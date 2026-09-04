// Cálculo mental — cálculo / velocidad de procesamiento.
// Resuelve una operación eligiendo la respuesta antes de que acabe el tiempo.
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

const RONDAS = 10;

interface Op {
  texto: string;
  resultado: number;
  opciones: number[];
}

function generar(max: number, mul: boolean): Op {
  const a = 1 + Math.floor(Math.random() * max);
  const b = 1 + Math.floor(Math.random() * (mul ? Math.min(max, 12) : max));
  const tipos = mul ? ["+", "-", "×"] : ["+", "-"];
  const t = tipos[Math.floor(Math.random() * tipos.length)];
  let x = a,
    y = b,
    r = a + b;
  if (t === "-") {
    x = Math.max(a, b);
    y = Math.min(a, b);
    r = x - y;
  } else if (t === "×") {
    r = a * b;
  }
  const set = new Set<number>([r]);
  while (set.size < 4) {
    const delta = Math.floor(Math.random() * 9) - 4 || 1;
    const cand = r + delta;
    if (cand >= 0) set.add(cand);
  }
  const opciones = [...set].sort(() => Math.random() - 0.5);
  return { texto: `${x} ${t} ${y}`, resultado: r, opciones };
}

export function CalculoMental({ level, onFinish }: GameProps) {
  const max = level.max ?? 10;
  const mul = Boolean(level.mul);
  const ms = level.ms ?? 6000;

  const [idx, setIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [op, setOp] = useState<Op>(() => generar(max, mul));
  const [feedback, setFeedback] = useState<"ok" | "mal" | null>(null);
  const inicio = useRef(Date.now());
  const respondido = useRef(false);
  const opRef = useRef<Op>(op);
  const fin = useRef(false);

  useEffect(() => {
    if (fin.current) return;
    const o = generar(max, mul);
    opRef.current = o;
    setOp(o);
    respondido.current = false;
    setFeedback(null);
    const t = setTimeout(() => resolver(null), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function resolver(elegido: number | null) {
    if (respondido.current || fin.current) return;
    respondido.current = true;
    const acierto = elegido === opRef.current.resultado;
    if (acierto) setAciertos((a) => a + 1);
    setFeedback(acierto ? "ok" : "mal");
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
    }, 350);
  }

  return (
    <div className="text-center">
      <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>
          {Math.min(idx + 1, RONDAS)}/{RONDAS}
        </span>
        <span>Aciertos: {aciertos}</span>
      </div>
      <div
        className={`mx-auto flex h-32 max-w-md items-center justify-center rounded-3xl border-2 transition-colors ${
          feedback === "ok"
            ? "border-emerald-400 bg-emerald-500/10"
            : feedback === "mal"
              ? "border-rose-400 bg-rose-500/10"
              : "border-white/20 bg-white/5"
        }`}
      >
        <span className="text-4xl font-extrabold text-white">{op.texto} = ?</span>
      </div>
      <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-3">
        {op.opciones.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={() => resolver(o)}
            className="rounded-2xl bg-white/10 py-4 text-2xl font-bold text-white transition-colors hover:bg-white/20"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
