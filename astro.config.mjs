import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import remarkOembed from 'remark-oembed';

export default defineConfig({
  site: 'https://www.rutadoradafilms.com',
  markdown: {
    remarkPlugins: [remarkOembed],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});