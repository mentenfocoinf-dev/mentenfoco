import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { FileText, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/anamnesis")({
  head: () => ({
    meta: [
      { title: "Onboarding y Anamnesis — Mente en Foco" },
      { name: "description", content: "Completa tu perfil para iniciar." },
    ],
  }),
  component: Anamnesis,
});

function Anamnesis() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Si ya completó el onboarding, no debería estar aquí
  if (profile?.onboarding_completed) {
    navigate({ to: "/ingresa", replace: true });
    return null;
  }

  // Si es terapeuta o admin, redirigir de vuelta al dashboard
  if (profile?.role === "therapist" || profile?.role === "admin") {
    navigate({ to: "/ingresa", replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Por favor, ingresa tu nombre completo.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Guardar nombre y marcar onboarding completado
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName, onboarding_completed: true })
        .eq("id", profile.id);

      if (!error) {
        window.location.href = "/ingresa";
      } else {
        console.error("[Anamnesis] Error al guardar perfil:", error);
        setErrorMsg("Error al guardar. Intenta de nuevo.");
        setLoading(false);
      }
    } catch (err) {
      console.error("[Anamnesis] Excepción:", err);
      setErrorMsg("Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16">
      <div className="card-neon-hover w-full max-w-2xl rounded-3xl glass bg-white/60 p-10 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Bienvenido a tu Espacio</h1>
          <p className="mt-3 text-slate-600">
            Para personalizar tu experiencia y habilitar tu dashboard, necesitamos que completes
            esta breve información inicial.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-900">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María García López"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  Completar Perfil y Acceder <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
