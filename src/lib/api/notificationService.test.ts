// Tests del servicio de notificaciones.
//
// Se prueban las cuatro funciones públicas. No hay `create`: las notificaciones
// nacen de triggers sobre las tablas donde ocurren los hechos, y eso está
// verificado contra Postgres con simulación de JWT — un mock no puede probar un
// trigger.
//
// Qué prueba cada capa:
//   · aquí     que el servicio lee y marca por el camino correcto, que sin
//              sesión no escribe, que un fallo no rompe la pantalla y que no
//              existe forma de crear ni de borrar desde el cliente;
//   · la base  que nadie lee ni marca lo ajeno.
import { describe, it, expect, beforeEach, vi } from "vitest";

let updateError: { message: string } | null = null;
let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let sesion: { user: { id: string } } | null = { user: { id: "yo" } };

let ultimoUpdate: Record<string, unknown> | null = null;
let filtros: string[] = [];
let ultimaRpc: { fn: string; args: unknown } | null = null;

vi.mock("../supabase", () => {
  const cadena = () => {
    const q: Record<string, unknown> = {};
    for (const m of ["eq", "is"]) {
      q[m] = (col: string, val: unknown) => {
        filtros.push(`${m}:${col}=${String(val)}`);
        return q;
      };
    }
    (q as { then: unknown }).then = (resolver: (v: unknown) => unknown) =>
      resolver({ error: updateError });
    return q;
  };

  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: sesion } }) },
      from: () => ({
        update: (fila: Record<string, unknown>) => {
          ultimoUpdate = fila;
          return cadena();
        },
      }),
      rpc: async (fn: string, args: unknown) => {
        ultimaRpc = { fn, args };
        return rpcResult;
      },
    },
  };
});

const servicio = await import("./notificationService");
const { listNotifications, markAsRead, markAllAsRead, getUnreadCount } = servicio;

function fila(over: Record<string, unknown> = {}) {
  return {
    id: "n1",
    event_type: "MESSAGE_SENT",
    title: "Tienes un mensaje nuevo",
    body: null,
    resource_type: "conversacion",
    resource_id: "rel-1",
    relationship_id: "rel-1",
    read_at: null,
    created_at: "2026-08-03T12:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  updateError = null;
  rpcResult = { data: [], error: null };
  sesion = { user: { id: "yo" } };
  ultimoUpdate = null;
  filtros = [];
  ultimaRpc = null;
});

describe("superficie pública", () => {
  it("expone exactamente cuatro funciones: no se crea ni se borra desde el cliente", () => {
    const funciones = Object.keys(servicio).filter(
      (k) => typeof (servicio as Record<string, unknown>)[k] === "function",
    );
    expect(funciones.sort()).toEqual([
      "getUnreadCount",
      "listNotifications",
      "markAllAsRead",
      "markAsRead",
    ]);
  });
});

describe("lectura propia", () => {
  it("lee por función, sin parámetro de identidad: la sesión decide", async () => {
    await listNotifications();
    expect(ultimaRpc).toEqual({ fn: "list_my_notifications", args: { p_limit: 30 } });
  });

  it("mapea la fila completa", async () => {
    rpcResult = { data: [fila()], error: null };
    const r = await listNotifications();
    expect(r[0]).toEqual({
      id: "n1",
      eventType: "MESSAGE_SENT",
      title: "Tienes un mensaje nuevo",
      body: null,
      resourceType: "conversacion",
      resourceId: "rel-1",
      relationshipId: "rel-1",
      readAt: null,
      createdAt: "2026-08-03T12:00:00Z",
    });
  });

  it("conserva el orden descendente que devuelve la base", async () => {
    rpcResult = {
      data: [
        fila({ id: "n3", created_at: "2026-08-03T14:00:00Z" }),
        fila({ id: "n2", created_at: "2026-08-03T13:00:00Z" }),
        fila({ id: "n1", created_at: "2026-08-03T12:00:00Z" }),
      ],
      error: null,
    };
    const r = await listNotifications();
    expect(r.map((n) => n.id)).toEqual(["n3", "n2", "n1"]);
  });
});

describe("lectura ajena", () => {
  it("la bandeja de otra persona llega vacía: la base no la devuelve", async () => {
    rpcResult = { data: [], error: null };
    expect(await listNotifications()).toEqual([]);
  });

  it("sin sesión la lectura es vacía, no un error", async () => {
    sesion = null;
    rpcResult = { data: [], error: null };
    expect(await listNotifications()).toEqual([]);
  });
});

describe("contador", () => {
  it("pregunta por su propia función", async () => {
    rpcResult = { data: 3, error: null };
    expect(await getUnreadCount()).toBe(3);
    expect(ultimaRpc?.fn).toBe("count_my_unread_notifications");
  });

  it("devuelve 0 si la base no responde un número", async () => {
    rpcResult = { data: null, error: null };
    expect(await getUnreadCount()).toBe(0);
    rpcResult = { data: [], error: null };
    expect(await getUnreadCount()).toBe(0);
  });

  it("un fallo devuelve 0: el badge desaparece, no rompe la página", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await getUnreadCount()).toBe(0);
  });
});

describe("marcar una", () => {
  it("solo escribe read_at, sobre la notificación indicada y si estaba sin leer", async () => {
    await markAsRead("n1");
    expect(Object.keys(ultimoUpdate ?? {})).toEqual(["read_at"]);
    expect(filtros).toContain("eq:id=n1");
    expect(filtros).toContain("is:read_at=null");
  });

  it("traduce el rechazo del trigger cuando no es tuya", async () => {
    updateError = { message: "ERROR: NOTIFICATION_FORBIDDEN: no es tuya" };
    await expect(markAsRead("de-otro")).rejects.toThrow(/no es tuya/i);
  });

  it("un fallo desconocido no filtra el mensaje interno", async () => {
    updateError = { message: 'relation "x" does not exist at character 42' };
    await expect(markAsRead("n1")).rejects.toThrow(/No se pudo marcar la notificación/i);
  });
});

describe("marcar todas", () => {
  it("acota a las propias y sin leer", async () => {
    await markAllAsRead();
    expect(Object.keys(ultimoUpdate ?? {})).toEqual(["read_at"]);
    expect(filtros).toContain("eq:user_id=yo");
    expect(filtros).toContain("is:read_at=null");
  });

  it("sin sesión no escribe nada", async () => {
    sesion = null;
    await markAllAsRead();
    expect(ultimoUpdate).toBeNull();
  });

  it("un fallo se reporta", async () => {
    updateError = { message: "boom" };
    await expect(markAllAsRead()).rejects.toThrow(/No se pudieron marcar/i);
  });
});

describe("recurso inexistente y eventos sin acción", () => {
  it("una notificación sin recurso se mapea igual, con nulos", async () => {
    rpcResult = {
      data: [fila({ resource_type: null, resource_id: null, relationship_id: null })],
      error: null,
    };
    const r = await listNotifications();
    expect(r[0].resourceId).toBeNull();
    expect(r[0].relationshipId).toBeNull();
  });

  it("un rechazo llega sin relación: la pantalla lo mostrará sin acción", async () => {
    rpcResult = {
      data: [
        fila({
          id: "n9",
          event_type: "CONTACT_REQUEST_REJECTED",
          title: "Tu solicitud no fue aceptada",
          resource_type: "solicitud",
          resource_id: "sol-1",
          relationship_id: null,
        }),
      ],
      error: null,
    };
    const r = await listNotifications();
    expect(r[0].eventType).toBe("CONTACT_REQUEST_REJECTED");
    expect(r[0].relationshipId).toBeNull();
  });

  it("un tipo de evento desconocido no rompe el mapeo", async () => {
    rpcResult = { data: [fila({ event_type: "ALGO_NUEVO" })], error: null };
    expect((await listNotifications())[0].eventType).toBe("ALGO_NUEVO");
  });
});
