// Forma la palabra — lenguaje.
// A partir de una pista y unas letras revueltas, arma la palabra.
import { useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";
import { createBag } from "./bag";
import type { GameProps } from "./types";

const PALABRAS: { pista: string; palabra: string }[] = [
  // Cortas (3-4 letras)
  { pista: "Astro que ilumina el día", palabra: "SOL" },
  { pista: "Alimento que se hornea a diario", palabra: "PAN" },
  { pista: "Gran masa de agua salada", palabra: "MAR" },
  { pista: "Líquido que bebemos a diario", palabra: "AGUA" },
  { pista: "Color del cielo despejado", palabra: "AZUL" },
  { pista: "Astro que vemos de noche", palabra: "LUNA" },
  { pista: "Parte colorida de una planta", palabra: "FLOR" },
  { pista: "Animal que maúlla", palabra: "GATO" },
  { pista: "Ave que nada y hace cuac", palabra: "PATO" },
  { pista: "Color de la sangre y las fresas", palabra: "ROJO" },
  { pista: "Se forma en el cielo y trae lluvia", palabra: "NUBE" },
  { pista: "Mueble donde comemos", palabra: "MESA" },
  // Medias (5-6 letras)
  { pista: "Animal que ladra", palabra: "PERRO" },
  { pista: "Se usa para escribir", palabra: "LAPIZ" },
  { pista: "Objeto con páginas para leer", palabra: "LIBRO" },
  { pista: "Color de las hojas y el pasto", palabra: "VERDE" },
  { pista: "Alimento hecho de leche", palabra: "QUESO" },
  { pista: "Fruta amarilla y curva", palabra: "BANANA" },
  { pista: "Prenda para la parte de arriba", palabra: "CAMISA" },
  { pista: "Se pone en los pies", palabra: "ZAPATO" },
  // Largas (7-9 letras)
  { pista: "Abertura de la pared con vidrio", palabra: "VENTANA" },
  { pista: "Animal que se monta y relincha", palabra: "CABALLO" },
  { pista: "Lugar donde se aprende", palabra: "ESCUELA" },
  { pista: "Estación más fría del año", palabra: "INVIERNO" },
  { pista: "Animal enorme con trompa", palabra: "ELEFANTE" },
  { pista: "Insecto de alas coloridas", palabra: "MARIPOSA" },
  { pista: "Aparato para hablar a distancia", palabra: "TELEFONO" },
  { pista: "Lugar donde atienden enfermos", palabra: "HOSPITAL" },
  { pista: "Vehículo de dos ruedas a pedales", palabra: "BICICLETA" },
  { pista: "Dulce hecho de cacao", palabra: "CHOCOLATE" },
];

interface Ficha {
  id: number;
  letra: string;
  usada: boolean;
}

export function FormaPalabra({ level, onFinish }: GameProps) {
  const totalRondas = level.rounds ?? 5;
  const maxLen = level.maxLen ?? 9;

  // Subconjunto apto para esta dificultad + bolsa sin reemplazo sobre él.
  const aptas = useRef(PALABRAS.filter((p) => p.palabra.length <= maxLen));
  const bag = useRef(createBag(aptas.current.length));

  function preparar() {
    const elegida = aptas.current[bag.current.next()] ?? PALABRAS[0];
    const fichas: Ficha[] = elegida.palabra
      .split("")
      .map((letra, id) => ({ id, letra, usada: false }))
      .sort(() => Math.random() - 0.5);
    return { pista: elegida.pista, palabra: elegida.palabra, fichas };
  }

  const [ronda, setRonda] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [errores, setErrores] = useState(0);
  const [estado, setEstado] = useState(() => preparar());
  const [armado, setArmado] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"ok" | "mal" | null>(null);
  const fin = useRef(false);

  useEffect(() => {
    setArmado([]);
    setFeedback(null);
  }, [estado]);

  const texto = armado.map((i) => estado.fichas.find((f) => f.id === i)!.letra).join("");

  function tocar(id: number) {
    if (fin.current || feedback) return;
    const f = estado.fichas.find((x) => x.id === id);
    if (!f || f.usada) return;
    f.usada = true;
    const nuevo = [...armado, id];
    setArmado(nuevo);
    if (nuevo.length === estado.palabra.length) {
      const palabra = nuevo.map((i) => estado.fichas.find((x) => x.id === i)!.letra).join("");
      if (palabra === estado.palabra) {
        setFeedback("ok");
        setAciertos((a) => a + 1);
        setTimeout(() => avanzar(aciertos + 1, errores), 700);
      } else {
        setFeedback("mal");
        setErrores((e) => e + 1);
        setTimeout(() => {
          estado.fichas.forEach((x) => (x.usada = false));
          setArmado([]);
          setFeedback(null);
        }, 700);
      }
    }
  }

  function borrar() {
    if (feedback) return;
    const ult = armado[armado.length - 1];
    if (ult === undefined) return;
    const f = estado.fichas.find((x) => x.id === ult);
    if (f) f.usada = false;
    setArmado((a) => a.slice(0, -1));
  }

  function avanzar(ac: number, er: number) {
    if (ronda + 1 >= totalRondas) {
      fin.current = true;
      onFinish({
        score: Math.max(0, ac * 20 - er * 5),
        accuracy: ac + er > 0 ? ac / (ac + er) : 1,
        durationSeconds: 0,
        completed: true,
      });
    } else {
      setRonda((r) => r + 1);
      setEstado(preparar());
    }
  }

  return (
    <div className="text-center">
      <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>
          Palabra {Math.min(ronda + 1, totalRondas)}/{totalRondas}
        </span>
        <span>Aciertos: {aciertos}</span>
      </div>

      <p className="text-sm text-white/70">Pista</p>
      <p className="mt-1 text-lg font-bold text-white">{estado.pista}</p>

      {/* Palabra en construcción */}
      <div className="mt-5 flex justify-center gap-1.5">
        {estado.palabra.split("").map((_, i) => (
          <span
            key={i}
            className={`flex h-11 w-9 items-center justify-center rounded-lg border-2 text-xl font-extrabold text-white ${
              feedback === "ok"
                ? "border-emerald-400 bg-emerald-500/20"
                : feedback === "mal"
                  ? "border-rose-400 bg-rose-500/20"
                  : "border-white/20 bg-white/5"
            }`}
          >
            {texto[i] ?? ""}
          </span>
        ))}
      </div>

      {/* Letras revueltas */}
      <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2">
        {estado.fichas.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={f.usada}
            onClick={() => tocar(f.id)}
            className={`h-11 w-11 rounded-xl text-xl font-extrabold transition-colors ${
              f.usada ? "bg-white/5 text-white/20" : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            {f.letra}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={borrar}
        className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10"
      >
        <Delete size={14} /> Borrar
      </button>
    </div>
  );
}
