// Servicio de autenticación. Misma lógica que src/lib/api/authService.ts de la web, sin
// localStorage (RN usa AsyncStorage vía el propio cliente de supabase-js, no hay que tocarlo
// manualmente aquí).
import { supabase } from "../supabase";

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Credenciales incorrectas. Verifica tu correo y contraseña.");
}

export async function signOut() {
  await supabase.auth.signOut();
}
