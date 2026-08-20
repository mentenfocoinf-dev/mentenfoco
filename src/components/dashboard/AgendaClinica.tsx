// ============================================================================
// "Agenda clínica" — la herramienta de trabajo diaria del profesional.
//
// ── Dos tablas, dos preguntas distintas ─────────────────────────────────────
//
// `appointments` es la NEGOCIACIÓN: alguien pide una hora, el profesional
// acepta, propone otra o cancela. `therapy_sessions` es la AGENDA: lo que
// realmente va a ocurrir. Confirmar una cita materializa su sesión por trigger.
//
// El calendario lee de `therapy_sessions` y solo de ahí. Las solicitudes
// pendientes van arriba, fuera del calendario y siempre visibles: una solicitud
// sin responder no debe depender de que alguien navegue hasta su día.
//
// La lógica —qué se carga, sobre qué se actúa— no vive aquí sino en `useAgenda`,
// compartida con el portal del paciente. Dos copias de la misma regla acaban
// comportándose distinto.
//
// ── Confirmar no es un botón ────────────────────────────────────────────────
//
// Abre un panel donde el profesional revisa la hora y pega el enlace de la
// videollamada, que es obligatorio: confirmar y dejar la sesión sin enlace es la
// forma más común de que un paciente acabe esperando delante de una pantalla.
//
// La fecha y la hora se muestran para revisarlas, no para editarlas: son
// inmutables por trigger. Para cambiarlas está "Reprogramar" —o "Proponer nuevo
// horario" si aún no está confirmada—, que cancela y crea otra cita enlazada.
// Reprogramar no edita nada: deja las dos citas y su enlace en el historial.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Plus,
} from "lucide-react";
import {
  confirmAppointment,
  getSessionByAppointment,
  getTherapistProfessionalProfile,
  listAvailableHours,
  listMyTimeBlocks,
  createTimeBlock,
  deleteTimeBlock,
  APPOINTMENT_STATUS_LABELS,
  BLOCK_KIND_LABELS,
  type AgendaBlockKind,
  type Appointment,
  type AvailabilitySlot,
  type TherapistSessionRow,
  type TimeBlock,
} from "../../lib/api";
import type { EstadoAgenda } from "../../hooks/useAgenda";
import { SesionPanel, enlaceValido, type ContextoSesion } from "../agenda/SesionPanel";
import {
  DisponibilidadDia,
  construirHoras,
  marcarRango,
  type EstadoHora,
  type OcupacionHora,
} from "../agenda/DisponibilidadDia";
import { WeeklyAgenda } from "../agenda/WeeklyAgenda";

type Vista = "dia" | "semana" | "mes";

const CLASE_CITA: Record<string, string> = {
  requested: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
  completed: "border-slate-200 bg-slate-50 text-slate-600",
  no_show: "border-slate-200 bg-slate-50 text-slate-500",
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

const fechaCorta = (d: Date) =>
  d.toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "long" });

/** Hoy en `YYYY-MM-DD` local: mínimo del calendario, para no proponer hacia atrás. */
function hoyLocal(): string {
  const d = new Date();
  const dd = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
}

/** `YYYY-MM-DD` local de una fecha, para el input de tipo date. */
function comoValorFecha(d: Date): string {
  const dd = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
}

/** Inicio del día, para comparar sin que la hora estorbe. */
function dia0(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Lunes de la semana de `d`. */
function lunes(d: Date): Date {
  const x = dia0(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // domingo = 6
  return x;
}

/** Rango [desde, hasta) que abarca la vista. */
function rango(vista: Vista, ancla: Date): { desde: Date; hasta: Date; titulo: string } {
  if (vista === "dia") {
    const desde = dia0(ancla);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 1);
    return { desde, hasta, titulo: fechaCorta(desde) };
  }
  if (vista === "semana") {
    const desde = lunes(ancla);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 7);
    const fin = new Date(hasta);
    fin.setDate(fin.getDate() - 1);
    return {
      desde,
      hasta,
      titulo: `${desde.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} – ${fin.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`,
    };
  }
  const desde = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const hasta = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1);
  return {
    desde,
    hasta,
    titulo: desde.toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
  };
}

function mover(vista: Vista, ancla: Date, pasos: number): Date {
  const x = new Date(ancla);
  if (vista === "dia") x.setDate(x.getDate() + pasos);
  else if (vista === "semana") x.setDate(x.getDate() + pasos * 7);
  else x.setMonth(x.getMonth() + pasos);
  return x;
}

/**
 * El estado de la agenda llega POR PROPIEDAD, no se crea aquí.
 *
 * Este panel se monta dentro del mismo dashboard que ya usa `useAgendaTerapeuta`
 * para la sección "Agenda". Llamar al hook otra vez daría dos copias del mismo
 * estado: cancelar una sesión aquí dejaría la otra vista mostrando la anterior
 * hasta que alguien recargara. Una instancia, una verdad.
 */
export function AgendaClinica({
  agenda,
  therapistId,
  pacientes,
}: {
  agenda: EstadoAgenda;
  therapistId: string;
  /** Con quién se puede programar directamente, sin que medie una solicitud. */
  pacientes: { id: string; nombre: string }[];
}) {
  const [vista, setVista] = useState<Vista>("semana");
  const [ancla, setAncla] = useState<Date>(new Date());
  const [confirmando, setConfirmando] = useState<Appointment | null>(null);
  const [proponiendo, setProponiendo] = useState<Appointment | null>(null);
  const [programando, setProgramando] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [franja, setFranja] = useState<AvailabilitySlot[]>([]);
  const [bloqueos, setBloqueos] = useState<TimeBlock[]>([]);
  const [reprogramando, setReprogramando] = useState<string | null>(null);

  const cargarBloqueos = useCallback(async () => {
    setBloqueos(await listMyTimeBlocks());
  }, []);

  useEffect(() => {
    void cargarBloqueos();
  }, [cargarBloqueos]);

  // La franja declarada se enseña como dato, no como regla: quien decide sigue
  // siendo el servidor.
  useEffect(() => {
    let vigente = true;
    void getTherapistProfessionalProfile()
      .then((p) => {
        if (vigente && p?.availability) setFranja(p.availability);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  const { desde, hasta, titulo } = rango(vista, ancla);

  const enRango = useMemo(
    () =>
      agenda.sesiones
        .filter((s) => {
          const t = new Date(s.scheduled_at).getTime();
          return t >= desde.getTime() && t < hasta.getTime();
        })
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [agenda.sesiones, desde, hasta],
  );

  /**
   * Qué hay en cada hora del día visible.
   *
   * Cuenta lo agendado Y lo solicitado sin responder: una hora con una solicitud
   * encima no está libre, aunque todavía no exista sesión. Es la misma regla que
   * aplica `agenda_hay_conflicto` en la base.
   *
   * Cuando coinciden varias cosas en la misma hora gana la más viva —una sesión
   * confirmada sobre una cancelada—, que es la que condiciona la decisión.
   */
  const ocupacion = useMemo(() => {
    const mapa = new Map<number, OcupacionHora>();

    // Cada cosa ocupa TODO su rango, no solo la hora en que empieza: una sesión
    // de 45 minutos a las 10:55 inutiliza el bloque de las 10 y el de las 11.
    for (const s of agenda.sesiones) {
      const estado: EstadoHora =
        s.status === "cancelada"
          ? "cancelada"
          : s.status === "completada" || s.status === "no_asistio"
            ? "realizada"
            : s.status === "confirmada"
              ? "confirmada"
              : "programada";
      const inicio = new Date(s.scheduled_at).getTime();
      marcarRango(
        mapa,
        inicio,
        inicio + s.duration_minutes * 60000,
        estado,
        `${s.counterpartName || "Sesión"} · sesión`,
      );
    }

    for (const c of agenda.citas) {
      if (c.status !== "requested") continue;
      marcarRango(
        mapa,
        new Date(c.startsAt).getTime(),
        new Date(c.endsAt).getTime(),
        "solicitada",
        `${c.counterpartName || "Paciente"} · ${c.replacesAppointmentId ? "propuesta tuya" : "solicitud"}`,
      );
    }

    for (const b of bloqueos) {
      marcarRango(
        mapa,
        new Date(b.startsAt).getTime(),
        new Date(b.endsAt).getTime(),
        b.kind === "vacaciones" ? "vacaciones" : "bloqueada",
        b.reason ?? BLOCK_KIND_LABELS[b.kind],
      );
    }

    return mapa;
  }, [agenda.sesiones, agenda.citas, bloqueos]);

  const horasDelDia = useMemo(() => construirHoras({ dia: ancla, ocupacion }), [ancla, ocupacion]);

  /**
   * Contexto de cada sesión: de dónde viene y qué hay antes y después con el
   * mismo paciente. Se calcula sobre lo ya cargado — ninguna consulta nueva.
   */
  const contextoDe = useMemo(() => {
    const porPaciente = new Map<string, TherapistSessionRow[]>();
    for (const s of agenda.sesiones) {
      porPaciente.set(s.patient_id, [...(porPaciente.get(s.patient_id) ?? []), s]);
    }
    for (const lista of porPaciente.values()) {
      lista.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    }
    const citaPorId = new Map(agenda.citas.map((c) => [c.id, c]));

    return (s: TherapistSessionRow): ContextoSesion => {
      const lista = porPaciente.get(s.patient_id) ?? [];
      const i = lista.findIndex((x) => x.id === s.id);
      const cita = s.appointment_id ? citaPorId.get(s.appointment_id) : undefined;
      return {
        desdeContraoferta: Boolean(cita?.replacesAppointmentId),
        anterior: i > 0 ? lista[i - 1] : undefined,
        siguiente: i >= 0 && i < lista.length - 1 ? lista[i + 1] : undefined,
      };
    };
  }, [agenda.sesiones, agenda.citas]);

  if (agenda.cargando) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-white/40 p-10">
        <Loader2 className="animate-spin text-primary" size={22} />
      </div>
    );
  }

  const porDia = new Map<string, typeof enRango>();
  for (const s of enRango) {
    const clave = dia0(new Date(s.scheduled_at)).toISOString();
    porDia.set(clave, [...(porDia.get(clave) ?? []), s]);
  }

  /** La solicitud que una contraoferta vino a sustituir, si está a la vista. */
  const origenDe = (c: Appointment) =>
    c.replacesAppointmentId
      ? agenda.citas.find((x) => x.id === c.replacesAppointmentId)
      : undefined;

  return (
    <div className="space-y-6">
      {agenda.error && <p className="text-sm text-red-600">{agenda.error}</p>}

      {/* ── Pendientes: negociación, no agenda. Siempre arriba. ── */}
      <section>
        <h2 className="text-lg font-bold text-primary">
          Pendientes de confirmar
          {agenda.pendientes.length > 0 && (
            <span className="ml-2 text-sm font-semibold text-muted-foreground">
              ({agenda.pendientes.length})
            </span>
          )}
        </h2>
        <div className="mt-3 space-y-2">
          {agenda.pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada por responder.</p>
          ) : (
            agenda.pendientes.map((c) => (
              <article key={c.id} className="rounded-2xl glass-card border border-white/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {c.counterpartName || "Paciente"}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {fechaCorta(new Date(c.startsAt))} · {hora(c.startsAt)}–{hora(c.endsAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${CLASE_CITA[c.status]}`}
                  >
                    {APPOINTMENT_STATUS_LABELS[c.status]}
                  </span>
                </div>

                <Origen cita={c} origen={origenDe(c)} />

                {c.notes && (
                  <p className="mt-2 rounded-xl bg-white/60 p-2.5 text-sm text-slate-700">
                    {c.notes}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={agenda.trabajando === c.id}
                    onClick={() => {
                      setProponiendo(null);
                      setConfirmando(confirmando?.id === c.id ? null : c);
                    }}
                    className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  >
                    Aceptar…
                  </button>
                  {/* Solo sobre la solicitud del paciente: contraofertar una
                      contraoferta convierte la agenda en un regateo. */}
                  {!c.replacesAppointmentId && (
                    <button
                      type="button"
                      disabled={agenda.trabajando === c.id}
                      onClick={() => {
                        setConfirmando(null);
                        setProponiendo(proponiendo?.id === c.id ? null : c);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-4 py-1.5 text-xs font-bold text-primary disabled:opacity-60"
                    >
                      <CalendarClock size={13} /> Proponer nuevo horario
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={agenda.trabajando === c.id}
                    onClick={() => void agenda.cancelarSolicitud(c.id)}
                    className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>

                {confirmando?.id === c.id && (
                  <PanelConfirmacion
                    cita={c}
                    trabajando={agenda.trabajando === c.id}
                    onConfirmar={async (enlace, observaciones) => {
                      await agenda.confirmarSolicitud(c.id, enlace, observaciones);
                      setConfirmando(null);
                    }}
                    onCerrar={() => setConfirmando(null)}
                  />
                )}

                {proponiendo?.id === c.id && (
                  <PanelPropuesta
                    cita={c}
                    trabajando={agenda.trabajando === c.id}
                    onProponer={agenda.proponerHorario}
                    onCerrar={() => setProponiendo(null)}
                    onHecho={async () => {
                      setProponiendo(null);
                      await agenda.recargar();
                    }}
                  />
                )}
              </article>
            ))
          )}
        </div>
      </section>

      {/* ── Calendario: lo que va a ocurrir ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <Calendar size={18} /> Agenda
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBloqueando(false);
                setProgramando((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary"
            >
              <Plus size={13} /> Programar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setProgramando(false);
                setBloqueando((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
            >
              <Ban size={13} /> Bloquear fechas
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
              {(["dia", "semana", "mes"] as Vista[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVista(v)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold capitalize ${
                    vista === v ? "bg-primary text-primary-foreground" : "text-slate-600"
                  }`}
                >
                  {v === "dia" ? "Día" : v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {bloqueando && (
          <PanelBloqueos
            bloqueos={bloqueos}
            onCrear={async (input) => {
              await createTimeBlock(input);
              await cargarBloqueos();
            }}
            onBorrar={async (id) => {
              await deleteTimeBlock(id);
              await cargarBloqueos();
            }}
            onCerrar={() => setBloqueando(false)}
          />
        )}

        {programando && (
          <PanelProgramar
            therapistId={therapistId}
            pacientes={pacientes}
            trabajando={agenda.trabajando === "nueva"}
            onProgramar={agenda.programarSesion}
            onCerrar={() => setProgramando(false)}
          />
        )}

        {/* La navegación no depende de que haya nada agendado: una agenda vacía
            se sigue teniendo que poder recorrer. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setAncla(mover(vista, ancla, -1))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label="Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="flex-1 text-center text-sm font-bold capitalize text-slate-700">{titulo}</p>
          <button
            type="button"
            onClick={() => setAncla(new Date())}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setAncla(mover(vista, ancla, 1))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label="Siguiente"
          >
            <ChevronRight size={16} />
          </button>
          {/* Saltar a una fecha concreta sin tener que avanzar mes a mes. */}
          <input
            type="date"
            value={comoValorFecha(ancla)}
            onChange={(e) => {
              if (!e.target.value) return;
              const [a, m, d] = e.target.value.split("-").map(Number);
              setAncla(new Date(a, m - 1, d));
            }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
            aria-label="Ir a una fecha"
          />
        </div>

        {/* Cada vista enseña lo que esa escala responde bien: el día, en qué
            horas queda hueco; la semana, cómo se reparte la carga. El mes se
            lee mejor como lista, que es lo que hay más abajo. */}
        <div className="mt-4">
          {vista === "dia" && (
            <>
              <DisponibilidadDia horas={horasDelDia} franja={franja} />
              <p className="mt-1.5 text-xs capitalize text-muted-foreground">
                Corresponde al {fechaCorta(dia0(ancla))}.
              </p>
            </>
          )}
          {vista === "semana" && (
            <WeeklyAgenda
              semanaDe={ancla}
              items={agenda.sesiones.map((s) => ({
                id: s.id,
                scheduled_at: s.scheduled_at,
                duration_minutes: s.duration_minutes,
                status: s.status,
                label: s.patient?.full_name || s.patient?.email || "Paciente",
                video_call_link: s.video_call_link,
              }))}
              onElegirDia={(d) => {
                setAncla(d);
                setVista("dia");
              }}
            />
          )}
        </div>

        <div className="mt-4 space-y-4">
          {porDia.size === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sesiones en este periodo.</p>
          ) : (
            [...porDia.entries()].map(([clave, delDia]) => (
              <div key={clave}>
                <p className="text-xs font-bold capitalize tracking-wider text-slate-500">
                  {fechaCorta(new Date(clave))}
                </p>
                <div className="mt-2 space-y-3">
                  {delDia.map((s) => {
                    const cita = s.appointment_id
                      ? agenda.citas.find((c) => c.id === s.appointment_id)
                      : undefined;
                    return (
                      <div key={s.id}>
                        <SesionPanel
                          sesion={s}
                          contexto={contextoDe(s)}
                          trabajando={agenda.trabajando === s.id}
                          onCancelar={(x) => void agenda.cancelarSesion(x)}
                          onCompletar={(x) => void agenda.completarSesion(x)}
                          onNoAsistio={(x) => void agenda.marcarNoAsistio(x)}
                          onGuardarDetalles={agenda.guardarDetalles}
                          // Reprogramar solo tiene sentido si detrás hay una cita:
                          // es esa cita la que se cancela y se vuelve a proponer.
                          onReprogramar={
                            cita
                              ? () => setReprogramando(reprogramando === s.id ? null : s.id)
                              : undefined
                          }
                        />
                        {reprogramando === s.id && cita && (
                          <PanelPropuesta
                            cita={cita}
                            reprogramacion
                            trabajando={agenda.trabajando === cita.id}
                            onProponer={agenda.proponerHorario}
                            onCerrar={() => setReprogramando(null)}
                            onHecho={async () => {
                              setReprogramando(null);
                              await agenda.recargar();
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ── Trazabilidad ────────────────────────────────────────────────────────────
//
// Una cita nunca cambia de hora: si se acordó otra, hay dos registros enlazados.
// Enseñar el enlace evita la lectura equivocada —"aquí hay dos citas y una está
// cancelada"— cuando lo que pasó fue una sola conversación.
function Origen({ cita, origen }: { cita: Appointment; origen?: Appointment }) {
  if (!cita.replacesAppointmentId) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
      <History size={12} />
      {origen ? (
        <>
          Sustituye a la solicitud del {fechaCorta(new Date(origen.startsAt))} a las{" "}
          {hora(origen.startsAt)}
        </>
      ) : (
        <>Sustituye a una solicitud anterior</>
      )}
    </p>
  );
}

// ── Proponer otro horario ───────────────────────────────────────────────────
//
// No edita la cita: la base cancela la original y crea otra enlazada, en una
// sola transacción. Aquí solo se elige cuándo y se escribe el motivo.
function PanelPropuesta({
  cita,
  trabajando,
  reprogramacion = false,
  onProponer,
  onCerrar,
  onHecho,
}: {
  cita: Appointment;
  trabajando: boolean;
  /** Sobre una cita ya confirmada: cambia lo que se le dice al profesional. */
  reprogramacion?: boolean;
  onProponer: (
    citaId: string,
    inicioISO: string,
    finISO: string,
    mensaje?: string | null,
  ) => Promise<void>;
  onCerrar: () => void;
  onHecho: () => Promise<void>;
}) {
  const [dia, setDia] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [libres, setLibres] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!dia) {
      setLibres([]);
      return;
    }
    let vigente = true;
    setBuscando(true);
    setNuevaHora("");
    void listAvailableHours(cita.relationshipId, dia)
      .then((h) => {
        if (vigente) setLibres(h);
      })
      .finally(() => {
        if (vigente) setBuscando(false);
      });
    return () => {
      vigente = false;
    };
  }, [cita.relationshipId, dia]);

  // La escritura vive en el hook; aquí solo se recoge el cuándo y el porqué.
  async function proponer() {
    if (!nuevaHora) return;
    const inicio = new Date(nuevaHora);
    const fin = new Date(inicio.getTime() + 60 * 60000);
    await onProponer(cita.id, inicio.toISOString(), fin.toISOString(), mensaje);
    await onHecho();
  }

  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-bold text-primary">
        {reprogramacion ? "Reprogramar la sesión" : "Proponer otro horario"}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {reprogramacion
          ? "La cita actual se cancela y su sesión con ella. Se envía una nueva propuesta al paciente, que tendrá que aceptarla. El historial queda entero."
          : "Se cancela esta solicitud y se envía una nueva al paciente, que tendrá que aceptarla."}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Día</span>
          <input
            type="date"
            value={dia}
            min={hoyLocal()}
            onChange={(e) => setDia(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hora</span>
          <select
            value={nuevaHora}
            disabled={!dia || buscando || libres.length === 0}
            onChange={(e) => setNuevaHora(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {!dia ? "Elige primero un día" : buscando ? "Buscando horas…" : "Elige una hora"}
            </option>
            {libres.map((h) => (
              <option key={h} value={h}>
                {hora(h)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dia && !buscando && libres.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Ese día no te queda ninguna hora libre. Prueba con otra fecha.
        </p>
      )}

      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Mensaje (opcional)
        </span>
        <textarea
          rows={2}
          maxLength={1000}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Por ejemplo: a esa hora tengo otra sesión, ¿te sirve más tarde?"
          className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={trabajando || !nuevaHora}
          onClick={proponer}
          className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {trabajando ? "Enviando…" : "Enviar propuesta"}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Bloqueos y vacaciones ───────────────────────────────────────────────────
//
// Son la misma cosa con distinta etiqueta: un rango en el que no se atiende. La
// base impide crear uno encima de algo ya agendado, así que aquí no hay que
// comprobar nada — solo mostrar lo que conteste.
function PanelBloqueos({
  bloqueos,
  onCrear,
  onBorrar,
  onCerrar,
}: {
  bloqueos: TimeBlock[];
  onCrear: (input: {
    startsAt: string;
    endsAt: string;
    kind: AgendaBlockKind;
    reason?: string | null;
  }) => Promise<void>;
  onBorrar: (id: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<AgendaBlockKind>("bloqueo");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [diaEntero, setDiaEntero] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function crear() {
    if (!desde || !hasta) return;
    setGuardando(true);
    setFallo(null);
    try {
      // Un día completo es un rango de 00:00 a 24:00. No hace falta una marca
      // aparte: el rango ya lo dice, y una marca puede contradecirlo.
      const inicio = diaEntero ? new Date(`${desde}T00:00:00`) : new Date(desde);
      const fin = diaEntero
        ? new Date(new Date(`${hasta}T00:00:00`).getTime() + 24 * 3600 * 1000)
        : new Date(hasta);
      await onCrear({
        startsAt: inicio.toISOString(),
        endsAt: fin.toISOString(),
        kind: tipo,
        reason: motivo,
      });
      setDesde("");
      setHasta("");
      setMotivo("");
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo guardar el bloqueo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-sm font-bold text-slate-700">Fechas en las que no atiendes</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Dejan de ofrecerse a tus pacientes y el servidor rechaza cualquier solicitud sobre ellas.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["bloqueo", "vacaciones"] as AgendaBlockKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTipo(k)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
              tipo === k
                ? "bg-primary text-primary-foreground"
                : "border border-slate-200 text-slate-600"
            }`}
          >
            {BLOCK_KIND_LABELS[k]}
          </button>
        ))}
        <label className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={diaEntero}
            onChange={(e) => setDiaEntero(e.target.checked)}
          />
          Días completos
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Desde</span>
          <input
            type={diaEntero ? "date" : "datetime-local"}
            value={desde}
            min={hoyLocal()}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hasta</span>
          <input
            type={diaEntero ? "date" : "datetime-local"}
            value={hasta}
            min={desde || hoyLocal()}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Motivo (opcional)
        </span>
        <input
          value={motivo}
          maxLength={300}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Congreso, descanso, formación…"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      {fallo && <p className="mt-2 text-xs text-red-600">{fallo}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={guardando || !desde || !hasta}
          onClick={crear}
          className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Bloquear"}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600"
        >
          Cerrar
        </button>
      </div>

      {bloqueos.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-200 pt-3">
          {bloqueos.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
            >
              <span>
                <strong>{BLOCK_KIND_LABELS[b.kind]}</strong>{" "}
                {new Date(b.startsAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                })}{" "}
                –{" "}
                {new Date(b.endsAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
                {b.reason && ` · ${b.reason}`}
              </span>
              <button
                type="button"
                onClick={() => void onBorrar(b.id)}
                className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-500"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Programar una sesión directamente ───────────────────────────────────────
//
// Sin solicitud de por medio: el profesional acuerda la hora por otro canal y la
// deja puesta. Estaba en otra pantalla; vive aquí porque agendar es agenda.
//
// El solapamiento lo impide la base, no este formulario. Si la hora está tomada
// la respuesta llega del servidor y se muestra tal cual.
function PanelProgramar({
  therapistId,
  pacientes,
  trabajando,
  onProgramar,
  onCerrar,
}: {
  therapistId: string;
  pacientes: { id: string; nombre: string }[];
  trabajando: boolean;
  onProgramar: (p: {
    patientId: string;
    therapistId: string;
    scheduledAt: string;
    durationMinutes?: number;
    videoCallLink?: string | null;
  }) => Promise<void>;
  onCerrar: () => void;
}) {
  const [pacienteId, setPacienteId] = useState("");
  const [cuando, setCuando] = useState("");
  const [duracion, setDuracion] = useState(45);
  const [enlace, setEnlace] = useState("");

  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-bold text-primary">Programar sesión</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Para lo que se acordó fuera de la plataforma. No genera solicitud: queda agendada.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Paciente
          </span>
          <select
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Elige un paciente</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Fecha y hora
          </span>
          <input
            type="datetime-local"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Duración (min)
          </span>
          <input
            type="number"
            min={15}
            step={15}
            value={duracion}
            onChange={(e) => setDuracion(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Enlace de videollamada
          </span>
          <input
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://meet.google.com/…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {!enlaceValido(enlace) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Sin enlace el paciente no puede entrar a la sesión.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={trabajando || !pacienteId || !cuando || !enlaceValido(enlace)}
          onClick={async () => {
            await onProgramar({
              patientId: pacienteId,
              therapistId,
              scheduledAt: new Date(cuando).toISOString(),
              durationMinutes: duracion,
              videoCallLink: enlace.trim(),
            });
            setPacienteId("");
            setCuando("");
            setEnlace("");
            onCerrar();
          }}
          className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {trabajando ? "Programando…" : "Programar"}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Panel de confirmación ───────────────────────────────────────────────────
//
// El enlace es obligatorio. Una sesión confirmada sin enlace es una cita a la
// que el paciente no puede llegar, y descubrirlo cinco minutos antes no es un
// detalle: es la sesión perdida.
function PanelConfirmacion({
  cita,
  trabajando,
  onConfirmar,
  onCerrar,
}: {
  cita: Appointment;
  trabajando: boolean;
  onConfirmar: (enlace: string, observaciones: string | null) => Promise<void>;
  onCerrar: () => void;
}) {
  const [enlace, setEnlace] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Confirmar y guardar el enlace es UNA operación, y vive en el hook. Este
  // panel solo recoge los datos: cuando la escritura vivía aquí, "confirmar"
  // hacía cosas distintas según desde qué pantalla se pulsara.
  async function guardar() {
    if (!enlaceValido(enlace)) return;
    await onConfirmar(enlace, observaciones.trim() || null);
  }

  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-bold text-primary">Confirmar cita</p>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Paciente</dt>
          <dd className="text-sm font-semibold text-slate-800">
            {cita.counterpartName || "Paciente"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Fecha y hora
          </dt>
          <dd className="text-sm font-semibold capitalize text-slate-800">
            {fechaCorta(new Date(cita.startsAt))} · {hora(cita.startsAt)}–{hora(cita.endsAt)}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-muted-foreground">
        La hora no se puede cambiar al confirmar. Si no te sirve, usa "Proponer nuevo horario".
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Enlace de la videollamada
        </span>
        <input
          type="url"
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          placeholder="https://meet.google.com/…"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        {!enlaceValido(enlace) && (
          <span className="mt-1 block text-xs text-muted-foreground">
            Hace falta para confirmar: sin enlace el paciente no puede entrar a la sesión.
          </span>
        )}
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Observaciones (opcional)
        </span>
        <textarea
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={trabajando || !enlaceValido(enlace)}
          onClick={guardar}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {trabajando ? "Confirmando…" : "Confirmar y guardar"}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
