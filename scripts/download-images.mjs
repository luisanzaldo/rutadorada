import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import sharp from 'sharp';

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

    // Solo procesa si la imagen existe
    if (image) {
      const slug = file.replace(/\.(md|mdx)$/, '');
      const newImagePath = `/images/posts/${slug}.jpg`;
      const localImagePath = path.join(imagesDir, `${slug}.jpg`);
      const mobileImagePath = path.join(imagesDir, `${slug}-mobile.jpg`);

      try {
        let mobileNeedsCreation = false;
        let desktopNeedsCreation = false;

        try {
          await fs.access(localImagePath);
        } catch {
          desktopNeedsCreation = true;
        }

        try {
          await fs.access(mobileImagePath);
        } catch {
          mobileNeedsCreation = true;
        }

        // Si falta alguna versión...
        if (desktopNeedsCreation || mobileNeedsCreation) {
          let buffer;

          // 1. Obtener el buffer (de URL externa o de archivo local si existe)
          if (image.startsWith('http')) {
            console.log(`📥 Descargando imagen para: ${slug}...`);
            const response = await fetch(image);
            if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
            buffer = Buffer.from(await response.arrayBuffer());
          } else if (image.startsWith('/')) {
            // Si la imagen es local (como en / o /images/posts/), la usamos de base
            try {
              buffer = await fs.readFile(path.join(process.cwd(), 'public', image));
            } catch (e) {
              console.log(`⏭️  No se pudo leer imagen local ruta ${image} para ${slug}: ${e.message}`);
              continue;
            }
          } else {
            continue; // Otro tipo de imagen no soportada
          }

          // 2. Generar versión Escritorio si falta
          if (desktopNeedsCreation) {
            await sharp(buffer)
              .resize(1280, 720, { fit: 'cover', withoutEnlargement: true })
              .jpeg({ quality: 85, mozjpeg: true })
              .toFile(localImagePath);
          }

          // 3. Generar versión Móvil si falta
          if (mobileNeedsCreation) {
            console.log(`📱 Generando versión móvil para: ${slug}...`);
            await sharp(buffer)
              .resize(600, 338, { fit: 'cover', withoutEnlargement: true })
              .jpeg({ quality: 85, mozjpeg: true })
              .toFile(mobileImagePath);
          }
          
          downloadedCount++;
        } else {
          skippedCount++;
        }

        // Actualizamos el string usando regex para preservar todo el frontmatter
        if (image.startsWith('http') || (image.startsWith('/') && !image.startsWith('/images/posts/'))) {
            const escapedUrl = image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(image:\\s*["']?)${escapedUrl}(["']?)`, 'g');
            
            if (regex.test(content)) {
                const newContent = content.replace(regex, `$1${newImagePath}$2`);
                await fs.writeFile(filePath, newContent, 'utf-8');
            }
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
