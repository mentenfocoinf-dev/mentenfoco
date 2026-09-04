// ============================================================================
// Recordatorios de sesión por correo electrónico (canal inicial — la app móvil
// asumirá las notificaciones push más adelante, por decisión explícita del
// usuario el 2026-07-16).
//
// Qué hace: busca sesiones en `therapy_sessions` que ocurren dentro de la
// ventana de recordatorio (por defecto, entre 23 y 25 horas desde ahora — así
// el cron corre cada hora y cada sesión cae en la ventana una sola vez), con
// reminder_status = 'pendiente' y status en ('programada','confirmada'), y le
// envía un correo al paciente vía Resend. Marca reminder_status = 'enviado' o
// 'fallido' según el resultado, para que nunca se reenvíe el mismo recordatorio
// dos veces y quede trazabilidad de qué falló.
//
// Se dispara por un cron de Postgres (pg_cron + pg_net) — ver la migración
// supabase/20260717_schedule_session_reminders.sql. No requiere que el
// dashboard esté abierto ni que nadie dispare nada manualmente.
//
// Variables de entorno requeridas (Supabase secrets, las configura Claude Code
// con acceso al proyecto real):
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (para leer/escribir sin RLS, ya
//     que esta función corre con privilegios de servidor, no como un usuario).
//   - RESEND_API_KEY: API key de Resend (https://resend.com). Con la cuenta
//     gratuita y el remitente de pruebas onboarding@resend.dev ya funciona sin
//     verificar dominio propio — suficiente para probar hoy mismo.
//   - REMINDER_FROM_EMAIL (opcional): remitente. Si no se define, usa
//     "Mente en Foco <onboarding@resend.dev>".
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") as string,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Mente en Foco <onboarding@resend.dev>";

// Ventana de recordatorio: sesiones entre 23h y 25h a partir de ahora. Pensada para un cron que
// corre cada hora (ver migración) — ancha lo suficiente para no perder ninguna sesión si el cron
// se atrasa un poco, sin duplicar envíos porque reminder_status pasa a 'enviado' de inmediato.
const WINDOW_START_HOURS = 23;
const WINDOW_END_HOURS = 25;

interface SessionRow {
  id: string;
  scheduled_at: string;
  patient_id: string;
  therapist_id: string;
}

Deno.serve(async () => {
  if (!RESEND_API_KEY) {
    return new Response("Falta configurar RESEND_API_KEY como secret de Supabase.", {
      status: 500,
    });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_HOURS * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + WINDOW_END_HOURS * 60 * 60 * 1000).toISOString();

  const { data: sessions, error: fetchError } = await supabase
    .from("therapy_sessions")
    .select("id, scheduled_at, patient_id, therapist_id")
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd)
    .eq("reminder_status", "pendiente")
    .in("status", ["programada", "confirmada"]);

  if (fetchError) {
    console.error("[send-session-reminders] Error consultando sesiones:", fetchError);
    return new Response(`Error consultando sesiones: ${fetchError.message}`, { status: 500 });
  }

  const results: { sessionId: string; ok: boolean }[] = [];

  for (const session of (sessions ?? []) as SessionRow[]) {
    const ok = await sendReminderForSession(session);
    results.push({ sessionId: session.id, ok });
    await supabase
      .from("therapy_sessions")
      .update({ reminder_status: ok ? "enviado" : "fallido" })
      .eq("id", session.id);
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  return new Response(JSON.stringify({ processed: results.length, sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sendReminderForSession(session: SessionRow): Promise<boolean> {
  try {
    const [{ data: patient }, { data: therapist }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("id", session.patient_id).single(),
      supabase.from("profiles").select("full_name").eq("id", session.therapist_id).single(),
    ]);

    if (!patient?.email) {
      console.error(`[send-session-reminders] Paciente ${session.patient_id} sin correo.`);
      return false;
    }

    const scheduledDate = new Date(session.scheduled_at).toLocaleString("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Bogota",
    });
    const therapistName = therapist?.full_name ?? "tu terapeuta";
    const patientFirstName = (patient.full_name ?? "").split(" ")[0] || "Hola";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: patient.email,
        subject: "Recordatorio: tienes una sesión mañana en Mente en Foco",
        html: `
          <p>Hola ${patientFirstName},</p>
          <p>Te recordamos que tienes una sesión programada con <strong>${therapistName}</strong>:</p>
          <p style="font-size:16px;font-weight:bold;">${scheduledDate}</p>
          <p>Ingresa a tu cuenta en Mente en Foco para ver el enlace de la videollamada si ya está disponible.</p>
          <p>— Equipo Mente en Foco</p>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[send-session-reminders] Resend respondió ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[send-session-reminders] Error enviando recordatorio:", err);
    return false;
  }
}
