// La respuesta adecuada — cognición social.
// Lee una situación con otra persona y elige la respuesta más apropiada.
// Trabaja la lectura de intenciones y las normas sociales. Basado en texto.
import { useRef } from "react";
import { TimedChoice, type ChoiceRound } from "./TimedChoice";
import { createBag } from "./bag";
import type { GameProps } from "./types";

const CASOS: { s: string; ok: string; malas: string[] }[] = [
  {
    s: "Un amigo te cuenta que perdió su trabajo.",
    ok: "Lamento que estés pasando por esto, ¿en qué te puedo ayudar?",
    malas: ["Seguro fue tu culpa.", "No me interesa ahora.", "¿Y a mí qué?"],
  },
  {
    s: "Alguien tropieza y se le caen sus cosas al piso.",
    ok: "Le ayudas a recogerlas y preguntas si está bien.",
    malas: ["Te ríes y sigues de largo.", "Le dices que es un torpe.", "Grabas un video."],
  },
  {
    s: "En una reunión, otra persona está hablando.",
    ok: "Esperas tu turno para hablar y escuchas con atención.",
    malas: [
      "La interrumpes de inmediato.",
      "Le subes el volumen a tu teléfono.",
      "Te vas sin avisar.",
    ],
  },
  {
    s: "Un compañero te presta algo y lo necesita de vuelta.",
    ok: "Se lo devuelves a tiempo y le das las gracias.",
    malas: [
      "Lo ignoras varios días.",
      "Dices que nunca te lo prestó.",
      "Se lo prestas a otra persona.",
    ],
  },
  {
    s: "Alguien te felicita por algo que hiciste bien.",
    ok: "Le agradeces con una sonrisa.",
    malas: ["Le dices que se calle.", "Le respondes de mala manera.", "Te alejas sin decir nada."],
  },
  {
    s: "Un vecino mayor carga bolsas pesadas por la escalera.",
    ok: "Le ofreces ayudarle a subirlas.",
    malas: ["Pasas empujándolo.", "Le dices que se apure.", "Cierras la puerta en su cara."],
  },
  {
    s: "Cometiste un error que afectó a otra persona.",
    ok: "Reconoces el error y ofreces una disculpa sincera.",
    malas: ["Culpas a alguien más.", "Actúas como si nada.", "Te enojas con quien lo notó."],
  },
  {
    s: "Un amigo está muy contento porque le fue bien en un examen.",
    ok: "Te alegras por él y lo felicitas.",
    malas: ["Le dices que tuvo suerte.", "Cambias de tema.", "Le restas importancia."],
  },
  {
    s: "Un compañero nuevo no conoce a nadie en el grupo.",
    ok: "Te acercas y te presentas para que se sienta bienvenido.",
    malas: [
      "Lo ignoras por ser nuevo.",
      "Te burlas de que esté solo.",
      "Le dices que se busque a otros.",
    ],
  },
  {
    s: "Tu amigo está triste y quiere hablar contigo.",
    ok: "Lo escuchas con atención, sin interrumpir.",
    malas: [
      "Miras el teléfono mientras habla.",
      "Le dices que exagera.",
      "Cambias de tema enseguida.",
    ],
  },
  {
    s: "Alguien te pide perdón por un error que cometió.",
    ok: "Aceptas la disculpa y sigues adelante.",
    malas: [
      "Se lo recuerdas para siempre.",
      "Le gritas aún más fuerte.",
      "No le vuelves a hablar nunca.",
    ],
  },
  {
    s: "En el bus, una persona mayor no encuentra asiento.",
    ok: "Le ofreces tu asiento.",
    malas: ["Finges no verla.", "Le dices que llegó tarde.", "Pones tu bolso en el asiento libre."],
  },
  {
    s: "Un vecino te saluda por la mañana.",
    ok: "Le devuelves el saludo con amabilidad.",
    malas: ["Lo ignoras a propósito.", "Le respondes de mal humor.", "Le cierras la puerta."],
  },
  {
    s: "Estás en una fila y tienes algo de prisa.",
    ok: "Esperas tu turno con paciencia.",
    malas: ["Te cuelas adelante.", "Empujas a los demás.", "Insultas a quien va lento."],
  },
  {
    s: "Un amigo te confía un secreto importante.",
    ok: "Lo guardas y no se lo cuentas a nadie.",
    malas: ["Lo publicas en redes.", "Se lo cuentas al grupo.", "Lo usas para burlarte."],
  },
  {
    s: "Recibes una crítica útil sobre tu trabajo.",
    ok: "Agradeces el comentario y tratas de mejorar.",
    malas: ["Te enojas y te vas.", "Insultas a quien te habló.", "Rompes tu trabajo."],
  },
  {
    s: "Un familiar está enfermo en cama.",
    ok: "Le preguntas cómo se siente y en qué puedes ayudar.",
    malas: [
      "Le subes el volumen a la tele.",
      "Le dices que no moleste.",
      "Lo dejas solo sin avisar.",
    ],
  },
  {
    s: "Alguien deja caer sus llaves sin darse cuenta.",
    ok: "Se las recoges y se las entregas.",
    malas: ["Te las quedas.", "Finges no ver nada.", "Las pateas lejos."],
  },
  {
    s: "Un niño está perdido y llora en la plaza.",
    ok: "Buscas con calma a un adulto o a un guardia para ayudarlo.",
    malas: ["Sigues caminando.", "Le gritas que se calle.", "Te burlas de que llore."],
  },
  {
    s: "Interrumpiste a alguien sin querer mientras hablaba.",
    ok: "Te disculpas y lo dejas terminar.",
    malas: ["Sigues hablando más fuerte.", "Le dices que se apure.", "Te vas molesto."],
  },
  {
    s: "Un amigo logró algo que a ti no te salió.",
    ok: "Lo felicitas de corazón.",
    malas: ["Le dices que fue pura suerte.", "Le restas mérito.", "Te enojas con él."],
  },
  {
    s: "Alguien necesita ayuda para cargar algo pesado.",
    ok: "Te ofreces a echarle una mano.",
    malas: ["Pasas de largo mirando.", "Le dices que se apure.", "Te ríes de su esfuerzo."],
  },
  {
    s: "Rompiste algo que te habían prestado, sin querer.",
    ok: "Avisas lo que pasó y ofreces reponerlo.",
    malas: ["Lo escondes y callas.", "Dices que ya estaba roto.", "Culpas a otra persona."],
  },
];

export function RespuestaAdecuada({ level, onFinish }: GameProps) {
  const ms = level.ms ?? 9000;
  const bag = useRef(createBag(CASOS.length));

  function make(): ChoiceRound {
    const caso = CASOS[bag.current.next()];
    const malas = [...caso.malas].sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [caso.ok, ...malas]
      .sort(() => Math.random() - 0.5)
      .map((v) => ({
        key: v,
        node: <span className="text-sm leading-snug">{v}</span>,
        correct: v === caso.ok,
      }));
    return {
      prompt: <p className="text-base font-semibold leading-relaxed text-white">{caso.s}</p>,
      options,
    };
  }

  return (
    <TimedChoice
      rounds={8}
      ms={ms}
      make={make}
      onFinish={onFinish}
      layout="row"
      hint="¿Cuál es la respuesta más adecuada?"
    />
  );
}
