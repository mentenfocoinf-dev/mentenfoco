// Cliente de Supabase para React Native. Misma base que src/lib/supabase.ts de la web, adaptado:
// - AsyncStorage en vez de localStorage (RN no tiene localStorage).
// - react-native-url-polyfill porque el runtime de RN no trae `URL` completo, y supabase-js lo
//   necesita para armar las peticiones.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Tipos derivados del schema (mismos que src/lib/supabase.ts de la web) ──────────────────────
export type UserRole = "admin" | "therapist" | "patient";
export type PlanType = "free" | "esencial" | "integral" | "premium";

export interface Profile {
  id: string;
  role: UserRole;
  plan_type: PlanType;
  subscription_status: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  professional_card?: string | null;
  session_token?: string | null;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at: string;
}
