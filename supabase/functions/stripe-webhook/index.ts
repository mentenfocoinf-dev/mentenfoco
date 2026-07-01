import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@16.12.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      let userId = session.client_reference_id;
      const customerId = session.customer;
      const customerEmail = session.customer_details?.email;
      const customerName = session.customer_details?.name || "Paciente";

      const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
      const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      let generatedPassword = null;

      // LÓGICA TRANSACCIONAL: Si no hay userId (compra directa sin cuenta), creamos el usuario
      if (!userId && customerEmail) {
        // Credenciales Espejo: el correo funciona como contraseña inicial
        generatedPassword = customerEmail;

        // 1. Creación de cuenta puenteando el bloqueo público (API Admin)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: customerEmail,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { full_name: customerName },
        });

        if (authError || !authData.user) {
          console.error("Error crítico creando usuario en Auth:", authError);
          return new Response(JSON.stringify({ error: authError?.message }), { status: 500 });
        }

        userId = authData.user.id;
        console.log(`✅ Nuevo usuario creado exitosamente vía transacción: ${userId}`);
      }

      if (userId) {
        // 2. UPSERT en tabla profiles
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: userId,
            full_name: customerName,
            plan_type: "premium",
            subscription_status: "active",
            stripe_customer_id: customerId as string,
            role: "patient",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        if (profileError) {
          console.error(`Error en UPSERT del perfil ${userId}:`, profileError);
          return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
        }

        console.log(`✅ Perfil sincronizado y marcado como Premium: ${userId}`);

        // 3. Log de Credenciales Espejo.
        if (generatedPassword && customerEmail) {
          console.log(
            `✅ Cuenta configurada bajo modelo de Credenciales Espejo. Usuario accederá con su email.`,
          );
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
