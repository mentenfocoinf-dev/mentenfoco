// ============================================================================
// verify-resend.cjs — verificación de SOLO LECTURA de la rotación de Resend.
//
// P1. NO rota nada, NO imprime valores: solo consulta el `updated_at` del secret
// `RESEND_API_KEY` (nombre + fecha vía la Management API) para confirmar que la
// rotación ocurrió — mismo patrón defensivo que verify-pitr.cjs.
//
// La ROTACIÓN la hace el responsable (nueva clave en Resend + actualizar el
// secret en Supabase). Este script solo confirma DESPUÉS que la fecha cambió.
//
//     node scripts/verify-resend.cjs
//
// Referencia: la clave estaba sin rotar desde 2026-07-19 (comprometida). Si el
// updated_at es posterior a esa fecha, la rotación se hizo.
// ============================================================================
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || "eluxdqsprbgtnwznmxqe";
const PRE_ROTATION = "2026-07-19"; // fecha del secret comprometido, sin rotar

if (!token) {
  console.error("Falta SUPABASE_ACCESS_TOKEN en .env — no se puede consultar la Management API.");
  process.exit(1);
}

const H = { Authorization: `Bearer ${token}` };

(async () => {
  console.log(`=== verify-resend · proyecto ${ref} · ${new Date().toISOString()} ===`);
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, { headers: H });
    if (r.status !== 200) {
      console.log(`[secrets] http ${r.status} — no accesible`);
      process.exit(0);
    }
    const d = await r.json();
    // Solo name + updated_at. NUNCA el valor.
    const byName = Object.fromEntries(
      (Array.isArray(d) ? d : []).map((s) => [s.name, s.updated_at]),
    );
    const present = Object.prototype.hasOwnProperty.call(byName, "RESEND_API_KEY");
    const updated = byName.RESEND_API_KEY;

    console.log("[secrets]");
    console.log(`  RESEND_API_KEY  ${present ? "PRESENTE (updated " + updated + ")" : "AUSENTE"}`);
    console.log("");

    if (!present) {
      console.log("⛔ AUSENTE — no hay clave de Resend configurada.");
      process.exit(0);
    }
    const rotated = updated && new Date(updated) > new Date(PRE_ROTATION + "T23:59:59Z");
    if (rotated) {
      console.log(
        `✅ updated_at (${updated}) es posterior al ${PRE_ROTATION} → la rotación se hizo. ` +
          "Verificar aparte que el dominio de envío esté verificado en Resend antes de retirar DEV_MAIL_REDIRECT (R6/P2).",
      );
    } else {
      console.log(
        `⛔ updated_at (${updated}) NO es posterior al ${PRE_ROTATION} → la clave sigue SIN rotar. ` +
          "R6 (retirar DEV_MAIL_REDIRECT) sigue bloqueado hasta rotar + verificar dominio.",
      );
    }
  } catch (e) {
    console.log("[secrets] error:", e.message);
  }
})();
