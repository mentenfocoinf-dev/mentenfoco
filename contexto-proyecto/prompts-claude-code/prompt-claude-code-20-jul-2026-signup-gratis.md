# Prompt para Claude Code — Cuenta gratuita autoservicio + gaps de terapeuta

Contexto: yo (Claude en Cowork) no tengo acceso de red al proyecto Supabase real desde mi sandbox
(confirmado con curl: `HTTP_STATUS:000`), así que no pude loguearme con las credenciales de prueba
que me pasó el usuario para revisar en vivo el panel de terapeuta. Diseñé todo el feature de abajo
por código, pero **tú tienes que ejecutarlo, migrarlo y probarlo en vivo** contra el proyecto real
(`eluxdqsprbgtnwznmxqe.supabase.co`).

Credenciales de prueba (ya existen, no las crees):
```
admin@test.com
terapeuta@test.com
paciente.free@test.com
paciente.esencial@test.com
paciente.integral@test.com
paciente.premium@test.com
Contraseña (todas): MenteFoco2026!Test
```

## Parte 0 — Revisión en vivo del panel de terapeuta (antes de programar nada)

Loguéate como `terapeuta@test.com` y confirma o descarta estos 7 gaps que identifiqué leyendo el
código (no pude verlos corriendo):

1. Sin registro de consentimiento informado (Ley 1090/2006 lo exige).
2. Sin informe formal exportable/imprimible (hoy solo hay nota de evolución interna en
   `ClinicalReportModal.tsx`, sin PDF con membrete para entregar a paciente/EPS/colegio).
3. Plan de tratamiento sin estructura (solo el campo libre "P" del SOAP; Ley 1616/2013 espera
   objetivos, modalidad, frecuencia, pronóstico).
4. `dismissCrisisAlert` en `TherapistDashboard.tsx` (línea ~245) solo oculta la alerta en el
   cliente — no persiste qué acción tomó el terapeuta. Confírmalo con una alerta de prueba.
5. Anamnesis (`src/routes/anamnesis.tsx`) no recoge antecedentes personales no patológicos
   (desarrollo, escolaridad, ocupación) — solo médico/psiquiátrico/sustancias/autolesión.
6. Sin campo de remisión/interconsulta a psiquiatría o neurología.
7. Sin informe de cierre/egreso de proceso terapéutico (distinto de la nota de evolución).

Repórtame cuáles de estos 7 confirmaste viendo la UI real, y si encuentras algo adicional que yo
no vi por solo leer código (por ejemplo, algo que se ve roto o vacío en pantalla).

No implementes soluciones a estos 7 todavía — primero construye la Parte 1 (abajo), que es lo que
el usuario pidió con prioridad hoy. Los 7 gaps quedan para la siguiente iteración.

## Parte 1 — Botón "Crear cuenta gratis" (lead capture + email marketing)

### Objetivo de negocio (no lo pierdas de vista al implementar)
Esta cuenta gratuita **no da acceso a nada del producto real** (sin terapeuta asignado, sin
sesiones, sin mensajería). Su único propósito es: (a) capturar datos de contacto de leads
interesados, (b) dejarlos entrar a ver unas pocas guías gratuitas como gancho, (c) tener su
consentimiento explícito para email marketing. Todo lo que construyas debe reflejar eso — no le
des a esta cuenta ningún acceso adicional "por si acaso".

### 1.1 Migración SQL — `supabase/20260720_signup_gratis.sql`

```sql
-- Columnas nuevas en profiles para soportar el signup autoservicio.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_source text;

-- Curaduría de guías gratuitas visibles para cuentas plan_type = 'free'. Los planes de pago
-- (esencial/integral/premium) siguen viendo TODAS las guías no premium, como hasta ahora — esta
-- columna solo restringe más a la cuenta gratuita de captura de leads.
ALTER TABLE clinical_guides
  ADD COLUMN IF NOT EXISTS visible_en_plan_gratis boolean NOT NULL DEFAULT false;

-- Marca aquí 3-5 guías como vitrina gratuita (ajusta los ids reales de tu catálogo; pide al
-- usuario cuáles quiere destacar si no es obvio, o elige una por categoría para variedad).
-- Ejemplo (reemplaza los ids):
-- UPDATE clinical_guides SET visible_en_plan_gratis = true WHERE id IN ('id-1', 'id-2', 'id-3');

-- Reemplaza la política de guías gratuitas: ahora depende de si el usuario es un plan_type='free'
-- de este signup, o un cliente pagante (que sigue viendo todo el catálogo no-premium).
DROP POLICY IF EXISTS "Permitir lectura de guías gratuitas" ON clinical_guides;
CREATE POLICY "Permitir lectura de guías gratuitas" ON clinical_guides
  FOR SELECT USING (
    es_premium = false
    AND (
      visible_en_plan_gratis = true
      OR NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.plan_type = 'free'
      )
    )
  );

COMMENT ON COLUMN profiles.must_change_password IS
  'true tras signup autoservicio: fuerza pantalla de "crea tu contraseña" en el primer login.';
COMMENT ON COLUMN profiles.terms_accepted_at IS
  'Timestamp de aceptación de términos/tratamiento de datos (Ley 1581 de 2012). No debe ser null para cuentas creadas por signup-gratis.';
```

Verifica con las 6 cuentas de prueba existentes que el `ALTER TABLE ... ADD COLUMN` con
`DEFAULT false` no rompe nada (no debería, es no-breaking).

### 1.2 Edge Function — `supabase/functions/public-signup/index.ts`

Función pública (sin JWT de usuario, la llama un visitante anónimo). Usa el **service role key**
internamente (nunca se expone al cliente) para crear el usuario en Auth con contraseña generada
por el sistema.

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Mente en Foco <onboarding@resend.dev>";
const TERMS_VERSION = "2026-07-20-v1";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return "Mf-" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, full_name, phone, terms_accepted, marketing_consent } = await req.json();

    if (!email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Correo inválido." }), { status: 400, headers: cors });
    }
    if (!full_name || String(full_name).trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nombre inválido." }), { status: 400, headers: cors });
    }
    if (terms_accepted !== true) {
      return new Response(
        JSON.stringify({ error: "Debes aceptar el tratamiento de datos para continuar." }),
        { status: 400, headers: cors },
      );
    }

    // Evita duplicados: si el correo ya existe en Auth, no crear otro usuario.
    const { data: existing } = await admin.auth.admin.listUsers();
    // NOTA: listUsers pagina de a 50 por defecto — si el volumen de usuarios crece, cambia esto
    // por una consulta a `profiles` por email, o por auth.admin.getUserById si ya guardas el id.
    // Para el volumen actual del proyecto (fase de pruebas) esto es aceptable.
    const alreadyExists = existing.users.some((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (alreadyExists) {
      return new Response(
        JSON.stringify({ error: "Ya existe una cuenta con ese correo. Inicia sesión en vez de crear una nueva." }),
        { status: 409, headers: cors },
      );
    }

    const password = generatePassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no mandamos el correo de confirmación de Supabase, mandamos el nuestro con las credenciales
      user_metadata: { full_name },
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "No se pudo crear el usuario.");
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: created.user.id,
      role: "patient",
      plan_type: "free",
      subscription_status: "inactive",
      full_name,
      phone: phone ?? null,
      must_change_password: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
      marketing_consent: marketing_consent === true,
      signup_source: "web_free_signup",
      onboarding_completed: false,
    });
    if (profileError) throw new Error(profileError.message);

    // Email con credenciales — mismo proveedor (Resend) que ya usa send-session-reminders.
    const loginUrl = Deno.env.get("SITE_URL") ?? "https://mente-en-foco.com";
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "Tus credenciales de acceso a Mente en Foco",
        html: `
          <p>Hola ${full_name},</p>
          <p>Tu cuenta gratuita en Mente en Foco ya está lista. Estos son tus datos de acceso:</p>
          <p><strong>Correo:</strong> ${email}<br/><strong>Contraseña temporal:</strong> ${password}</p>
          <p>Al ingresar por primera vez te pediremos que la cambies por una contraseña propia.</p>
          <p><a href="${loginUrl}/ingresa">Ingresar a mi cuenta</a></p>
          <p style="color:#888;font-size:12px;">Si no solicitaste esta cuenta, ignora este correo.</p>
        `,
      }),
    });
    if (!emailRes.ok) {
      console.error("[public-signup] Resend error:", await emailRes.text());
      // No revertimos la creación del usuario por un fallo de email — lo dejamos para retry manual,
      // pero sí lo reportamos como error para que el frontend avise al usuario de revisar soporte.
      return new Response(
        JSON.stringify({ error: "Cuenta creada, pero no pudimos enviar el correo. Contáctanos." }),
        { status: 502, headers: cors },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[public-signup] Error:", err);
    return new Response(JSON.stringify({ error: "Error inesperado. Intenta de nuevo." }), {
      status: 500,
      headers: cors,
    });
  }
});
```

Despliega con:
```
supabase functions deploy public-signup --no-verify-jwt
supabase secrets set SITE_URL=<url real de producción>
```
(`RESEND_API_KEY` y `REMINDER_FROM_EMAIL` ya están seteados del feature de recordatorios — reusa
los mismos, no dupliques secretos.)

**Nota sobre abuso:** esta función es pública y sin JWT — cualquiera puede llamarla. Para el
volumen actual (fase de pruebas) no es urgente, pero antes de anunciar el signup masivamente,
considera: (a) un captcha simple en el frontend, (b) un rate-limit por IP en la función (ej. tabla
`signup_attempts` con timestamp, máx. 3 por IP por hora). Impleméntalo si tienes tiempo, pero no
bloquees el lanzamiento por esto — díselo al usuario como pendiente conocido.

### 1.3 Frontend

**Componente nuevo:** `src/components/SignupModal.tsx` — mismo estilo `glass-card` / `card-neon-hover`
que el resto del sitio (revisa `ClinicalReportModal.tsx` o `CssrsModal.tsx` como referencia de
modal). Campos: nombre completo, correo, teléfono (input `type="tel"`), checkbox de aceptación de
términos (obligatorio, ver texto abajo) y checkbox separado de consentimiento de marketing
(opcional — puede estar desmarcado y aun así crear la cuenta, ya que el tratamiento de datos base
para operar la cuenta no requiere marketing, pero SÍ es indispensable para que el usuario reciba
las campañas). Al enviar, llama:
```ts
const { data, error } = await supabase.functions.invoke("public-signup", {
  body: { email, full_name, phone, terms_accepted: true, marketing_consent },
});
```
Muestra estado de éxito ("Revisa tu correo, te enviamos tus credenciales de acceso") o el mensaje
de error que devuelva la función.

**Botón "Crear cuenta gratis":** agrégalo en `src/routes/ingresa.tsx` (junto al formulario de
login existente) y considera también un CTA secundario en `index.tsx` (landing) apuntando al mismo
modal — el usuario no especificó dónde exactamente, usa criterio de UX pero no lo escondas.

**Texto de términos y condiciones (checkbox obligatorio)** — cúmplelo literal o ajusta solo lo
necesario, está redactado para cumplir los 3 elementos mínimos de un aviso de privacidad bajo la
Ley 1581 de 2012 (identidad/contacto del responsable, finalidad del tratamiento, mecanismo para
ejercer derechos):

> Autorizo a Mente en Foco (contacto: mentenfocoinf@gmail.com) a tratar mis datos personales
> (nombre, correo electrónico y teléfono) con la finalidad de crear mi cuenta gratuita en la
> plataforma, darme acceso a contenido de bienestar de cortesía, y — si marco la casilla de
> comunicaciones — enviarme información comercial y de marketing sobre nuestros servicios. Podré
> conocer, actualizar, rectificar o solicitar la eliminación de mis datos en cualquier momento
> escribiendo al correo anterior, de acuerdo con la Ley 1581 de 2012 y sus decretos reglamentarios.

**Pantalla de cambio de contraseña obligatorio:** en el flujo de login (`ingresa.tsx` /
`useAuth.tsx`), después de autenticar, si `profile.must_change_password === true`, redirige a una
pantalla nueva (`src/routes/nueva-contrasena.tsx`) que:
1. Pide la nueva contraseña (con confirmación, validación mínima de longitud/complejidad).
2. Llama `supabase.auth.updateUser({ password: nuevaContrasena })`.
3. Hace `UPDATE profiles SET must_change_password = false WHERE id = ...`.
4. Redirige al dashboard normal según `role`/`plan_type`.
No dejes que el usuario navegue a ninguna otra ruta del portal mientras `must_change_password` sea
`true` (igual que ya existe la lógica de redirección forzosa a onboarding en `useAuth.tsx` — sigue
ese mismo patrón).

### 1.4 Guías gratuitas curadas

Marca 3-5 guías reales del catálogo con `visible_en_plan_gratis = true` (ver punto 1.1). Si no es
obvio cuáles, pregúntale al usuario cuáles quiere usar como gancho antes de decidir por tu cuenta —
esto es una decisión de producto/marketing, no solo técnica.

### 1.5 Prueba end-to-end obligatoria antes de reportar terminado

1. Ejecuta la migración contra el proyecto real.
2. Despliega la función y confirma que los secretos están seteados.
3. Desde el sitio, crea una cuenta nueva de prueba (usa un correo real tuyo o uno temporal) y
   confirma: (a) llega el correo con credenciales, (b) el primer login fuerza cambio de
   contraseña, (c) tras cambiarla, el dashboard de paciente solo muestra las guías marcadas como
   `visible_en_plan_gratis`, (d) no tiene terapeuta asignado ni acceso a sesiones/mensajería.
4. Confirma que las 6 cuentas de prueba existentes (`paciente.free@test.com`, etc.) siguen
   funcionando sin cambios de comportamiento inesperados tras la migración.

## Qué hacer con este documento

1. Empieza por la Parte 0 (revisión en vivo) y repórtame qué confirmaste de los 7 gaps.
2. Luego implementa la Parte 1 completa (SQL + función + frontend) y corre la prueba end-to-end
   de 1.5 antes de avisarme que está listo.
3. Cuando termines, dime explícitamente: qué guías quedaron marcadas como gratuitas, si el envío
   de correo funcionó, y si encontraste algo que no cuadraba con esta especificación (mejor que lo
   ajustes con criterio y me avises qué cambiaste, a que te quedes bloqueado).
