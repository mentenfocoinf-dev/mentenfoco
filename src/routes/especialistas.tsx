// ============================================================================
// Directorio público de especialistas (Ola 3).
//
// Página de captación fuera del login: cualquier visitante navega los perfiles
// y filtra. Lee `public_therapist_directory` (vista curada: solo columnas
// seguras, solo activos y verificados). El contacto real exige cuenta —aquí se
// invita a crearla, nunca se inicia contacto anónimo (ADR-005: invitación, no
// muro). Sin candados, sin "premium": el directorio informa y acompaña.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRound, Globe, MapPin, Languages, ArrowRight } from "lucide-react";
import { listPublicTherapists, type PublicTherapist } from "../lib/api";

export const Route = createFileRoute("/especialistas")({
  head: () => ({
    meta: [
      { title: "Especialistas — Mente en Foco" },
      {
        name: "description",
        content:
          "Conoce a los profesionales de nuestro equipo clínico: su enfoque, especialidades y modalidad de atención.",
      },
    ],
  }),
  component: Especialistas,
});

function Especialistas() {
  const [todos, setTodos] = useState<PublicTherapist[]>([]);
  const [cargando, setCargando] = useState(true);
  const [especialidad, setEspecialidad] = useState<string | null>(null);
  const [modalidad, setModalidad] = useState<"virtual" | "presencial" | null>(null);

  useEffect(() => {
    let vigente = true;
    void listPublicTherapists().then((t) => {
      if (!vigente) return;
      setTodos(t);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const especialidades = useMemo(
    () => [...new Set(todos.flatMap((t) => t.specializations))].sort((a, b) => a.localeCompare(b)),
    [todos],
  );

  const visibles = useMemo(
    () =>
      todos.filter((t) => {
        if (especialidad && !t.specializations.includes(especialidad)) return false;
        if (modalidad === "virtual" && !t.acceptsOnline) return false;
        if (modalidad === "presencial" && !t.acceptsInPerson) return false;
        return true;
      }),
    [todos, especialidad, modalidad],
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary md:text-4xl">Nuestro equipo clínico</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          Conoce a los profesionales que acompañan en Mente en Foco: su enfoque, sus especialidades
          y cómo atienden. Cuando quieras dar el paso, creas tu cuenta y coordinamos tu valoración.
        </p>
      </div>

      {/* Filtros */}
      {!cargando && todos.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEspecialidad(null);
              setModalidad(null);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              !especialidad && !modalidad
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todos
          </button>
          {especialidades.map((esp) => (
            <button
              key={esp}
              type="button"
              onClick={() => setEspecialidad(especialidad === esp ? null : esp)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                especialidad === esp
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {esp}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => setModalidad(modalidad === "virtual" ? null : "virtual")}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
              modalidad === "virtual"
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Globe size={12} /> En línea
          </button>
          <button
            type="button"
            onClick={() => setModalidad(modalidad === "presencial" ? null : "presencial")}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
              modalidad === "presencial"
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <MapPin size={12} /> Presencial
          </button>
        </div>
      )}

      {/* Listado */}
      {cargando ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : todos.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Todavía no hay especialistas publicados. Vuelve pronto.
        </p>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((t) => (
            <li
              key={t.profileId}
              className="flex h-full flex-col rounded-3xl glass-card border border-white/40 p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <UserRound size={24} strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-900">{t.name}</h2>
                  {t.yearsExperience != null && t.yearsExperience > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t.yearsExperience} años de experiencia
                    </p>
                  )}
                </div>
              </div>

              {t.bio && (
                <p className="mt-3 line-clamp-4 flex-grow text-sm leading-relaxed text-foreground/75">
                  {t.bio}
                </p>
              )}

              {t.specializations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.specializations.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {t.languages.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Languages size={12} /> {t.languages.join(", ")}
                  </span>
                )}
                {t.acceptsOnline && (
                  <span className="inline-flex items-center gap-1">
                    <Globe size={12} /> En línea
                  </span>
                )}
                {t.acceptsInPerson && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} /> Presencial
                  </span>
                )}
              </div>

              <Link
                to="/ingresa"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Crear cuenta para hablar con un profesional <ArrowRight size={15} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!cargando && visibles.length === 0 && todos.length > 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No encontramos especialistas con ese filtro. Prueba con otra especialidad o modalidad.
        </p>
      )}
    </section>
  );
}
