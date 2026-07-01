// Ejecuta un archivo .sql de supabase/ contra la base real usando el Management API
// (endpoint /database/query), autenticado con SUPABASE_ACCESS_TOKEN. No requiere la contraseña
// de la base ni el CLI de Supabase vinculado con `supabase link`.
//
// Uso: node run_sql_migration.cjs supabase/20260701_seed_cie11_directory.sql
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, ".env"), quiet: true });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = "eluxdqsprbgtnwznmxqe";
const file = process.argv[2];
if (!file) {
  console.error("Uso: node run_sql_migration.cjs <archivo.sql>");
  process.exit(1);
}
const sql = fs.readFileSync(path.resolve(__dirname, file), "utf8");

fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
})
  .then(async (r) => {
    const text = await r.text();
    console.log("status:", r.status);
    console.log(text);
    if (r.status >= 400) process.exit(1);
  })
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
