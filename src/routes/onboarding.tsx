// ============================================================================
// Onboarding inteligente.
//
// Cuatro preguntas para saber por dónde acompañarte. Ninguna es clínica: no se
// pregunta qué te pasa, ni cuánto, ni desde cuándo. Eso es la anamnesis, va
// detrás del consentimiento de Ley 1090 y la lee un profesional. Aquí solo se
// recoge lo que orienta lo que se te ofrece.
//
// NO bloquea. No es una puerta como el consentimiento o la contraseña: se
// puede saltar, abandonar a medias y retomar. Un onboarding obligatorio es una
// pantalla de bloqueo con otro nombre (ADR-001).
//
// Cada respuesta alimenta un motor que ya existe:
//   temas         → ancla del Recommendation Engine y motivo del Matching
//   objetivo      → a dónde te llevamos al terminar
//   idioma        → criterio de Matching
//   modalidad     → criterio de Matching
//   disponibilidad→ criterio de Matching
//
// Nada se guarda que ningún motor consuma: pedir un dato que no se usa es
// pedirlo por pedir.
// ============================================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import {
  getMyPreferences,
  saveMyPreferences,
  trackEvent,
  AVAILABILITY_LABELS,
  GOAL_HINTS,
  GOAL_LABELS,
  MAX_TEMAS,
  MODALITY_LABELS,
  THEME_KEYS,
  THEME_LABELS,
  type AvailabilitySlot,
  type OnboardingGoal,
  type ThemeKey,
  type TherapyModality,
} from "../lib/api";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Cuéntanos por dónde empezar — Mente en Foco" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

const IDIOMAS = ["Español", "Inglés", "Portugués"];

/** Añade o quita un valor de una lista, sin mutarla. */
function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

const PASOS = 4;

function Onboarding() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [temas, setTemas] = useState<ThemeKey[]>([]);
  const [objetivo, setObjetivo] = useState<OnboardingGoal | null>(null);
  const [idioma, setIdioma] = useState<string>("Español");
  const [modalidades, setModalidades] = useState<TherapyModality[]>([]);
  const [franjas, setFranjas] = useState<AvailabilitySlot[]>([]);

  // Si ya respondió antes, el flujo se abre con lo que dijo: esto es editable,
  // no un formulario de una sola vez.
  useEffect(() => {
    let vigente = true;
    void getMyPreferences().then((p) => {
      if (!vigente) return;
      if (p) {
        setTemas(p.themes);
        setObjetivo(p.goal);
        setIdioma(p.language ?? "Español");
        setModalidades(p.modalities);
        setFranjas(p.availability);
      }
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function terminar() {
    setGuardando(true);
    setError(null);
    try {
      await saveMyPreferences({
        themes: temas,
        goal: objetivo,
        language: idioma,
        modalities: modalidades,
        availability: franjas,
        completed: true,
      });
      trackEvent("ONBOARDING_COMPLETED", {
        // Cuántos temas y qué busca. Nunca por qué, ni nada que se parezca a un
        // motivo clínico.
        count: temas.length,
        rule: objetivo ?? "sin-objetivo",
      });
      // El objetivo decide a dónde se va, no cómo puntúa ningún motor.
      void navigate({ to: objetivo === "hablar_con_alguien" ? "/contactanos" : "/contenido" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar tus preferencias.");
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const puedeSeguir =
    (paso === 1 && temas.length > 0) ||
    (paso === 2 && objetivo !== null) ||
    paso === 3 ||
    paso === 4;

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Paso {paso} de {PASOS}
        </span>
        {/* Saltar siempre visible: esto no es una puerta. */}
        <Link to="/contenido" className="text-xs font-semibold text-slate-500 hover:text-primary">
          Saltar por ahora
        </Link>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(paso / PASOS) * 100}%` }}
        />
      </div>

      {paso === 1 && (
        <Bloque
          titulo="¿Sobre qué te gustaría empezar?"
          ayuda={`Elige hasta ${MAX_TEMAS}. Sirve para saber qué mostrarte primero; puedes cambiarlo cuando quieras.`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {THEME_KEYS.map((t) => {
              const marcado = temas.includes(t);
              const lleno = temas.length >= MAX_TEMAS && !marcado;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={lleno}
                  onClick={() => setTemas((prev) => alternar(prev, t))}
                  className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                    marcado
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : lleno
                        ? "border-slate-200 text-slate-300"
                        : "border-slate-200 text-slate-700 hover:border-primary/40"
                  }`}
                >
                  {THEME_LABELS[t]}
                  {marcado && <Check size={15} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </Bloque>
      )}

      {paso === 2 && (
        <Bloque titulo="¿Qué buscas ahora?" ayuda="Puede cambiar más adelante. No es una etiqueta.">
          <div className="space-y-2">
            {(Object.keys(GOAL_LABELS) as OnboardingGoal[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setObjetivo(g)}
                className={`block w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                  objetivo === g
                    ? "border-primary bg-primary/10"
                    : "border-slate-200 hover:border-primary/40"
                }`}
              >
                <span
                  className={`block text-sm font-bold ${objetivo === g ? "text-primary" : "text-slate-800"}`}
                >
                  {GOAL_LABELS[g]}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{GOAL_HINTS[g]}</span>
              </button>
            ))}
          </div>
        </Bloque>
      )}

      {paso === 3 && (
        <Bloque
          titulo="Si algún día quieres hablar con alguien"
          ayuda="Nos ayuda a proponerte al profesional adecuado. Puedes dejarlo en blanco."
        >
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Idioma
            </span>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {IDIOMAS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="mt-5">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Modalidad
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(MODALITY_LABELS) as TherapyModality[]).map((m) => (
                <Pastilla
                  key={m}
                  activa={modalidades.includes(m)}
                  onClick={() => setModalidades((prev) => alternar(prev, m))}
                >
                  {MODALITY_LABELS[m]}
                </Pastilla>
              ))}
            </div>
          </fieldset>
        </Bloque>
      )}

      {paso === 4 && (
        <Bloque
          titulo="¿Cuándo te viene bien?"
          ayuda="Solo para cuadrar agendas. Puedes dejarlo en blanco."
        >
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AVAILABILITY_LABELS) as AvailabilitySlot[]).map((f) => (
              <Pastilla
                key={f}
                activa={franjas.includes(f)}
                onClick={() => setFranjas((prev) => alternar(prev, f))}
              >
                {AVAILABILITY_LABELS[f]}
              </Pastilla>
            ))}
          </div>
        </Bloque>
      )}

      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPaso((p) => Math.max(1, p - 1))}
          disabled={paso === 1}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 disabled:opacity-0"
        >
          <ArrowLeft size={15} /> Atrás
        </button>

        {paso < PASOS ? (
          <button
            type="button"
            disabled={!puedeSeguir}
            onClick={() => setPaso((p) => p + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            Continuar <ArrowRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            disabled={guardando}
            onClick={terminar}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Terminar"} <ArrowRight size={15} />
          </button>
        )}
      </div>
    </section>
  );
}

function Bloque({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <h1 className="text-2xl font-bold leading-snug text-slate-900 md:text-3xl">{titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{ayuda}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Pastilla({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        activa
          ? "border-primary bg-primary/10 font-bold text-primary"
          : "border-slate-200 text-slate-700 hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
