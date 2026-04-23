import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rawFilename = request.headers.get('x-filename');
    if (!rawFilename) {
      return new Response(JSON.stringify({ success: false, error: 'Falta el header x-filename.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const originalName = decodeURIComponent(rawFilename);

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No se recibió ningún archivo.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const dateString = new Date().toISOString().split('T')[0];
    const lastDotIndex = originalName.lastIndexOf('.');
    const ext = lastDotIndex !== -1 ? originalName.substring(lastDotIndex).toLowerCase() : '.jpg';
    const nameWithoutExt = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;

    const safeName = nameWithoutExt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const filename = `${dateString}-${safeName}-${Date.now()}${ext}`;
    const base64Content = Buffer.from(arrayBuffer).toString('base64');

    const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    const GITHUB_REPO = import.meta.env.GITHUB_REPO || process.env.GITHUB_REPO;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return new Response(JSON.stringify({ success: false, error: 'Configuración de servidor incompleta.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
      let errorDetail = `HTTP ${githubRes.status}`;
      try {
        const errorData = await githubRes.json();
        errorDetail = errorData.message || JSON.stringify(errorData);
      } catch {
        const text = await githubRes.text().catch(() => '');
        if (text) errorDetail = text.substring(0, 200);
      }
      return new Response(JSON.stringify({ success: false, error: `GitHub: ${errorDetail}` }), {
        status: githubRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, url: `/images/posts/${filename}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
