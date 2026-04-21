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
      console.error("[UPLOAD-IMAGE API] ERROR: El campo 'image' existe pero no parece ser un archivo válido.");
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

    // Añadimos timestamp para evitar colisiones si suben el mismo nombre en el mismo día
    const filename = `${dateString}-${safeName}-${Date.now()}${ext}`;

    // 4. Convertir Archivo a Base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString('base64');

    // 5. Variables de entorno GitHub (Soporta import.meta.env y process.env)
    const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    const GITHUB_REPO = import.meta.env.GITHUB_REPO || process.env.GITHUB_REPO;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.error("Faltan variables de entorno GITHUB_TOKEN o GITHUB_REPO.");
      return new Response(JSON.stringify({ success: false, error: 'Configuración de servidor incompleta (GitHub API keys faltantes).' }), {
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
      let errorDetail = 'Desconocido';
      const contentType = githubRes.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await githubRes.json();
          errorDetail = errorData.message || JSON.stringify(errorData);
        } catch (e) {
          errorDetail = 'Error al parsear JSON de GitHub';
        }
      } else {
        try {
          errorDetail = await githubRes.text();
          // Truncar si es muy largo (ej. una página HTML de error)
          if (errorDetail.length > 200) errorDetail = errorDetail.substring(0, 200) + '...';
        } catch (e) {
          errorDetail = 'No se pudo leer el cuerpo de la respuesta';
        }
      }

      console.error(`[UPLOAD-IMAGE API] Error al subir imagen a GitHub (${githubRes.status}):`, errorDetail);
      if (githubRes.status === 403) {
        console.error("[UPLOAD-IMAGE API] TIP: Verifica que el GITHUB_TOKEN tenga permisos de escritura (repo scope) y que la cuenta no tenga límites de tasa.");
      }
      return new Response(JSON.stringify({ 
        success: false, 
        error: `GitHub respondió con error (${githubRes.status}): ${errorDetail}` 
      }), {
        status: githubRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const githubData = await githubRes.json();

    // 7. Respuesta Exitosa
    // Al usar download_url apuntamos directamente a raw.githubusercontent.com,
    // garantizando que la imagen se vea al instante sin esperar el rebuild de Vercel.
    const finalUrl = githubData.content?.download_url || `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${githubPath}`;
    
    return new Response(JSON.stringify({ success: true, url: finalUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error crítico en upload API:", error);
    return new Response(JSON.stringify({ success: false, error: `Excepción interna: ${error.message || 'Error desconocido'}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
