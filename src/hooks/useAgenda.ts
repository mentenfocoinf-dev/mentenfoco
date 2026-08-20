// ============================================================================
// La agenda, para los dos portales.
//
// Antes había una copia por pantalla: la sección "Agenda" del profesional
// llevaba su propio estado y sus propias escrituras, y "Agenda clínica" los
// suyos. Se desincronizaban, y peor: hacían cosas distintas. Cancelar desde una
// dejaba la cita viva y el hueco ocupado.
//
// Este hook es el único sitio donde la agenda se lee y se escribe. Sirve a
// paciente y profesional porque el ciclo es el mismo —solicitud, propuesta,
// confirmación, sesión, cierre—; lo único que cambia es quién puede hacer qué,
// y eso lo decide PostgreSQL, no la interfaz.
//
// ── La regla que centraliza ─────────────────────────────────────────────────
//
// Si la sesión nació de una cita, cancelar o completar se hace sobre la CITA: el
// trigger `materialize_session_on_confirm` arrastra la sesión y las dos tablas
// quedan coherentes. Si no hay cita detrás, se actúa sobre la sesión.
//
// Demostrado contra la base: cancelando solo la sesión, la cita queda
// `confirmed` y el hueco sigue ocupado en `agenda_hay_conflicto`.
//
// ── Fuentes ─────────────────────────────────────────────────────────────────
//
// `therapy_sessions` (vía `list_my_sessions`) es la agenda: lo que va a ocurrir.
// `appointments` es la negociación: lo que está por decidirse. Las dos
// funciones filtran por `auth.uid()` dentro, así que cada rol recibe lo suyo sin
// que el cliente mande ningún identificador.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createSession,
  getSessionByAppointment,
  getPatientSessions,
  getTherapistSessions,
  listMyAppointments,
  listTherapistAppointments,
  proposeNewTime,
  updateSessionDetails,
  updateSessionStatus,
  type Appointment,
  type TherapistSessionRow,
} from "../lib/api";

export type RolAgenda = "therapist" | "patient";

export interface EstadoAgenda {
  rol: RolAgenda;
  /** Lo agendado: sesiones clínicas, vengan o no de una solicitud. */
  sesiones: TherapistSessionRow[];
  /** La negociación completa, incluidas las canceladas: son el historial. */
  citas: Appointment[];
  /** Solicitudes que esperan respuesta. */
  pendientes: Appointment[];
  /**
   * Las que esperan respuesta DEL PACIENTE: contraofertas del profesional.
   *
   * Se distinguen porque son lo único que el paciente puede aceptar, y porque
   * dejarlas mezcladas con sus propias solicitudes era exactamente lo que le
   * hacía perder de vista que había algo esperándole.
   */
  propuestas: Appointment[];
  cargando: boolean;
  /** Id de la fila sobre la que hay una operación en curso, si la hay. */
  trabajando: string | null;
  error: string | null;
  limpiarError: () => void;
  recargar: () => Promise<void>;

  // ── Sobre sesiones ────────────────────────────────────────────────────────
  cancelarSesion: (s: TherapistSessionRow) => Promise<void>;
  completarSesion: (s: TherapistSessionRow) => Promise<void>;
  marcarNoAsistio: (s: TherapistSessionRow) => Promise<void>;
  guardarDetalles: (
    sesionId: string,
    detalles: { videoCallLink?: string | null; notes?: string | null },
  ) => Promise<void>;

  // ── Sobre citas ───────────────────────────────────────────────────────────
  cancelarSolicitud: (citaId: string) => Promise<void>;
  /** Confirmar y dejar la sesión lista: son un solo gesto, no dos. */
  confirmarSolicitud: (
    citaId: string,
    enlace: string,
    observaciones?: string | null,
  ) => Promise<void>;
  proponerHorario: (
    citaId: string,
    inicioISO: string,
    finISO: string,
    mensaje?: string | null,
  ) => Promise<void>;
  /** El paciente acepta el horario que le propusieron. */
  aceptarPropuesta: (citaId: string) => Promise<void>;
  /** Y rechazarlo es cancelarlo: no hay un tercer estado que inventar. */
  rechazarPropuesta: (citaId: string) => Promise<void>;
  programarSesion: (params: {
    patientId: string;
    therapistId: string;
    scheduledAt: string;
    durationMinutes?: number;
    videoCallLink?: string | null;
  }) => Promise<void>;
}

export function useAgenda(rol: RolAgenda): EstadoAgenda {
  const [sesiones, setSesiones] = useState<TherapistSessionRow[]>([]);
  const [citas, setCitas] = useState<Appointment[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const [agenda, negociacion] = await Promise.all([
        rol === "therapist" ? getTherapistSessions() : getPatientSessions(),
        rol === "therapist" ? listTherapistAppointments() : listMyAppointments(),
      ]);
      setSesiones(agenda as TherapistSessionRow[]);
      setCitas(negociacion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la agenda.");
    } finally {
      setCargando(false);
    }
  }, [rol]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  /** Envuelve una operación: marca en curso, traduce el fallo y recarga. */
  const operar = useCallback(
    async (id: string, fallo: string, hacer: () => Promise<void>) => {
      setTrabajando(id);
      setError(null);
      try {
        await hacer();
        await recargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : fallo);
      } finally {
        setTrabajando(null);
      }
    },
    [recargar],
  );

  /** Cerrar una sesión: por la cita si la hay, para no dejarlas contradiciéndose. */
  const cerrarSesion = useCallback(
    (
      s: TherapistSessionRow,
      comoCita: (id: string) => Promise<void>,
      comoSesion: () => Promise<void>,
    ) =>
      operar(s.id, "No se pudo actualizar la sesión.", async () => {
        if (s.appointment_id) await comoCita(s.appointment_id);
        else await comoSesion();
      }),
    [operar],
  );

  const cancelarSesion = useCallback(
    (s: TherapistSessionRow) =>
      cerrarSesion(s, cancelAppointment, () => updateSessionStatus(s.id, "cancelada")),
    [cerrarSesion],
  );

  const completarSesion = useCallback(
    (s: TherapistSessionRow) =>
      cerrarSesion(s, completeAppointment, () => updateSessionStatus(s.id, "completada")),
    [cerrarSesion],
  );

  // "No asistió" no tiene equivalente en `appointments` desde el cliente —el
  // trigger lo admite, pero no hay función de servicio para ello— así que se
  // marca sobre la sesión. La cita queda confirmada: es correcto, la cita
  // ocurrió aunque el paciente no apareciera.
  const marcarNoAsistio = useCallback(
    (s: TherapistSessionRow) =>
      operar(s.id, "No se pudo marcar la inasistencia.", () =>
        updateSessionStatus(s.id, "no_asistio"),
      ),
    [operar],
  );

  const guardarDetalles = useCallback(
    (sesionId: string, detalles: { videoCallLink?: string | null; notes?: string | null }) =>
      operar(sesionId, "No se pudieron guardar los datos de la sesión.", () =>
        updateSessionDetails(sesionId, detalles),
      ),
    [operar],
  );

  const cancelarSolicitud = useCallback(
    (citaId: string) =>
      operar(citaId, "No se pudo cancelar la solicitud.", () => cancelAppointment(citaId)),
    [operar],
  );

  /**
   * Confirmar una solicitud y dejar la sesión utilizable.
   *
   * Confirmar crea la sesión por trigger, pero una sesión sin enlace es una cita
   * a la que el paciente no puede llegar. Por eso las dos escrituras van juntas
   * aquí y no repartidas por la interfaz.
   *
   * No es atómico —son dos llamadas—, así que si la segunda falla se dice
   * exactamente qué quedó hecho en vez de dar el conjunto por perdido.
   */
  const confirmarSolicitud = useCallback(
    (citaId: string, enlace: string, observaciones?: string | null) =>
      operar(citaId, "No se pudo confirmar la cita.", async () => {
        await confirmAppointment(citaId);
        const ses = await getSessionByAppointment(citaId);
        if (!ses) {
          throw new Error(
            "La cita quedó confirmada, pero no se encontró su sesión para guardar el enlace. Añádelo desde la agenda.",
          );
        }
        await updateSessionDetails(ses.id, {
          videoCallLink: enlace.trim(),
          notes: observaciones?.trim() || null,
        });
      }),
    [operar],
  );

  const proponerHorario = useCallback(
    (citaId: string, inicioISO: string, finISO: string, mensaje?: string | null) =>
      operar(citaId, "No se pudo proponer el horario.", async () => {
        await proposeNewTime(citaId, inicioISO, finISO, mensaje);
      }),
    [operar],
  );

  // Aceptar es confirmar. Lo que decide si el paciente puede hacerlo es el
  // trigger: solo sobre una contraoferta del profesional, y solo esa transición.
  const aceptarPropuesta = useCallback(
    (citaId: string) =>
      operar(citaId, "No se pudo aceptar el horario.", () => confirmAppointment(citaId)),
    [operar],
  );

  const rechazarPropuesta = cancelarSolicitud;

  const programarSesion = useCallback(
    (params: {
      patientId: string;
      therapistId: string;
      scheduledAt: string;
      durationMinutes?: number;
      videoCallLink?: string | null;
    }) =>
      operar("nueva", "No se pudo programar la sesión.", async () => {
        try {
          await createSession(params);
        } catch (e) {
          // El conflicto de agenda tiene un motivo concreto: decirlo evita que
          // se lea como un fallo de red y se reintente igual.
          const crudo = e instanceof Error ? e.message : "";
          throw new Error(
            crudo.includes("AGENDA_CONFLICT")
              ? "Ese horario ya está ocupado en la agenda."
              : "No se pudo programar la sesión.",
          );
        }
      }),
    [operar],
  );

  const pendientes = citas.filter((c) => c.status === "requested");

  return {
    rol,
    sesiones,
    citas,
    pendientes,
    // Una contraoferta es una solicitud viva que sustituye a otra. Para el
    // paciente es lo único que puede aceptar; para el profesional, algo que ya
    // envió y está esperando.
    propuestas: pendientes.filter((c) => Boolean(c.replacesAppointmentId)),
    cargando,
    trabajando,
    error,
    limpiarError: () => setError(null),
    recargar,
    cancelarSesion,
    completarSesion,
    marcarNoAsistio,
    guardarDetalles,
    cancelarSolicitud,
    confirmarSolicitud,
    proponerHorario,
    aceptarPropuesta,
    rechazarPropuesta,
    programarSesion,
  };
}
