import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

import mdx from '@astrojs/mdx';

// El plugin vive en src/lib para que el renderizado en runtime use el mismo.
import { rehypeExternalLinksInNewTab } from './src/lib/markdown-plugins.mjs';

export default defineConfig({
  site: 'https://www.rutadoradafilms.com',
  output: 'static',
  adapter: cloudflare(),

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