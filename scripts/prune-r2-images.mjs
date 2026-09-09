#!/usr/bin/env node
/**
 * Fase 4 — borra de R2 las imágenes que ya no referencia ninguna nota.
 *
 * Borrar una nota no borra su portada: ni el endpoint de borrado ni el CI tocan
 * el bucket. Sin esto las imágenes de notas eliminadas se quedan para siempre.
 * No es urgente por espacio —a 274 KB por nota harían falta décadas para que
 * importara— pero es suciedad que se acumula.
 *
 * Va aparte y no dentro del borrado de notas por dos razones:
 *
 *   1. Borrar en R2 es irreversible.
 *   2. Los hashes se COMPARTEN. Dos notas distintas que usan la misma imagen
 *      tienen el mismo hash, así que borrar al eliminar una dejaría a la otra
 *      sin portada. Ya hay dos casos así en el contenido actual.
 *
 * Las referencias se cruzan contra git Y contra Supabase, porque los borradores
 * y los programados viven solo en la base: mirar únicamente git borraría la
 * portada de un borrador sin publicar.
 *
 *   node scripts/prune-r2-images.mjs                  # simulacro
 *   node scripts/prune-r2-images.mjs --apply          # borra
 *   node scripts/prune-r2-images.mjs --min-dias 60    # más margen (por defecto 30)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const BUCKET = 'rutadorada-images';
const HOST = 'img.rutadoradafilms.com';

const APPLY = process.argv.includes('--apply');
const MIN_DIAS = Number(
  process.argv[process.argv.indexOf('--min-dias') + 1] ?? 30,
);

// --- credenciales ---------------------------------------------------------
const env = {};
for (const line of (await fs.readFile('.env', 'utf-8')).split('\n')) {
  const i = line.indexOf('=');
  if (i < 1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const FALTAN = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
  .filter((k) => !env[k]);
if (FALTAN.length) {
  console.error(`Faltan en .env: ${FALTAN.join(', ')}`);
  console.error('Se crean en dash.cloudflare.com → R2 → API → Manage API tokens.');
  process.exit(1);
}

const s3 = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});
const ENDPOINT = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}`;

/** `<hash>-sm.webp` → `<hash>`. Devuelve null si no encaja con nuestro esquema. */
/** `<hash>-sm.webp` y `body/<hash>.png` → `<hash>`. Null para lo ajeno al esquema. */
const hashDeClave = (clave) =>
  clave.match(/^(?:body\/)?([0-9a-f]{16})(?:-sm|-og)?\.(?:jpg|png|webp)$/)?.[1] ?? null;

/** Extrae el hash de una URL de R2. Ignora rutas locales y de terceros. */
function hashDeUrl(valor) {
  if (typeof valor !== 'string') return null;
  try {
    const u = new URL(valor);
    if (u.hostname !== HOST) return null;
    return hashDeClave(u.pathname.slice(1));
  } catch {
    return null;
  }
}

/**
 * Toda URL de R2 que aparezca en un texto, venga del frontmatter o del cuerpo.
 *
 * Vive aquí y no dentro de hashesEnGit porque la base necesita exactamente la
 * misma lectura: si las dos fuentes no buscan lo mismo, la que busque de menos
 * da por huérfana una imagen que sí se usa. Ya pasó — el escaneo de Supabase
 * miraba solo image_url y se dejaba las imágenes incrustadas en el cuerpo.
 */
const RE_URL_R2 = new RegExp(
  `https://${HOST.replace(/\./g, '\\.')}/(?:body/)?[0-9a-f]{16}(?:-sm|-og)?\\.(?:jpg|png|webp)`,
  'g',
);

function hashesEnTexto(texto) {
  const encontrados = new Set();
  for (const m of String(texto ?? '').matchAll(RE_URL_R2)) {
    const h = hashDeUrl(m[0]);
    if (h) encontrados.add(h);
  }
  return encontrados;
}

// --- referencias en git ---------------------------------------------------
async function hashesEnGit() {
  const usados = new Set();
  const dirs = [POSTS_DIR, path.join(ROOT, 'drafts'), path.join(ROOT, 'scheduled')];

  for (const dir of dirs) {
    let archivos;
    try {
      archivos = (await fs.readdir(dir)).filter((f) => /\.mdx?$/.test(f));
    } catch {
      continue; // drafts/ y scheduled/ pueden no existir
    }
    for (const f of archivos) {
      const texto = await fs.readFile(path.join(dir, f), 'utf-8');
      // Se escanea el archivo ENTERO, no solo el frontmatter: varias notas
      // incrustan imágenes dentro del texto, y mirar solo `image:` las daría
      // por huérfanas y las borraría.
      for (const h of hashesEnTexto(texto)) usados.add(h);
    }
  }
  return usados;
}

// --- referencias en Supabase ---------------------------------------------
async function hashesEnSupabase() {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('⚠️  Sin credenciales de Supabase: no se comprueban borradores.');
    console.warn('    Se aborta para no borrar la portada de un borrador.');
    process.exit(1);
  }

  const usados = new Set();
  // El cuerpo va en el select, no solo la portada: una nota que viva unicamente
  // en la base —un borrador— puede llevar imagenes incrustadas en su texto, y
  // sin leerlas se darian por huerfanas y se borrarian. Es el mismo escaneo del
  // archivo entero que hace hashesEnGit, sobre el texto que guarda la fila.
  const res = await fetch(`${url}/rest/v1/posts?select=image_url,body,status`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);

  for (const fila of await res.json()) {
    const h = hashDeUrl(fila.image_url);
    if (h) usados.add(h);
    for (const hb of hashesEnTexto(fila.body)) usados.add(hb);
  }
  return usados;
}

// --- inventario del bucket ------------------------------------------------
async function objetosDelBucket() {
  const objetos = [];
  let token;

  do {
    const u = new URL(ENDPOINT);
    u.searchParams.set('list-type', '2');
    u.searchParams.set('max-keys', '1000');
    if (token) u.searchParams.set('continuation-token', token);

    const res = await s3.fetch(u.toString());
    if (!res.ok) throw new Error(`R2 list ${res.status}: ${await res.text()}`);
    const xml = await res.text();

    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const clave = m[1].match(/<Key>([^<]+)<\/Key>/)?.[1];
      const fecha = m[1].match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
      const bytes = Number(m[1].match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
      if (clave) objetos.push({ clave, fecha: new Date(fecha), bytes });
    }

    token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
  } while (token);

  return objetos;
}

async function borrar(clave) {
  const res = await s3.fetch(`${ENDPOINT}/${clave}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`${res.status} ${await res.text()}`);
}

// --- main -----------------------------------------------------------------
const [enGit, enBase, objetos] = await Promise.all([
  hashesEnGit(),
  hashesEnSupabase(),
  objetosDelBucket(),
]);

const referenciados = new Set([...enGit, ...enBase]);
const corte = Date.now() - MIN_DIAS * 24 * 60 * 60 * 1000;

const desconocidos = [];
const huerfanos = [];
const jovenes = [];

for (const o of objetos) {
  const h = hashDeClave(o.clave);
  if (!h) {
    desconocidos.push(o);
    continue;
  }
  if (referenciados.has(h)) continue;
  (o.fecha.getTime() > corte ? jovenes : huerfanos).push(o);
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);

console.log(APPLY ? '--- recolección aplicada ---' : '--- SIMULACRO, no se borra nada ---');
console.log(`objetos en el bucket:    ${objetos.length} (${mb(objetos.reduce((a, o) => a + o.bytes, 0))} MB)`);
console.log(`hashes referenciados:    ${referenciados.size}  (git ${enGit.size} · base ${enBase.size})`);
console.log(`huérfanos borrables:     ${huerfanos.length} (${mb(huerfanos.reduce((a, o) => a + o.bytes, 0))} MB)`);
console.log(`huérfanos aún jóvenes:   ${jovenes.length}  — menos de ${MIN_DIAS} días, se respetan`);

if (desconocidos.length) {
  console.log(`\n⚠️  ${desconocidos.length} objetos con nombre ajeno al esquema. NO se tocan:`);
  for (const o of desconocidos.slice(0, 10)) console.log(`   ${o.clave}`);
}

if (!huerfanos.length) {
  console.log('\nNada que recolectar.');
} else if (!APPLY) {
  console.log('\nSe borrarían:');
  for (const o of huerfanos) console.log(`   ${o.clave}  (${mb(o.bytes)} MB, ${o.fecha.toISOString().slice(0, 10)})`);
  console.log('\nRepite con --apply para borrar.');
} else {
  let n = 0;
  for (const o of huerfanos) {
    await borrar(o.clave);
    console.log(`   borrado ${o.clave}`);
    n++;
  }
  console.log(`\nborrados: ${n}`);
}
