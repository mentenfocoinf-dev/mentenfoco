// Tests del servicio de citas.
//
// Se prueban las ocho funciones públicas. Las reglas de verdad —solapamientos,
// franjas, transiciones, propiedad— viven en Postgres y están verificadas allí
// con simulación de JWT; un mock no puede probar una restricción EXCLUDE.
//
// Lo que sí se prueba aquí: que el cliente no envía nada que deba derivar la
// base, que no existe forma de borrar, y que cada código del servidor se
// traduce a una frase que una persona pueda leer.
import { describe, it, expect, beforeEach, vi } from "vitest";

let insertError: { message: string } | null = null;
let updateError: { message: string } | null = null;
let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let sesion: { user: { id: string } } | null = { user: { id: "pac-1" } };

let ultimoInsert: Record<string, unknown> | null = null;
let ultimoUpdate: Record<string, unknown> | null = null;
let ultimoUpdateId: string | null = null;
let ultimaRpc: string | null = null;
let ultimosArgs: Record<string, unknown> | null = null;

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: sesion } }) },
    from: () => ({
      insert: async (fila: Record<string, unknown>) => {
        ultimoInsert = fila;
        return { error: insertError };
      },
      update: (fila: Record<string, unknown>) => ({
        eq: async (_c: string, id: string) => {
          ultimoUpdate = fila;
          ultimoUpdateId = id;
          return { error: updateError };
        },
      }),
    }),
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      ultimaRpc = fn;
      ultimosArgs = args ?? null;
      return rpcResult;
    },
  },
}));

const servicio = await import("./appointmentService");
const {
  requestAppointment,
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
  listMyAppointments,
  listTherapistAppointments,
  proposeNewTime,
} = servicio;

const INICIO = "2026-09-01T14:00:00.000Z";
const FIN = "2026-09-01T14:50:00.000Z";

function fila(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    relationship_id: "rel-1",
    counterpart_name: "Ana",
    starts_at: INICIO,
    ends_at: FIN,
    status: "requested",
    notes: null,
    created_by: "pac-1",
    ...over,
  };
}

beforeEach(() => {
  insertError = null;
  updateError = null;
  rpcResult = { data: [], error: null };
  sesion = { user: { id: "pac-1" } };
  ultimoInsert = null;
  ultimoUpdate = null;
  ultimoUpdateId = null;
  ultimaRpc = null;
  ultimosArgs = null;
});

// ── Contraoferta ────────────────────────────────────────────────────────────
//
// Que cancelar y crear ocurran juntos es una garantía transaccional, y eso solo
// se puede probar contra Postgres —está verificado allí—. Lo que se comprueba
// aquí es que el cliente NO intenta hacerlo por su cuenta: una sola llamada, sin
// UPDATE previo, sin INSERT propio.
describe("proponer otro horario", () => {
  it("va por la función de la base, en una sola llamada", async () => {
    rpcResult = { data: "c2", error: null };
    const nueva = await proposeNewTime("c1", INICIO, FIN, "  te propongo otra hora  ");

    expect(nueva).toBe("c2");
    expect(ultimaRpc).toBe("propose_new_time");
    expect(ultimosArgs).toEqual({
      p_appointment_id: "c1",
      p_starts_at: INICIO,
      p_ends_at: FIN,
      p_message: "te propongo otra hora",
    });
    // La cancelación de la original la hace la base, no el cliente.
    expect(ultimoUpdate).toBeNull();
    expect(ultimoInsert).toBeNull();
  });

  it("un mensaje vacío viaja como nulo, no como cadena en blanco", async () => {
    rpcResult = { data: "c2", error: null };
    await proposeNewTime("c1", INICIO, FIN, "   ");
    expect(ultimosArgs?.p_message).toBeNull();
  });

  it("traduce el rechazo de una segunda contraoferta", async () => {
    rpcResult = { data: null, error: { message: "APPOINTMENT_CLOSED: ya cerrada" } };
    await expect(proposeNewTime("c1", INICIO, FIN)).rejects.toThrow("ya está cerrada");
  });

  it("traduce el intento sobre una cita ajena", async () => {
    rpcResult = { data: null, error: { message: "APPOINTMENT_FORBIDDEN: no es tuya" } };
    await expect(proposeNewTime("c1", INICIO, FIN)).rejects.toThrow("no es tuya");
  });
});

describe("historial de la cadena", () => {
  it("el enlace con la solicitud anterior llega al cliente", async () => {
    rpcResult = { data: [fila({ replaces_appointment_id: "c0" })], error: null };
    expect((await listMyAppointments())[0].replacesAppointmentId).toBe("c0");
  });

  it("una cita normal no inventa enlace", async () => {
    rpcResult = { data: [fila()], error: null };
    expect((await listMyAppointments())[0].replacesAppointmentId).toBeNull();
  });
});

describe("superficie pública", () => {
  it("expone exactamente ocho funciones: no hay forma de borrar", () => {
    const funciones = Object.keys(servicio).filter(
      (k) => typeof (servicio as Record<string, unknown>)[k] === "function",
    );
    expect(funciones.sort()).toEqual([
      "cancelAppointment",
      "completeAppointment",
      "confirmAppointment",
      "listAvailableHours",
      "listMyAppointments",
      "listTherapistAppointments",
      "proposeNewTime",
      "requestAppointment",
    ]);
  });
});

describe("solicitud válida", () => {
  it("no envía paciente ni terapeuta: los deriva la base de la relación", async () => {
    await requestAppointment("rel-1", INICIO, FIN);
    expect(ultimoInsert).toEqual({
      relationship_id: "rel-1",
      starts_at: INICIO,
      ends_at: FIN,
      created_by: "pac-1",
      notes: null,
    });
    expect(ultimoInsert).not.toHaveProperty("patient_id");
    expect(ultimoInsert).not.toHaveProperty("therapist_id");
  });

  it("no envía estado: nace solicitada por defecto de la base", async () => {
    await requestAppointment("rel-1", INICIO, FIN);
    expect(ultimoInsert).not.toHaveProperty("status");
  });

  it("una nota en blanco se guarda como null y se recorta si es larga", async () => {
    await requestAppointment("rel-1", INICIO, FIN, "   ");
    expect(ultimoInsert?.notes).toBeNull();
    await requestAppointment("rel-1", INICIO, FIN, "x".repeat(1500));
    expect((ultimoInsert?.notes as string).length).toBe(1000);
  });

  it("sin sesión no llega a escribir", async () => {
    sesion = null;
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(/iniciar sesión/i);
    expect(ultimoInsert).toBeNull();
  });
});

describe("sin relación activa", () => {
  it("traduce que no hay proceso abierto", async () => {
    insertError = { message: "ERROR: APPOINTMENT_RELATIONSHIP_INACTIVE: ..." };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(/proceso activo/i);
  });

  it("traduce que la relación no existe", async () => {
    insertError = { message: "ERROR: APPOINTMENT_NO_RELATIONSHIP: ..." };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(/no existe/i);
  });
});

describe("conflictos de horario", () => {
  it("solape del paciente", async () => {
    insertError = {
      message:
        'conflicting key value violates exclusion constraint "appointments_sin_solape_paciente"',
    };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(
      /Ya tienes una cita a esa hora/i,
    );
  });

  it("solape del profesional", async () => {
    insertError = {
      message:
        'conflicting key value violates exclusion constraint "appointments_sin_solape_terapeuta"',
    };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(
      /ya tiene una cita a esa hora/i,
    );
  });

  it("franja no disponible y modalidad incompatible", async () => {
    insertError = { message: "APPOINTMENT_SLOT_UNAVAILABLE" };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(/franja horaria/i);

    insertError = { message: "APPOINTMENT_MODALITY_MISMATCH" };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(/modalidad/i);
  });

  it("en el pasado", async () => {
    insertError = { message: "APPOINTMENT_IN_THE_PAST" };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(/hacia atrás/i);
  });
});

describe("transiciones", () => {
  it("confirmar, cancelar y completar mandan solo el estado", async () => {
    for (const [fn, estado] of [
      [confirmAppointment, "confirmed"],
      [cancelAppointment, "cancelled"],
      [completeAppointment, "completed"],
    ] as const) {
      await fn("c1");
      expect(ultimoUpdate).toEqual({ status: estado });
      expect(ultimoUpdateId).toBe("c1");
    }
  });

  it("ninguna transición toca la hora ni las partes", async () => {
    await confirmAppointment("c1");
    expect(Object.keys(ultimoUpdate ?? {})).toEqual(["status"]);
  });
});

describe("transiciones inválidas y DELETE", () => {
  const casos: [string, RegExp][] = [
    ["APPOINTMENT_CLOSED", /ya está cerrada/i],
    ["APPOINTMENT_INVALID_TRANSITION", /no está permitida/i],
    ["APPOINTMENT_PATIENT_CAN_ONLY_CANCEL", /solo puedes cancelar/i],
    ["APPOINTMENT_IMMUTABLE", /cancelar y pedir otra/i],
    ["APPOINTMENT_FORBIDDEN", /no es tuya/i],
    ["APPOINTMENT_APPEND_ONLY", /no se borra/i],
  ];

  for (const [codigo, esperado] of casos) {
    it(`traduce ${codigo}`, async () => {
      updateError = { message: `ERROR: ${codigo}: del trigger` };
      await expect(confirmAppointment("c1")).rejects.toThrow(esperado);
    });
  }

  it("un fallo desconocido no filtra el mensaje interno", async () => {
    updateError = { message: 'relation "x" does not exist at character 42' };
    await expect(cancelAppointment("c1")).rejects.toThrow(/No se pudo completar/i);
  });
});

describe("lectura propia", () => {
  it("el paciente lee por su función, sin parámetro de identidad", async () => {
    await listMyAppointments();
    expect(ultimaRpc).toBe("list_my_appointments");
  });

  it("el profesional lee por la suya", async () => {
    await listTherapistAppointments();
    expect(ultimaRpc).toBe("list_therapist_appointments");
  });

  it("mapea la fila", async () => {
    rpcResult = { data: [fila()], error: null };
    expect((await listMyAppointments())[0]).toEqual({
      id: "c1",
      relationshipId: "rel-1",
      counterpartName: "Ana",
      startsAt: INICIO,
      endsAt: FIN,
      status: "requested",
      notes: null,
      createdBy: "pac-1",
      replacesAppointmentId: null,
    });
  });
});

describe("lectura ajena", () => {
  it("las citas de otra persona no llegan: la base no las devuelve", async () => {
    rpcResult = { data: [], error: null };
    expect(await listMyAppointments()).toEqual([]);
    expect(await listTherapistAppointments()).toEqual([]);
  });

  it("un fallo de lectura devuelve vacío, no rompe la pantalla", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await listMyAppointments()).toEqual([]);
    expect(await listTherapistAppointments()).toEqual([]);
  });
});

// ── Agenda unificada ────────────────────────────────────────────────────────
//
// La materialización de la sesión al confirmar, la liberación del hueco al
// cancelar y el solapamiento cruzado ocurren en la base, en una sola
// transacción. Aquí se prueba lo que le toca a esta capa: que el conflicto
// cruzado llega traducido y que confirmar no manda nada de la sesión — la
// crea el trigger, no el cliente.
describe("agenda unificada", () => {
  it("traduce el conflicto cruzado entre citas y sesiones clínicas", async () => {
    insertError = { message: "ERROR: AGENDA_CONFLICT: ese horario ya está ocupado" };
    await expect(requestAppointment("rel-1", INICIO, FIN)).rejects.toThrow(
      /ya está ocupado en la agenda/i,
    );

    updateError = { message: "ERROR: AGENDA_CONFLICT: ese horario ya está ocupado" };
    await expect(confirmAppointment("c1")).rejects.toThrow(/ya está ocupado en la agenda/i);
  });

  it("confirmar no envía nada de la sesión: la materializa el trigger", async () => {
    await confirmAppointment("c1");
    expect(ultimoUpdate).toEqual({ status: "confirmed" });
    expect(ultimoUpdate).not.toHaveProperty("duration_minutes");
    expect(ultimoUpdate).not.toHaveProperty("scheduled_at");
    expect(ultimoUpdate).not.toHaveProperty("session_id");
  });

  it("si la sesión no se puede crear, la confirmación tampoco queda aplicada", async () => {
    // El trigger levanta la excepción dentro de la misma transacción del
    // UPDATE, así que el servicio ve un fallo y no un éxito a medias.
    updateError = { message: "AGENDA_CONFLICT" };
    await expect(confirmAppointment("c1")).rejects.toThrow();
  });

  it("cancelar sigue siendo un solo cambio de estado: la sesión la cierra el trigger", async () => {
    await cancelAppointment("c1");
    expect(Object.keys(ultimoUpdate ?? {})).toEqual(["status"]);
    expect(ultimoUpdate).toEqual({ status: "cancelled" });
  });
});
