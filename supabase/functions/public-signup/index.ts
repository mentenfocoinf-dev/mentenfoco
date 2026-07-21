// ============================================================================
// Signup autoservicio de cuenta gratuita (captura de leads).
//
// Funcion PUBLICA: la invoca un visitante anonimo, sin JWT de usuario. Por eso
// se despliega con --no-verify-jwt. El service role key solo vive aqui dentro,
// nunca llega al cliente.
//
// La cuenta creada no da acceso al producto real: rol patient, plan free, sin
// terapeuta asignado. Solo ve la vitrina de guias marcadas visible_en_plan_gratis.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Mente en Foco <onboarding@resend.dev>";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://mente-en-foco.com";
// Debe coincidir con PRIVACY_POLICY_VERSION en src/components/PrivacyPolicyModal.tsx:
// es la version del texto que el lead acepto y queda guardada en profiles.terms_version.
const TERMS_VERSION = "2026-07-21-v3";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Contrasena temporal legible pero no adivinable: 16 bytes de crypto en base36,
// con prefijo que garantiza mayuscula, minuscula y simbolo para cualquier politica
// de complejidad que se configure en Auth mas adelante.
function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const body = Array.from(bytes, (b) => b.toString(36)).join("").slice(0, 14);
  return `Mf-${body}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fail(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { email, full_name, phone, terms_accepted, marketing_consent } = await req.json();

    if (!email || !isValidEmail(email)) return fail("Correo inválido.", 400);
    if (!full_name || String(full_name).trim().length < 2) return fail("Nombre inválido.", 400);
    if (terms_accepted !== true) {
      return fail("Debes aceptar el tratamiento de datos para continuar.", 400);
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(full_name).trim();

    // Evita duplicados consultando profiles por email en vez de paginar auth.admin.listUsers()
    // (que trae solo 50 por pagina y se rompe en silencio al crecer el volumen).
    const { data: existing, error: existingError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return fail(
        "Ya existe una cuenta con ese correo. Inicia sesión en vez de crear una nueva.",
        409,
      );
    }

    const password = generatePassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      // No mandamos el correo de confirmacion de Supabase: enviamos el nuestro con credenciales.
      email_confirm: true,
      user_metadata: { full_name: cleanName },
    });
    if (createError || !created.user) {
      // createUser tambien falla si el correo ya existe en Auth pero no en profiles
      // (cuenta huerfana). Lo reportamos como conflicto, no como error inesperado.
      if (createError?.message?.toLowerCase().includes("already")) {
        return fail("Ya existe una cuenta con ese correo. Inicia sesión.", 409);
      }
      throw new Error(createError?.message ?? "No se pudo crear el usuario.");
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: created.user.id,
      email: cleanEmail,
      role: "patient",
      plan_type: "free",
      subscription_status: "inactive",
      full_name: cleanName,
      phone: phone ? String(phone).trim() : null,
      must_change_password: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
      marketing_consent: marketing_consent === true,
      signup_source: "web_free_signup",
      // true a proposito: onboarding_completed=false empuja a /anamnesis, que es la
      // entrevista clinica de un paciente real. Un lead de captura no debe entrar ahi.
      onboarding_completed: true,
    });
    if (profileError) {
      // Deja el Auth user sin perfil huerfano si el upsert falla.
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    // Email con credenciales — mismo proveedor (Resend) que send-session-reminders.
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [cleanEmail],
        subject: "Tus credenciales de acceso a Mente en Foco",
        html: `
          <p>Hola ${escapeHtml(cleanName)},</p>
          <p>Tu cuenta gratuita en Mente en Foco ya está lista. Estos son tus datos de acceso:</p>
          <p><strong>Correo:</strong> ${escapeHtml(cleanEmail)}<br/>
             <strong>Contraseña temporal:</strong> ${escapeHtml(password)}</p>
          <p>Al ingresar por primera vez te pediremos que la cambies por una contraseña propia.</p>
          <p><a href="${SITE_URL}/ingresa">Ingresar a mi cuenta</a></p>
          <p style="color:#888;font-size:12px;">Si no solicitaste esta cuenta, ignora este correo.</p>
        `,
      }),
    });
    if (!emailRes.ok) {
      console.error("[public-signup] Resend error:", await emailRes.text());
      // No revertimos la cuenta por un fallo de correo: el lead ya quedo capturado y el
      // usuario puede recuperar acceso con "olvidé mi contraseña".
      return fail(
        "Creamos tu cuenta, pero no pudimos enviarte el correo. Usa \"¿Olvidaste tu contraseña?\" en la pantalla de ingreso o escríbenos.",
        502,
      );
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
  } catch (err) {
    console.error("[public-signup] Error:", err);
    return fail("Error inesperado. Intenta de nuevo.", 500);
  }
});
