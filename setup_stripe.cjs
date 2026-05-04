const fs = require('fs');

async function createStripeInfrastructure() {
  console.log("Iniciando creación de productos en Stripe...");

  const STRIPE_SECRET_KEY = "sk_test_51TOL2XF2VoNmnjBfa3kzdBpJpUmejAyTZeIpCsDKCZ9MnhWS3xr0lXSK4d5n61s0wYnpKycS9uc052znT63DaOnC00zLTVfbcO";
  
  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    
    // Membresia
    console.log("Creando Membresía Plus...");
    const memProduct = await stripe.products.create({ name: 'Membresía Plus' });
    const p1 = await stripe.prices.create({ product: memProduct.id, unit_amount: 7000000, currency: 'cop', recurring: { interval: 'month' } });
    const p2 = await stripe.prices.create({ product: memProduct.id, unit_amount: 70000000, currency: 'cop', recurring: { interval: 'year' } });
    
    const mensualLink = await stripe.paymentLinks.create({ line_items: [{ price: p1.id, quantity: 1 }] });
    const anualLink = await stripe.paymentLinks.create({ line_items: [{ price: p2.id, quantity: 1 }] });

    // Paquetes
    console.log("Creando Paquetes de Asesoramiento...");
    const prodE = await stripe.products.create({ name: 'Paquete Esencial' });
    const pE = await stripe.prices.create({ product: prodE.id, unit_amount: 18000000, currency: 'cop' });
    const esencialLink = await stripe.paymentLinks.create({ line_items: [{ price: pE.id, quantity: 1 }] });

    const prodI = await stripe.products.create({ name: 'Paquete Integral' });
    const pI = await stripe.prices.create({ product: prodI.id, unit_amount: 48000000, currency: 'cop' });
    const integralLink = await stripe.paymentLinks.create({ line_items: [{ price: pI.id, quantity: 1 }] });

    const prodP = await stripe.products.create({ name: 'Paquete Premium' });
    const pP = await stripe.prices.create({ product: prodP.id, unit_amount: 95000000, currency: 'cop' });
    const premiumLink = await stripe.paymentLinks.create({ line_items: [{ price: pP.id, quantity: 1 }] });

    console.log("\n✅ ¡Infraestructura de Stripe creada con éxito (REAL API)!");
    console.log("\n--- ENLACES DE PAGO (PAYMENT LINKS) ---");
    console.log(`Membresía Mensual: ${mensualLink.url}`);
    console.log(`Membresía Anual:   ${anualLink.url}`);
    console.log(`Paquete Esencial:  ${esencialLink.url}`);
    console.log(`Paquete Integral:  ${integralLink.url}`);
    console.log(`Paquete Premium:   ${premiumLink.url}`);

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
