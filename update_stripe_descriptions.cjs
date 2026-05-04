const fs = require('fs');
const Stripe = require('stripe');

async function updateDescriptions() {
  console.log("Iniciando inyección de copywriting empático en Stripe...");

  const STRIPE_SECRET_KEY = "sk_test_51TOL2XF2VoNmnjBfa3kzdBpJpUmejAyTZeIpCsDKCZ9MnhWS3xr0lXSK4d5n61s0wYnpKycS9uc052znT63DaOnC00zLTVfbcO";
  const stripe = Stripe(STRIPE_SECRET_KEY);

  try {
    const products = await stripe.products.list({ limit: 100 });
    
    // Texts
    const txtEsencial = "Con este paquete tendrás acceso a 1 sesión individual de psicoterapia al mes. Si es tu primera vez con nosotros, incluimos una valoración inicial completamente gratis. Además, tendrás a tu disposición material de apoyo digital específico para tu caso y atención por chat en horario laboral.";
    const txtIntegral = "Da un paso más profundo en tu bienestar con 2 sesiones individuales al mes. Incluye todo lo del paquete esencial, sumando un seguimiento quincenal más cercano, ejercicios prácticos personalizados y acceso prioritario a la agenda de nuestros especialistas.";
    const txtPremium = "El acompañamiento definitivo. Disfruta de 4 sesiones al mes (una por semana) para un proceso terapéutico continuo e intensivo. Tendrás soporte prioritario 24/7 vía chat, acceso total a la Bóveda Plus, y materiales exclusivos diseñados a la medida de tu progreso.";
    const txtMensual = "Únete a nuestra comunidad con acceso completo a la Bóveda Plus. Disfruta de nuevos artículos, videos y guías de salud mental cada semana, además de descuentos exclusivos en futuros paquetes de asesoramiento.";
    const txtAnual = "Asegura tu bienestar para todo el año con un gran descuento. Obtendrás acceso ininterrumpido a todo el contenido premium de la Bóveda Plus, herramientas de autoayuda descargables y tarifas preferenciales en todas nuestras terapias.";

    let memAnualLinkStr = null;

    for (const product of products.data) {
      if (product.name === 'Membresía Plus' || product.name === 'Membresía Plus Mensual') {
        // Update to Mensual
        await stripe.products.update(product.id, { name: 'Membresía Plus Mensual', description: txtMensual });
        console.log(`✅ Producto actualizado: Membresía Plus Mensual`);
      } else if (product.name === 'Paquete Esencial') {
        await stripe.products.update(product.id, { description: txtEsencial });
        console.log(`✅ Producto actualizado: Paquete Esencial`);
      } else if (product.name === 'Paquete Integral') {
        await stripe.products.update(product.id, { description: txtIntegral });
        console.log(`✅ Producto actualizado: Paquete Integral`);
      } else if (product.name === 'Paquete Premium') {
        await stripe.products.update(product.id, { description: txtPremium });
        console.log(`✅ Producto actualizado: Paquete Premium`);
      }
    }

    // Now check if Membresía Plus Anual exists, if not create it
    const anualCheck = products.data.find(p => p.name === 'Membresía Plus Anual');
    if (!anualCheck) {
      console.log("Creando producto separado para Membresía Plus Anual para inyectar su propio copy...");
      const memAnual = await stripe.products.create({ name: 'Membresía Plus Anual', description: txtAnual });
      const pAnual = await stripe.prices.create({ product: memAnual.id, unit_amount: 70000000, currency: 'cop', recurring: { interval: 'year' } });
      const anualLinkObj = await stripe.paymentLinks.create({ line_items: [{ price: pAnual.id, quantity: 1 }] });
      memAnualLinkStr = anualLinkObj.url;
      console.log(`✅ Producto creado y actualizado: Membresía Plus Anual`);
      
      // We will output this link to update the frontend
      fs.writeFileSync('new_anual_link.txt', memAnualLinkStr);
    } else {
      await stripe.products.update(anualCheck.id, { description: txtAnual });
      console.log(`✅ Producto actualizado: Membresía Plus Anual`);
    }

    console.log("\n🚀 Actualización completada exitosamente.");
  } catch (error) {
    console.error("❌ Error conectando con Stripe:", error.message);
  }
}

updateDescriptions();
