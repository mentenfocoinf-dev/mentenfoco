// Ordena los pasos — planificación / comprensión.
// Toca los pasos de una actividad en el orden correcto.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createBag } from "./bag";
import type { GameProps } from "./types";

const ACTIVIDADES: { titulo: string; pasos: string[] }[] = [
  {
    titulo: "Preparar un café",
    pasos: ["Calentar el agua", "Poner el café en la taza", "Verter el agua", "Revolver"],
  },
  {
    titulo: "Lavarse las manos",
    pasos: ["Abrir la llave", "Echar jabón", "Frotar las manos", "Enjuagar", "Secar"],
  },
  {
    titulo: "Enviar una carta",
    pasos: [
      "Escribir la carta",
      "Meterla en el sobre",
      "Pegar la estampilla",
      "Llevarla al correo",
    ],
  },
  {
    titulo: "Plantar una semilla",
    pasos: ["Cavar un hoyo", "Poner la semilla", "Cubrir con tierra", "Regar"],
  },
  {
    titulo: "Preparar un sándwich",
    pasos: ["Sacar el pan", "Untar la mantequilla", "Poner el relleno", "Cerrar el sándwich"],
  },
  {
    titulo: "Cepillarse los dientes",
    pasos: [
      "Poner pasta en el cepillo",
      "Cepillar los dientes",
      "Enjuagar la boca",
      "Guardar el cepillo",
    ],
  },
  {
    titulo: "Preparar un té",
    pasos: [
      "Calentar el agua",
      "Poner la bolsita en la taza",
      "Verter el agua caliente",
      "Esperar unos minutos",
    ],
  },
  {
    titulo: "Vestirse para salir",
    pasos: ["Escoger la ropa", "Ponerse la ropa", "Ponerse los zapatos", "Ponerse el abrigo"],
  },
  {
    titulo: "Hacer una llamada",
    pasos: ["Tomar el teléfono", "Marcar el número", "Hablar con la persona", "Colgar al terminar"],
  },
  {
    titulo: "Regar las plantas",
    pasos: ["Llenar la regadera", "Verter el agua en la maceta", "Guardar la regadera"],
  },
  {
    titulo: "Tender la cama",
    pasos: ["Estirar la sábana", "Poner la cobija", "Acomodar las almohadas", "Alisar todo"],
  },
  {
    titulo: "Lavar los platos",
    pasos: [
      "Quitar los restos de comida",
      "Echar jabón a la esponja",
      "Fregar los platos",
      "Enjuagar con agua",
      "Dejarlos secar",
    ],
  },
  {
    titulo: "Ir de compras",
    pasos: ["Hacer la lista", "Ir a la tienda", "Escoger los productos", "Pagar en la caja"],
  },
  {
    titulo: "Hacer jugo de naranja",
    pasos: ["Cortar las naranjas", "Exprimir el jugo", "Servir en un vaso", "Beber el jugo"],
  },
  {
    titulo: "Salir de casa",
    pasos: ["Apagar las luces", "Tomar las llaves", "Salir por la puerta", "Cerrar con llave"],
  },
];

function barajar<T>(a: T[]): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

export function OrdenaPasos({ level, onFinish }: GameProps) {
  const totalRondas = level.rounds ?? 4;
  const maxPasos = level.maxSteps ?? 5;

  // Subconjunto apto para esta dificultad + bolsa sin reemplazo sobre él.
  const aptas = useRef(ACTIVIDADES.filter((a) => a.pasos.length <= maxPasos));
  const bag = useRef(createBag(aptas.current.length));
  const fin = useRef(false);

  function elegir() {
    return aptas.current[bag.current.next()] ?? ACTIVIDADES[0];
  }

  const [ronda, setRonda] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [errores, setErrores] = useState(0);
  const [actividad, setActividad] = useState(() => elegir());
  const [orden, setOrden] = useState<string[]>(() => barajar(actividad.pasos));
  const [siguiente, setSiguiente] = useState(0);
  const [malo, setMalo] = useState<string | null>(null);

  useEffect(() => {
    setOrden(barajar(actividad.pasos));
    setSiguiente(0);
  }, [actividad]);

  function tocar(paso: string) {
    if (fin.current) return;
    if (paso === actividad.pasos[siguiente]) {
      const s = siguiente + 1;
      setSiguiente(s);
      if (s === actividad.pasos.length) {
        const ac = aciertos + 1;
        setAciertos(ac);
        setTimeout(() => avanzar(ac, errores), 500);
      }
    } else {
      setErrores((e) => e + 1);
      setMalo(paso);
      setTimeout(() => setMalo(null), 400);
    }
  }

  function avanzar(ac: number, er: number) {
    if (ronda + 1 >= totalRondas) {
      fin.current = true;
      const totalActos = ac + er;
      onFinish({
        score: Math.max(0, ac * 20 - er * 5),
        accuracy: totalActos > 0 ? ac / (ac + er) : 1,
        durationSeconds: 0,
        completed: true,
      });
    } else {
      setRonda((r) => r + 1);
      setActividad(elegir());
    }
  }

  const hechos = actividad.pasos.slice(0, siguiente);

  return (
    <div className="text-center">
      <div className="mb-4 flex items-center justify-center gap-6 text-sm font-semibold text-white">
        <span>
          Actividad {Math.min(ronda + 1, totalRondas)}/{totalRondas}
        </span>
        <span>Aciertos: {aciertos}</span>
      </div>

      <p className="text-lg font-bold text-white">{actividad.titulo}</p>
      <p className="mt-1 text-sm text-white/70">Toca los pasos en el orden correcto.</p>

      <div className="mx-auto mt-4 flex max-w-md flex-col gap-2">
        {orden.map((paso) => {
          const hecho = hechos.includes(paso);
          const orden1 = hecho ? actividad.pasos.indexOf(paso) + 1 : null;
          return (
            <button
              key={paso}
              type="button"
              disabled={hecho}
              onClick={() => tocar(paso)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                hecho
                  ? "bg-emerald-500/20 text-emerald-200"
                  : malo === paso
                    ? "bg-rose-500/30 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {/* Solo se muestra el número una vez colocado; nunca antes (no revela el orden). */}
                {hecho ? orden1 : <CheckCircle2 size={13} className="opacity-30" />}
              </span>
              {paso}
            </button>
          );
        })}
      </div>
    </div>
  );
}
