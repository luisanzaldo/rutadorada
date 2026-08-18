import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

import mdx from '@astrojs/mdx';

/**
 * Los enlaces que se agregan desde el editor del panel admin se guardan en el
 * Markdown del post como [texto](url), formato que no admite atributos. Este
 * plugin los marca al renderizar para que abran en una pestaña nueva; los
 * enlaces internos (relativos) y las anclas (#seccion) se quedan como están.
 */
function rehypeExternalLinksInNewTab() {
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

export default defineConfig({
  site: 'https://www.rutadoradafilms.com',
  output: 'static',
  adapter: vercel(),

  vite: {
    plugins: [tailwindcss()],
    build: {
      modulePreload: false
    }
  },

  markdown: {
    rehypePlugins: [rehypeExternalLinksInNewTab]
  },

  integrations: [mdx()]
});