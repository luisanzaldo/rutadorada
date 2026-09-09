/**
 * Resuelve el archivo de una nota en GitHub a partir de su slug.
 *
 * El panel de administración identificaba las notas por `entry.id` de Astro —el
 * nombre del archivo con extensión— pero desde que el sitio lee de Supabase ese
 * campo ya no existe: la base guarda el slug, no el nombre del archivo. Y la
 * extensión no se puede deducir, porque tres notas heredadas siguen siendo
 * `.mdx` mientras que el CMS solo crea `.md`.
 *
 * Así que se resuelve preguntando: primero `.md`, que cubre 195 de 198, y solo
 * si no está se prueba `.mdx`. Una petición de más en el caso raro, ninguna
 * suposición que pueda borrar el archivo equivocado.
 */

const EXTENSIONES = ['md', 'mdx'] as const;

export type NotaEnGitHub = {
  /** Ruta completa en el repositorio, con su extensión real. */
  ruta: string;
  sha: string;
  /** Contenido ya decodificado desde base64. */
  contenido: string;
};

export async function resolverNotaEnGitHub(
  slug: string,
  token: string,
  repo: string,
): Promise<NotaEnGitHub | null> {
  // El slug viaja en una URL de la API, así que se valida antes de construirla.
  if (!/^[a-zA-Z0-9._-]+$/.test(slug) || slug.includes('..')) {
    throw new Error(`Slug inválido: ${slug}`);
  }

  const base = slug.replace(/\.mdx?$/, '');

  for (const ext of EXTENSIONES) {
    const ruta = `src/content/posts/${base}.${ext}`;
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${ruta}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        // GitHub responde en texto plano si falta, y el .json() de abajo
        // reventaría con un error indescifrable. Es la lección de la fase 1.
        'User-Agent': 'RutaDorada-CMS',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`GitHub ${res.status} al leer ${ruta}`);

    const json = await res.json();
    return {
      ruta,
      sha: json.sha,
      contenido: Buffer.from(json.content, 'base64').toString('utf-8'),
    };
  }

  return null;
}
