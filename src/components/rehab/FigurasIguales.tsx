// Figuras iguales — visualización espacial / atención selectiva.
// Se muestra una figura modelo (flecha con dirección y color); hay que elegir,
// entre las opciones, la que es idéntica (misma dirección y color).
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { GameProps } from "./types";

const RONDAS = 8;
const COLORES = ["text-rose-400", "text-sky-400", "text-emerald-400", "text-amber-400"];
const DIRS = [0, 90, 180, 270];

interface Figura {
  dir: number;
  color: number;
}

function igual(a: Figura, b: Figura) {
  return a.dir === b.dir && a.color === b.color;
}

function generar(): { modelo: Figura; opciones: Figura[]; correcta: number } {
  const modelo: Figura = {
    dir: DIRS[Math.floor(Math.random() * DIRS.length)],
    color: Math.floor(Math.random() * COLORES.length),
  };
  const opciones: Figura[] = [modelo];
  while (opciones.length < 4) {
    const f: Figura = {
      dir: DIRS[Math.floor(Math.random() * DIRS.length)],
      color: Math.floor(Math.random() * COLORES.length),
    };
    if (!opciones.some((o) => igual(o, f))) opciones.push(f);
  }
  opciones.sort(() => Math.random() - 0.5);
  return { modelo, opciones, correcta: opciones.findIndex((o) => igual(o, modelo)) };
}

function Flecha({ f, size }: { f: Figura; size: number }) {
  return (
    <ArrowUp
      size={size}
      strokeWidth={2.5}
      className={COLORES[f.color]}
      style={{ transform: `rotate(${f.dir}deg)` }}
    />
  );
}

export function FigurasIguales({ level, onFinish }: GameProps) {
  const ms = level.ms ?? 5000;
  const [idx, setIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [ronda, setRonda] = useState(() => generar());
  const [feedback, setFeedback] = useState<"ok" | "mal" | null>(null);
  const inicio = useRef(Date.now());
  const respondido = useRef(false);
  const rRef = useRef(ronda);
  const fin = useRef(false);

  useEffect(() => {
    if (fin.current) return;
    const r = generar();
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
    const acierto = elegido === rRef.current.correcta;
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

      <p className="text-sm text-white/80">Modelo</p>
      <div
        className={`mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-3xl border-2 ${
          feedback === "ok" ? "border-emerald-400" : feedback === "mal" ? "border-rose-400" : "border-white/20"
        } bg-white/5`}
      >
        <Flecha f={ronda.modelo} size={44} />
      </div>

      <p className="mt-5 text-sm text-white/80">Elige la idéntica</p>
      <div className="mx-auto mt-2 grid max-w-xs grid-cols-2 gap-3">
        {ronda.opciones.map((f, i) => (
          <button
            key={i}
            type="button"
            onClick={() => resolver(i)}
            className="flex h-20 items-center justify-center rounded-2xl bg-white/10 transition-colors hover:bg-white/20"
          >
            <Flecha f={f} size={36} />
          </button>
        ))}
      </div>
    </div>
  );
}
