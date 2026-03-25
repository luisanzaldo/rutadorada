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
      fileExtension 
    } = data;

    if (!title || !content || !category || !description) {
      return new Response(JSON.stringify({ success: false, error: 'Faltan campos requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Generar Slug
    const slug = generateSlug(title);

    // 4. Construir Contenido Final (Frontmatter + Markdown)
    // Escapar comillas en campos de texto libre
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
    const GITHUB_REPO = import.meta.env.GITHUB_REPO; // ej. "username/repository"

    console.log("--- DEBUG GITHUB API ENV VARS ---");
    console.log("GITHUB_TOKEN exists:", !!GITHUB_TOKEN);
    console.log("GITHUB_REPO:", GITHUB_REPO);

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.error("Faltan variables de entorno GITHUB_TOKEN o GITHUB_REPO.");
      return new Response(JSON.stringify({ success: false, error: 'Configuración de servidor incompleta (GitHub API).' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Asegurar que fileExtension empiece con "."
    const ext = fileExtension?.startsWith('.') ? fileExtension : `.${fileExtension || 'md'}`;
    const filePath = `src/content/posts/${slug}${ext}`;
    const githubUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

    // Codificar a base64 (UTF-8 compatible con acentos y caracteres especiales)
    const base64Content = Buffer.from(yamlContent, 'utf-8').toString('base64');

    const githubRes = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `feat: publish post ${title}`,
        content: base64Content
      })
    });

    if (!githubRes.ok) {
      const errorData = await githubRes.json();
      console.error("Error desde GitHub:", errorData);
      return new Response(JSON.stringify({ success: false, error: `Error de GitHub: ${errorData.message}` }), {
        status: githubRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Respuesta Exitosa
    return new Response(JSON.stringify({ success: true, slug, path: filePath }), {
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
