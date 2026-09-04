// ============================================================================
// Helpers de SEO compartidos.
//
// - META_NOINDEX: fuente ÚNICA para excluir una ruta de los buscadores. Se usa
//   en formularios clínicos, fichas de paciente y el portal autenticado, para
//   que sea imposible olvidarlo (o escribirlo mal) en una ruta nueva.
// - SITE_URL / absoluteUrl: URL absoluta del sitio para canonical, Open Graph y
//   sitemap. Sale de VITE_SITE_URL; si aún no hay dominio configurado, devuelve
//   null y quien la use debe omitir la etiqueta en vez de emitir una URL falsa.
// ============================================================================

/** Base absoluta del sitio (sin barra final). Vacía hasta fijar el dominio. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/+$/, "");

/** URL absoluta para canonical / OG / sitemap. `null` si aún no hay dominio. */
export function absoluteUrl(path: string): string | null {
  if (!SITE_URL) return null;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Meta que excluye una ruta de los buscadores (privado / clínico / portal). */
export const META_NOINDEX = { name: "robots", content: "noindex, nofollow" } as const;
