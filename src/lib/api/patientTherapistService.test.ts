// Tests de la relación paciente ↔ terapeuta.
//
// Se prueba a través de las cinco funciones públicas. No hay `create`: la
// relación nace en el trigger de la base al aceptar una solicitud, y eso está
// verificado contra Postgres con simulación de JWT — un mock no puede probar
// un trigger.
//
// Qué prueba cada capa:
//   · aquí     que el servicio no ofrece crear ni reabrir, que cierra por el
//              camino correcto, que traduce los códigos y que mapea la lectura;
//   · la base  que las reglas se cumplen aunque alguien llame a la API
//              saltándose este servicio.
import { describe, it, expect, beforeEach, vi } from "vitest";

let updateError: { message: string } | null = null;
let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };

let ultimoUpdate: Record<string, unknown> | null = null;
let ultimoUpdateId: string | null = null;
let ultimaRpc: { fn: string; args: unknown } | null = null;

vi.mock("../supabase", () => ({
  supabase: {
    from: () => ({
      update: (fila: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          ultimoUpdate = fila;
          ultimoUpdateId = id;
          return { error: updateError };
        },
      }),
    }),
    rpc: async (fn: string, args: unknown) => {
      ultimaRpc = { fn, args };
      return rpcResult;
    },
  },
}));

vi.mock("./journeyService", () => ({ trackEvent: vi.fn() }));

const servicio = await import("./patientTherapistService");
const { getMyTherapist, getMyPatients, getRelationship, finishRelationship, cancelRelationship } =
  servicio;
const { trackEvent } = await import("./journeyService");

beforeEach(() => {
  updateError = null;
  rpcResult = { data: [], error: null };
  ultimoUpdate = null;
  ultimoUpdateId = null;
  ultimaRpc = null;
  vi.mocked(trackEvent).mockClear();
});

describe("superficie pública", () => {
  it("expone exactamente cinco funciones: la relación no se crea desde el cliente", () => {
    const funciones = Object.keys(servicio).filter(
      (k) => typeof (servicio as Record<string, unknown>)[k] === "function",
    );
    expect(funciones.sort()).toEqual([
      "cancelRelationship",
      "finishRelationship",
      "getMyPatients",
      "getMyTherapist",
      "getRelationship",
    ]);
  });
});

describe("finalizar", () => {
  it("manda 'finished' sobre la relación indicada", async () => {
    await finishRelationship("rel-1");
    expect(ultimoUpdate).toEqual({ status: "finished" });
    expect(ultimoUpdateId).toBe("rel-1");
  });

  it("registra el evento solo si el cambio salió bien", async () => {
    await finishRelationship("rel-1");
    expect(trackEvent).toHaveBeenCalledWith("THERAPIST_RELATIONSHIP_FINISHED", expect.anything());

    vi.mocked(trackEvent).mockClear();
    updateError = { message: "RELATIONSHIP_CLOSED" };
    await expect(finishRelationship("rel-1")).rejects.toThrow();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe("cancelar", () => {
  it("manda 'cancelled'", async () => {
    await cancelRelationship("rel-1");
    expect(ultimoUpdate).toEqual({ status: "cancelled" });
    expect(trackEvent).toHaveBeenCalledWith("THERAPIST_RELATIONSHIP_CANCELLED", expect.anything());
  });

  it("ningún cierre toca paciente, terapeuta ni fecha de inicio", async () => {
    for (const fn of [finishRelationship, cancelRelationship]) {
      await fn("rel-1");
      expect(Object.keys(ultimoUpdate ?? {})).toEqual(["status"]);
    }
  });
});

describe("transiciones inválidas — las rechaza la base y el servicio las explica", () => {
  const casos: [string, RegExp][] = [
    ["RELATIONSHIP_CLOSED", /ya está cerrada/i],
    ["RELATIONSHIP_INVALID_TRANSITION", /solo se puede finalizar o cancelar/i],
    ["RELATIONSHIP_IMMUTABLE", /no se pueden cambiar/i],
    ["RELATIONSHIP_FORBIDDEN", /no es tuya/i],
    ["RELATIONSHIP_APPEND_ONLY", /no se borra/i],
  ];

  for (const [codigo, esperado] of casos) {
    it(`traduce ${codigo}`, async () => {
      updateError = { message: `ERROR: ${codigo}: mensaje del trigger` };
      await expect(cancelRelationship("rel-1")).rejects.toThrow(esperado);
    });
  }

  it("un fallo desconocido no filtra el mensaje interno", async () => {
    updateError = { message: 'relation "x" does not exist at character 42' };
    await expect(finishRelationship("rel-1")).rejects.toThrow(/No se pudo actualizar la relación/i);
  });
});

describe("lectura del paciente", () => {
  it("pide su terapeuta por función, sin parámetro de identidad", async () => {
    await getMyTherapist();
    expect(ultimaRpc).toEqual({ fn: "get_my_therapist", args: undefined });
  });

  it("null cuando no tiene terapeuta asignado", async () => {
    rpcResult = { data: [], error: null };
    expect(await getMyTherapist()).toBeNull();
  });

  it("mapea la relación con sus especialidades", async () => {
    rpcResult = {
      data: [
        {
          id: "r1",
          therapist_profile_id: "t1",
          therapist_name: "Ana",
          specializations: ["ansiedad_panico", "sueno_descanso"],
          status: "active",
          assigned_at: "2026-08-01T10:00:00Z",
          ended_at: null,
        },
      ],
      error: null,
    };
    const r = await getMyTherapist();
    expect(r).toEqual({
      id: "r1",
      therapistProfileId: "t1",
      therapistName: "Ana",
      specializations: ["ansiedad_panico", "sueno_descanso"],
      status: "active",
      assignedAt: "2026-08-01T10:00:00Z",
      endedAt: null,
    });
  });

  it("un fallo de lectura devuelve null, no rompe la pantalla", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await getMyTherapist()).toBeNull();
  });
});

describe("lectura del terapeuta", () => {
  it("pide sus pacientes por su propia función", async () => {
    await getMyPatients();
    expect(ultimaRpc?.fn).toBe("get_my_patients");
  });

  it("mapea las filas", async () => {
    rpcResult = {
      data: [
        {
          id: "r2",
          patient_id: "p1",
          patient_name: "Luis",
          status: "active",
          assigned_at: "2026-08-02T10:00:00Z",
          ended_at: null,
        },
        {
          id: "r3",
          patient_id: "p2",
          patient_name: "Sara",
          status: "finished",
          assigned_at: "2026-07-01T10:00:00Z",
          ended_at: "2026-07-30T10:00:00Z",
        },
      ],
      error: null,
    };
    const r = await getMyPatients();
    expect(r).toHaveLength(2);
    expect(r[1]).toMatchObject({ status: "finished", endedAt: "2026-07-30T10:00:00Z" });
  });

  it("vacío si no es terapeuta o si la lectura falla", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await getMyPatients()).toEqual([]);
  });
});

describe("integridad de una relación concreta", () => {
  it("pasa el id y no filtra por identidad desde el cliente", async () => {
    await getRelationship("rel-9");
    expect(ultimaRpc).toEqual({ fn: "get_relationship", args: { p_id: "rel-9" } });
  });

  it("null cuando no existe o quien pregunta no es parte", async () => {
    rpcResult = { data: [], error: null };
    expect(await getRelationship("rel-9")).toBeNull();
  });

  it("conserva el vínculo con la solicitud que la originó", async () => {
    rpcResult = {
      data: [
        {
          id: "r4",
          patient_id: "p1",
          therapist_profile_id: "t1",
          contact_request_id: "sol-1",
          status: "active",
          assigned_at: "2026-08-03T10:00:00Z",
          ended_at: null,
        },
      ],
      error: null,
    };
    const r = await getRelationship("r4");
    expect(r?.contactRequestId).toBe("sol-1");
  });

  it("una relación sin solicitud —asignación anterior a este flujo— es válida", async () => {
    rpcResult = {
      data: [
        {
          id: "r5",
          patient_id: "p1",
          therapist_profile_id: "t1",
          contact_request_id: null,
          status: "active",
          assigned_at: "2026-07-01T10:00:00Z",
          ended_at: null,
        },
      ],
      error: null,
    };
    const r = await getRelationship("r5");
    expect(r?.contactRequestId).toBeNull();
    expect(r?.status).toBe("active");
  });
});
