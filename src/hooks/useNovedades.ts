// ============================================================================
// Notification Center — el único sitio donde se calcula qué tiene novedades.
//
// ── El problema que resuelve ────────────────────────────────────────────────
//
// Un paciente pide cita, la cita llega bien, y el terapeuta entra en
// "Solicitudes" porque es donde parece que debe estar. La cita vive en "Agenda
// clínica" y nada le indica que allí hay algo nuevo. El sistema funcionaba y
// aun así parecía roto.
//
// Eso no es un problema de citas: es que cada pantalla decidía por su cuenta si
// tenía algo que avisar, y la mayoría no lo hacía. Aquí hay un registro único
// de FUENTES, y el menú solo consume el resultado.
//
// ── Cómo se añade un módulo ─────────────────────────────────────────────────
//
// Se añade una entrada a FUENTES_DE_NOVEDADES con su clave —la misma del
// menú—, los roles a los que aplica y cómo se cuenta. Nada más: ni tocar los
// paneles, ni el badge, ni este hook.
//
// ── Dos maneras de saber que hay algo nuevo ─────────────────────────────────
//
// 1. ESTADO REAL PENDIENTE — "hay 2 citas sin responder". Es el más honesto:
//    el aviso desaparece cuando el trabajo se hace, no cuando alguien mira.
// 2. NOTIFICACIONES SIN LEER — para lo que no deja trabajo pendiente sino que
//    solo hay que enterarse ("tu cita fue confirmada"). Ahí el `read_at` de
//    `notifications` ya es exactamente esa señal, y se reutiliza tal cual.
//
// Las notificaciones se piden UNA vez y se reparten a todas las fuentes que las
// necesiten, para no multiplicar consultas.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import {
  getPatientUnreadCount,
  getTherapistUnreadCount,
  listMyContent,
  listNotifications,
  listTherapistAppointments,
  listTherapistRequests,
  type AppNotification,
} from "../lib/api";

export type RolPortal = "patient" | "therapist";

export interface ContextoNovedades {
  rol: RolPortal;
  profileId: string;
  /** Notificaciones SIN LEER de quien tiene la sesión. Se piden una sola vez. */
  sinLeer: AppNotification[];
}

export interface FuenteDeNovedades {
  /** La misma clave que usa el menú. Es lo que las une. */
  clave: string;
  /** Nombre legible, para la tarjeta de acciones pendientes. */
  etiqueta: string;
  roles: RolPortal[];
  contar: (ctx: ContextoNovedades) => number | Promise<number>;
}

/** Cuenta notificaciones sin leer de ciertos tipos. Atajo para las fuentes. */
function porTipo(ctx: ContextoNovedades, tipos: string[]): number {
  return ctx.sinLeer.filter((n) => tipos.includes(n.eventType)).length;
}

export const FUENTES_DE_NOVEDADES: FuenteDeNovedades[] = [
  {
    clave: "mensajes",
    etiqueta: "Mensajes nuevos",
    roles: ["patient", "therapist"],
    // Estado real: los mensajes que no se han leído.
    contar: ({ rol, profileId }) =>
      rol === "patient" ? getPatientUnreadCount(profileId) : getTherapistUnreadCount(profileId),
  },
  {
    clave: "citas",
    etiqueta: "Citas por responder",
    roles: ["therapist"],
    // Estado real: mientras haya una solicitud sin responder, hay trabajo. El
    // aviso NO se apaga por abrir la pantalla — se apaga al confirmarla o
    // cancelarla, que es cuando deja de estar pendiente.
    contar: async () =>
      (await listTherapistAppointments()).filter((c) => c.status === "requested").length,
  },
  {
    clave: "citas",
    etiqueta: "Novedades de tus citas",
    roles: ["patient"],
    // Al paciente no le queda trabajo pendiente: solo tiene que enterarse de la
    // respuesta. Por eso aquí sí manda el "leído" de la notificación.
    contar: (ctx) =>
      porTipo(ctx, ["APPOINTMENT_CONFIRMED", "APPOINTMENT_CANCELLED", "APPOINTMENT_COMPLETED"]),
  },
  {
    clave: "solicitudes",
    etiqueta: "Solicitudes de contacto",
    roles: ["therapist"],
    contar: async () =>
      (await listTherapistRequests()).filter((s) => s.status === "pending").length,
  },
  {
    clave: "solicitudes",
    etiqueta: "Respuestas a tus solicitudes",
    roles: ["patient"],
    contar: (ctx) => porTipo(ctx, ["CONTACT_REQUEST_ACCEPTED", "CONTACT_REQUEST_REJECTED"]),
  },
  {
    clave: "contenido",
    etiqueta: "Propuestas con cambios pedidos",
    roles: ["therapist"],
    contar: async ({ profileId }) =>
      (await listMyContent(profileId)).filter((c) => c.status === "cambios_solicitados").length,
  },
];

export interface Novedad {
  clave: string;
  etiqueta: string;
  cantidad: number;
}

export interface EstadoNovedades {
  /** Cuántas novedades tiene cada clave del menú. */
  porClave: Record<string, number>;
  /** Solo lo que de verdad tiene algo, para la tarjeta de acciones pendientes. */
  pendientes: Novedad[];
  total: number;
  cargando: boolean;
  refrescar: () => void;
}

const VACIO: Record<string, number> = {};

/**
 * Novedades del portal para quien tiene la sesión abierta.
 *
 * Nunca lanza: una fuente que falle cuenta cero. Un badge equivocado es un
 * detalle; una pantalla en blanco por un contador es un problema.
 */
export function useNovedades(rol: RolPortal, profileId: string): EstadoNovedades {
  const [porClave, setPorClave] = useState<Record<string, number>>(VACIO);
  const [pendientes, setPendientes] = useState<Novedad[]>([]);
  const [cargando, setCargando] = useState(true);

  const calcular = useCallback(async () => {
    const sinLeer = (await listNotifications(100)).filter((n) => !n.readAt);
    const ctx: ContextoNovedades = { rol, profileId, sinLeer };

    const fuentes = FUENTES_DE_NOVEDADES.filter((f) => f.roles.includes(rol));
    const cantidades = await Promise.all(
      fuentes.map(async (f) => {
        try {
          return await f.contar(ctx);
        } catch {
          return 0;
        }
      }),
    );

    const mapa: Record<string, number> = {};
    const lista: Novedad[] = [];
    fuentes.forEach((f, i) => {
      const cantidad = cantidades[i] ?? 0;
      // Dos fuentes pueden compartir clave si aplican a roles distintos; al
      // filtrar por rol solo queda una, pero se suma por si algún día no.
      mapa[f.clave] = (mapa[f.clave] ?? 0) + cantidad;
      if (cantidad > 0) lista.push({ clave: f.clave, etiqueta: f.etiqueta, cantidad });
    });

    setPorClave(mapa);
    setPendientes(lista.sort((a, b) => b.cantidad - a.cantidad));
    setCargando(false);
  }, [rol, profileId]);

  useEffect(() => {
    let vigente = true;
    void calcular().catch(() => {
      if (vigente) setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [calcular]);

  return {
    porClave,
    pendientes,
    total: Object.values(porClave).reduce((s, n) => s + n, 0),
    cargando,
    refrescar: () => {
      void calcular().catch(() => {});
    },
  };
}
