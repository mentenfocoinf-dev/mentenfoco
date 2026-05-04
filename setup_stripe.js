const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const dotenv = require('dotenv');
dotenv.config();

async function createStripeInfrastructure() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY no encontrada en .env");
    return;
  }

  const stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  console.log("Iniciando creación de productos en Stripe...");

  try {
    // -------------------------------------------------------------
    // FASE 1: Membresía Plus (Suscripción Recurrente)
    // -------------------------------------------------------------
    console.log("Creando producto: Membresía Plus...");
    const membresiaProduct = await stripeClient.products.create({
      name: 'Membresía Plus',
      description: 'Acceso a contenido exclusivo, guías premium, IA 24/7 y comunidad privada.',
    });

    const mensualPrice = await stripeClient.prices.create({
      product: membresiaProduct.id,
      unit_amount: 7000000, // $70.000 COP = 70000 * 100 centavos
      currency: 'cop',
      recurring: { interval: 'month' },
    });

    const anualPrice = await stripeClient.prices.create({
      product: membresiaProduct.id,
      unit_amount: 70000000, // $700.000 COP = 700000 * 100 centavos
      currency: 'cop',
      recurring: { interval: 'year' },
    });

    const mensualLink = await stripeClient.paymentLinks.create({ line_items: [{ price: mensualPrice.id, quantity: 1 }] });
    const anualLink = await stripeClient.paymentLinks.create({ line_items: [{ price: anualPrice.id, quantity: 1 }] });

    // -------------------------------------------------------------
    // FASE 2: Paquetes de Asesoramiento (Pagos Únicos)
    // -------------------------------------------------------------
    console.log("Creando productos: Paquetes de Asesoramiento...");
    
    // Esencial
    const esencialProduct = await stripeClient.products.create({ name: 'Paquete Esencial' });
    const esencialPrice = await stripeClient.prices.create({
      product: esencialProduct.id,
      unit_amount: 18000000, // $180.000 COP
      currency: 'cop',
    });
    const esencialLink = await stripeClient.paymentLinks.create({ line_items: [{ price: esencialPrice.id, quantity: 1 }] });

    // Integral
    const integralProduct = await stripeClient.products.create({ name: 'Paquete Integral' });
    const integralPrice = await stripeClient.prices.create({
      product: integralProduct.id,
      unit_amount: 48000000, // $480.000 COP
      currency: 'cop',
    });
    const integralLink = await stripeClient.paymentLinks.create({ line_items: [{ price: integralPrice.id, quantity: 1 }] });

    // Premium
    const premiumProduct = await stripeClient.products.create({ name: 'Paquete Premium' });
    const premiumPrice = await stripeClient.prices.create({
      product: premiumProduct.id,
      unit_amount: 95000000, // $950.000 COP
      currency: 'cop',
    });
    const premiumLink = await stripeClient.paymentLinks.create({ line_items: [{ price: premiumPrice.id, quantity: 1 }] });

    // -------------------------------------------------------------
    // REPORTE
    // -------------------------------------------------------------
    console.log("\n✅ ¡Infraestructura de Stripe creada con éxito!");
    console.log("\n--- ENLACES DE PAGO (PAYMENT LINKS) ---");
    console.log(`Membresía Mensual: ${mensualLink.url}`);
    console.log(`Membresía Anual:   ${anualLink.url}`);
    console.log(`Paquete Esencial:  ${esencialLink.url}`);
    console.log(`Paquete Integral:  ${integralLink.url}`);
    console.log(`Paquete Premium:   ${premiumLink.url}`);

    const fs = require('fs');
    fs.writeFileSync('stripe_links.json', JSON.stringify({
      mensual: mensualLink.url,
      anual: anualLink.url,
      esencial: esencialLink.url,
      integral: integralLink.url,
      premium: premiumLink.url,
    }, null, 2));

  } catch (error) {
    console.error("❌ Error conectando con Stripe:", error.message);
  }
}

createStripeInfrastructure();
