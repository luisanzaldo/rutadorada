#!/usr/bin/env node
/**
 * Fase 5 — contrasta lo que diría la base contra lo que dicen los markdown.
 *
 * El paso 3 cambia la lectura del sitio de los archivos a Supabase. Esto
 * comprueba, campo a campo y nota a nota, que ese cambio no altera nada de lo
 * que ve un lector. Se ejecuta ANTES de cambiar la lectura, no después: si algo
 * no cuadra, tiene que verse aquí y no en producción.
 *
 * Reutiliza `filaAEntrada` de src/lib/posts.ts a propósito. Reimplementar el
 * mapeo aquí compararía el código consigo mismo y no probaría nada.
 *
 * Distingue tres resultados por campo:
 *
 *   · igual
 *   · diferencia blanda — los dos valores son vacíos de formas distintas
 *     ("" frente a ausente). No cambia lo que se pinta, pero conviene saberlo.
 *   · diferencia dura — valores realmente distintos. Bloquea el paso 3.
 *
 *   node scripts/check-parity.mjs
 *   node scripts/check-parity.mjs --verbose   # lista también las blandas
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const VERBOSE = process.argv.includes('--verbose');

// --- credenciales ---------------------------------------------------------
const env = {};
for (const line of (await fs.readFile('.env', 'utf-8')).split('\n')) {
  const i = line.indexOf('=');
  if (i < 1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

// --- se importa el mapeo real, no una copia -------------------------------
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'paridad-'));
const compilado = path.join(tmp, 'posts.mjs');
execFileSync('npx', ['esbuild', 'src/lib/posts.ts', '--format=esm', `--outfile=${compilado}`, '--log-level=error']);
// La completa, porque aquí sí se compara el cuerpo.
const { filaAEntradaCompleta } = await import(compilado);

// --- lo que dice la base --------------------------------------------------
const res = await fetch(`${env.PUBLIC_SUPABASE_URL}/rest/v1/posts?select=*&status=eq.published`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
const deLaBase = new Map((await res.json()).map((f) => [f.slug, filaAEntradaCompleta(f)]));

// --- lo que dicen los archivos --------------------------------------------
const vacio = (v) => v === undefined || v === null || v === '';
const norm = (v) => (vacio(v) ? undefined : v);

const archivos = (await fs.readdir(POSTS_DIR)).filter((f) => /\.mdx?$/.test(f)).sort();
const deGit = new Map();

for (const archivo of archivos) {
  const slug = archivo.replace(/\.mdx?$/, '');
  const { data: fm, content } = matter(await fs.readFile(path.join(POSTS_DIR, archivo), 'utf-8'));
  deGit.set(slug, {
    esMdx: archivo.endsWith('.mdx'),
    body: content.trim(),
    data: {
      title: fm.title,
      description: fm.description ?? '',
      pubDate: new Date(fm.pubDate),
      author: fm.author,
      authorImage: norm(fm.authorImage),
      image: fm.image,
      imageSource: norm(fm.imageSource),
      category: fm.category,
      readTime: norm(fm.readTime),
      featured: fm.featured ?? false,
      tags: fm.tags ?? [],
      rating: norm(fm.rating),
      letterboxd: norm(fm.letterboxd),
      videoUrl: norm(fm.videoUrl),
      fichaTecnica: norm(fm.fichaTecnica),
      fuente: norm(fm.fuente),
    },
  });
}

// --- comparación ----------------------------------------------------------
/**
 * PostgREST devuelve las claves de un jsonb en el orden en que Postgres las
 * guarda, que no es el del YAML. Comparar con JSON.stringify a secas marcaba
 * como distintas decenas de `fuente` idénticas, así que se ordenan las claves
 * antes de serializar.
 */
const estable = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x);

const iguales = (a, b) => {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  if (a && b && typeof a === 'object' && typeof b === 'object') return estable(a) === estable(b);
  return a === b;
};

const duras = [];
const blandas = [];
const soloGit = [];
const soloBase = [];
let mdxOmitidos = 0;

for (const [slug, git] of deGit) {
  const base = deLaBase.get(slug);
  if (!base) { soloGit.push(slug); continue; }

  for (const campo of Object.keys(git.data)) {
    const a = git.data[campo];
    const b = base.data[campo];
    if (iguales(a, b)) continue;
    (vacio(a) && vacio(b) ? blandas : duras).push({ slug, campo, git: a, base: b });
  }

  // El cuerpo de un .mdx se guarda convertido a HTML a propósito: la base no
  // guarda JSX. Comparar el original contra la conversión no diría nada.
  if (git.esMdx) { mdxOmitidos++; continue; }
  if (git.body !== base.body) {
    duras.push({ slug, campo: 'body', git: `${git.body.length} car.`, base: `${base.body.length} car.` });
  }
}

for (const slug of deLaBase.keys()) if (!deGit.has(slug)) soloBase.push(slug);

// --- informe --------------------------------------------------------------
const rec = (v) => (v === undefined ? '(ausente)' : JSON.stringify(v)?.slice(0, 60));

console.log('--- paridad git ↔ Supabase ---');
console.log(`notas en git:        ${deGit.size}`);
console.log(`notas en la base:    ${deLaBase.size}`);
console.log(`cuerpos .mdx omitidos: ${mdxOmitidos} (se guardan convertidos a HTML)`);
console.log(`diferencias duras:   ${duras.length}`);
console.log(`diferencias blandas: ${blandas.length}`);

if (soloGit.length) {
  console.log(`\n⚠️  ${soloGit.length} en git pero NO en la base — no se verían tras el paso 3:`);
  soloGit.forEach((s) => console.log(`   ${s}`));
}
if (soloBase.length) {
  console.log(`\n⚠️  ${soloBase.length} en la base pero NO en git — fantasmas, aparecerían tras el paso 3:`);
  soloBase.forEach((s) => console.log(`   ${s}`));
}
if (duras.length) {
  console.log('\n❌ diferencias duras:');
  for (const d of duras) console.log(`   ${d.slug} · ${d.campo}\n      git:  ${rec(d.git)}\n      base: ${rec(d.base)}`);
}
if (blandas.length) {
  const porCampo = {};
  for (const b of blandas) porCampo[b.campo] = (porCampo[b.campo] ?? 0) + 1;
  console.log('\n· diferencias blandas por campo: ' + Object.entries(porCampo).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log('  Son vacíos escritos de dos formas ("" frente a ausente). No cambian lo que se pinta.');
  if (VERBOSE) for (const b of blandas) console.log(`   ${b.slug} · ${b.campo}: git ${rec(b.git)} · base ${rec(b.base)}`);
}

await fs.rm(tmp, { recursive: true, force: true });

const bloquea = duras.length || soloGit.length || soloBase.length;
console.log(bloquea ? '\n❌ NO cambiar la lectura hasta resolver lo anterior.' : '\n✅ Paridad total. El paso 3 es seguro.');
process.exit(bloquea ? 1 : 0);
