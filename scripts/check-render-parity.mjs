#!/usr/bin/env node
/**
 * Fase 5 — comprueba que renderizar en runtime da el mismo HTML que el build.
 *
 * Cuando el sitio lea de la base ya no habrá archivo que renderizar al
 * construir: el markdown se convertirá al servir. Esto contrasta, nota a nota,
 * el HTML que produce src/lib/render.ts contra el que Astro dejó en dist/,
 * extrayéndolo del contenedor .prose de cada página.
 *
 * Es la red que impide que el paso 3 cambie en silencio cómo se ve una nota.
 * 53 de ellas llevan HTML crudo dentro —cajas con clases de Tailwind, SVGs,
 * iframes— y ahí un pipeline distinto se nota enseguida.
 *
 * Requiere un dist/ reciente:
 *
 *   npm run build && node scripts/check-render-parity.mjs
 *   node scripts/check-render-parity.mjs <slug> [slug...]   # solo algunas
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { createMarkdownProcessor, rehypeHeadingIds } from '@astrojs/markdown-remark';
import { rehypeExternalLinksInNewTab } from '../src/lib/markdown-plugins.mjs';

const proc = await createMarkdownProcessor({
  rehypePlugins: [rehypeHeadingIds, rehypeExternalLinksInNewTab],
});

// Se extrae el HTML que Astro generó en el build, dentro del div .prose.
function extraerDeDist(html) {
  const i = html.indexOf('class="prose prose-lg');
  if (i === -1) return null;
  const ini = html.indexOf('>', i) + 1;
  // Se recorre contando divs hasta cerrar el contenedor.
  let prof = 1, j = ini;
  const re = /<(\/?)div\b/g;
  re.lastIndex = ini;
  let m;
  while ((m = re.exec(html))) {
    prof += m[1] ? -1 : 1;
    if (prof === 0) { j = m.index; break; }
  }
  return html.slice(ini, j).trim();
}

const slugs = process.argv.length > 2
  ? process.argv.slice(2)
  : (await fs.readdir('src/content/posts')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
let iguales = 0, distintos = 0;

for (const slug of slugs) {
  const md = await fs.readFile(path.join('src/content/posts', `${slug}.md`), 'utf-8').catch(() => null);
  if (!md) { console.log(`  ? ${slug}: no es .md`); continue; }
  const { content } = matter(md);

  const dist = await fs.readFile(path.join('dist/posts', slug, 'index.html'), 'utf-8').catch(() => null);
  if (!dist) { console.log(`  ? ${slug}: sin build`); continue; }

  const esperado = extraerDeDist(dist);
  const { code } = await proc.render(content.trim());
  const obtenido = code.trim();

  if (esperado === obtenido) { iguales++; console.log(`  ✓ ${slug.slice(0, 58)}`); }
  else {
    distintos++;
    console.log(`  ✗ ${slug.slice(0, 58)}`);
    // Primer punto de divergencia, para saber qué mirar.
    let k = 0; while (k < Math.min(esperado.length, obtenido.length) && esperado[k] === obtenido[k]) k++;
    console.log(`      divergen en el carácter ${k} de ${esperado.length}/${obtenido.length}`);
    console.log(`      astro:  …${JSON.stringify(esperado.slice(Math.max(0, k - 40), k + 60))}`);
    console.log(`      runtime:…${JSON.stringify(obtenido.slice(Math.max(0, k - 40), k + 60))}`);
  }
}
console.log(`\n  idénticos: ${iguales} · distintos: ${distintos}`);
process.exit(distintos ? 1 : 0);
