/**
 * Renderizado de markdown en runtime.
 *
 * Hoy Astro renderiza las notas al construir, con `post.render()`. Cuando el
 * sitio lea de la base ya no habrá archivo que renderizar en el build, así que
 * hay que hacerlo al servir.
 *
 * Usa el procesador del propio Astro —`@astrojs/markdown-remark`, la misma
 * dependencia que usa internamente— con los mismos plugins, en vez de meter
 * otro parser. El motivo es que el HTML tiene que salir idéntico: comparado
 * contra el build actual nota a nota, las 195 en markdown coinciden byte a
 * byte, HTML crudo incluido.
 *
 * El HTML crudo se conserva a propósito: 53 notas lo llevan dentro —cajas con
 * clases de Tailwind, SVGs e iframes que genera el editor— y sanearlo las
 * rompería. Es contenido escrito por la redacción, no por lectores.
 */
import { createMarkdownProcessor, rehypeHeadingIds } from '@astrojs/markdown-remark';
import { rehypeExternalLinksInNewTab } from './markdown-plugins.mjs';

/** Lo que consume la tabla de contenidos de `PostSidebarRight`. */
export type Encabezado = { depth: number; slug: string; text: string };

export type NotaRenderizada = { html: string; encabezados: Encabezado[] };

/**
 * Construir el procesador es caro y no depende de la nota, así que se hace una
 * vez por isolate. Aquí sí es correcto guardarlo en el ámbito de módulo: es
 * configuración, no contenido, y no puede quedarse viejo.
 */
let procesador: Promise<Awaited<ReturnType<typeof createMarkdownProcessor>>> | null = null;

function obtenerProcesador() {
  procesador ??= createMarkdownProcessor({
    rehypePlugins: [rehypeHeadingIds, rehypeExternalLinksInNewTab],
  });
  return procesador;
}

export async function renderizarNota(markdown: string): Promise<NotaRenderizada> {
  const proc = await obtenerProcesador();
  const { code, metadata } = await proc.render(markdown);
  return { html: code, encabezados: (metadata?.headings ?? []) as Encabezado[] };
}
