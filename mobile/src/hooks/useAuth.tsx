// Adaptado de src/hooks/useAuth.tsx de la web. Diferencias a propósito:
// - Sin la lógica de "single device session" (session_token): en la web está deshabilitada
//   temporalmente por decisión del usuario (fase de pruebas) y no vale la pena portarla a ciegas.
// - Sin redirección forzada a /anamnesis: en móvil, la pantalla de Inicio simplemente muestra un
//   aviso si onboarding_completed es false, en vez de redirigir — más simple y menos propenso a
//   loops de navegación con Expo Router.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "../lib/supabase";

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string, email?: string | null) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error || !data) {
        console.error("[useAuth] Error cargando perfil (posible RLS):", error?.message);
        setProfile(null);
        return;
      }
      data.email = email;
      setProfile(data as Profile);
    } catch (err) {
      console.error("[useAuth] Excepción cargando perfil:", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    if (session?.user) await fetchProfile(session.user.id, session.user.email);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
