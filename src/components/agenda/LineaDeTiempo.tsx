// ============================================================================
// El ciclo de vida de una sesión, dibujado.
//
// Un badge dice dónde está. No dice de dónde viene ni qué falta. "Confirmada"
// y "Confirmada pero sin enlace" son el mismo badge y situaciones distintas: en
// la segunda el paciente no puede entrar.
//
// ── Todo se deriva, nada se inventa ─────────────────────────────────────────
//
// No hay tabla de historial. Cada hito se calcula de lo que ya existe:
//
//   Solicitud recibida   la sesión tiene `appointment_id`
//   Contraoferta         esa cita tiene `replaces_appointment_id`
//   Confirmada           estado `confirmada` (o `programada`, que es su previo)
//   Videollamada lista   hay `video_call_link`
//   En curso             ahora cae dentro de la sesión
//   Realizada            estado `completada`
//   Cancelada / No asistió   estados terminales, cortan la línea
//
// Los hitos que no se pueden saber NO se pintan como pendientes ambiguos: se
// omiten. Una línea que insinúa pasos que nunca van a ocurrir engaña igual que
// un dato falso.
// ============================================================================
import { Check, CircleDot, Circle, X } from "lucide-react";
import type { SessionStatus } from "../../lib/api";

export type EstadoHito = "hecho" | "actual" | "pendiente" | "fallido";

export interface Hito {
  clave: string;
  etiqueta: string;
  estado: EstadoHito;
  /** Aclara por qué está donde está, cuando no es obvio. */
  nota?: string;
}

export interface DatosCicloVida {
  status: SessionStatus;
  scheduledAt: string;
  durationMinutes: number;
  videoCallLink: string | null;
  /** La sesión nació de una solicitud del paciente. */
  desdeSolicitud: boolean;
  /** Y esa solicitud era una contraoferta del profesional. */
  desdeContraoferta: boolean;
  /** Para poder fijar "en curso" sin depender del reloj del render. */
  ahora?: number;
}

export function construirHitos(d: DatosCicloVida): Hito[] {
  const ahora = d.ahora ?? Date.now();
  const inicio = new Date(d.scheduledAt).getTime();
  const fin = inicio + d.durationMinutes * 60000;

  const cancelada = d.status === "cancelada";
  const noAsistio = d.status === "no_asistio";
  const realizada = d.status === "completada";
  const enCurso = !cancelada && !noAsistio && !realizada && ahora >= inicio && ahora < fin;
  const pasada = ahora >= fin;

  const hitos: Hito[] = [];

  if (d.desdeSolicitud) {
    hitos.push({
      clave: "solicitud",
      etiqueta: d.desdeContraoferta ? "Horario propuesto por ti" : "Solicitud recibida",
      estado: "hecho",
      nota: d.desdeContraoferta ? "Sustituye a una solicitud anterior" : undefined,
    });
  } else {
    hitos.push({ clave: "programada", etiqueta: "Programada por ti", estado: "hecho" });
  }

  hitos.push({
    clave: "confirmada",
    etiqueta: "Confirmada",
    estado: d.status === "programada" ? "pendiente" : "hecho",
  });

  hitos.push({
    clave: "enlace",
    etiqueta: "Videollamada disponible",
    estado: d.videoCallLink ? "hecho" : cancelada ? "pendiente" : "fallido",
    nota: d.videoCallLink ? undefined : "Sin enlace, el paciente no puede entrar",
  });

  if (cancelada) {
    hitos.push({ clave: "cancelada", etiqueta: "Cancelada", estado: "fallido" });
    return hitos;
  }
  if (noAsistio) {
    hitos.push({ clave: "no_asistio", etiqueta: "No asistió", estado: "fallido" });
    return hitos;
  }

  hitos.push({
    clave: "en_curso",
    etiqueta: "En curso",
    estado: enCurso ? "actual" : realizada || pasada ? "hecho" : "pendiente",
  });

  hitos.push({
    clave: "realizada",
    etiqueta: "Realizada",
    estado: realizada ? "hecho" : pasada ? "fallido" : "pendiente",
    nota: !realizada && pasada ? "Ya pasó la hora y sigue sin cerrarse" : undefined,
  });

  return hitos;
}

const ICONO: Record<EstadoHito, typeof Check> = {
  hecho: Check,
  actual: CircleDot,
  pendiente: Circle,
  fallido: X,
};

const COLOR: Record<EstadoHito, string> = {
  hecho: "border-emerald-300 bg-emerald-50 text-emerald-700",
  actual: "border-primary/40 bg-primary/10 text-primary",
  pendiente: "border-slate-200 bg-white text-slate-400",
  fallido: "border-amber-300 bg-amber-50 text-amber-700",
};

const LINEA: Record<EstadoHito, string> = {
  hecho: "bg-emerald-200",
  actual: "bg-primary/30",
  pendiente: "bg-slate-200",
  fallido: "bg-amber-200",
};

export function LineaDeTiempo({ hitos }: { hitos: Hito[] }) {
  return (
    <ol className="flex flex-wrap items-start gap-y-3">
      {hitos.map((h, i) => {
        const Icono = ICONO[h.estado];
        return (
          <li key={h.clave} className="flex min-w-0 items-start">
            <div className="flex w-24 flex-col items-center text-center sm:w-28">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${COLOR[h.estado]}`}
              >
                <Icono size={14} strokeWidth={2.5} />
              </span>
              <span
                className={`mt-1 text-[11px] font-bold leading-tight ${
                  h.estado === "pendiente" ? "text-slate-400" : "text-slate-700"
                }`}
              >
                {h.etiqueta}
              </span>
              {h.nota && (
                <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  {h.nota}
                </span>
              )}
            </div>
            {i < hitos.length - 1 && (
              <span
                aria-hidden
                className={`mt-3.5 h-0.5 w-3 shrink-0 rounded ${LINEA[hitos[i + 1].estado]}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
