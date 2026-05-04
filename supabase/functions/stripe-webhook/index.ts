import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature provided", { status: 400 });
  }

  const body = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret!,
      undefined,
      cryptoProvider
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`Evento recibido: ${event.type}`);

  // -------------------------------------------------------------
  // ESTRUCTURA BASE DEL WEBHOOK
  // -------------------------------------------------------------
  try {
    switch (event.type) {
      
      // Evento para "Paquetes de Asesoramiento" (pagos únicos)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Checkout completado para la sesión: ${session.id}`);
        // TODO: Extraer el cliente y el producto
        // TODO: Actualizar supabase.from('profiles') o crear registro en 'sessions'
        break;
      }

      // Evento para "Membresía Plus" (suscripciones recurrentes)
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Suscripción actualizada: ${subscription.id}, Status: ${subscription.status}`);
        // TODO: Actualizar supabase.from('profiles').update({ plan_type: 'premium', subscription_status: subscription.status })
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Suscripción cancelada: ${subscription.id}`);
        // TODO: Remover acceso premium en Supabase
        break;
      }

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error(`Error procesando el webhook: ${error.message}`);
    return new Response(`Webhook handler failed: ${error.message}`, { status: 500 });
  }
});
