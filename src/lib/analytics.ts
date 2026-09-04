// ============================================================================
// Capa de eventos de analítica, DESACOPLADA del proveedor.
//
// Hoy solo registra en consola en desarrollo y es un no-op seguro si no hay
// proveedor configurado (nunca truena, nunca envía nada por su cuenta). El día
// que se decida GA4 / Clarity / PostHog, se conecta el proveedor real AQUÍ —en
// una sola función—, sin reinstrumentar la app. Ver GUIA_ACTIVACIONES_MANUALES.
//
// Distinto de `trackEvent` (journeyService): aquel guarda eventos internos del
// "journey" en Supabase; este es para analítica de producto externa.
//
// REGLA: nunca pasar PII ni datos clínicos en las propiedades.
// ============================================================================
type EventProps = Record<string, string | number | boolean | null | undefined>;

export function track(evento: string, propiedades?: EventProps): void {
  try {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[analytics] ${evento}`, propiedades ?? {});
    }
    // ── Conectar el proveedor real aquí cuando se decida (no-op hasta entonces) ──
    // if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
    //   (window as any).gtag("event", evento, propiedades ?? {});
    // }
  } catch {
    // La analítica jamás debe romper la app.
  }
}
