import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';

export const prerender = false;

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

    console.log("\n--- [UPLOAD-IMAGE API] Iniciando petición ---");
    // 2. Extraer FormData y el archivo de imagen
    const formData = await request.formData();
    console.log("[UPLOAD-IMAGE API] FormData recibido. Llaves presentes:", Array.from(formData.keys()));
    
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      console.error("[UPLOAD-IMAGE API] ERROR: Campo 'image' no encontrado en FormData.");
      return new Response(JSON.stringify({ success: false, error: 'No se envió ninguna imagen.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Relaxed check since `instanceof File` can fail depending on Astro's runtime (Node context)
    if (typeof imageFile === 'string' || !imageFile.name) {
      console.error("[UPLOAD-IMAGE API] ERROR: El campo 'image' existe pero no parece ser un archivo válido. Tipo recibido:", typeof imageFile);
      return new Response(JSON.stringify({ success: false, error: 'El formato de la imagen subida es inválido o se mandó como texto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[UPLOAD-IMAGE API] Archivo válido detectado: nombre="${imageFile.name}", tamaño=${imageFile.size} bytes`);

    // 3. Generar Nombre de Archivo Único
    const dateString = new Date().toISOString().split('T')[0]; // Ejemplo: "2026-03-24"
    
    // Limpiar el nombre original del archivo para guardarlo seguro en el repo
    const lastDotIndex = imageFile.name.lastIndexOf('.');
    const ext = lastDotIndex !== -1 ? imageFile.name.substring(lastDotIndex).toLowerCase() : '';
    const nameWithoutExt = lastDotIndex !== -1 ? imageFile.name.substring(0, lastDotIndex) : imageFile.name;
    
    const safeName = nameWithoutExt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres raros y espacios por guiones
      .replace(/^-+|-+$/g, '');

    const filename = `${dateString}-${safeName}${ext}`;

    // 4. Convertir Archivo a Base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString('base64');

    // 5. Variables de entorno GitHub
    const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
    const GITHUB_REPO = import.meta.env.GITHUB_REPO; // formato "user/repo"

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.error("Faltan variables de entorno GITHUB_TOKEN o GITHUB_REPO.");
      return new Response(JSON.stringify({ success: false, error: 'Configuración de servidor incompleta (GitHub API).' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Subir Imagen a GitHub
    const githubPath = `public/images/posts/${filename}`;
    const githubUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${githubPath}`;

    const githubRes = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `upload: add post image ${filename}`,
        content: base64Content
      })
    });

    if (!githubRes.ok) {
      const errorData = await githubRes.json();
      console.error("Error al subir imagen a GitHub:", errorData);
      return new Response(JSON.stringify({ success: false, error: `Error de GitHub: ${errorData.message}` }), {
        status: githubRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 7. Respuesta Exitosa
    // Importante: La URL pública retornada será relativa al framework Astro, es decir, /images/posts/filename
    const finalUrl = `/images/posts/${filename}`;
    
    return new Response(JSON.stringify({ success: true, url: finalUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error en upload API:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
