import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import sharp from 'sharp';
import fetch from 'node-fetch';

const postsDir = path.join(process.cwd(), 'src/content/posts');
const imagesDir = path.join(process.cwd(), 'public/images/posts');

async function processPosts() {
  await fs.mkdir(imagesDir, { recursive: true });

  const files = await fs.readdir(postsDir);
  const markdownFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.mdx'));

  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const file of markdownFiles) {
    const filePath = path.join(postsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(content);

    const { image } = parsed.data;

    // Solo procesa si la imagen existe y es una URL externa (http o https)
    if (image && image.startsWith('http')) {
      const slug = file.replace(/\.(md|mdx)$/, '');
      const newImagePath = `/images/posts/${slug}.webp`;
      const localImagePath = path.join(imagesDir, `${slug}.webp`);

      try {
        let fileExists = false;
        try {
          await fs.access(localImagePath);
          fileExists = true;
        } catch {
          // Archivo no existe, se procederá a descarga
        }

        if (fileExists) {
          skippedCount++;
        } else {
          console.log(`📥 Descargando imagen para: ${slug}...`);
          const response = await fetch(image);
          if (!response.ok) {
            throw new Error(`HTTP Status ${response.status}: no se pudo descargar la imagen.`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          await sharp(buffer)
            .resize(1280, 720, { fit: 'cover', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(localImagePath);
          
          downloadedCount++;
        }

        // Actualizamos el string usando regex para preservar todo el frontmatter y evitar reescritura
        const escapedUrl = image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(image:\\s*["']?)${escapedUrl}(["']?)`, 'g');
        
        if (regex.test(content)) {
          const newContent = content.replace(regex, `$1${newImagePath}$2`);
          await fs.writeFile(filePath, newContent, 'utf-8');
        }

      } catch (error) {
        console.error(`❌ Error procesando la imagen de "${slug}":`, error.message);
        failedCount++;
      }
    }
  }

  console.log('\n--- 🖼️  Resumen de Optimizador de Imágenes ---');
  console.log(`✅ Transformadas y descargas:\t${downloadedCount}`);
  console.log(`⏭️  Saltadas (Ya existen):\t${skippedCount}`);
  console.log(`❌ Fallidas:\t\t\t${failedCount}\n`);
}

processPosts().catch(console.error);
