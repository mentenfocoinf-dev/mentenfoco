// Siembra un caso clínico completo y realista para cada uno de los 4 perfiles de paciente de
// prueba (free/esencial/integral/premium), con al menos 5 sesiones cada uno: anamnesis, sesiones
// pasadas, notas clínicas firmadas (SOAP + CIE-11), evaluaciones psicométricas con tendencia, y
// (para integral/premium) una alerta de crisis resuelta, para poder verificar de punta a punta que
// las gráficas, el historial y el informe exportable funcionan con datos reales, no solo con una
// interfaz vacía.
//
// Requisitos previos (no los ejecuta este script):
//   - seed_users.cjs ya corrido (existen las 6 cuentas @test.com).
//   - link_test_patient_therapist.cjs ya corrido, o los 4 pacientes ya enlazados a
//     terapeuta@test.com en `patient_therapist` (este script lo hace también si falta).
//   - La tabla `cie11_directory` ya sembrada (migración 20260701_seed_cie11_directory.sql).
//
// Uso:
//   node seed_clinical_demo_data.cjs
//
// Es idempotente a nivel de "no truena si corres dos veces", pero SÍ va a duplicar sesiones/notas
// si lo corres más de una vez (no hay unique constraint que lo evite) — si necesitas limpiar antes
// de re-sembrar, bórralo manualmente por patient_id.

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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const THERAPIST_EMAIL = "terapeuta@test.com";

// Un "caso" completo por cada paciente de prueba. severityStory describe la tendencia de PHQ-9/GAD-7
// a lo largo de las 5 sesiones (de la más antigua a la más reciente) — pensada para que el gráfico
// de tendencia muestre una mejora visible, que es la historia más realista para una demo.
const CASES = [
  {
    email: "paciente.free@test.com",
    // Plan gratuito: el trigger enforce_free_plan_evaluation_limit exige >=30 días entre
    // evaluaciones phq9/gad7, así que las 5 sesiones quedan espaciadas un mes cada una (~5 meses).
    sessionSpacingDays: 30,
    motivo_consulta:
      "Ansiedad relacionada con estrés laboral y dificultad para desconectar los fines de semana.",
    antecedentes_psiquiatricos_personales: "Sin tratamiento psicológico previo.",
    audit_c_score: 2,
    phq9Scores: [14, 12, 10, 8, 7], // moderado -> leve
    gad7Scores: [13, 11, 9, 8, 6],
    cie11Search: "ansiedad",
    includeCrisisAlert: false,
  },
  {
    email: "paciente.esencial@test.com",
    sessionSpacingDays: 7, // 1 sesión individual al mes según el plan, pero seguimiento semanal de bienestar
    motivo_consulta:
      "Síntomas depresivos tras una ruptura de pareja de larga duración hace 4 meses.",
    antecedentes_psiquiatricos_personales:
      "Un episodio depresivo previo hace 3 años, sin tratamiento farmacológico.",
    audit_c_score: 1,
    phq9Scores: [17, 15, 13, 11, 9], // moderadamente grave -> leve
    gad7Scores: [10, 9, 8, 7, 5],
    cie11Search: "depres",
    includeCrisisAlert: false,
  },
  {
    email: "paciente.integral@test.com",
    sessionSpacingDays: 7,
    motivo_consulta:
      "Duelo complicado por la muerte de su padre hace 8 meses, con aislamiento social progresivo.",
    antecedentes_psiquiatricos_personales: "Ninguno.",
    audit_c_score: 3,
    phq9Scores: [19, 16, 14, 12, 10],
    gad7Scores: [12, 11, 9, 8, 6],
    cie11Search: "duelo",
    // Alerta de riesgo bajo en la sesión 2, resuelta por el terapeuta con seguimiento agendado —
    // para probar el flujo de CrisisAlertResolutionModal sin simular un caso de alto riesgo real.
    includeCrisisAlert: true,
    crisisSeverity: "Bajo",
    crisisResolutionAction: "session_scheduled",
    crisisResolutionNotes:
      "Paciente refiere ideación pasiva ocasional sin plan ni intención. Se agenda sesión de seguimiento en 3 días y se refuerza red de apoyo.",
  },
  {
    email: "paciente.premium@test.com",
    sessionSpacingDays: 7,
    motivo_consulta:
      "Trastorno de pánico con episodios de 2-3 veces por semana desde hace 6 semanas.",
    antecedentes_psiquiatricos_personales: "Antecedente familiar de trastorno de ansiedad (madre).",
    audit_c_score: 0,
    phq9Scores: [11, 10, 8, 6, 5],
    gad7Scores: [18, 16, 13, 10, 7],
    cie11Search: "pánico",
    // Alerta moderada, para dejar visible en el dashboard de admin/terapeuta un caso resuelto de
    // mayor severidad que el de "integral" (variedad de escenarios para la demo).
    includeCrisisAlert: true,
    crisisSeverity: "Moderado",
    crisisResolutionAction: "contacted_patient",
    crisisResolutionNotes:
      "Se contactó telefónicamente el mismo día. Paciente estable, sin riesgo inminente. Continúa proceso regular.",
  },
];

async function findUserIdByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Error listando usuarios buscando ${email}: ${error.message}`);
  const user = data.users.find((u) => u.email === email);
  if (!user)
    throw new Error(
      `No existe ningún usuario con el correo ${email}. Corre primero seed_users.cjs.`,
    );
  return user.id;
}

async function findCie11(searchTerm) {
  const { data, error } = await supabase
    .from("cie11_directory")
    .select("code, description")
    .ilike("description", `%${searchTerm}%`)
    .limit(1);
  if (error) throw new Error(`Error buscando CIE-11 "${searchTerm}": ${error.message}`);
  if (!data || data.length === 0) {
    console.warn(
      `⚠️  No se encontró código CIE-11 para "${searchTerm}" — dejo el diagnóstico en blanco.`,
    );
    return null;
  }
  return `${data[0].code} - ${data[0].description}`;
}

async function ensureLinked(patientId, therapistId) {
  const { data: existing } = await supabase
    .from("patient_therapist")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("therapist_id", therapistId)
    .maybeSingle();
  if (existing) return;
  await supabase.from("patient_therapist").delete().eq("patient_id", patientId);
  const { error } = await supabase.from("patient_therapist").insert({
    patient_id: patientId,
    therapist_id: therapistId,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Error enlazando paciente/terapeuta: ${error.message}`);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seedCase(kase, therapistId) {
  console.log(`\n=== ${kase.email} ===`);
  const patientId = await findUserIdByEmail(kase.email);
  await ensureLinked(patientId, therapistId);

  // Anamnesis
  const { error: anamnesisError } = await supabase.from("patient_anamnesis").upsert(
    {
      patient_id: patientId,
      data: {
        motivo_consulta: kase.motivo_consulta,
        antecedentes_medicos: { seleccionados: [], otros: "" },
        medicacion_actual: [],
        antecedentes_psiquiatricos_personales: kase.antecedentes_psiquiatricos_personales,
        antecedentes_psiquiatricos_familiares: "",
        consumo_sustancias: {
          alcohol_audit_c: { respuestas: [0, 0, 0], puntaje: kase.audit_c_score },
          tabaco: "No fumo",
          otras_sustancias: "",
        },
        autolesion: { tiene_antecedentes: false, detalle: "" },
        red_apoyo: "Familia cercana y 1-2 amistades de confianza.",
        cribado_cognitivo: null,
      },
      audit_c_score: kase.audit_c_score,
      completed_at: daysAgo(kase.sessionSpacingDays * 5 + 3).toISOString(),
    },
    { onConflict: "patient_id" },
  );
  if (anamnesisError) throw new Error(`Anamnesis: ${anamnesisError.message}`);
  console.log("  ✓ Anamnesis sembrada");

  const diagnostic = await findCie11(kase.cieSearch || kase.cie11Search);

  // 5 sesiones + notas + evaluaciones, de la más antigua a la más reciente.
  for (let i = 0; i < 5; i++) {
    const sessionsAgo = kase.sessionSpacingDays * (5 - i);
    const scheduledAt = daysAgo(sessionsAgo);

    const { data: session, error: sessionError } = await supabase
      .from("therapy_sessions")
      .insert({
        patient_id: patientId,
        therapist_id: therapistId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 45,
        status: "completada",
        video_call_link: "https://meet.google.com/demo-seed-session",
        reminder_status: "no_aplica",
        notes: `Sesión ${i + 1} de 5 (datos de prueba sembrados).`,
      })
      .select("id")
      .single();
    if (sessionError) throw new Error(`Sesión ${i + 1}: ${sessionError.message}`);

    const { error: noteError } = await supabase.from("clinical_notes").insert({
      patient_id: patientId,
      therapist_id: therapistId,
      soap_data: {
        complaints: [],
        diagnostic: diagnostic ?? "",
        mental_exam: {
          Apariencia: "Adecuada",
          Actitud: "Colaboradora",
          Afecto: i < 2 ? "Ansioso" : "Eutímico",
        },
        s: `Paciente refiere ${i < 3 ? "persistencia" : "mejoría notable"} de los síntomas reportados en el motivo de consulta.`,
        o: "Colaborador/a durante la sesión, discurso coherente, contacto visual adecuado.",
        a: `Evolución ${i < 2 ? "estable, sin cambios significativos" : "favorable"} respecto a la sesión anterior.`,
        p:
          i === 4
            ? "Continuar seguimiento mensual y reforzar estrategias ya trabajadas."
            : "Continuar con el plan de intervención vigente. Próxima sesión en la fecha agendada.",
      },
      is_signed: true,
      signed_at: scheduledAt.toISOString(),
      created_at: scheduledAt.toISOString(),
    });
    if (noteError) throw new Error(`Nota ${i + 1}: ${noteError.message}`);

    const { error: phqError } = await supabase.from("psychometric_evaluations").insert({
      patient_id: patientId,
      scale_type: "phq9",
      total_score: kase.phq9Scores[i],
      severity_level: severityLabelPhq9(kase.phq9Scores[i]),
      raw_answers: { respuestas: Array(9).fill(1), nota: "dato de prueba sembrado" },
      evaluated_at: scheduledAt.toISOString(),
    });
    if (phqError) throw new Error(`PHQ-9 sesión ${i + 1}: ${phqError.message}`);

    const { error: gadError } = await supabase.from("psychometric_evaluations").insert({
      patient_id: patientId,
      scale_type: "gad7",
      total_score: kase.gad7Scores[i],
      severity_level: severityLabelGad7(kase.gad7Scores[i]),
      raw_answers: { respuestas: Array(7).fill(1), nota: "dato de prueba sembrado" },
      evaluated_at: scheduledAt.toISOString(),
    });
    if (gadError) throw new Error(`GAD-7 sesión ${i + 1}: ${gadError.message}`);

    console.log(
      `  ✓ Sesión ${i + 1}/5 (${scheduledAt.toISOString().slice(0, 10)}): nota firmada + PHQ-9 ${kase.phq9Scores[i]} + GAD-7 ${kase.gad7Scores[i]}`,
    );

    // Alerta de crisis en la segunda sesión, si aplica al caso.
    if (kase.includeCrisisAlert && i === 1) {
      const { data: alert, error: alertError } = await supabase
        .from("clinical_alerts")
        .insert({
          patient_id: patientId,
          status: "high_priority",
          created_at: scheduledAt.toISOString(),
        })
        .select("id")
        .single();
      if (alertError) throw new Error(`Alerta de crisis: ${alertError.message}`);

      const resolvedAt = new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000); // 2h después
      const { error: resolveError } = await supabase
        .from("clinical_alerts")
        .update({
          resolved_at: resolvedAt.toISOString(),
          resolved_by: therapistId,
          resolution_action: kase.crisisResolutionAction,
          resolution_notes: kase.crisisResolutionNotes,
        })
        .eq("id", alert.id);
      if (resolveError) throw new Error(`Resolución de alerta: ${resolveError.message}`);
      console.log(`  ✓ Alerta de crisis (${kase.crisisSeverity}) sembrada y resuelta`);
    }
  }
}

function severityLabelPhq9(score) {
  if (score <= 4) return "Mínimo";
  if (score <= 9) return "Leve";
  if (score <= 14) return "Moderado";
  if (score <= 19) return "Moderadamente grave";
  return "Grave";
}
function severityLabelGad7(score) {
  if (score <= 4) return "Mínimo";
  if (score <= 9) return "Leve";
  if (score <= 14) return "Moderado";
  return "Grave";
}

async function main() {
  const therapistId = await findUserIdByEmail(THERAPIST_EMAIL);
  console.log(`Terapeuta: ${THERAPIST_EMAIL} (${therapistId})`);

  for (const kase of CASES) {
    await seedCase(kase, therapistId);
  }

  console.log(
    "\n✅ Listo. 4 pacientes con 5 sesiones cada uno, anamnesis, notas firmadas, evaluaciones con tendencia, y 2 alertas de crisis resueltas (integral y premium).",
  );
}

main().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
