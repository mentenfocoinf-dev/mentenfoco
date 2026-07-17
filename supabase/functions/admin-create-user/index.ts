// Edge Function: admin-create-user
// Allows an authenticated admin to create patient or therapist accounts.
// The service role key never leaves the backend — the frontend only calls
// this endpoint with the admin's JWT.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Verify the caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const asCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await asCaller.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerProfile?.role !== "admin") {
      return json({ error: "Solo un administrador puede crear usuarios" }, 403);
    }

    // 2. Validate payload
    const { email, password, full_name, role, plan_type } = await req.json();
    if (!email || !password || !full_name || !["patient", "therapist"].includes(role)) {
      return json({ error: "Datos incompletos o rol invalido" }, 400);
    }
    if (String(password).length < 8) {
      return json({ error: "La contrasena debe tener al menos 8 caracteres" }, 400);
    }
    const plan = ["free", "esencial", "integral", "premium"].includes(plan_type)
      ? plan_type
      : "free";

    // 3. Create the auth user (email confirmed, ready to log in)
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, plan_type: plan },
    });
    if (createError) return json({ error: createError.message }, 400);

    // 4. Make sure the profile reflects the requested role and plan
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role,
        plan_type: plan,
        subscription_status: role === "therapist" || plan !== "free" ? "active" : "inactive",
        full_name,
        email,
        onboarding_completed: role === "therapist",
      })
      .eq("id", created.user.id);
    if (profileError) return json({ error: profileError.message }, 500);

    return json({ ok: true, user_id: created.user.id });
  } catch (e) {
    return json({ error: `Error inesperado: ${String(e)}` }, 500);
  }
});
