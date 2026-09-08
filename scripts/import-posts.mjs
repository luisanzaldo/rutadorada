/**
 * Importa las notas de src/content/posts a la tabla public.posts de Supabase.
 *
 *   node scripts/import-posts.mjs                    → simulacro, no escribe nada
 *   node scripts/import-posts.mjs --commit           → inserta y actualiza
 *   node scripts/import-posts.mjs --commit --prune   → además borra las huérfanas
 *
 * El upsert por sí solo nunca elimina: una nota borrada de git sobrevive para
 * siempre en la base. --prune cierra ese hueco borrando las filas cuyo slug ya
 * no existe en src/content/posts. Va aparte y no por defecto porque borrar es
 * la única operación de este script que no se puede deshacer.
 *
 * El simulacro valida cada nota contra las restricciones de la tabla y reporta
 * lo que encontraría, para que ningún problema de datos aparezca a mitad de una
 * escritura. Es idempotente: usa upsert sobre el slug, así que volver a correrlo
 * actualiza en vez de duplicar.
 */
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const COMMIT = process.argv.includes('--commit');
const PRUNE  = process.argv.includes('--prune');
const DIR = path.join(process.cwd(), 'src/content/posts');

// --- credenciales ---------------------------------------------------------
const env = {};
for (const line of (await fs.readFile('.env', 'utf-8')).split('\n')) {
  const i = line.indexOf('=');
  if (i < 1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// --- conversión de MDX ----------------------------------------------------
// Tres notas usan <YouTube id="..." />. Se sustituye por el mismo iframe que
// genera el componente, que es además lo que produce el editor tiptap.
function mdxToHtml(body) {
  return body
    .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/<YouTube\s+id=["']([^"']+)["']\s*\/>/g, (_, id) =>
      `<div class="relative w-full aspect-video my-8">\n` +
      `    <iframe src="https://www.youtube.com/embed/${id}" title="YouTube video" ` +
      `frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; ` +
      `gyroscope; picture-in-picture" allowfullscreen class="w-full h-full rounded-xl"></iframe>\n` +
      `</div>`)
    .trim();
}

// --- lectura y mapeo ------------------------------------------------------
const files = (await fs.readdir(DIR)).filter(f => /\.mdx?$/.test(f)).sort();
const rows = [];
const problemas = [];
const avisos = [];

for (const file of files) {
  const slug = file.replace(/\.mdx?$/, '');
  const raw = await fs.readFile(path.join(DIR, file), 'utf-8');
  const { data: fm, content } = matter(raw);

  const body = file.endsWith('.mdx') ? mdxToHtml(content) : content.trim();
  const img = (fm.image || '').trim();
  const vacio = v => v === undefined || v === null || v === '' ? null : v;

  const row = {
    slug,
    status: 'published',
    title: fm.title,
    description: fm.description,
    body,
    pub_date: fm.pubDate instanceof Date ? fm.pubDate.toISOString() : fm.pubDate,
    author: fm.author,
    author_image: vacio(fm.authorImage),
    category: fm.category,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    read_time: vacio(fm.readTime),
    featured: fm.featured === true,
    rating: fm.rating ?? null,
    letterboxd: vacio(fm.letterboxd),
    video_url: vacio(fm.videoUrl),
    image_url: img,
    image_credit: null,
    // Si la imagen sigue siendo remota, esa URL es su procedencia. Si ya es local,
    // el prebuild la reescribió en su día y el origen se perdió.
    image_source: img.startsWith('http') ? img : null,
    ficha_tecnica: fm.fichaTecnica ?? null,
    fuente: fm.fuente ?? null,
  };

  // Validación contra las restricciones reales de la tabla. description es
  // NOT NULL pero admite cadena vacía, y 9 tráilers la tienen así: se importan
  // tal cual, porque una migración no debe inventar contenido. Se reportan
  // aparte para que la falta se pueda corregir editorialmente más adelante.
  for (const campo of ['slug', 'title', 'pub_date', 'author', 'category', 'image_url']) {
    if (!row[campo]) problemas.push(`${slug}: falta ${campo}`);
  }
  if (row.description === undefined || row.description === null) {
    problemas.push(`${slug}: description ausente (debe existir, aunque sea vacía)`);
  } else if (row.description === '') {
    avisos.push(slug);
  }
  if (row.rating !== null && (row.rating < 0 || row.rating > 100)) {
    problemas.push(`${slug}: rating fuera de rango (${row.rating})`);
  }
  if (row.pub_date && isNaN(Date.parse(row.pub_date))) {
    problemas.push(`${slug}: pub_date no parseable (${row.pub_date})`);
  }
  rows.push(row);
}

// slugs duplicados
const vistos = new Set();
for (const r of rows) {
  if (vistos.has(r.slug)) problemas.push(`slug duplicado: ${r.slug}`);
  vistos.add(r.slug);
}

// --- huérfanas: en la base pero ya no en git -------------------------------
const slugsGit = new Set(rows.map(r => r.slug));
let huerfanas = [];
{
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=slug`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (res.ok) huerfanas = (await res.json()).map(x => x.slug).filter(s => !slugsGit.has(s));
}

// --- informe --------------------------------------------------------------
console.log(`\nNotas leídas: ${rows.length}`);
console.log(`  con cuerpo vacío:      ${rows.filter(r => !r.body).length}`);
console.log(`  con imagen remota:     ${rows.filter(r => r.image_source).length}`);
console.log(`  con ficha técnica:     ${rows.filter(r => r.ficha_tecnica).length}`);
console.log(`  con fuente:            ${rows.filter(r => r.fuente).length}`);
console.log(`  con video:             ${rows.filter(r => r.video_url).length}`);
const porCat = {};
for (const r of rows) porCat[r.category] = (porCat[r.category] || 0) + 1;
console.log('  por categoría:         ' + Object.entries(porCat).map(([k, v]) => `${k}=${v}`).join(', '));

if (huerfanas.length) {
  console.log(`\nHuérfanas en la base, ya no están en git (${huerfanas.length}):`);
  huerfanas.forEach(h => console.log('    - ' + h));
  console.log(PRUNE ? '  → se borrarán (--prune)' : '  → se conservan; usa --prune para borrarlas');
}

if (avisos.length) {
  console.log(`\nAvisos, no bloquean la importación (${avisos.length}):`);
  console.log(`  notas con description vacía — se importan así, pero convendría`);
  console.log(`  redactarlas: sin ella no hay meta description para buscadores.`);
  avisos.slice(0, 5).forEach(a => console.log('    ' + a));
  if (avisos.length > 5) console.log(`    … y ${avisos.length - 5} más`);
}

if (problemas.length) {
  console.log(`\nPROBLEMAS (${problemas.length}):`);
  problemas.slice(0, 20).forEach(p => console.log('  ' + p));
  if (problemas.length > 20) console.log(`  … y ${problemas.length - 20} más`);
} else {
  console.log('\nSin problemas de validación.');
}

const mdx = files.filter(f => f.endsWith('.mdx'));
if (mdx.length) {
  console.log(`\nConvertidas de MDX (${mdx.length}):`);
  for (const f of mdx) {
    const r = rows.find(x => x.slug === f.replace(/\.mdx?$/, ''));
    const iframes = (r.body.match(/<iframe/g) || []).length;
    const restos = (r.body.match(/<[A-Z]/g) || []).length;
    console.log(`  ${f}  → ${iframes} iframes, ${restos} componentes sin convertir`);
  }
}

if (!COMMIT) {
  console.log('\nSIMULACRO — no se escribió nada. Usa --commit para importar.\n');
  process.exit(problemas.length ? 1 : 0);
}
if (problemas.length) {
  console.log('\nAbortado: hay problemas sin resolver.\n');
  process.exit(1);
}

// --- escritura ------------------------------------------------------------
console.log('\nImportando…');
const LOTE = 50;
let escritas = 0;
for (let i = 0; i < rows.length; i += LOTE) {
  const lote = rows.slice(i, i + LOTE);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?on_conflict=slug`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(lote),
  });
  if (!res.ok) {
    console.error(`  lote ${i / LOTE + 1} falló: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  escritas += lote.length;
  console.log(`  ${escritas}/${rows.length}`);
}
if (PRUNE && huerfanas.length) {
  console.log(`\nBorrando ${huerfanas.length} huérfanas…`);
  for (const slug of huerfanas) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
    });
    console.log(`  ${res.ok ? 'borrada' : 'FALLÓ (' + res.status + ')'}: ${slug}`);
    if (!res.ok) process.exit(1);
  }
}

console.log('\nListo.\n');
