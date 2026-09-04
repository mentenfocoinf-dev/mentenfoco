// ============================================================================
// Cambio de contraseña obligatorio tras el signup autoservicio.
//
// useAuth redirige aquí mientras profile.must_change_password sea true, así que
// esta ruta es la única accesible del portal hasta que el usuario defina su
// propia contraseña (mismo patrón que la redirección forzosa a /anamnesis).
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { META_NOINDEX } from "../lib/seo";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

export const Route = createFileRoute("/nueva-contrasena")({
  head: () => ({
    meta: [META_NOINDEX, { title: "Crea tu contraseña — Mente en Foco" }],
  }),
  component: NuevaContrasena,
});

const MIN_LENGTH = 8;

const inputClass =
  "mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm";

function validate(password: string, confirm: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una minúscula y una mayúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  if (password !== confirm) {
    return "Las contraseñas no coinciden.";
  }
  return null;
}

function NuevaContrasena() {
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate(password, confirm);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);

      const userId = session?.user?.id;
      if (!userId) throw new Error("Sesión no disponible. Vuelve a iniciar sesión.");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userId);
      if (profileError) throw new Error(profileError.message);

      // Recarga completa para que useAuth vuelva a leer el perfil ya sin el flag
      // y enrute al dashboard que corresponda al rol.
      window.location.href = "/ingresa";
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Ocurrió un error inesperado. Intenta de nuevo.",
      );
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[80vh] w-full items-center justify-center px-4 py-16 md:px-6">
      <div className="card-neon-hover w-full max-w-md rounded-3xl glass bg-white/40 p-10 shadow-xl transition-all">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
            <KeyRound size={32} strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-primary drop-shadow-sm">
            Crea tu contraseña
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Por seguridad, reemplaza la contraseña temporal que te enviamos por correo.
          </p>
        </div>

        {errorMsg && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-600"
          >
            {errorMsg}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="new-pass" className="text-sm font-semibold text-primary">
              Nueva contraseña
            </label>
            <input
              id="new-pass"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mínimo {MIN_LENGTH} caracteres, con mayúscula, minúscula y número.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-pass" className="text-sm font-semibold text-primary">
              Confirma la contraseña
            </label>
            <input
              id="confirm-pass"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Guardando…
              </>
            ) : (
              "Guardar contraseña"
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
