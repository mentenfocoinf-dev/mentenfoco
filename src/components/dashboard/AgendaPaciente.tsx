// ============================================================================
// "Agenda" — la del paciente.
//
// Antes había dos pantallas: "Mis citas" enseñaba las solicitudes con un badge,
// y "Agenda" enseñaba las sesiones. Ninguna de las dos contaba la historia
// entera, así que quien pedía una cita y recibía una contraoferta no tenía
// dónde verla ni cómo responderla. Se quedaba a ciegas.
//
// Aquí está el ciclo completo y en orden de urgencia:
//
//   1. Lo que espera respuesta SUYA  — contraofertas: aceptar o rechazar
//   2. Lo que espera respuesta AJENA — solicitudes enviadas
//   3. Lo que va a ocurrir           — sesiones, con su videollamada
//   4. Lo que ya ocurrió             — historial, sin borrar nada
//
// Usa el mismo hook y la misma ficha que el profesional. Es deliberado: cuando
// cada portal tenía su propia versión de "la sesión", contaban cosas distintas
// del mismo hecho.
// ============================================================================
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Clock, History, Loader2 } from "lucide-react";
import {
  getMyTherapist,
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type MyTherapist,
} from "../../lib/api";
import { useAgenda } from "../../hooks/useAgenda";
import { SesionPanel } from "../agenda/SesionPanel";

const CLASE_ESTADO: Record<string, string> = {
  requested: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
  completed: "border-slate-200 bg-slate-50 text-slate-600",
  no_show: "border-slate-200 bg-slate-50 text-slate-500",
};

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgendaPaciente() {
  const agenda = useAgenda("patient");
  // Solo hace falta para enlazar a la conversación, que es donde se piden las
  // citas. Si falla, la agenda se sigue leyendo entera.
  const [relacion, setRelacion] = useState<MyTherapist | null>(null);
  useEffect(() => {
    let vigente = true;
    void getMyTherapist()
      .then((r) => {
        if (vigente) setRelacion(r);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  if (agenda.cargando) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-white/40 p-10">
        <Loader2 className="animate-spin text-primary" size={22} />
      </div>
    );
  }

  const ahora = Date.now();

  // Lo que el profesional propuso y todavía no ha respondido nadie.
  const propuestas = agenda.propuestas;
  const propuestasIds = new Set(propuestas.map((c) => c.id));
  // Sus propias solicitudes, esperando respuesta del profesional.
  const enviadas = agenda.pendientes.filter((c) => !propuestasIds.has(c.id));

  const proximas = agenda.sesiones
    .filter((s) => s.status !== "cancelada" && new Date(s.scheduled_at).getTime() >= ahora)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const pasadas = agenda.sesiones
    .filter((s) => s.status === "cancelada" || new Date(s.scheduled_at).getTime() < ahora)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  // Citas que nunca llegaron a sesión: canceladas antes de confirmarse. Sin
  // esto, una solicitud rechazada desaparecería sin dejar rastro.
  const citasSinSesion = agenda.citas.filter(
    (c) => c.status === "cancelled" && !agenda.sesiones.some((s) => s.appointment_id === c.id),
  );

  return (
    <div className="space-y-6">
      {agenda.error && <p className="text-sm text-red-600">{agenda.error}</p>}

      {relacion && (
        <Link
          to="/conversacion/$relationshipId"
          params={{ relationshipId: relacion.id }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <CalendarPlus size={15} /> Solicitar cita
        </Link>
      )}

      {/* ── 1. Lo que espera respuesta suya ── */}
      {propuestas.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-primary">Te proponen otro horario</h2>
          {/* Sirve para los dos casos: una solicitud que no encajaba y una
              sesión ya confirmada que hubo que mover. Desde aquí se ven igual,
              y en los dos hay que responder. */}
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tu profesional propone esta hora en lugar de la anterior. Hasta que respondas, no hay
            nada agendado.
          </p>
          <div className="mt-3 space-y-2">
            {propuestas.map((c) => (
              <Propuesta
                key={c.id}
                cita={c}
                original={agenda.citas.find((x) => x.id === c.replacesAppointmentId)}
                trabajando={agenda.trabajando === c.id}
                onAceptar={() => void agenda.aceptarPropuesta(c.id)}
                onRechazar={() => void agenda.rechazarPropuesta(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 2. Lo que espera respuesta del profesional ── */}
      <section>
        <h2 className="text-lg font-bold text-primary">Solicitudes enviadas</h2>
        <div className="mt-3 space-y-2">
          {enviadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes solicitudes sin responder.</p>
          ) : (
            enviadas.map((c) => (
              <article
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl glass-card border border-white/40 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold capitalize text-slate-800">
                    {fechaLarga(c.startsAt)}
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={12} /> Esperando respuesta de {c.counterpartName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${CLASE_ESTADO[c.status]}`}
                  >
                    {APPOINTMENT_STATUS_LABELS[c.status]}
                  </span>
                  <button
                    type="button"
                    disabled={agenda.trabajando === c.id}
                    onClick={() => void agenda.cancelarSolicitud(c.id)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60"
                  >
                    Retirar
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* ── 3. Lo que va a ocurrir ── */}
      <section>
        <h2 className="text-lg font-bold text-primary">Próximas sesiones</h2>
        <div className="mt-3 space-y-3">
          {proximas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes sesiones programadas todavía.</p>
          ) : (
            proximas.map((s) => (
              <SesionPanel key={s.id} sesion={s} trabajando={false} soloLectura />
            ))
          )}
        </div>
      </section>

      {/* ── 4. Lo que ya ocurrió ── */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          <History size={18} /> Historial
        </h2>
        <div className="mt-3 space-y-3">
          {pasadas.length === 0 && citasSinSesion.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay nada anterior.</p>
          ) : (
            <>
              {pasadas.map((s) => (
                <SesionPanel key={s.id} sesion={s} trabajando={false} soloLectura />
              ))}
              {citasSinSesion.map((c) => (
                <article
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/40 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize text-slate-600">
                      {fechaLarga(c.startsAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.replacesAppointmentId
                        ? "Horario propuesto que no llegó a acordarse"
                        : "Solicitud que no llegó a confirmarse"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${CLASE_ESTADO[c.status]}`}
                  >
                    {APPOINTMENT_STATUS_LABELS[c.status]}
                  </span>
                </article>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Una contraoferta, con las dos respuestas posibles ───────────────────────
function Propuesta({
  cita,
  original,
  trabajando,
  onAceptar,
  onRechazar,
}: {
  cita: Appointment;
  original?: Appointment;
  trabajando: boolean;
  onAceptar: () => void;
  onRechazar: () => void;
}) {
  return (
    <article className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-base font-bold capitalize text-slate-800">{fechaLarga(cita.startsAt)}</p>

      {original && (
        <p className="mt-1 text-xs capitalize text-muted-foreground">
          En lugar de: {fechaLarga(original.startsAt)}
        </p>
      )}

      {cita.notes && (
        <p className="mt-2 rounded-xl bg-white/70 p-2.5 text-sm text-slate-700">{cita.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={trabajando}
          onClick={onAceptar}
          className="rounded-xl bg-primary px-5 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {trabajando ? "Guardando…" : "Aceptar este horario"}
        </button>
        <button
          type="button"
          disabled={trabajando}
          onClick={onRechazar}
          className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60"
        >
          Rechazar
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Si lo rechazas, puedes pedir otra hora desde la conversación.
      </p>
    </article>
  );
}
