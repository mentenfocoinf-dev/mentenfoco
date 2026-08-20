// Tests del endurecimiento de acceso.
//
// La regla que importa —quién ve qué— vive en Postgres y está verificada allí
// con JWT simulado y cambio real de rol. Lo que se prueba aquí es lo que le
// toca al cliente: que ya NO consulta las tablas sensibles directamente, que
// llama a la función correcta, y que no pasa identidades desde fuera.
//
// Estos tests fallarían si alguien volviera a introducir un `.from("messages")`
// de lectura: el mock no ofrece `select`, así que la llamada rompería.
import { describe, it, expect, beforeEach, vi } from "vitest";

let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let llamadas: { fn: string; args: unknown }[] = [];
/** Si algún servicio intenta leer una tabla directamente, lo registramos. */
let lecturasDirectas: string[] = [];

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "yo" } } } }) },
    from: (tabla: string) => ({
      select: () => {
        lecturasDirectas.push(tabla);
        return { eq: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      },
      insert: async () => ({ error: null }),
      update: () => ({
        eq: () => ({ neq: () => ({ is: async () => ({ error: null }) }) }),
      }),
    }),
    rpc: async (fn: string, args: unknown) => {
      llamadas.push({ fn, args });
      return rpcResult;
    },
  },
}));

const mensajes = await import("./messagesService");
const sesiones = await import("./sessionsService");

beforeEach(() => {
  rpcResult = { data: [], error: null };
  llamadas = [];
  lecturasDirectas = [];
});

describe("consumidores antiguos migrados", () => {
  it("la conversación por par se lee por función, no por consulta a la tabla", async () => {
    await mensajes.getConversationByPair("pac", "ter");
    expect(llamadas[0]).toEqual({
      fn: "list_pair_messages",
      args: { p_patient_id: "pac", p_therapist_id: "ter" },
    });
    expect(lecturasDirectas).toEqual([]);
  });

  it("el terapeuta asignado se lee por función y sin pasar identidad", async () => {
    rpcResult = { data: "ter-1", error: null };
    expect(await mensajes.getAssignedTherapistId("pac")).toBe("ter-1");
    expect(llamadas[0].fn).toBe("get_assigned_therapist");
    expect(llamadas[0].args).toBeUndefined();
    expect(lecturasDirectas).toEqual([]);
  });

  it("los contadores de no leídos no aceptan de quién son: los decide la sesión", async () => {
    rpcResult = { data: 4, error: null };
    expect(await mensajes.getPatientUnreadCount("cualquiera")).toBe(4);
    expect(await mensajes.getTherapistUnreadCount("cualquiera")).toBe(4);
    expect(llamadas.map((l) => l.fn)).toEqual([
      "count_my_unread_messages",
      "count_my_unread_messages",
    ]);
    expect(llamadas.every((l) => l.args === undefined)).toBe(true);
  });

  it("la bandeja del terapeuta la agrega la base, no el cliente", async () => {
    rpcResult = {
      data: [
        {
          patient_id: "p1",
          patient_name: "Luis",
          last_message: "hola",
          last_message_at: "2026-08-03T12:00:00Z",
          unread_count: 2,
        },
      ],
      error: null,
    };
    const r = await mensajes.getTherapistConversations("ter");
    expect(llamadas[0].fn).toBe("list_my_conversations");
    expect(r[0].unread_count).toBe(2);
    expect(lecturasDirectas).toEqual([]);
  });

  it("las sesiones del paciente y del terapeuta salen de la misma función", async () => {
    await sesiones.getPatientSessions("pac");
    await sesiones.getTherapistSessions("ter");
    expect(llamadas.map((l) => l.fn)).toEqual(["list_my_sessions", "list_my_sessions"]);
    expect(lecturasDirectas).toEqual([]);
  });

  it("la agenda del terapeuta conserva la forma que espera el panel", async () => {
    rpcResult = {
      data: [
        {
          id: "s1",
          patient_id: "p1",
          therapist_id: "t1",
          scheduled_at: "2026-09-01T14:00:00Z",
          duration_minutes: 45,
          status: "confirmada",
          counterpart_name: "Luis",
          counterpart_email: "luis@x.com",
        },
      ],
      error: null,
    };
    const r = await sesiones.getTherapistSessions("t1");
    // El panel lee `patient.full_name`: la forma no puede cambiar.
    expect(r[0].patient).toEqual({ id: "p1", full_name: "Luis", email: "luis@x.com" });
  });
});

describe("ausencia de lecturas directas", () => {
  it("ninguna lectura migrada toca una tabla sensible", async () => {
    rpcResult = { data: [], error: null };
    await mensajes.getConversationByPair("p", "t");
    await mensajes.getPatientConversation("p");
    await mensajes.getAssignedTherapistId("p");
    await mensajes.getPatientUnreadCount("p");
    await mensajes.getTherapistUnreadCount("t");
    await mensajes.getTherapistConversations("t");
    await sesiones.getPatientSessions("p");
    await sesiones.getTherapistSessions("t");
    expect(lecturasDirectas).toEqual([]);
  });
});

describe("degradación sin sesión", () => {
  it("sin terapeuta asignado devuelve null, no error", async () => {
    rpcResult = { data: null, error: null };
    expect(await mensajes.getAssignedTherapistId("p")).toBeNull();
  });

  it("la conversación del paciente sin terapeuta no consulta mensajes", async () => {
    rpcResult = { data: null, error: null };
    const r = await mensajes.getPatientConversation("p");
    expect(r).toEqual({ therapistId: null, messages: [] });
    expect(llamadas.map((l) => l.fn)).toEqual(["get_assigned_therapist"]);
  });

  it("los contadores devuelven 0 cuando la base no responde un número", async () => {
    rpcResult = { data: null, error: null };
    expect(await mensajes.getPatientUnreadCount("p")).toBe(0);
  });
});
