// Stroop de colores — atención selectiva / inhibición.
// Muestra el NOMBRE de un color escrito con otra tinta; hay que elegir el color
// de la TINTA antes de que acabe el tiempo. Cronómetro por ronda + aciertos.
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./types";

const COLORES = [
  { key: "rojo", label: "Rojo", text: "text-rose-600", bg: "bg-rose-600" },
  { key: "azul", label: "Azul", text: "text-sky-600", bg: "bg-sky-600" },
  { key: "verde", label: "Verde", text: "text-emerald-600", bg: "bg-emerald-600" },
  { key: "amarillo", label: "Amarillo", text: "text-amber-500", bg: "bg-amber-500" },
  { key: "morado", label: "Morado", text: "text-violet-600", bg: "bg-violet-600" },
] as const;

type ColorKey = (typeof COLORES)[number]["key"];

interface Ronda {
  palabra: ColorKey; // qué dice la palabra
  tinta: ColorKey; // de qué color está escrita (la respuesta)
}

function nuevaRonda(): Ronda {
  const palabra = COLORES[Math.floor(Math.random() * COLORES.length)].key;
  let tinta = palabra;
  while (tinta === palabra) tinta = COLORES[Math.floor(Math.random() * COLORES.length)].key;
  return { palabra, tinta };
}

export function StroopColor({ level, onFinish }: GameProps) {
  const totalRondas = level.trials ?? 10;
  const ms = level.ms ?? 2000;

  const [idx, setIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [ronda, setRonda] = useState<Ronda>(() => nuevaRonda());
  const [feedback, setFeedback] = useState<"ok" | "mal" | null>(null);
  const inicio = useRef(Date.now());
  const respondido = useRef(false);
  const rondaActual = useRef<Ronda>(ronda);
  const finalizado = useRef(false);

  useEffect(() => {
    if (finalizado.current) return;
    const r = nuevaRonda();
    rondaActual.current = r;
    setRonda(r);
    respondido.current = false;
    setFeedback(null);
    const t = setTimeout(() => resolver(null), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function resolver(elegido: ColorKey | null) {
    if (respondido.current || finalizado.current) return;
    respondido.current = true;
    const acierto = elegido === rondaActual.current.tinta;
    if (acierto) setAciertos((a) => a + 1);
    setFeedback(acierto ? "ok" : "mal");

    setTimeout(() => {
      if (idx + 1 >= totalRondas) {
        finalizado.current = true;
        const totalAciertos = aciertos + (acierto ? 1 : 0);
        const dur = Math.round((Date.now() - inicio.current) / 1000);
        onFinish({
          score: totalAciertos * 10,
          accuracy: totalAciertos / totalRondas,
          durationSeconds: dur,
          completed: true,
        });
      } else {
        setIdx((i) => i + 1);
      }
    }, 350);
  }

  const colorTinta = COLORES.find((c) => c.key === ronda.tinta)!;
  const colorPalabra = COLORES.find((c) => c.key === ronda.palabra)!;

  return (
    <div className="text-center">
      <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>
          Ronda {Math.min(idx + 1, totalRondas)}/{totalRondas}
        </span>
        <span>Aciertos: {aciertos}</span>
      </div>

      <div
        className={`mx-auto flex h-40 max-w-md items-center justify-center rounded-3xl border-2 transition-colors ${
          feedback === "ok"
            ? "border-emerald-300 bg-emerald-50"
            : feedback === "mal"
              ? "border-rose-300 bg-rose-50"
              : "border-slate-200 bg-white"
        }`}
      >
        <span className={`text-5xl font-extrabold ${colorTinta.text}`}>{colorPalabra.label}</span>
      </div>

      <p className="mt-4 text-sm text-white/80">Toca el color de la TINTA, no lo que dice.</p>

      <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-3">
        {COLORES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => resolver(c.key)}
            aria-label={c.label}
            className={`h-12 w-12 rounded-full ${c.bg} ring-2 ring-white shadow-md transition-transform hover:scale-110`}
          />
        ))}
      </div>
    </div>
  );
}
