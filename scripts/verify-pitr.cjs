// ============================================================================
// verify-pitr.cjs — verificación de SOLO LECTURA del estado de backups/PITR.
//
// P0 de la fase de configuraciones. NO activa nada, NO escribe nada: solo
// consulta la Management API de Supabase y reporta METADATA. Nunca imprime el
// token ni datos sensibles — mismo patrón defensivo que las verificaciones de
// secrets (nombres/estado, jamás valores).
//
// Correr en cualquier momento, antes y después de que el responsable active
// PITR en el panel:
//     node scripts/verify-pitr.cjs
//
// Requiere SUPABASE_ACCESS_TOKEN en .env (ya usado por run_sql_migration.cjs).
// La compuerta: hasta que haya >=1 copia recuperable, siguen BLOQUEADOS los
// DROP de test_scores/guides y cualquier operación estructural irreversible.
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
  console.log(`=== verify-pitr · proyecto ${ref} · ${new Date().toISOString()} ===`);

  // 1) Estado de backups / PITR
  let pitr = null;
  let copias = null;
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/backups`, {
      headers: H,
    });
    if (r.status !== 200) {
      console.log(`[backups] http ${r.status} — no accesible`);
    } else {
      const d = await r.json();
      pitr = d.pitr_enabled === true;
      copias = Array.isArray(d.backups) ? d.backups.length : 0;
      console.log("[backups]");
      console.log(`  pitr_enabled ....... ${d.pitr_enabled}`);
      console.log(`  walg_enabled ....... ${d.walg_enabled}`);
      console.log(`  copias recuperables  ${copias}`);
      console.log(`  region ............. ${d.region}`);
    }
  } catch (e) {
    console.log("[backups] error:", e.message);
  }

  // 2) ¿el add-on PITR está aplicado?
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/billing/addons`, {
      headers: H,
    });
    if (r.status === 200) {
      const d = await r.json();
      const disponibles = (d.available_addons || []).map((a) => a.type || a.name);
      const aplicados = (d.selected_addons || d.applied_addons || []).map((a) => a.type || a.name);
      console.log("[add-ons]");
      console.log(`  pitr disponible .... ${disponibles.includes("pitr")}`);
      console.log(`  pitr aplicado ...... ${aplicados.includes("pitr")}`);
      console.log(`  aplicados .......... ${aplicados.join(", ") || "(ninguno)"}`);
    }
  } catch (e) {
    console.log("[add-ons] error:", e.message);
  }

  // 3) Veredicto / compuerta
  console.log("");
  if (pitr === true && copias > 0) {
    console.log(`✅ OK — PITR activo y ${copias} copia(s) recuperable(s). Compuerta LEVANTADA.`);
    process.exit(0);
  } else {
    console.log(
      "⛔ GATE — sin copia recuperable (pitr:" +
        pitr +
        ", copias:" +
        copias +
        "). Siguen BLOQUEADOS los DROP de test_scores/guides y toda operación estructural irreversible.",
    );
    process.exit(0); // read-only: no falla el proceso, solo informa
  }
})();
