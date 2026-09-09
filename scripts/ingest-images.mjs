#!/usr/bin/env node
/**
 * Lleva a R2 las imágenes de las notas que todavía no están ahí.
 *
 * Sustituye a scripts/download-images.mjs, que descargaba las imágenes al
 * repositorio en CADA build. Este corre una vez por publicación: la imagen se
 * baja una sola vez en su vida, se convierte, se sube a R2 y el frontmatter
 * queda apuntando a su URL por hash del contenido.
 *
 * Cubre todas las formas de colocar una imagen sin tocar quien las coloca:
 *
 *   · el bot con la URL del medio, incluida la que resuelve al escribir «omitir»
 *   · el CMS subiendo un archivo, que llega a git como /images/posts/…
 *   · el CMS pegando una URL
 *   · las imágenes incrustadas a mano en el cuerpo de una nota
 *
 * Es el mismo patrón que la fase 3 usó para reconciliar Supabase: el trabajo se
 * hace en el CI y ni el bot ni el CMS se enteran.
 *
 * INCREMENTAL: una nota cuya imagen ya es de R2 no se toca. En un despliegue
 * normal no procesa ninguna y termina en menos de un segundo.
 *
 * TOLERANTE: si un medio ha caído, esa nota se salta con su URL remota intacta
 * y el despliegue continúa. Un origen muerto no puede tumbar una publicación.
 *
 *   node scripts/ingest-images.mjs            # procesa lo que falte
 *   node scripts/ingest-images.mjs --dry-run  # dice qué haría
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const PUBLIC_DIR = path.join(ROOT, 'public');
const BUCKET = 'rutadorada-images';
const R2_HOST = 'img.rutadoradafilms.com';
const HOST = `https://${R2_HOST}`;
const CACHE = 'public, max-age=31536000, immutable';

const DRY = process.argv.includes('--dry-run');

// Varios medios devuelven 403 a un cliente sin User-Agent. Es la misma lección
// que dejó la API de GitHub al migrar a Workers en la fase 1.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

/**
 * La extensión va SIEMPRE en la clave, nunca negociada por `Accept`: en el plan
 * gratuito el borde de Cloudflare ignora `Vary` y le serviría a todo el mundo el
 * primer formato que cacheó. `-og` no lleva withoutEnlargement porque la tarjeta
 * social debe medir 1200x630 exactos, que es lo que declara Layout.astro.
 */
const VARIANTES = [
  { sufijo: '', w: 1280, h: 720, fmt: 'jpeg' },
  { sufijo: '', w: 1280, h: 720, fmt: 'webp' },
  { sufijo: '-sm', w: 600, h: 338, fmt: 'jpeg' },
  { sufijo: '-sm', w: 600, h: 338, fmt: 'webp' },
  { sufijo: '-og', w: 1200, h: 630, fmt: 'jpeg', agrandar: true },
];

const EXT_FMT = { jpeg: 'jpg', webp: 'webp' };
const TIPO_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const RE_LOCAL = /\/images\/posts\/[a-zA-Z0-9._-]+/g;

const hashDe = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const esDeR2 = (v) => typeof v === 'string' && v.startsWith(`${HOST}/`);

let TMP;

function subir(clave, archivo, tipo) {
  if (DRY) return Promise.resolve();
  const args = [
    '--yes', 'wrangler@4', 'r2', 'object', 'put', `${BUCKET}/${clave}`,
    '--file', archivo, '--content-type', tipo, '--cache-control', CACHE, '--remote',
  ];
  return new Promise((res, rej) => {
    const p = spawn('npx', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(err.trim().split('\n').slice(-2).join(' | ')))));
  });
}

async function bytesDe(valor) {
  if (valor.startsWith('http')) {
    const res = await fetch(valor, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.byteLength) throw new Error('el origen devolvió 0 bytes');
    return buf;
  }
  if (valor.startsWith('/')) return fs.readFile(path.join(PUBLIC_DIR, valor));
  throw new Error(`ruta no soportada: ${valor}`);
}

/** Portada: cinco variantes derivadas del hash del original. */
async function ingerirPortada(valor) {
  const bytes = await bytesDe(valor);
  const hash = hashDe(bytes);

  for (const v of VARIANTES) {
    const clave = `${hash}${v.sufijo}.${EXT_FMT[v.fmt]}`;
    const destino = path.join(TMP, clave);
    const tuberia = sharp(bytes).resize(v.w, v.h, { fit: 'cover', withoutEnlargement: !v.agrandar });
    const salida = v.fmt === 'webp' ? tuberia.webp({ quality: 82 }) : tuberia.jpeg({ quality: 85, mozjpeg: true });
    await fs.writeFile(destino, await salida.toBuffer());
    await subir(clave, destino, v.fmt === 'webp' ? 'image/webp' : 'image/jpeg');
  }

  return `${HOST}/${hash}.jpg`;
}

/**
 * Cuerpo: el original tal cual, sin variantes. No hay srcset que alimentar.
 *
 * Va bajo el prefijo `body/` para no compartir espacio de nombres con las
 * portadas. Si una imagen se usa a la vez como portada y dentro del texto, las
 * dos tienen el mismo hash del contenido, y sin el prefijo el original del
 * cuerpo sobrescribía la variante redimensionada de la portada. Pasó con
 * e5962a8b38626ef6 al migrar.
 */
async function ingerirDelCuerpo(ruta) {
  const ext = path.extname(ruta).toLowerCase();
  const tipo = TIPO_EXT[ext];
  if (!tipo) throw new Error(`formato no soportado: ${ext}`);

  const bytes = await bytesDe(ruta);
  const clave = `body/${hashDe(bytes)}${ext}`;
  const destino = path.join(TMP, clave.replace('/', '_'));
  await fs.writeFile(destino, bytes);
  await subir(clave, destino, tipo);
  return `${HOST}/${clave}`;
}

function limitesFrontmatter(lineas) {
  if (lineas[0]?.trim() !== '---') return null;
  const fin = lineas.indexOf('---', 1);
  return fin === -1 ? null : [1, fin];
}

// --- main -----------------------------------------------------------------
TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'ingest-imgs-'));

const archivos = (await fs.readdir(POSTS_DIR)).filter((f) => /\.mdx?$/.test(f)).sort();
const fallos = [];
let portadas = 0;
let cuerpos = 0;
let notas = 0;

for (const archivo of archivos) {
  const ruta = path.join(POSTS_DIR, archivo);
  const texto = await fs.readFile(ruta, 'utf-8');
  const lineas = texto.split('\n');
  const limites = limitesFrontmatter(lineas);
  if (!limites) continue;

  const [ini, fin] = limites;
  const iImagen = lineas.findIndex((l, i) => i >= ini && i < fin && /^image:\s/.test(l));
  const valor = iImagen === -1
    ? null
    : lineas[iImagen].replace(/^image:\s*/, '').trim().replace(/^["']|["']$/g, '');

  const localesEnCuerpo = [...new Set(texto.match(RE_LOCAL) ?? [])];
  const necesitaPortada = valor && !esDeR2(valor);

  if (!necesitaPortada && !localesEnCuerpo.length) continue;

  let cambiado = false;
  let nuevoTexto = null;

  if (necesitaPortada) {
    try {
      const nueva = await ingerirPortada(valor);
      lineas[iImagen] = `image: "${nueva}"`;

      // Si venía de un medio ajeno, esa URL es su procedencia y hay que
      // guardarla: a partir de ahora la URL de la imagen es de R2 y ya no
      // delata de dónde salió.
      const yaTiene = lineas.some((l, i) => i >= ini && i < fin && /^imageSource:\s/.test(l));
      if (valor.startsWith('http') && !yaTiene) {
        lineas.splice(iImagen + 1, 0, `imageSource: "${valor}"`);
      }

      portadas++;
      cambiado = true;
      console.log(`  ✓ ${archivo}\n      portada → ${nueva}`);
    } catch (e) {
      fallos.push({ archivo, valor, error: e.message });
      console.log(`  ⚠️  ${archivo}: portada no ingerida (${e.message}); se deja como está`);
    }
  }

  nuevoTexto = lineas.join('\n');

  for (const local of localesEnCuerpo) {
    try {
      const nueva = await ingerirDelCuerpo(local);
      nuevoTexto = nuevoTexto.split(local).join(nueva);
      cuerpos++;
      cambiado = true;
      console.log(`      cuerpo → ${nueva}`);
    } catch (e) {
      fallos.push({ archivo, valor: local, error: e.message });
      console.log(`  ⚠️  ${archivo}: imagen del cuerpo no ingerida (${e.message})`);
    }
  }

  if (cambiado && !DRY) {
    await fs.writeFile(ruta, nuevoTexto, 'utf-8');
    notas++;
  } else if (cambiado) {
    notas++;
  }
}

await fs.rm(TMP, { recursive: true, force: true });

console.log(DRY ? '\n--- SIMULACRO ---' : '\n--- ingesta ---');
console.log(`notas modificadas: ${notas}`);
console.log(`portadas a R2:     ${portadas}`);
console.log(`imágenes de cuerpo:${cuerpos}`);

if (fallos.length) {
  console.log(`\n⚠️  ${fallos.length} imágenes no ingeridas. Las notas conservan su URL original:`);
  for (const f of fallos) console.log(`   ${f.archivo}\n     ${f.error} · ${f.valor}`);
  console.log('\nNo es un fallo del despliegue: se reintenta en la siguiente publicación.');
}

// Nunca se rompe el build por una imagen. Un origen caído no puede impedir que
// se publique una nota.
process.exit(0);
