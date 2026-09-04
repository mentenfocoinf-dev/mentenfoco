// ============================================================================
// Rehabilitación cognitiva — catálogo de ejercicios.
//
// Aviso de términos al entrar. Menú de ÁREAS a la izquierda (secciones de
// rehabilitación, cada una llegará a ≥5 juegos). Cada ejercicio se muestra con
// una imagen arriba (para reconocerlo sin leer — accesibilidad) e info abajo,
// con "Ver más" para una previsualización. La RLS filtra por etapa (ADR-001);
// aquí se acota por edad y, opcionalmente, por área.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ShieldAlert, X, Info, ChevronDown } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  REHAB_AREAS,
  acceptCognitiveTerms,
  ageBandFromBirthdate,
  domainLabel,
  listExercises,
  listMyProgress,
  type CognitiveExercise,
  type ExerciseProgress,
} from "../lib/api";
import { GameThumbnail } from "../components/rehab/GameThumbnail";

const LS_KEY = "mef_cognitive_terms_ok";

export const Route = createFileRoute("/rehabilitacion-cognitiva")({
  head: () => ({
    meta: [
      { title: "Ejercicios de rehabilitación cognitiva — Mente en Foco" },
      {
        name: "description",
        content:
          "Ejercicios de estimulación cognitiva para practicar memoria, atención y otras funciones, adaptados a tu etapa.",
      },
    ],
  }),
  component: Rehab,
});

type Estado = "decidiendo" | "aceptado" | "declinado";

function Rehab() {
  const { profile } = useAuth();
  const [estado, setEstado] = useState<Estado>("decidiendo");
  const [ejercicios, setEjercicios] = useState<CognitiveExercise[]>([]);
  const [progreso, setProgreso] = useState<Record<string, ExerciseProgress>>({});
  const [cargando, setCargando] = useState(true);
  const [area, setArea] = useState<string | null>(null); // null = todas
  const [verMas, setVerMas] = useState<CognitiveExercise | null>(null);

  useEffect(() => {
    let ok = Boolean(profile?.cognitive_terms_accepted_at);
    if (!ok) {
      try {
        ok = localStorage.getItem(LS_KEY) === "1";
      } catch {
        /* ignore */
      }
    }
    if (ok) setEstado("aceptado");
  }, [profile?.cognitive_terms_accepted_at]);

  useEffect(() => {
    if (estado !== "aceptado") return;
    let vigente = true;
    const banda = ageBandFromBirthdate(profile?.birthdate);
    void Promise.all([listExercises(banda), profile ? listMyProgress() : Promise.resolve({})]).then(
      ([ex, pr]) => {
        if (!vigente) return;
        setEjercicios(ex);
        setProgreso(pr);
        setCargando(false);
      },
    );
    return () => {
      vigente = false;
    };
  }, [estado, profile]);

  async function aceptar() {
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {
      /* ignore */
    }
    await acceptCognitiveTerms();
    setEstado("aceptado");
  }

  const areaActual = REHAB_AREAS.find((a) => a.key === area) ?? null;
  const visibles = useMemo(
    () =>
      areaActual
        ? ejercicios.filter((e) => e.domains.some((d) => areaActual.domains.includes(d)))
        : ejercicios,
    [ejercicios, areaActual],
  );
  const conteoPorArea = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of REHAB_AREAS)
      m[a.key] = ejercicios.filter((e) => e.domains.some((d) => a.domains.includes(d))).length;
    return m;
  }, [ejercicios]);

  // ── Aviso de términos ──
  if (estado === "decidiendo") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldAlert size={26} strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 text-center text-xl font-bold text-slate-900">Antes de empezar</h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
            <p>
              Estos son <strong>ejercicios de estimulación y práctica cognitiva</strong> con fines de
              entrenamiento y bienestar. <strong>No son una prueba diagnóstica ni un tratamiento</strong>,
              y no reemplazan una valoración neuropsicológica profesional.
            </p>
            <p>
              Tus resultados se guardan solo para mostrarte tu propio progreso. Al continuar, aceptas
              usar esta sección con ese entendimiento.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="button"
              onClick={aceptar}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Aceptar y continuar
            </button>
            <Link
              to="/"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Declinar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (estado === "declinado") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary">Entendido</h1>
        <p className="mt-2 text-sm text-muted-foreground">No hay problema. Puedes volver cuando quieras.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-bold text-primary hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  // ── Catálogo ──
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary md:text-4xl">Rehabilitación cognitiva</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Ejercicios breves para practicar memoria, atención y otras funciones, a tu ritmo. Sube de
          nivel cuando te sientas listo.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-8 lg:flex-row">
        {/* Menú de áreas (desplegable) */}
        <aside className="lg:w-64 lg:shrink-0">
          <details className="group rounded-2xl border border-white/50 bg-white/50 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-primary">
              <span>Áreas de rehabilitación</span>
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <ul className="px-2 pb-2">
              <li>
                <button
                  type="button"
                  onClick={() => setArea(null)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    area === null ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Todas <span className="text-xs text-muted-foreground">{ejercicios.length}</span>
                </button>
              </li>
              {REHAB_AREAS.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => setArea(a.key)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      area === a.key ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {a.label}
                    <span
                      className={`rounded-full px-1.5 text-xs ${
                        conteoPorArea[a.key] >= 5
                          ? "text-emerald-600"
                          : conteoPorArea[a.key] > 0
                            ? "text-amber-600"
                            : "text-slate-400"
                      }`}
                    >
                      {conteoPorArea[a.key]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-2 px-2 text-[11px] leading-snug text-muted-foreground">
            Cada área tendrá al menos 5 ejercicios. El número indica cuántos hay hoy.
          </p>
        </aside>

        {/* Catálogo */}
        <div className="flex-1">
          {cargando ? (
            <p className="text-center text-sm text-muted-foreground">Cargando…</p>
          ) : visibles.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                {ejercicios.length === 0
                  ? "Todavía no hay ejercicios disponibles en tu etapa."
                  : "Aún no hay ejercicios en esta área. Pronto habrá más."}
              </p>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {visibles.map((e) => {
                const p = progreso[e.id];
                return (
                  <li
                    key={e.id}
                    className="flex flex-col overflow-hidden rounded-3xl border border-white/50 bg-white shadow-sm transition-shadow hover:shadow-lg"
                  >
                    {/* Imagen (mitad superior) */}
                    <div className="relative h-40 w-full">
                      {e.image ? (
                        <img src={e.image} alt={e.title} className="h-full w-full object-cover" />
                      ) : (
                        <GameThumbnail gameKind={e.gameKind} />
                      )}
                      {p?.completed && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                          <CheckCircle2 size={12} /> Hecho
                        </span>
                      )}
                    </div>

                    {/* Info (mitad inferior) */}
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="text-lg font-bold text-primary">{e.title}</h2>
                      {e.description && (
                        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-foreground/75">
                          {e.description}
                        </p>
                      )}
                      {p && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {p.sessions} {p.sessions === 1 ? "partida" : "partidas"} · mejor: {p.bestScore}
                          {p.lastAccuracy != null && p.lastAccuracy < 0.6 && (
                            <span className="text-amber-600"> · sigue practicando</span>
                          )}
                        </p>
                      )}

                      <div className="mt-4 flex items-center gap-2">
                        <Link
                          to="/ejercicios/$slug"
                          params={{ slug: e.slug }}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          {p ? "Seguir" : "Empezar"} <ArrowRight size={15} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setVerMas(e)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <Info size={15} /> Ver más
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Previsualización "Ver más" */}
      {verMas && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          onClick={() => setVerMas(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="relative h-48 w-full">
              {verMas.image ? (
                <img src={verMas.image} alt={verMas.title} className="h-full w-full object-cover" />
              ) : (
                <GameThumbnail gameKind={verMas.gameKind} />
              )}
              <button
                type="button"
                onClick={() => setVerMas(null)}
                aria-label="Cerrar"
                className="absolute right-3 top-3 rounded-lg bg-white/90 p-1.5 text-slate-600 hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-primary">{verMas.title}</h3>
              {verMas.description && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">{verMas.description}</p>
              )}
              {verMas.domains.length > 0 && (
                <>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Qué trabaja
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {verMas.domains.map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary"
                      >
                        {domainLabel(d)}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <Link
                to="/ejercicios/$slug"
                params={{ slug: verMas.slug }}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Jugar <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
