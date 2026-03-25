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

    // 2. Extraer Payload
    const data = await request.json();
    const { filename } = data;

    if (!filename) {
      return new Response(JSON.stringify({ success: false, error: 'Falta el nombre del archivo (filename)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Configuración de GitHub
    const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
    const GITHUB_REPO = import.meta.env.GITHUB_REPO;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return new Response(JSON.stringify({ success: false, error: 'Configuración de servidor incompleta (GitHub API).' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const filePath = `src/content/posts/${filename}`;
    const githubUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

    // 4. Obtener el SHA del archivo
    const getRes = await fetch(githubUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!getRes.ok) {
      const errorData = await getRes.json();
      return new Response(JSON.stringify({ success: false, error: `Error al obtener archivo de GitHub: ${errorData.message}` }), {
        status: getRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;

    if (!sha) {
      return new Response(JSON.stringify({ success: false, error: 'No se pudo obtener el SHA del archivo.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Eliminar el archivo en GitHub
    const deleteRes = await fetch(githubUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `delete: remove post ${filename}`,
        sha: sha
      })
    });

    if (!deleteRes.ok) {
      const errorData = await deleteRes.json();
      return new Response(JSON.stringify({ success: false, error: `Error al eliminar en GitHub: ${errorData.message}` }), {
        status: deleteRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Disparar Deploy Hook de Vercel (Opcional)
    const VERCEL_DEPLOY_HOOK = import.meta.env.VERCEL_DEPLOY_HOOK;
    if (VERCEL_DEPLOY_HOOK) {
      fetch(VERCEL_DEPLOY_HOOK).catch(err => {
        console.error("Error al disparar Vercel Deploy Hook:", err);
      });
    } else {
      console.warn("VERCEL_DEPLOY_HOOK no está configurado.");
    }

    // 7. Respuesta Exitosa
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Error en delete API:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
