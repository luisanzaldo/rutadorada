import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.rutadoradafilms.com',
  markdown: {
    remarkPlugins: [
      async () => {
        const { default: remarkEmbedder } = await import('@remark-embedder/core');
        const { default: oembedTransformer } = await import('@remark-embedder/transformer-oembed');
        return remarkEmbedder.default({ transformers: [oembedTransformer] });
      }
    ],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});