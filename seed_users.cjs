const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("❌ Falta VITE_SUPABASE_URL en el .env");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error("❌ Falta SERVICE_ROLE_KEY en el .env. Por favor añádelo (ej. SERVICE_ROLE_KEY=ey...).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createProfileRecord(userId, profileData) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profileData });
  
  if (error) {
    console.error(`❌ Error upserting profile for ${profileData.full_name}:`, error.message);
  } else {
    console.log(`✅ Perfil actualizado para ${profileData.full_name}`);
  }
}

async function seedUsers() {
  console.log("Iniciando Seeding de Cuentas de Prueba...");

  const usersToSeed = [
    {
      email: 'admin@test.com',
      password: 'Password123!',
      full_name: 'Administrador de Prueba',
      role: 'admin',
      plan_type: 'free',
      subscription_status: 'inactive'
    },
    {
      email: 'terapeuta@test.com',
      password: 'Password123!',
      full_name: 'Terapeuta de Prueba',
      role: 'therapist',
      plan_type: 'free',
      subscription_status: 'inactive'
    },
    {
      email: 'paciente@test.com',
      password: 'Password123!',
      full_name: 'Paciente de Prueba',
      role: 'patient',
      plan_type: 'premium',
      subscription_status: 'activate'
    }
  ];

  for (const u of usersToSeed) {
    console.log(`\nCreando usuario: ${u.email}...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true
    });

    if (error) {
      if (error.message.includes('already exists') || error.message.includes('already registered')) {
        console.log(`⚠️ El usuario ${u.email} ya existe. Buscando su ID...`);
        // If user already exists, we find the ID via admin.listUsers
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingUser = listData.users.find(usr => usr.email === u.email);
        if (existingUser) {
           await createProfileRecord(existingUser.id, {
            role: u.role,
            plan_type: u.plan_type,
            subscription_status: u.subscription_status,
            full_name: u.full_name
          });
        }
      } else {
        console.error(`❌ Error creando usuario ${u.email}:`, error.message);
      }
    } else {
      console.log(`✅ Usuario creado: ${data.user.id}`);
      await createProfileRecord(data.user.id, {
        role: u.role,
        plan_type: u.plan_type,
        subscription_status: u.subscription_status,
        full_name: u.full_name
      });
    }
  }

  console.log("\n------------------------------------------------");
  console.log("Fase 3: Verificación de Login para Paciente Premium");
  
  // Normal sign-in uses anon key ideally, but we can try it with service client since 
  // auth.signInWithPassword works on any client. However, testing RLS properly 
  // requires an anon/authenticated client. 
  
  const anonSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);
  
  const { data: authData, error: authError } = await anonSupabase.auth.signInWithPassword({
    email: 'paciente@test.com',
    password: 'Password123!'
  });

  if (authError) {
    console.error("❌ Falló la autenticación del Paciente Premium:", authError.message);
  } else {
    console.log("✅ Autenticación exitosa (Status 200). Usuario:", authData.user.email);
    
    // Check RLS by fetching profile
    const { data: profileData, error: profileError } = await anonSupabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    if (profileError) {
      console.error("❌ Falló la lectura del perfil debido a políticas RLS u otro error:", profileError.message);
    } else {
      console.log("✅ Perfil leído exitosamente a través de RLS. Datos:", profileData);
    }
  }

  console.log("\nProceso finalizado.");
}

seedUsers();
