/**
 * Portadas de las notas: una sola fuente de verdad para derivar variantes.
 *
 * Las imágenes viven en R2 con la URL `https://<host>/<hash>.<ext>`, donde el
 * hash es del contenido original. Si se sustituye la portada de una nota cambia
 * el hash, cambia la URL y ninguna caché puede servir la copia vieja.
 *
 * La extensión va SIEMPRE en la URL, nunca negociada por `Accept`: en el plan
 * gratuito el borde de Cloudflare ignora `Vary`, así que un mismo URL le daría
 * a todo el mundo el primer formato que cacheó. Un navegador guarda el WebP y
 * el siguiente en pedirlo puede ser el crawler de una red social.
 *
 * Antes esta derivación se hacía con `.replace('.jpg', '-mobile.jpg')` repartido
 * por los componentes, lo que fallaba de tres formas: no hacía nada en .png y
 * .webp, pedía un `-mobile` inexistente en 9 notas, y se aplicaba también a las
 * URLs de terceros, pidiéndole a Variety un archivo que nunca ha tenido.
 */

const R2_HOST = 'img.rutadoradafilms.com';

/** Anchos reales de las variantes que genera scripts/build-image-variants.mjs. */
const ANCHO_COMPLETO = 1280;
const ANCHO_PEQUENO = 600;

type Portada = {
  /** Siempre utilizable en `src`. */
  src: string;
  /** `srcset` en JPEG; `undefined` si la imagen no está en R2. */
  srcset?: string;
  /** `srcset` en WebP para un `<source>`; `undefined` si no está en R2. */
  srcsetWebp?: string;
  /** Variante 1200x630 para `og:image`; cae al `src` si no está en R2. */
  social: string;
};

/** Descompone una URL de R2. Devuelve null para cualquier otra cosa. */
function partesR2(image: string): { base: string; ext: string } | null {
  let url: URL;
  try {
    url = new URL(image);
  } catch {
    return null;
  }
  if (url.hostname !== R2_HOST) return null;

  const m = url.pathname.match(/^\/([0-9a-f]{16})\.(jpg|webp)$/);
  if (!m) return null;

  return { base: `${url.origin}/${m[1]}`, ext: m[2] };
}

/**
 * Resuelve una portada a todas sus formas.
 *
 * `image` es el campo tal cual viene del frontmatter o de la base: una URL de
 * R2, una ruta local heredada (`/images/posts/…`) o una URL de un tercero. Las
 * dos últimas siguen funcionando: devuelven `src` y `social` sin variantes, que
 * es exactamente el comportamiento de hoy.
 */
export function portada(image: string, baseUrl = ''): Portada {
  const absoluta = image.startsWith('/') ? `${baseUrl}${image}` : image;
  const r2 = partesR2(image);

  if (!r2) return { src: absoluta, social: absoluta };

  return {
    src: `${r2.base}.jpg`,
    srcset: `${r2.base}-sm.jpg ${ANCHO_PEQUENO}w, ${r2.base}.jpg ${ANCHO_COMPLETO}w`,
    srcsetWebp: `${r2.base}-sm.webp ${ANCHO_PEQUENO}w, ${r2.base}.webp ${ANCHO_COMPLETO}w`,
    social: `${r2.base}-og.jpg`,
  };
}

/** `true` si la portada ya está migrada a R2. Útil durante la transición. */
export function estaEnR2(image: string): boolean {
  return partesR2(image) !== null;
}
