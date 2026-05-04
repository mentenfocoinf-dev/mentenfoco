import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log("Probando conexión a Supabase (crm_leads)...");
  const { data, error, status } = await supabase.from('crm_leads').select('*').limit(1);
  
  if (error) {
    console.error("❌ Error en la conexión (crm_leads):", error.message, "Status:", status);
  } else {
    console.log("✅ Conexión exitosa. Status:", status, "Datos de crm_leads:", data);
  }
}

testConnection();
