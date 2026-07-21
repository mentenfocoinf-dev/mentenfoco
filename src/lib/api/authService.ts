// ============================================================================
// Servicio de autenticación: único punto de entrada/salida de sesión.
// ============================================================================
import { supabase } from "../supabase";

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Credenciales incorrectas. Verifica tu correo y contraseña.");
}

export async function signOut() {
  localStorage.removeItem("mf_session_token");
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/ingresa`,
  });
  if (error) throw new Error("No pudimos enviar el correo. Verifica el email ingresado.");
}

// ── Inicio de sesión con proveedores externos ───────────────────────────────

export type OAuthProvider = "google" | "facebook";

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  facebook: "Facebook",
};

/**
 * Redirige al proveedor externo. Supabase devuelve al usuario a /ingresa con la
 * sesión ya establecida, y useAuth se encarga del resto (perfil, onboarding).
 *
 * Un proveedor que no esté habilitado en el panel de Supabase Auth responde con
 * "provider is not enabled": se traduce a un mensaje entendible en vez de dejar
 * el error crudo en pantalla.
 */
export async function signInWithProvider(provider: OAuthProvider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/ingresa` },
  });

  if (error) {
    const raw = error.message?.toLowerCase() ?? "";
    if (raw.includes("not enabled") || raw.includes("unsupported provider")) {
      throw new Error(
        `El acceso con ${PROVIDER_LABELS[provider]} aún no está habilitado. Ingresa con tu correo y contraseña.`,
      );
    }
    throw new Error(`No pudimos conectar con ${PROVIDER_LABELS[provider]}. Intenta de nuevo.`);
  }
}
