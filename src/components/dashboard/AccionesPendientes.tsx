// ============================================================================
// "Acciones pendientes" — el resumen de novedades del portal.
//
// Lee del mismo Notification Center que los badges del menú, así que no puede
// contradecirlos: si el menú marca dos citas, aquí salen dos.
//
// Solo aparece lo que de verdad tiene algo. Sin novedades, la tarjeta no se
// dibuja: una lista de ceros no informa de nada y solo ocupa la parte alta del
// panel, que es donde debe estar lo urgente.
// ============================================================================
import { ArrowRight } from "lucide-react";
import type { Novedad } from "../../hooks/useNovedades";

export function AccionesPendientes({
  pendientes,
  onIr,
}: {
  pendientes: Novedad[];
  onIr: (clave: string) => void;
}) {
  if (pendientes.length === 0) return null;

  return (
    <section className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
      <h2 className="text-lg font-bold text-primary">Acciones pendientes</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Lo que está esperando algo de tu parte.
      </p>

      <ul className="mt-4 space-y-2">
        {pendientes.map((n) => (
          <li key={`${n.clave}-${n.etiqueta}`}>
            <button
              type="button"
              onClick={() => onIr(n.clave)}
              className="glow-hover flex w-full items-center gap-3 rounded-2xl border border-white/50 bg-white/50 px-4 py-3 text-left transition-colors hover:border-primary/40"
            >
              <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
                {n.cantidad}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                {n.etiqueta}
              </span>
              <ArrowRight size={16} className="shrink-0 text-primary" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
