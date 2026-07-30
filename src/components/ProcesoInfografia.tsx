// ============================================================================
// "Cómo funciona el proceso" como diagrama, no como cuatro tarjetas sueltas.
//
// Cuatro cajas iguales en fila no comunican secuencia: se leen como cuatro
// opciones. Lo que hace que se entienda de un vistazo es la línea que une los
// pasos, porque es la que dice "esto va después de aquello".
//
// En escritorio la línea es horizontal y atraviesa los cuatro círculos; en
// móvil, donde los pasos se apilan, gira a vertical. Es un solo elemento
// decorativo con `aria-hidden`: la secuencia real ya la da el <ol>.
// ============================================================================
import type { LucideIcon } from "lucide-react";

export interface PasoProceso {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface Props {
  pasos: PasoProceso[];
  className?: string;
}

export function ProcesoInfografia({ pasos, className }: Props) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Riel de conexión. Se detiene en el centro del primer y del último
          círculo (de ahí los inset), para que no sobresalga por los extremos. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary/10 via-primary/30 to-primary/10 md:left-[12.5%] md:right-[12.5%] md:top-8 md:bottom-auto md:h-0.5 md:w-auto md:bg-gradient-to-r md:from-primary/10 md:via-primary/30 md:to-primary/10"
      />

      <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
        {pasos.map((paso, i) => {
          const Icon = paso.icon;
          return (
            <li
              key={paso.title}
              className="group flex items-start gap-5 md:flex-col md:items-center md:gap-0 md:text-center"
            >
              {/* El círculo va sobre fondo sólido para tapar el riel justo
                  detrás: si fuera translúcido, la línea se vería cruzándolo. */}
              <div className="relative z-10 shrink-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-110">
                  <Icon size={24} strokeWidth={1.75} />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white text-xs font-bold text-primary shadow-sm ring-1 ring-primary/20">
                  {i + 1}
                </span>
              </div>

              <div className="md:mt-5">
                <h3 className="font-bold text-primary">{paso.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground md:mx-auto md:max-w-[15rem]">
                  {paso.desc}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
