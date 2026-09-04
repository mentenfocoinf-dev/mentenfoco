// Enlaza al paciente de prueba con el terapeuta de prueba en la tabla `patient_therapist`.
// No hay ninguna pantalla en la app todavía para hacer esta asignación manualmente
// (ni desde AdminDashboard ni desde TherapistDashboard), así que se hace directo
// con la Service Role Key, igual que seed_users.cjs.
//
// Uso:
//   node link_test_patient_therapist.cjs
//
// Puedes cambiar los correos de abajo si quieres enlazar otras cuentas.

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

const PATIENT_EMAIL = "paciente@test.com";
const THERAPIST_EMAIL = "terapeuta@test.com";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error(`❌ Error listando usuarios (buscando ${email}):`, error.message);
    process.exit(1);
  }
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    console.error(
      `❌ No existe ningún usuario con el correo ${email}. Corre primero seed_users.cjs.`,
    );
    process.exit(1);
  }
  return user.id;
}

async function main() {
  console.log(`Buscando IDs de ${PATIENT_EMAIL} y ${THERAPIST_EMAIL}...`);
  const patientId = await findUserIdByEmail(PATIENT_EMAIL);
  const therapistId = await findUserIdByEmail(THERAPIST_EMAIL);

  console.log(`Paciente: ${patientId}`);
  console.log(`Terapeuta: ${therapistId}`);

  // Revisamos si ya existe el enlace para no duplicarlo
  const { data: existing, error: existingError } = await supabase
    .from("patient_therapist")
    .select("patient_id, therapist_id")
    .eq("patient_id", patientId)
    .eq("therapist_id", therapistId)
    .maybeSingle();

  if (existingError) {
    console.error("❌ Error revisando enlace existente:", existingError.message);
    process.exit(1);
  }

  if (existing) {
    console.log("✅ El enlace ya existía. Nada que hacer.");
    return;
  }

  // Si el paciente ya tenía otro terapeuta asignado, lo quitamos primero
  // (el modelo de la app asume un terapeuta principal por paciente).
  const { error: cleanupError } = await supabase
    .from("patient_therapist")
    .delete()
    .eq("patient_id", patientId);

  if (cleanupError) {
    console.error("⚠️  No se pudo limpiar asignaciones previas:", cleanupError.message);
  }

  const { error: insertError } = await supabase.from("patient_therapist").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("❌ Error creando el enlace:", insertError.message);
    process.exit(1);
  }

  console.log(`✅ Enlazado: ${PATIENT_EMAIL} ahora es paciente de ${THERAPIST_EMAIL}.`);
}

main();
