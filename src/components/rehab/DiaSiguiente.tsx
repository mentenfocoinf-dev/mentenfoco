// ¿Qué sigue? — orientación (temporal).
// Muestra un día de la semana o un mes y pide el que viene antes o después.
// Refuerza la orientación en el tiempo. Basado en texto, sin emojis.
import { useRef } from "react";
import { TimedChoice, type ChoiceRound } from "./TimedChoice";
import { createBag } from "./bag";
import type { GameProps } from "./types";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function elegir<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export function DiaSiguiente({ level, onFinish }: GameProps) {
  const ms = level.ms ?? 8000;
  // Bolsa sobre los 19 ítems (0..6 = días, 7..18 = meses): el ítem base no se
  // repite hasta agotarse; la dirección (antes/después) sigue siendo aleatoria.
  const bag = useRef(createBag(DIAS.length + MESES.length));

  function make(): ChoiceRound {
    const global = bag.current.next();
    const usarDias = global < DIAS.length;
    const lista = usarDias ? DIAS : MESES;
    const unidad = usarDias ? "día" : "mes";
    const despues = Math.random() < 0.5;
    const i = usarDias ? global : global - DIAS.length;
    const correcto = despues
      ? lista[(i + 1) % lista.length]
      : lista[(i - 1 + lista.length) % lista.length];

    const set = new Set<string>([correcto]);
    while (set.size < 4) set.add(elegir(lista));
    const options = [...set]
      .sort(() => Math.random() - 0.5)
      .map((v) => ({ key: v, node: v, correct: v === correcto }));

    return {
      prompt: (
        <p className="text-base font-semibold leading-relaxed text-white">
          ¿Qué {unidad} viene {despues ? "después" : "antes"} de{" "}
          <span className="font-extrabold">{lista[i]}</span>?
        </p>
      ),
      options,
    };
  }

  return <TimedChoice rounds={8} ms={ms} make={make} onFinish={onFinish} hint="Elige el correcto" />;
}
