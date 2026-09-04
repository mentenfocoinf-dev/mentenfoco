// Motor reutilizable para juegos de "elegir la opción correcta" con rondas y
// temporizador. Cada juego solo aporta cómo se ve la ronda (enunciado) y las
// opciones; este componente lleva el conteo, el tiempo y el puntaje. Pensado
// sobre fondo OSCURO (texto claro).
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GameResult } from "./types";

export interface ChoiceOption {
  key: string;
  node: ReactNode;
  correct: boolean;
}

export interface ChoiceRound {
  prompt?: ReactNode; // enunciado / estímulo de la ronda
  options: ChoiceOption[];
}

interface Props {
  rounds: number;
  ms: number;
  make: () => ChoiceRound;
  onFinish: (r: GameResult) => void;
  /** disposición de los botones de opción */
  layout?: "grid2" | "row";
  hint?: string;
}

export function TimedChoice({ rounds, ms, make, onFinish, layout = "grid2", hint }: Props) {
  const [idx, setIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [ronda, setRonda] = useState<ChoiceRound>(() => make());
  const [feedback, setFeedback] = useState<"ok" | "mal" | null>(null);
  const inicio = useRef(Date.now());
  const respondido = useRef(false);
  const ref = useRef<ChoiceRound>(ronda);
  const fin = useRef(false);

  useEffect(() => {
    if (fin.current) return;
    const r = make();
    ref.current = r;
    setRonda(r);
    respondido.current = false;
    setFeedback(null);
    const t = setTimeout(() => resolver(null), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function resolver(key: string | null) {
    if (respondido.current || fin.current) return;
    respondido.current = true;
    const acierto =
      key != null && (ref.current.options.find((o) => o.key === key)?.correct ?? false);
    if (acierto) setAciertos((a) => a + 1);
    setFeedback(acierto ? "ok" : "mal");
    setTimeout(() => {
      if (idx + 1 >= rounds) {
        fin.current = true;
        const total = aciertos + (acierto ? 1 : 0);
        onFinish({
          score: total * 10,
          accuracy: total / rounds,
          durationSeconds: Math.round((Date.now() - inicio.current) / 1000),
          completed: true,
        });
      } else setIdx((i) => i + 1);
    }, 350);
  }

  return (
    <div className="text-center">
      <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>
          {Math.min(idx + 1, rounds)}/{rounds}
        </span>
        <span>Aciertos: {aciertos}</span>
      </div>

      {ronda.prompt && (
        <div
          className={`mx-auto flex min-h-[6rem] max-w-md items-center justify-center rounded-3xl border-2 px-4 py-3 transition-colors ${
            feedback === "ok"
              ? "border-emerald-400 bg-emerald-500/10"
              : feedback === "mal"
                ? "border-rose-400 bg-rose-500/10"
                : "border-white/20 bg-white/5"
          }`}
        >
          {ronda.prompt}
        </div>
      )}

      {hint && <p className="mt-3 text-sm text-white/80">{hint}</p>}

      <div
        className={`mx-auto mt-4 max-w-md gap-3 ${
          layout === "grid2" ? "grid grid-cols-2" : "flex flex-wrap justify-center"
        }`}
      >
        {ronda.options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => resolver(o.key)}
            className="flex items-center justify-center rounded-2xl bg-white/10 px-4 py-4 text-lg font-bold text-white transition-colors hover:bg-white/20"
          >
            {o.node}
          </button>
        ))}
      </div>
    </div>
  );
}
