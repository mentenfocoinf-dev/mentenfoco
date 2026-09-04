// ============================================================================
// Micro-tracker de estado de ánimo.
//
// Cinco niveles representados con barras de altura creciente en vez de caritas:
// mantiene el registro visual limpio y evita la lectura infantilizada que un
// emoji introduce en un contexto clínico.
// ============================================================================
import { useEffect, useState } from "react";
import { Check, HeartPulse, Loader2 } from "lucide-react";
import { getTodayMood, saveTodayMood, MOOD_OPTIONS, type MoodValue } from "../../lib/api";

interface Props {
  patientId: string;
}

export function MoodTrackerCard({ patientId }: Props) {
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<MoodValue | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTodayMood(patientId)
      .then((value) => {
        if (active) setMood(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  async function handleSelect(value: MoodValue) {
    setSaving(value);
    setErrorMsg(null);
    try {
      await saveTodayMood(patientId, value);
      setMood(value);
    } catch {
      setErrorMsg("No pudimos guardar tu registro.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center gap-2 text-primary">
        <HeartPulse size={16} strokeWidth={2} />
        <h3 className="text-sm font-bold">¿Cómo te sientes hoy?</h3>
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center py-3">
          <Loader2 size={18} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between gap-1.5">
            {MOOD_OPTIONS.map(({ value, label }) => {
              const selected = mood === value;
              return (
                <button
                  key={value}
                  onClick={() => handleSelect(value)}
                  disabled={saving !== null}
                  aria-label={label}
                  aria-pressed={selected}
                  title={label}
                  className={`group flex flex-1 flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-all disabled:cursor-not-allowed ${
                    selected ? "bg-primary/10" : "hover:bg-slate-100"
                  }`}
                >
                  <span
                    // La altura crece con el nivel: el valor se lee de un vistazo.
                    style={{ height: `${10 + value * 6}px` }}
                    className={`w-2 rounded-full transition-all ${
                      selected ? "bg-primary" : "bg-slate-300 group-hover:bg-primary/50"
                    }`}
                  />
                  <span
                    className={`text-[10px] leading-tight ${
                      selected ? "font-bold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {errorMsg ? (
            <p role="alert" className="mt-3 text-center text-xs text-red-600">
              {errorMsg}
            </p>
          ) : mood ? (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-600">
              <Check size={12} /> Registrado por hoy. Puedes cambiarlo si quieres.
            </p>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Marca cómo te sientes para seguir tu evolución.
            </p>
          )}
        </>
      )}
    </div>
  );
}
