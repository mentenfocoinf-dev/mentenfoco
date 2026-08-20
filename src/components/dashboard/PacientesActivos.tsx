// ============================================================================
// "Pacientes activos" — panel del terapeuta.
//
// Solo llegan las relaciones donde participa quien tiene la sesión: lo filtra
// la función de la base, no esta pantalla.
//
// ── Lo que falta, y por qué no está inventado ───────────────────────────────
//
// La especificación pedía también "última actividad Journey" y "programa
// activo". No se pueden mostrar hoy: las funciones del Journey
// (`journey_recent_resources`, `journey_seen_resources`) filtran por
// `auth.uid()` DENTRO, así que un terapeuta no puede leer el recorrido de su
// paciente ni aunque quiera. No es un descuido del sprint anterior — es la
// decisión de que el recorrido solo lo lea su dueño.
//
// Abrirlo exige una función nueva que exponga el recorrido de una persona a
// otra, y eso es una decisión de privacidad, no una tarea de integración. Se
// deja fuera en vez de rellenar las columnas con algo que parezca un dato.
// ============================================================================
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMyPatients, RELATIONSHIP_STATUS_LABELS, type MyPatient } from "../../lib/api";

const CLASE_ESTADO: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  finished: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PacientesActivos() {
  const [relaciones, setRelaciones] = useState<MyPatient[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    void getMyPatients().then((r) => {
      if (!vigente) return;
      setRelaciones(r);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (cargando) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-white/40 p-10">
        <Loader2 className="animate-spin text-primary" size={22} />
      </div>
    );
  }

  if (relaciones.length === 0) {
    return (
      <p className="rounded-3xl glass-card border border-white/40 p-6 text-sm text-muted-foreground">
        Todavía no tienes pacientes asignados.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {relaciones.map((r) => (
        <article
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-3xl glass-card border border-white/40 p-5"
        >
          <div className="min-w-0">
            <p className="font-bold text-primary">{r.patientName || "Paciente"}</p>
            <p className="text-xs text-muted-foreground">
              Desde el {fecha(r.assignedAt)}
              {r.endedAt && ` · hasta el ${fecha(r.endedAt)}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${CLASE_ESTADO[r.status]}`}
            >
              {RELATIONSHIP_STATUS_LABELS[r.status]}
            </span>
            <Link
              to="/conversacion/$relationshipId"
              params={{ relationshipId: r.id }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
            >
              <MessageCircle size={13} /> Conversación
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
