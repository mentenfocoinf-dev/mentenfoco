// Limpia perfiles de terapeuta duplicados/de prueba, dejando solo terapeuta@test.com
// (o los emails que pases como argumentos para conservar).
//
// Uso:
//   node cleanup_test_therapists.cjs                → solo LISTA qué borraría (dry-run, seguro)
//   node cleanup_test_therapists.cjs --delete        → borra de verdad los que no estén en KEEP_EMAILS
//
// Puedes ajustar qué correos conservar editando KEEP_EMAILS abajo.

const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env");
  process.exit(1);
}

const KEEP_EMAILS = ["terapeuta@test.com"];
const DELETE_MODE = process.argv.includes("--delete");

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Modo: ${DELETE_MODE ? "BORRADO REAL" : "SOLO LISTAR (dry-run)"}\n`);

  const { data: therapistProfiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "therapist");

  if (error) {
    console.error("❌ Error leyendo perfiles de terapeutas:", error.message);
    process.exit(1);
  }

  if (!therapistProfiles || therapistProfiles.length === 0) {
    console.log("No hay perfiles con role=therapist.");
    return;
  }

  const { data: usersList, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    console.error("❌ Error listando usuarios de auth:", listError.message);
    process.exit(1);
  }

  const emailById = Object.fromEntries(usersList.users.map((u) => [u.id, u.email]));

  const toKeep = [];
  const toDelete = [];

  for (const p of therapistProfiles) {
    const email = emailById[p.id] || "(sin email / usuario huérfano)";
    if (KEEP_EMAILS.includes(email)) {
      toKeep.push({ ...p, email });
    } else {
      toDelete.push({ ...p, email });
    }
  }

  console.log("✅ Se conservan:");
  toKeep.forEach((t) => console.log(`   - ${t.full_name || "(sin nombre)"} <${t.email}> (${t.id})`));

  console.log(`\n${DELETE_MODE ? "🗑️  Borrando" : "🔎 Se borrarían (agrega --delete para confirmar)"}:`);
  toDelete.forEach((t) => console.log(`   - ${t.full_name || "(sin nombre)"} <${t.email}> (${t.id})`));

  if (!DELETE_MODE) {
    console.log("\nNada fue borrado. Corre de nuevo con --delete para ejecutar.");
    return;
  }

  for (const t of toDelete) {
    const { error: delAuthError } = await supabase.auth.admin.deleteUser(t.id);
    if (delAuthError) {
      console.error(`❌ Error borrando usuario de Auth ${t.email}:`, delAuthError.message);
      continue;
    }
    // Por si no hay cascada automática hacia profiles:
    await supabase.from("profiles").delete().eq("id", t.id);
    console.log(`✅ Borrado: ${t.email}`);
  }

  console.log("\nListo.");
}

main();
