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

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
