// ============================================================================
// Cabeceras de seguridad HTTP (pilar 18/19 del assessment).
//
// El deploy es un Cloudflare Worker (TanStack Start server-entry), NO Pages, así
// que un `public/_headers` NO aplicaría: las cabeceras se ponen en un middleware
// global de request, que TanStack Start descubre por convención en `src/start.ts`.
//
// Estrategia: las cabeceras que no afectan el render se FUERZAN ya (clickjacking,
// sniffing, referrer, HSTS, permisos). La CSP entra primero como REPORT-ONLY
// —calibrada a los orígenes reales (Supabase, Cloudflare Turnstile, Google
// Fonts)— para no romper la app en producción sin poder probarla localmente en
// el Worker; se observan las violaciones tras desplegar (consola / scanner) y se
// pasa a `Content-Security-Policy` (enforcing) cuando esté limpia.
//
// VERIFICACIÓN: tras desplegar, confirmar con `curl -I https://<dominio>` o
// securityheaders.com que las cabeceras aparecen — no solo por inspección de
// este archivo.
// ============================================================================
import { createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

// CSP calibrada a los orígenes reales del proyecto:
//   - script/frame Turnstile: https://challenges.cloudflare.com (widget captcha)
//   - style/font Google Fonts: fonts.googleapis.com / fonts.gstatic.com
//   - connect Supabase: https/wss *.supabase.co (API REST + realtime)
//   - 'unsafe-inline' en script/style: el SSR de TanStack Start inyecta scripts
//     inline de hidratación; endurecer a nonce es un paso posterior.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  // Report-Only primero (no rompe nada); pasar a "Content-Security-Policy" cuando
  // se confirme que no hay violaciones legítimas tras desplegar.
  "Content-Security-Policy-Report-Only": CSP,
};

const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  setResponseHeaders(SECURITY_HEADERS);
  return next();
});

// ============================================================================
// Endpoints utilitarios que no son páginas: sitemap y healthcheck.
//
// Esta versión de TanStack Start no expone "server routes" clásicas, así que se
// resuelven en el middleware de request devolviendo un Response directamente
// (short-circuit, sin renderizar la app). La base absoluta sale del ORIGIN del
// propio request → siempre correcta, sin depender de que el dominio esté fijado.
// ============================================================================

// Rutas públicas estáticas indexables (misma lista que robots.txt).
const SITEMAP_STATIC_PATHS = [
  "/",
  "/asesoramiento",
  "/membresia",
  "/guia",
  "/contenido",
  "/blog",
  "/sobre-nosotros",
  "/contactanos",
  "/faq",
  "/lineas-de-crisis",
  "/empresas",
  "/rehabilitacion-cognitiva",
  "/tests",
];
const SITEMAP_SERVICE_SLUGS = [
  "psicologia-clinica",
  "neuropsicologia",
  "psiquiatria",
  "fonoaudiologia",
  "terapia-pareja",
  "orientacion-padres",
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Construye el sitemap con las páginas públicas + guías/contenido/blog PUBLICADOS.
// Consulta por REST con la anon key: la RLS ya limita a lo visible de forma
// anónima (= lo que un buscador puede indexar). Si la BD falla, igual devuelve
// las rutas estáticas (mejor un sitemap parcial que ninguno).
async function buildSitemap(origin: string): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const urls = new Set<string>();
  for (const p of SITEMAP_STATIC_PATHS) urls.add(origin + p);
  for (const s of SITEMAP_SERVICE_SLUGS) urls.add(`${origin}/servicios/${s}`);

  if (base && key) {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const j = (url: string) =>
      fetch(url, { headers }).then((r) => (r.ok ? r.json() : []) as Promise<unknown[]>);
    const [guias, contenido, blog] = await Promise.allSettled([
      j(`${base}/rest/v1/clinical_guides_meta?select=id`),
      j(
        `${base}/rest/v1/content_items?select=slug&status=eq.publicado&content_type=in.(articulo,programa,herramienta,audio)`,
      ),
      j(`${base}/rest/v1/content_items?select=slug&status=eq.publicado&content_type=eq.blog`),
    ]);
    if (guias.status === "fulfilled")
      for (const g of guias.value as { id?: string }[])
        if (g?.id) urls.add(`${origin}/guias/${g.id}`);
    if (contenido.status === "fulfilled")
      for (const c of contenido.value as { slug?: string }[])
        if (c?.slug) urls.add(`${origin}/contenido/${c.slug}`);
    if (blog.status === "fulfilled")
      for (const b of blog.value as { slug?: string }[])
        if (b?.slug) urls.add(`${origin}/blog/${b.slug}`);
  }

  const body = [...urls].map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const utilityEndpointsMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const { pathname, origin } = new URL(request.url);

    // Healthcheck para monitoreo de uptime externo (no consulta la BD).
    if (pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", time: new Date().toISOString() }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    // Sitemap dinámico (caché corta: refleja el contenido publicado sin rebuild).
    if (pathname === "/sitemap.xml") {
      const xml = await buildSitemap(origin);
      return new Response(xml, {
        status: 200,
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    }

    return next();
  },
);

export const startInstance = createStart(() => ({
  // El de endpoints va primero: intercepta /sitemap.xml y /api/health antes de
  // que el router intente renderizar una página.
  requestMiddleware: [utilityEndpointsMiddleware, securityHeadersMiddleware],
}));
