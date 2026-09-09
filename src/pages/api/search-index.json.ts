/**
 * Índice del buscador interno (la lupa del header, Cmd+K).
 *
 * Antes iba inline en cada página: 815 KB de los 912 que pesaba una nota, el
 * 89%. Se descargaban y parseaban en cada visita, incluso para quien nunca
 * abría el buscador, y eran la razón de que publicar una nota reescribiera las
 * 232 páginas del sitio.
 *
 * Ahora se pide una sola vez, y solo cuando alguien abre el buscador.
 *
 * No es un archivo estático a propósito: regenerarlo exigiría un build por
 * publicación, que es justo lo que la fase 5 viene a eliminar. Lee de la base y
 * se cachea en el borde.
 *
 * Nada de esto afecta a Google, que indexa el HTML visible de cada nota. Este
 * índice solo alimenta la búsqueda dentro del sitio.
 */
import type { APIRoute } from 'astro';
import { consultarPublicadas } from '../../lib/posts';
import { renderRichText, stripRichText } from '../../lib/richText';

export const prerender = false;

type FilaBusqueda = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[] | null;
  body: string;
};

export const GET: APIRoute = async () => {
  try {
    const filas = await consultarPublicadas<FilaBusqueda>(
      'slug,title,description,category,tags,body',
    );

    // La misma forma que tenía el array inline, para que la búsqueda del
    // cliente no cambie: texto plano para comparar sin tropezar con las marcas
    // de énfasis, y HTML para pintar los resultados.
    const indice = filas.map((f) => ({
      slug: f.slug,
      title: stripRichText(f.title),
      description: stripRichText(f.description ?? ''),
      titleHtml: renderRichText(f.title),
      descriptionHtml: renderRichText(f.description ?? ''),
      category: f.category,
      tags: f.tags ?? [],
      body: f.body ?? '',
    }));

    return new Response(JSON.stringify(indice), {
      headers: {
        'Content-Type': 'application/json',
        // La cabecera del endpoint manda sobre el comodín de public/_headers:
        // se comprobó en producción con /api/cannes/latest, que conserva la
        // suya. La acumulación de reglas solo afecta a assets estáticos.
        //
        // Cinco minutos en el borde y media hora sirviendo la copia vieja
        // mientras se revalida: una nota recién publicada tarda como mucho ese
        // rato en ser buscable, y a cambio ninguna visita paga la consulta.
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800',
      },
    });
  } catch (error: any) {
    // Que falle el índice no puede tumbar el header: el cliente muestra un
    // aviso y el resto del sitio sigue funcionando.
    return new Response(JSON.stringify({ error: error?.message ?? 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};
