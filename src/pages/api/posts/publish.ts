import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';

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
      // Si estamos editando, mantenemos el archivo original
      filePath = `src/content/posts/${filename}`;
    } else {
      // Si es nuevo, generamos slug
      const slug = generateSlug(title);
      const ext = fileExtension?.startsWith('.') ? fileExtension : `.${fileExtension || 'md'}`;
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

    const yamlContent = `---
title: "${safeTitle}"
description: "${safeDesc}"
pubDate: ${pubDate || new Date().toISOString()}
author: "${safeAuthor}"
letterboxd: "${safeLetterboxd}"
image: "${safeImage}"
category: "${category}"
fuente:
  nombre: "${fuenteName}"
  url: "${fuenteUrl}"
readTime: "${readTime || '3 min read'}"
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

    // 6. Disparar Deploy Hook de Vercel
    const VERCEL_DEPLOY_HOOK = import.meta.env.VERCEL_DEPLOY_HOOK;
    if (VERCEL_DEPLOY_HOOK) {
      fetch(VERCEL_DEPLOY_HOOK).catch(() => {});
    }

    // 7. Respuesta Exitosa
    return new Response(JSON.stringify({ success: true, path: filePath }), {
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
