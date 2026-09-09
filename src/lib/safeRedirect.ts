/**
 * Valida el parámetro `?redirect=` con el que /login devuelve al lector a la
 * página donde estaba.
 *
 * Quienes lo generan —Comments, PostSidebarLeft, my-likes, my-favorites— mandan
 * siempre `window.location.pathname`, a veces con un hash: una ruta del propio
 * sitio. Cualquier otra cosa (otro dominio, `//otro.com`, `/\otro.com`,
 * `javascript:`) es un intento de sacar al lector del sitio justo después de
 * escribir su contraseña, y se descarta a favor de `fallback`.
 *
 * Se resuelve con `URL` contra el origen actual en vez de mirar el primer
 * carácter: `//otro.com` y `/\otro.com` empiezan por `/` y aun así llevan a
 * otro dominio. Solo para scripts de cliente: depende de `window`.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;

  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return fallback;
  }

  if (url.origin !== window.location.origin) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
