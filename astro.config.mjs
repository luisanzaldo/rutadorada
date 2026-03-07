import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import remarkEmbedder from '@remark-embedder/core';
import oembedTransformer from '@remark-embedder/transformer-oembed';

export default defineConfig({
  site: 'https://www.rutadoradafilms.com',
  markdown: {
    remarkPlugins: [
      [remarkEmbedder, { transformers: [oembedTransformer] }]
    ],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});