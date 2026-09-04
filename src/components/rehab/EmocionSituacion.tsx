// ¿Cómo se siente? — cognición social / comprensión.
// Lee una situación cotidiana y elige la emoción que mejor encaja. Basado en
// texto (sin caras ni emojis), coherente con la guía de estilo.
import { useRef } from "react";
import { TimedChoice, type ChoiceRound } from "./TimedChoice";
import { createBag } from "./bag";
import type { GameProps } from "./types";

const EMOCIONES = ["Alegría", "Tristeza", "Miedo", "Sorpresa", "Enojo", "Calma"];

const CASOS: { s: string; e: string }[] = [
  // Alegría
  { s: "Ana recibió un regalo que quería mucho.", e: "Alegría" },
  { s: "Carla aprobó el examen para el que tanto estudió.", e: "Alegría" },
  { s: "A Marcos lo invitaron a la fiesta que esperaba.", e: "Alegría" },
  { s: "Nació el primer nieto de doña Rosa.", e: "Alegría" },
  { s: "El equipo de Javier ganó el partido final.", e: "Alegría" },
  { s: "Le avisaron a Sara que fue aceptada en la universidad.", e: "Alegría" },
  // Tristeza
  { s: "A Luis se le perdió su mascota y no la encuentra.", e: "Tristeza" },
  { s: "Se dañó la foto favorita del abuelo de Diego.", e: "Tristeza" },
  { s: "El mejor amigo de Camila se mudó a otra ciudad.", e: "Tristeza" },
  { s: "A Óscar se le rompió un regalo que guardaba hace años.", e: "Tristeza" },
  { s: "Nadie llegó a la reunión que Marta preparó con cariño.", e: "Tristeza" },
  { s: "Se marchitó la planta que Pedro cuidaba desde niño.", e: "Tristeza" },
  // Miedo
  { s: "María oyó un ruido fuerte de noche, sola en casa.", e: "Miedo" },
  { s: "Un perro grande corre hacia Lucía ladrando.", e: "Miedo" },
  { s: "Andrés se perdió de noche en una calle que no conocía.", e: "Miedo" },
  { s: "El avión de Paula empezó a moverse con fuerte turbulencia.", e: "Miedo" },
  { s: "Se fue la luz y Toño quedó a oscuras en el sótano.", e: "Miedo" },
  { s: "Valentina vio una sombra moverse detrás de la ventana.", e: "Miedo" },
  // Sorpresa
  { s: "Pedro abrió la puerta y todos gritaron: ¡felicidades!", e: "Sorpresa" },
  { s: "Al llegar, Marta encontró la casa completamente distinta.", e: "Sorpresa" },
  { s: "Nicolás se encontró un billete olvidado en su abrigo.", e: "Sorpresa" },
  { s: "Sonó el teléfono y era un amigo de la infancia sin avisar.", e: "Sorpresa" },
  { s: "Abrió la caja y adentro había algo que no esperaba.", e: "Sorpresa" },
  { s: "Al voltear, Laura se topó con su artista favorito en la calle.", e: "Sorpresa" },
  // Enojo
  { s: "Rompieron el juguete de Sofía a propósito.", e: "Enojo" },
  { s: "Alguien se coló en la fila delante de Tomás.", e: "Enojo" },
  { s: "Le mancharon el trabajo que Renata acababa de terminar.", e: "Enojo" },
  { s: "Un conductor le cerró el paso a Gabriel sin razón.", e: "Enojo" },
  { s: "Repitieron algo que Elena había pedido guardar en secreto.", e: "Enojo" },
  { s: "Le echaron la culpa a Mateo de algo que no hizo.", e: "Enojo" },
  // Calma
  { s: "Juan terminó una tarea difícil y ahora descansa.", e: "Calma" },
  { s: "Después de meditar, Elena respira despacio y tranquila.", e: "Calma" },
  { s: "Julia toma un té caliente mirando la lluvia por la ventana.", e: "Calma" },
  { s: "Terminó la semana y Raúl se recuesta sin pendientes.", e: "Calma" },
  { s: "Camina despacio por el parque en una mañana silenciosa.", e: "Calma" },
  { s: "Escucha música suave recostado, sin prisa por nada.", e: "Calma" },
];

export function EmocionSituacion({ level, onFinish }: GameProps) {
  const ms = level.ms ?? 8000;
  const bag = useRef(createBag(CASOS.length));

  function make(): ChoiceRound {
    const caso = CASOS[bag.current.next()];
    const set = new Set<string>([caso.e]);
    while (set.size < 4) set.add(EMOCIONES[Math.floor(Math.random() * EMOCIONES.length)]);
    const options = [...set]
      .sort(() => Math.random() - 0.5)
      .map((v) => ({ key: v, node: v, correct: v === caso.e }));
    return {
      prompt: <p className="text-base font-semibold leading-relaxed text-white">{caso.s}</p>,
      options,
    };
  }

  return (
    <TimedChoice rounds={8} ms={ms} make={make} onFinish={onFinish} hint="¿Cómo crees que se siente?" />
  );
}
