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
