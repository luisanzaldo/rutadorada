/**
 * Plugins del pipeline de markdown, en un solo sitio.
 *
 * Los usan dos consumidores que deben coincidir exactamente: `astro.config.mjs`,
 * que renderiza en el build, y `src/lib/render.ts`, que renderizará en runtime
 * cuando el sitio lea de la base. Si divergen, el mismo texto se pinta distinto
 * según de dónde venga, y eso es muy difícil de ver revisando.
 */

/**
 * Los enlaces que se agregan desde el editor del panel admin se guardan en el
 * Markdown del post como [texto](url), formato que no admite atributos. Este
 * plugin los marca al renderizar para que abran en una pestaña nueva; los
 * enlaces internos (relativos) y las anclas (#seccion) se quedan como están.
 */
export function rehypeExternalLinksInNewTab() {
  const isExternal = (href) => typeof href === 'string' && /^(https?:)?\/\//i.test(href.trim());

  const visit = (node) => {
    if (node.type === 'element' && node.tagName === 'a' && isExternal(node.properties?.href)) {
      node.properties.target = '_blank';
      node.properties.rel = 'noopener noreferrer';
    }
    node.children?.forEach(visit);
  };

  return (tree) => visit(tree);
}
