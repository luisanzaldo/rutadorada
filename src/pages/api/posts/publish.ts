import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { upsertPost, slugDesdeRuta, type PostRow } from '../../../lib/postsDb';

export const prerender = false;

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD") // Descompone caracteres acentuados
    .replace(/[\u0300-\u036f]/g, "") // Elimina marcas diacríticas (acentos)
    .replace(/[^a-z0-9\s-]/g, "") // Elimina caracteres especiales que no sean espacios o guiones
    .trim() // Elimina espacios al inicio y final
    .replace(/\s+/g, '-'); // Reemplaza espacios por guiones
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Verificar Sesión
    const session = await getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Extraer Payload
    const data = await request.json();
    const { 
      title, 
      description, 
      pubDate, 
      author, 
      letterboxd, 
      image, 
      category, 
      tags, 
      fuente, 
      readTime, 
      content, 
      fileExtension,
      videoUrl,
      rating,
      fichaTecnica,
      sha, // Opcional: Para actualizaciones
      filename // Opcional: Nombre de archivo original
    } = data;

    if (!title || !content || !category || !description) {
      return new Response(JSON.stringify({ success: false, error: 'Faltan campos requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Determinar Ruta de Archivo
    let filePath = "";
    if (filename) {
      // Validar que el filename no contenga path traversal ni caracteres peligrosos
      if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return new Response(JSON.stringify({ success: false, error: 'Nombre de archivo inválido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      filePath = `src/content/posts/${filename}`;
    } else {
      // Validar extensión: solo se permiten .md y .mdx
      const allowedExtensions = ['.md', '.mdx'];
      const ext = fileExtension?.startsWith('.') ? fileExtension : `.${fileExtension || 'md'}`;
      if (!allowedExtensions.includes(ext)) {
        return new Response(JSON.stringify({ success: false, error: 'Extensión de archivo no permitida' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const slug = generateSlug(title);
      filePath = `src/content/posts/${slug}${ext}`;
    }

    // 4. Construir Contenido Final (Frontmatter + Markdown)
    // ... (same logic for escaping and building yamlContent)
    const safeTitle = title.replace(/"/g, '\\"');
    const safeDesc = description.replace(/"/g, '\\"');
    const safeImage = image ? image.replace(/"/g, '\\"') : '';
    const safeAuthor = author ? author.replace(/"/g, '\\"') : '';
    const safeLetterboxd = letterboxd || '';
    
    const fuenteName = fuente?.nombre ? fuente.nombre.replace(/"/g, '\\"') : "Redacción";
    const fuenteUrl = fuente?.url || "https://www.rutadoradafilms.com";
    
    // Solo agregar fuente si no es un tráiler o si tiene datos explícitos
    const videoUrlLine = videoUrl ? `videoUrl: "${videoUrl.replace(/"/g, '\\"')}"` : "";
    const sourceBlock = category !== 'Tráilers' ? `fuente:
  nombre: "${fuenteName}"
  url: "${fuenteUrl}"` : "";

    // Bloque Crítica (Rating y Ficha Técnica)
    let criticaBlock = "";
    if (category === 'Críticas' && rating !== undefined) {
        criticaBlock = `rating: ${rating}
fichaTecnica:
  sinopsis: "${fichaTecnica?.sinopsis?.replace(/"/g, '\\"') || ""}"
  director: "${fichaTecnica?.director?.replace(/"/g, '\\"') || ""}"
  cast: "${fichaTecnica?.cast?.replace(/"/g, '\\"') || ""}"
  duracion: "${fichaTecnica?.duracion?.replace(/"/g, '\\"') || ""}"\n`;
    }

    const yamlContent = `---
title: "${safeTitle}"
description: "${safeDesc}"
pubDate: ${pubDate || new Date().toISOString()}
author: "${safeAuthor}"
letterboxd: "${safeLetterboxd}"
image: "${safeImage}"
category: "${category}"
${sourceBlock ? sourceBlock + '\n' : ''}${videoUrlLine ? videoUrlLine + '\n' : ''}${criticaBlock}readTime: "${readTime || '3 min read'}"
tags: ${JSON.stringify(Array.isArray(tags) ? tags : [])}
---

${content}
`;

    // 5. Preparar Request de GitHub
    const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
    const GITHUB_REPO = import.meta.env.GITHUB_REPO;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return new Response(JSON.stringify({ success: false, error: 'Configuración de servidor incompleta.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const githubUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
    const base64Content = Buffer.from(yamlContent, 'utf-8').toString('base64');

    const githubRes = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'RutaDorada-CMS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: sha ? `feat: update post ${title}` : `feat: publish post ${title}`,
        content: base64Content,
        sha: sha || undefined // Solo se envía si existe
      })
    });

    if (!githubRes.ok) {
      const errorData = await githubRes.json();
      return new Response(JSON.stringify({ success: false, error: `Error de GitHub: ${errorData.message}` }), {
        status: githubRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Escritura doble: la misma nota va a Supabase.
    //
    // Se hace DESPUÉS de GitHub y a propósito: mientras el sitio se compile desde
    // los markdown, git es la ruta crítica y un fallo de Supabase no debe impedir
    // que la nota salga publicada. El resultado viaja en la respuesta para que el
    // CMS lo muestre, y `scripts/import-posts.mjs --commit --prune` reconcilia.
    const row: PostRow = {
      slug: slugDesdeRuta(filePath),
      status: 'published',
      title,
      description,
      body: content,
      pub_date: pubDate || new Date().toISOString(),
      author: author || '',
      author_image: null,
      category,
      tags: Array.isArray(tags) ? tags : [],
      read_time: readTime || '3 min read',
      featured: false,
      rating: category === 'Críticas' && rating !== undefined ? Number(rating) : null,
      letterboxd: letterboxd || null,
      video_url: videoUrl || null,
      image_url: image || '',
      image_credit: null,
      image_source: typeof image === 'string' && image.startsWith('http') ? image : null,
      ficha_tecnica: category === 'Críticas' && rating !== undefined
        ? {
            sinopsis: fichaTecnica?.sinopsis || '',
            director: fichaTecnica?.director || '',
            cast: fichaTecnica?.cast || '',
            duracion: fichaTecnica?.duracion || '',
          }
        : null,
      fuente: category !== 'Tráilers'
        ? { nombre: fuente?.nombre || 'Redacción', url: fuente?.url || 'https://www.rutadoradafilms.com' }
        : null,
    };

    const db = await upsertPost(row);
    if (!db.ok) console.error('Escritura doble: falló Supabase para', row.slug, '→', db.error);

    // 7. Respuesta Exitosa
    return new Response(JSON.stringify({
      success: true,
      path: filePath,
      db: db.ok ? 'ok' : `falló: ${db.error}`,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error en publish API:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
