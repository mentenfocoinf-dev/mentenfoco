// Encuentra el diferente — atención selectiva / razonamiento / velocidad.
// Una rejilla de fichas iguales con UNA distinta; hay que tocarla a tiempo.
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

const RONDAS = 8;
// Pares (base, distinta) con contraste suficiente para baja visión.
const PARES = [
  ["bg-sky-500", "bg-sky-300"],
  ["bg-rose-500", "bg-rose-300"],
  ["bg-emerald-500", "bg-emerald-300"],
  ["bg-amber-500", "bg-amber-300"],
  ["bg-violet-500", "bg-violet-300"],
];

interface Ronda {
  total: number;
  distinta: number;
  base: string;
  dif: string;
}

function generar(cols: number): Ronda {
  const total = cols * cols;
  const [base, dif] = PARES[Math.floor(Math.random() * PARES.length)];
  return { total, distinta: Math.floor(Math.random() * total), base, dif };
}

export function OddOneOut({ level, onFinish }: GameProps) {
  const cols = level.cols ?? 3;
  const ms = level.ms ?? 6000;

  const [idx, setIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [ronda, setRonda] = useState<Ronda>(() => generar(cols));
  const [feedback, setFeedback] = useState<number | null>(null);
  const inicio = useRef(Date.now());
  const respondido = useRef(false);
  const rRef = useRef<Ronda>(ronda);
  const fin = useRef(false);

  useEffect(() => {
    if (fin.current) return;
    const r = generar(cols);
    rRef.current = r;
    setRonda(r);
    respondido.current = false;
    setFeedback(null);
    const t = setTimeout(() => resolver(-1), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function resolver(elegido: number) {
    if (respondido.current || fin.current) return;
    respondido.current = true;
    const acierto = elegido === rRef.current.distinta;
    if (acierto) setAciertos((a) => a + 1);
    setFeedback(acierto ? 1 : 0);
    setTimeout(() => {
      if (idx + 1 >= RONDAS) {
        fin.current = true;
        const total = aciertos + (acierto ? 1 : 0);
        onFinish({
          score: total * 10,
          accuracy: total / RONDAS,
          durationSeconds: Math.round((Date.now() - inicio.current) / 1000),
          completed: true,
        });
      } else setIdx((i) => i + 1);
    }, 300);
  }

  return (
    <div className="text-center">
      <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>
          {Math.min(idx + 1, RONDAS)}/{RONDAS}
        </span>
        <span>Aciertos: {aciertos}</span>
      </div>
      <p className="mb-3 text-sm text-white/80">Toca la ficha que es distinta.</p>
      <div
        className="mx-auto grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          maxWidth: `${cols * 3.2}rem`,
        }}
      >
        {Array.from({ length: ronda.total }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => resolver(i)}
            aria-label={i === ronda.distinta ? "Ficha distinta" : "Ficha"}
            className={`aspect-square rounded-lg transition-transform hover:scale-105 ${
              i === ronda.distinta ? ronda.dif : ronda.base
            } ${feedback === 1 && i === ronda.distinta ? "ring-4 ring-emerald-300" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
