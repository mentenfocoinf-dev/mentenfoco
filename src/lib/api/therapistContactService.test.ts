// Tests del flujo de solicitud de contacto.
//
// Se prueba a través de las siete funciones públicas: no hay internos
// exportados que testear por atajo.
//
// Qué prueba cada capa, para no confundirlas:
//   · aquí          que el servicio manda lo correcto (nunca un patient_id de
//                   fuera, nunca un estado inicial distinto de pendiente), que
//                   traduce los códigos del trigger y que mapea la lectura;
//   · la base       que las reglas se cumplen aunque alguien llame a la API
//                   saltándose este servicio. Eso está verificado con
//                   simulación de JWT contra Postgres, no se puede simular aquí.
import { describe, it, expect, beforeEach, vi } from "vitest";

/** Lo que la base "responde" en cada test. */
let insertError: { message: string } | null = null;
let updateError: { message: string } | null = null;
let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let sesion: { user: { id: string } } | null = { user: { id: "paciente-1" } };

/** Lo que el servicio envió, para poder afirmar sobre ello. */
let ultimoInsert: Record<string, unknown> | null = null;
let ultimoUpdate: Record<string, unknown> | null = null;
let ultimoUpdateId: string | null = null;
let ultimaRpc: { fn: string; args: unknown } | null = null;

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: sesion } }) },
    from: () => ({
      insert: async (fila: Record<string, unknown>) => {
        ultimoInsert = fila;
        return { error: insertError };
      },
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

// El registro del recorrido no debe influir en estos tests ni fallar por red.
vi.mock("./journeyService", () => ({ trackEvent: vi.fn() }));

const {
  createContactRequest,
  cancelContactRequest,
  acceptContactRequest,
  rejectContactRequest,
  listPatientRequests,
  listTherapistRequests,
  getContactRequest,
} = await import("./therapistContactService");

const { trackEvent } = await import("./journeyService");

beforeEach(() => {
  insertError = null;
  updateError = null;
  rpcResult = { data: [], error: null };
  sesion = { user: { id: "paciente-1" } };
  ultimoInsert = null;
  ultimoUpdate = null;
  ultimoUpdateId = null;
  ultimaRpc = null;
  vi.mocked(trackEvent).mockClear();
});

describe("crear solicitud", () => {
  it("la crea a nombre de quien tiene la sesión, no de un parámetro", async () => {
    await createContactRequest("terapeuta-1", "Hola");
    expect(ultimoInsert).toEqual({
      patient_id: "paciente-1",
      therapist_profile_id: "terapeuta-1",
      message: "Hola",
    });
  });

  it("no envía estado: nace pendiente por defecto de la base", async () => {
    await createContactRequest("terapeuta-1");
    expect(ultimoInsert).not.toHaveProperty("status");
  });

  it("un mensaje vacío o en blanco se guarda como null, no como cadena vacía", async () => {
    await createContactRequest("terapeuta-1", "   ");
    expect(ultimoInsert?.message).toBeNull();
    await createContactRequest("terapeuta-1");
    expect(ultimoInsert?.message).toBeNull();
  });

  it("recorta el mensaje al límite de la columna", async () => {
    await createContactRequest("terapeuta-1", "x".repeat(1500));
    expect((ultimoInsert?.message as string).length).toBe(1000);
  });

  it("sin sesión no llega a escribir", async () => {
    sesion = null;
    await expect(createContactRequest("terapeuta-1")).rejects.toThrow(/iniciar sesión/i);
    expect(ultimoInsert).toBeNull();
  });

  it("registra el evento solo si la escritura salió bien", async () => {
    await createContactRequest("terapeuta-1");
    expect(trackEvent).toHaveBeenCalledWith("CONTACT_REQUEST_CREATED", expect.anything());

    vi.mocked(trackEvent).mockClear();
    insertError = { message: "cualquier fallo" };
    await expect(createContactRequest("terapeuta-1")).rejects.toThrow();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe("duplicado", () => {
  it("traduce el choque del índice único a una frase legible", async () => {
    insertError = {
      message:
        'duplicate key value violates unique constraint "idx_contact_requests_una_pendiente"',
    };
    await expect(createContactRequest("terapeuta-1")).rejects.toThrow(
      /Ya tienes una solicitud pendiente/i,
    );
  });
});

describe("transiciones", () => {
  it("cancelar manda 'cancelled' sobre la solicitud indicada", async () => {
    await cancelContactRequest("sol-1");
    expect(ultimoUpdate).toEqual({ status: "cancelled" });
    expect(ultimoUpdateId).toBe("sol-1");
    expect(trackEvent).toHaveBeenCalledWith("CONTACT_REQUEST_CANCELLED", expect.anything());
  });

  it("aceptar manda 'accepted'", async () => {
    await acceptContactRequest("sol-1");
    expect(ultimoUpdate).toEqual({ status: "accepted" });
    expect(trackEvent).toHaveBeenCalledWith("CONTACT_REQUEST_ACCEPTED", expect.anything());
  });

  it("rechazar manda 'rejected'", async () => {
    await rejectContactRequest("sol-1");
    expect(ultimoUpdate).toEqual({ status: "rejected" });
    expect(trackEvent).toHaveBeenCalledWith("CONTACT_REQUEST_REJECTED", expect.anything());
  });

  it("ninguna transición toca el paciente, el terapeuta ni el mensaje", async () => {
    for (const fn of [cancelContactRequest, acceptContactRequest, rejectContactRequest]) {
      await fn("sol-1");
      expect(Object.keys(ultimoUpdate ?? {})).toEqual(["status"]);
    }
  });
});

describe("transiciones inválidas — las rechaza la base y el servicio las explica", () => {
  const casos: [string, RegExp][] = [
    ["CONTACT_REQUEST_CLOSED", /ya fue resuelta/i],
    ["CONTACT_REQUEST_PATIENT_CAN_ONLY_CANCEL", /solo puedes cancelar/i],
    ["CONTACT_REQUEST_THERAPIST_CAN_ONLY_RESOLVE", /aceptar o rechazar/i],
    ["CONTACT_REQUEST_FORBIDDEN", /no es tuya/i],
    ["CONTACT_REQUEST_IMMUTABLE", /no se puede reescribir/i],
    ["CONTACT_REQUEST_APPEND_ONLY", /no se borra/i],
  ];

  for (const [codigo, esperado] of casos) {
    it(`traduce ${codigo}`, async () => {
      updateError = { message: `ERROR: ${codigo}: mensaje del trigger` };
      await expect(acceptContactRequest("sol-1")).rejects.toThrow(esperado);
    });
  }

  it("un fallo desconocido no filtra el mensaje interno", async () => {
    updateError = { message: 'relation "x" does not exist at character 42' };
    await expect(acceptContactRequest("sol-1")).rejects.toThrow(
      /No se pudo completar la solicitud/i,
    );
  });

  it("no registra evento si la transición falló", async () => {
    updateError = { message: "CONTACT_REQUEST_CLOSED" };
    await expect(rejectContactRequest("sol-1")).rejects.toThrow();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe("lectura del paciente", () => {
  it("pide sus propias solicitudes por función, nunca por consulta a la tabla", async () => {
    await listPatientRequests();
    expect(ultimaRpc?.fn).toBe("list_my_contact_requests");
  });

  it("no acepta ningún parámetro de identidad: la sesión decide", async () => {
    await listPatientRequests();
    expect(ultimaRpc?.args).toBeUndefined();
  });

  it("mapea la fila al modelo del paciente", async () => {
    rpcResult = {
      data: [
        {
          id: "s1",
          therapist_profile_id: "t1",
          therapist_name: "Ana",
          status: "pending",
          message: null,
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-01T10:00:00Z",
        },
      ],
      error: null,
    };
    const r = await listPatientRequests();
    expect(r).toEqual([
      {
        id: "s1",
        therapistProfileId: "t1",
        therapistName: "Ana",
        status: "pending",
        message: null,
        createdAt: "2026-08-01T10:00:00Z",
        updatedAt: "2026-08-01T10:00:00Z",
      },
    ]);
  });

  it("un fallo de lectura devuelve lista vacía, no rompe la pantalla", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await listPatientRequests()).toEqual([]);
  });
});

describe("lectura del terapeuta", () => {
  it("pide las recibidas por su propia función", async () => {
    await listTherapistRequests();
    expect(ultimaRpc?.fn).toBe("list_received_contact_requests");
  });

  it("mapea la fila al modelo del terapeuta", async () => {
    rpcResult = {
      data: [
        {
          id: "s2",
          patient_id: "p1",
          patient_name: "Luis",
          status: "accepted",
          message: "Hola",
          created_at: "2026-08-02T10:00:00Z",
          updated_at: "2026-08-02T11:00:00Z",
        },
      ],
      error: null,
    };
    const r = await listTherapistRequests();
    expect(r[0]).toEqual({
      id: "s2",
      patientId: "p1",
      patientName: "Luis",
      status: "accepted",
      message: "Hola",
      createdAt: "2026-08-02T10:00:00Z",
      updatedAt: "2026-08-02T11:00:00Z",
    });
  });

  it("un fallo de lectura devuelve lista vacía", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await listTherapistRequests()).toEqual([]);
  });
});

describe("lectura de una solicitud", () => {
  it("pasa el id a la función y no filtra por identidad desde el cliente", async () => {
    await getContactRequest("sol-9");
    expect(ultimaRpc).toEqual({ fn: "get_contact_request", args: { p_id: "sol-9" } });
  });

  it("devuelve null cuando no hay fila — no existe o no eres parte", async () => {
    rpcResult = { data: [], error: null };
    expect(await getContactRequest("sol-9")).toBeNull();
  });

  it("mapea la fila completa", async () => {
    rpcResult = {
      data: [
        {
          id: "s3",
          patient_id: "p1",
          therapist_profile_id: "t1",
          status: "cancelled",
          message: null,
          created_at: "2026-08-03T10:00:00Z",
          updated_at: "2026-08-03T12:00:00Z",
        },
      ],
      error: null,
    };
    const r = await getContactRequest("s3");
    expect(r?.status).toBe("cancelled");
    expect(r?.patientId).toBe("p1");
    expect(r?.therapistProfileId).toBe("t1");
  });
});
