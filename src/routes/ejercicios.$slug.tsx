// ============================================================================
// Reproductor de un ejercicio de rehabilitación cognitiva.
//
// Carga el ejercicio (la RLS ya garantiza que solo llega si está en la etapa
// del visitante — ADR-001), deja elegir dificultad, y dentro de cada dificultad
// se avanza por 5 subniveles ascendentes. El área de juego va sobre fondo
// OSCURO para máxima visibilidad (adultos mayores / baja visión).
// ============================================================================
import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw, Trophy, Target, Timer, ChevronRight } from "lucide-react";
import {
  DIFFICULTY_LABELS,
  getExerciseBySlug,
  recordSession,
  type CognitiveExercise,
  type Difficulty,
  type GameKind,
} from "../lib/api";
import { MemoryPairs } from "../components/rehab/MemoryPairs";
import { StroopColor } from "../components/rehab/StroopColor";
import { SequenceRecall } from "../components/rehab/SequenceRecall";
import { CalculoMental } from "../components/rehab/CalculoMental";
import { OddOneOut } from "../components/rehab/OddOneOut";
import { FigurasIguales } from "../components/rehab/FigurasIguales";
import { CuentaRapido } from "../components/rehab/CuentaRapido";
import { PatronIgual } from "../components/rehab/PatronIgual";
import { QueHora } from "../components/rehab/QueHora";
import { EmocionSituacion } from "../components/rehab/EmocionSituacion";
import { OrdenaPasos } from "../components/rehab/OrdenaPasos";
import { FormaPalabra } from "../components/rehab/FormaPalabra";
import { DiaSiguiente } from "../components/rehab/DiaSiguiente";
import { RespuestaAdecuada } from "../components/rehab/RespuestaAdecuada";
import type { GameProps, GameResult } from "../components/rehab/types";

const GAMES: Record<GameKind, ComponentType<GameProps>> = {
  memory_pairs: MemoryPairs,
  stroop_color: StroopColor,
  sequence_recall: SequenceRecall,
  calculo_mental: CalculoMental,
  odd_one_out: OddOneOut,
  figuras_iguales: FigurasIguales,
  cuenta_rapido: CuentaRapido,
  patron_igual: PatronIgual,
  que_hora: QueHora,
  emocion_situacion: EmocionSituacion,
  ordena_pasos: OrdenaPasos,
  forma_palabra: FormaPalabra,
  dia_siguiente: DiaSiguiente,
  respuesta_adecuada: RespuestaAdecuada,
};

const DIFICULTADES: Difficulty[] = ["facil", "medio", "dificil"];

export const Route = createFileRoute("/ejercicios/$slug")({
  head: () => ({ meta: [{ title: "Ejercicio — Mente en Foco" }] }),
  component: Player,
});

function Player() {
  const { slug } = Route.useParams();
  const [ejercicio, setEjercicio] = useState<CognitiveExercise | null>(null);
  const [cargando, setCargando] = useState(true);
  const [dificultad, setDificultad] = useState<Difficulty | null>(null);
  const [subnivel, setSubnivel] = useState(0);
  const [jugando, setJugando] = useState(false);
  const [resultado, setResultado] = useState<GameResult | null>(null);

  useEffect(() => {
    let vigente = true;
    void getExerciseBySlug(slug).then((e) => {
      if (!vigente) return;
      setEjercicio(e);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [slug]);

  if (cargando) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">Cargando…</p>
    );
  }
  if (!ejercicio) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary">No encontramos este ejercicio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que no esté disponible en tu etapa todavía.
        </p>
        <Link
          to="/rehabilitacion-cognitiva"
          className="mt-6 inline-block text-sm font-bold text-primary hover:underline"
        >
          Volver a los ejercicios
        </Link>
      </div>
    );
  }

  const niveles = ejercicio.config.levels ?? {};
  const disponibles = DIFICULTADES.filter((d) => (niveles[d]?.length ?? 0) > 0);
  const subniveles = dificultad ? (niveles[dificultad] ?? []) : [];
  const nivelActual = dificultad ? subniveles[subnivel] : null;
  const Game = GAMES[ejercicio.gameKind];
  const haySiguiente = Boolean(resultado?.completed && subnivel + 1 < subniveles.length);

  function elegirDificultad(d: Difficulty) {
    setDificultad(d);
    setSubnivel(0);
    setResultado(null);
  }

  async function handleFinish(r: GameResult) {
    setResultado(r);
    setJugando(false);
    if (ejercicio && dificultad) {
      await recordSession({
        exerciseId: ejercicio.id,
        difficulty: dificultad,
        score: r.score,
        accuracy: r.accuracy,
        durationSeconds: r.durationSeconds,
        completed: r.completed,
      });
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Link
        to="/rehabilitacion-cognitiva"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft size={15} /> Ejercicios
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-primary md:text-3xl">{ejercicio.title}</h1>
      {ejercicio.instructions && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {ejercicio.instructions}
        </p>
      )}

      {jugando && nivelActual ? (
        // Área de juego — fondo OSCURO para máxima visibilidad.
        <div className="mt-8 rounded-3xl bg-slate-900 p-6 shadow-xl md:p-8">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-wide text-white/50">
            {dificultad && DIFFICULTY_LABELS[dificultad]} · Subnivel {subnivel + 1}/
            {subniveles.length}
          </p>
          <Game key={`${dificultad}-${subnivel}`} level={nivelActual} onFinish={handleFinish} />
        </div>
      ) : (
        <div className="mt-8 rounded-3xl glass-card border border-white/40 p-6">
          {resultado && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <p className="font-bold text-emerald-700">
                {resultado.completed ? "¡Terminaste este subnivel!" : "Buen intento"}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <Trophy size={15} /> Puntaje: {resultado.score}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Target size={15} /> Precisión: {Math.round(resultado.accuracy * 100)}%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Timer size={15} /> {resultado.durationSeconds}s
                </span>
              </div>
            </div>
          )}

          <p className="text-center text-sm font-semibold text-primary">Elige la dificultad</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {disponibles.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => elegirDificultad(d)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  dificultad === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>

          {dificultad && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Subnivel {subnivel + 1} de {subniveles.length}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={!dificultad}
              onClick={() => {
                setResultado(null);
                setJugando(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resultado ? (
                <>
                  <RotateCcw size={16} /> Repetir subnivel
                </>
              ) : (
                "Empezar"
              )}
            </button>
            {haySiguiente && (
              <button
                type="button"
                onClick={() => {
                  setSubnivel((n) => n + 1);
                  setResultado(null);
                  setJugando(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-primary px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
              >
                Siguiente subnivel <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
