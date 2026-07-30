import { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "../lib/supabase";
import { shouldRedirectToGate, getClinicalConsentState } from "../lib/api";

// Logger condicional: solo activo en desarrollo
const log = {
  info: (...args: unknown[]) => { if (import.meta.env.DEV) console.info(...args); },
  warn: (...args: unknown[]) => { if (import.meta.env.DEV) console.warn(...args); },
  error: (...args: unknown[]) => { if (import.meta.env.DEV) console.error(...args); },
};

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ session: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    // 2. Escuchar cambios (login, logout, refresh)
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

  async function fetchProfile(userId: string, email?: string) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) {
        log.error("[useAuth] Error fetching profile:", profileError.message);
      }
      if (!profileData) {
        log.warn("[useAuth] Profile NULL for user:", userId, "— Posible fallo de RLS.");
        setProfile(null);
        return;
      }

      // Inyectar email de la sesión al objeto del perfil
      profileData.email = email;

      log.info("[useAuth] Profile loaded:", {
        role: profileData.role,
        plan: profileData.plan_type,
      });

      // 1. Single Device Session Logic
      // NOTA (temporal, fase de desarrollo): antes esto cerraba la sesión por completo
      // cuando el token local no coincidía con el guardado en el perfil. Como
      // localStorage se comparte entre TODAS las cuentas de prueba dentro del mismo
      // navegador (admin/terapeuta/paciente logueándose sucesivamente en el mismo
      // origin), cualquier cambio de cuenta disparaba un "sesión en otro dispositivo"
      // contra sí mismo y entraba en bucle de logout inmediato tras el login.
      // Mientras se prioriza avanzar en funcionalidad (seguridad al final del roadmap),
      // esta cuenta ("reclama") el dispositivo en vez de cerrar sesión. Antes de pasar
      // a producción, esto debe volver a forzar el signOut real.
      let localSessionToken = localStorage.getItem("mf_session_token");

      if (!localSessionToken || localSessionToken !== profileData.session_token) {
        localSessionToken = crypto.randomUUID();
        localStorage.setItem("mf_session_token", localSessionToken);
        await supabase
          .from("profiles")
          .update({ session_token: localSessionToken })
          .eq("id", userId);
        profileData.session_token = localSessionToken;
      }

      // 2. Pasos obligatorios antes del portal (contraseña temporal,
      // consentimiento de datos, datos mínimos de facturación, consentimiento
      // clínico, anamnesis). El orden y las condiciones viven en
      // resolveRequiredGate: aquí solo se aplica el resultado, para que no vuelva
      // a haber varios flujos de "pantalla obligatoria" repartidos por el hook.
      //
      // El paso clínico necesita datos que el perfil no tiene (si hay proceso
      // abierto y si existe la versión vigente del consentimiento), así que se
      // resuelven aparte. Solo para pacientes: al staff no le aplica y sería una
      // consulta por cada carga de sesión sin motivo.
      let clinical;
      if (profileData.role === "patient") {
        const estado = await getClinicalConsentState(profileData);
        clinical = {
          inClinicalProcess: estado.estado !== "no_aplica",
          hasCurrentConsent: estado.estado === "aceptado",
        };
      }

      const gate = shouldRedirectToGate(profileData, window.location.pathname, clinical);
      if (gate) {
        window.location.href = gate;
        return;
      }

      setProfile(profileData);
    } catch (err) {
      log.error("[useAuth] Excepción no controlada en fetchProfile:", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
