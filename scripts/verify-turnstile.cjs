// ============================================================================
// verify-turnstile.cjs — verificación de SOLO LECTURA del secreto de Turnstile.
//
// P1. NO activa nada, NO imprime valores de secretos: solo consulta si el
// secret `TURNSTILE_SECRET_KEY` está cargado en el proyecto (nombre + updated_at
// vía la Management API) — mismo patrón defensivo que verify-pitr.cjs.
//
// Contexto: el código de R3 (captcha Turnstile) ya está en producción, pero
// verifica en modo fail-safe — sin `TURNSTILE_SECRET_KEY` el captcha se OMITE.
// Este script confirma cuándo la clave ya está cargada, para poder hacer la
// prueba de rechazo end-to-end (403 sin token) sin fabricar tokens ni crear
// cuentas.
//
//     node scripts/verify-turnstile.cjs
//
// OJO: `VITE_TURNSTILE_SITE_KEY` es una variable de BUILD del frontend
// (Cloudflare), NO un secret de Supabase — no aparece aquí; se verifica en el
// entorno de build de Cloudflare por separado.
// ============================================================================
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || "eluxdqsprbgtnwznmxqe";

if (!token) {
  console.error("Falta SUPABASE_ACCESS_TOKEN en .env — no se puede consultar la Management API.");
  process.exit(1);
}

const H = { Authorization: `Bearer ${token}` };

(async () => {
  console.log(`=== verify-turnstile · proyecto ${ref} · ${new Date().toISOString()} ===`);
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, { headers: H });
    if (r.status !== 200) {
      console.log(`[secrets] http ${r.status} — no accesible`);
      process.exit(0);
    }
    const d = await r.json();
    // Solo se leen name + updated_at. NUNCA se toca ni imprime el valor.
    const byName = Object.fromEntries(
      (Array.isArray(d) ? d : []).map((s) => [s.name, s.updated_at]),
    );
    const present = Object.prototype.hasOwnProperty.call(byName, "TURNSTILE_SECRET_KEY");

    console.log("[secrets]");
    console.log(
      `  TURNSTILE_SECRET_KEY  ${present ? "PRESENTE (updated " + byName.TURNSTILE_SECRET_KEY + ")" : "AUSENTE"}`,
    );
    console.log("");
    if (present) {
      console.log(
        "✅ Clave cargada. El backend ya exige Turnstile. Siguiente paso seguro: prueba de RECHAZO " +
          "end-to-end (POST a public-signup sin token → 403), sin fabricar tokens ni crear cuentas.",
      );
    } else {
      console.log(
        "⛔ AUSENTE — el captcha sigue INERTE (fail-safe: se omite). El rate-limit sí protege. " +
          "Cargar TURNSTILE_SECRET_KEY (Edge Function) y VITE_TURNSTILE_SITE_KEY (build Cloudflare) para activarlo.",
      );
    }
  } catch (e) {
    console.log("[secrets] error:", e.message);
  }
})();
