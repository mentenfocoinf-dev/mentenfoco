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

/** Imagen para Open Graph: la portada de la pieza (absoluta si se puede) o el
 *  banner genérico. Nunca devuelve vacío. */
export function ogImageUrl(cover?: string | null): string {
  const c = cover?.trim();
  if (!c) return absoluteUrl("/BANNER.jpg") ?? "/BANNER.jpg";
  if (/^https?:\/\//.test(c)) return c;
  // Las portadas de blog/contenido se guardan como nombre suelto y viven en
  // /contenido/. Lo que ya trae una ruta (p. ej. /guias/…) se deja tal cual.
  const path = c.startsWith("/") ? c : `/contenido/${c}`;
  return absoluteUrl(path) ?? path;
}

/** Meta que excluye una ruta de los buscadores (privado / clínico / portal). */
export const META_NOINDEX = { name: "robots", content: "noindex, nofollow" } as const;

// ── Datos estructurados (JSON-LD) ──────────────────────────────────────────
// Vocabulario conservador: contenido EDITORIAL/informativo (Organization,
// Article, FAQPage). Nunca tipos que impliquen diagnóstico médico automatizado
// (MedicalWebPage / MedicalCondition con afirmaciones propias).

const LOGO_URL = absoluteUrl("/GOLO.png") ?? "/GOLO.png";
const ORG_NAME = "Mente en Foco";
const ORG_DESC =
  "Centro de salud mental: acompañamiento, guías clínicas y evaluaciones para ti y tu familia.";

/** JSON-LD Organization para el layout raíz. */
export function organizationLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORG_NAME,
    ...(SITE_URL ? { url: SITE_URL } : {}),
    logo: LOGO_URL,
    description: ORG_DESC,
    // sameAs se omite a propósito: no se inventan redes que no estén confirmadas.
  };
}

/** JSON-LD Article para blog / contenido. Sin afirmaciones clínicas propias. */
export function articleLd(opts: {
  title: string;
  description?: string | null;
  datePublished?: string | null;
  path: string;
  image?: string | null;
  author?: string | null;
}): Record<string, unknown> {
  const url = absoluteUrl(opts.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.image ? { image: opts.image } : {}),
    ...(url ? { url, mainEntityOfPage: url } : {}),
    author: { "@type": "Organization", name: opts.author || ORG_NAME },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: { "@type": "ImageObject", url: LOGO_URL },
    },
  };
}

/** JSON-LD FAQPage a partir de pares pregunta/respuesta. */
export function faqLd(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
