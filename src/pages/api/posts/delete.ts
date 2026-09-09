import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { deletePostBySlug, slugDesdeRuta } from '../../../lib/postsDb';
import { resolverNotaEnGitHub } from '../../../lib/notaEnGitHub';

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

    // Validar que el filename no contenga path traversal ni caracteres peligrosos
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return new Response(JSON.stringify({ success: false, error: 'Nombre de archivo inválido' }), {
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

    // `filename` llega como slug desde el panel: la base no guarda la extensión
    // y tres notas heredadas siguen siendo .mdx. Se resuelve preguntando a
    // GitHub en vez de suponerla, que aquí suponer mal sería borrar otra cosa.
    const nota = await resolverNotaEnGitHub(filename, GITHUB_TOKEN, GITHUB_REPO);

    if (!nota) {
      return new Response(JSON.stringify({ success: false, error: `No se encontró la nota ${filename} en el repositorio` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const postPath = nota.ruta;
    const postUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${postPath}`;
    const postSha = nota.sha;
    const postContent = nota.contenido;

    // 5. Buscar y eliminar imágenes asociadas
    // Buscamos cualquier cadena que empiece por /images/posts/
    const imagePaths: string[] = [];
    const imageRegex = /\/images\/posts\/[a-zA-Z0-9.\-_]+/g;
    const matches = postContent.match(imageRegex);
    
    if (matches) {
      const uniqueMatches = [...new Set(matches)];
      console.log(`[DELETE API] Se encontraron ${uniqueMatches.length} imágenes potenciales para eliminar.`);
      
      for (const imgUrl of uniqueMatches) {
        // El path en GitHub es public/images/posts/...
        const imgPath = `public${imgUrl}`;
        const imgUrlGitHub = `https://api.github.com/repos/${GITHUB_REPO}/contents/${imgPath}`;
        
        try {
          // Obtener SHA de la imagen
          const imgGetRes = await fetch(imgUrlGitHub, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'RutaDorada-CMS' }
          });
          
          if (imgGetRes.ok) {
            const imgData = await imgGetRes.json();
            const imgSha = imgData.sha;
            
            // Eliminar imagen
            await fetch(imgUrlGitHub, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'RutaDorada-CMS',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: `delete: remove associated image ${imgUrl}`,
                sha: imgSha
              })
            });
            console.log(`[DELETE API] Imagen eliminada: ${imgUrl}`);
          }
        } catch (err) {
          console.error(`[DELETE API] No se pudo eliminar la imagen ${imgUrl}:`, err);
        }
      }
    }

    // 6. Eliminar el archivo del post en GitHub
    const deleteRes = await fetch(postUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'RutaDorada-CMS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `delete: remove post ${filename}`,
        sha: postSha
      })
    });

    if (!deleteRes.ok) {
      const errorData = await deleteRes.json();
      return new Response(JSON.stringify({ success: false, error: `Error al eliminar post en GitHub: ${errorData.message}` }), {
        status: deleteRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 7. Escritura doble: borrar también la fila en Supabase.
    //
    // Sin esto la nota sobrevive en la base como fantasma. Ya pasó una vez, y no
    // se nota hasta que alguien compara: el sitio deja de mostrarla pero la base
    // sigue teniéndola, y el día que el sitio lea de la base, reaparece.
    const slug = slugDesdeRuta(postPath);
    const db = await deletePostBySlug(slug);
    if (!db.ok) console.error('Escritura doble: falló el borrado en Supabase para', slug, '→', db.error);

    return new Response(JSON.stringify({ success: true, db: db.ok ? 'ok' : `falló: ${db.error}` }), {
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
