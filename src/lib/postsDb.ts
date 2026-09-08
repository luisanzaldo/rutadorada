/**
 * Escritura de notas en Supabase.
 *
 * Durante la fase de escritura doble, publicar y borrar afectan a dos destinos:
 * los archivos markdown de git —que siguen siendo lo que el sitio compila— y esta
 * tabla, que será la fuente de verdad cuando el sitio lea de la base.
 *
 * Las funciones NUNCA lanzan: devuelven { ok, error } para que quien publica
 * decida. Durante esta fase git es la ruta crítica y un fallo de Supabase no debe
 * impedir que una nota salga publicada; el desfase se reconcilia después con
 * `node scripts/import-posts.mjs --commit --prune`.
 */

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export interface PostRow {
  slug: string;
  status: 'draft' | 'scheduled' | 'published';
  title: string;
  description: string;
  body: string;
  pub_date: string;
  author: string;
  author_image: string | null;
  category: string;
  tags: string[];
  read_time: string | null;
  featured: boolean;
  rating: number | null;
  letterboxd: string | null;
  video_url: string | null;
  image_url: string;
  image_credit: string | null;
  image_source: string | null;
  ficha_tecnica: Record<string, string> | null;
  fuente: Record<string, string> | null;
}

type Result = { ok: boolean; error?: string };

function configurado(): string | null {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return 'Supabase no configurado (falta PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)';
  }
  return null;
}

/**
 * Inserta la nota o la actualiza si el slug ya existe. Mismo comportamiento que
 * el script de importación, para que ambos produzcan filas idénticas.
 */
export async function upsertPost(row: PostRow): Promise<Result> {
  const falta = configurado();
  if (falta) return { ok: false, error: falta };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?on_conflict=slug`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([row]),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error de red hacia Supabase' };
  }
}

/**
 * Borra la nota. Sin esto, una nota eliminada desde el CMS sobrevive en la base
 * como fantasma — ya ocurrió una vez antes de que existiera esta función.
 */
export async function deletePostBySlug(slug: string): Promise<Result> {
  const falta = configurado();
  if (falta) return { ok: false, error: falta };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error de red hacia Supabase' };
  }
}

/** Deriva el slug desde la ruta del archivo: src/content/posts/algo.md → algo */
export function slugDesdeRuta(filePath: string): string {
  return filePath.split('/').pop()!.replace(/\.mdx?$/, '');
}
