import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

import mdx from '@astrojs/mdx';

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

  integrations: [mdx()],

  security: {
    checkOrigin: false
  }
});