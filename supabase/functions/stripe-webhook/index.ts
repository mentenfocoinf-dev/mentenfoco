import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@16.12.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Contraseña aleatoria cripto (NUNCA derivada del email). Nadie la conoce: la
// cuenta se activa con el enlace de recuperación que se envía por correo, y el
// usuario define su propia contraseña. Mismo patrón que public-signup.
function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const body = Array.from(bytes, (b) => b.toString(36)).join("").slice(0, 14);
  return `Mf-${body}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");

  if (!signature) {
    return new Response("Webhook Error: Falta la firma de Stripe", { status: 400 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response("Webhook Error: Falta el secreto del Webhook", { status: 500 });
  }

  try {
    const body = await req.text();

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ── Idempotencia ─────────────────────────────────────────────────────────
    // Stripe entrega "al menos una vez": un reintento de red puede traer el mismo
    // evento dos veces. Registramos event.id ANTES de aplicar efectos; si ya
    // existía, es un reintento → 200 OK (no-op). NUNCA se responde con error: eso
    // Stripe lo tomaría como "reintenta más", empeorando el problema.
    const { data: nuevoEvento, error: idempotenciaError } = await supabase
      .from("stripe_processed_events")
      .upsert({ event_id: event.id }, { onConflict: "event_id", ignoreDuplicates: true })
      .select("event_id");

    if (idempotenciaError) {
      // Un fallo registrando el evento no debe bloquear el efecto (p. ej. crear la
      // cuenta): se deja en el log y se continúa. La idempotencia es best-effort
      // si la tabla no está disponible.
      console.error("[stripe-webhook] idempotencia:", idempotenciaError.message);
    } else if (!nuevoEvento || nuevoEvento.length === 0) {
      // event.id ya procesado → reintento → no-op seguro.
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      let userId = session.client_reference_id;
      const customerId = session.customer;
      const customerEmail = session.customer_details?.email;
      const customerName = session.customer_details?.name || "Paciente";

      let createdViaWebhook = false;

      // LÓGICA TRANSACCIONAL: Si no hay userId (compra directa sin cuenta), creamos el usuario
      if (!userId && customerEmail) {
        // Contraseña ALEATORIA, nunca el email. La cuenta se activa con el enlace
        // de recuperación que se envía más abajo; el usuario elige su propia clave.
        const password = generatePassword();

        // 1. Creación de cuenta puenteando el bloqueo público (API Admin)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: customerEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: customerName },
        });

        if (authError || !authData.user) {
          console.error("Error crítico creando usuario en Auth:", authError);
          // El efecto falló: se borra el registro de idempotencia para que el
          // reintento de Stripe SÍ reprocese (si no, el cliente pagó y quedaría
          // sin cuenta). Borrar es no-op si no se había registrado.
          await supabase.from("stripe_processed_events").delete().eq("event_id", event.id);
          return new Response(JSON.stringify({ error: authError?.message }), { status: 500 });
        }

        userId = authData.user.id;
        createdViaWebhook = true;
        console.log(`✅ Nuevo usuario creado exitosamente vía transacción: ${userId}`);
      }

      if (userId) {
        // 2. UPSERT en tabla profiles
        const profileData: Record<string, unknown> = {
          id: userId,
          full_name: customerName,
          plan_type: "premium",
          subscription_status: "active",
          stripe_customer_id: customerId as string,
          role: "patient",
          updated_at: new Date().toISOString(),
        };
        // Solo para cuentas NUEVAS creadas por el webhook: forzar que el usuario
        // defina su contraseña (defensa en profundidad; el gate ya existe en el
        // portal — onboardingGates). No se aplica a cuentas existentes que compran.
        if (createdViaWebhook) profileData.must_change_password = true;

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(profileData, { onConflict: "id" });

        if (profileError) {
          console.error(`Error en UPSERT del perfil ${userId}:`, profileError);
          // Igual que arriba: se revierte el registro para permitir el reintento.
          await supabase.from("stripe_processed_events").delete().eq("event_id", event.id);
          return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
        }

        console.log(`✅ Perfil sincronizado y marcado como Premium: ${userId}`);

        // 3. Cuenta nueva: enviar el enlace para que el usuario cree su contraseña
        //    —es lo que /compra-exitosa ya promete—. La entrega real depende de que
        //    el dominio de Resend esté verificado (R2); si el correo falla, la cuenta
        //    sigue segura (contraseña aleatoria) y el usuario puede pedir el enlace
        //    desde "¿Olvidaste tu contraseña?". No se hace fatal el webhook por esto.
        if (createdViaWebhook && customerEmail) {
          const SITE_URL = Deno.env.get("SITE_URL") ?? "https://mente-en-foco.com";
          const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: "recovery",
            email: customerEmail,
            options: { redirectTo: `${SITE_URL}/ingresa` },
          });

          const actionLink = linkData?.properties?.action_link;
          if (linkError || !actionLink) {
            console.error("No se pudo generar el enlace de activación:", linkError);
          } else {
            const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
            const FROM_EMAIL =
              Deno.env.get("REMINDER_FROM_EMAIL") ?? "Mente en Foco <onboarding@resend.dev>";
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: FROM_EMAIL,
                to: [customerEmail],
                subject: "Activa tu cuenta y crea tu contraseña — Mente en Foco",
                html: `
                  <p>Hola ${escapeHtml(customerName)},</p>
                  <p>Tu pago quedó confirmado y tu acompañamiento ya está activo.</p>
                  <p>Para entrar a tu espacio, crea tu contraseña con este enlace:</p>
                  <p><a href="${actionLink}">Crear mi contraseña</a></p>
                  <p>Por seguridad el enlace caduca. Si expira, puedes pedir uno nuevo desde
                     "¿Olvidaste tu contraseña?" en la pantalla de ingreso.</p>
                  <p style="color:#888;font-size:12px;">Si no reconoces esta compra, escríbenos.</p>
                `,
              }),
            });
            if (!emailRes.ok) {
              console.error("[stripe-webhook] Resend error:", await emailRes.text());
            }
          }
        }
      } else {
        console.warn(
          "⚠️ Evento ignorado: Falta client_reference_id y no se pudo capturar email para registro.",
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
