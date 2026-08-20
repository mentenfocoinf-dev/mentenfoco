// Tests de la mensajería atada a la relación.
//
// Se prueban las cuatro funciones públicas del modelo nuevo: sendMessage,
// listMessages, markAsRead y getConversation. Las funciones `*ByPair` del
// modelo anterior no se tocan aquí.
//
// Qué prueba cada capa:
//   · aquí     que el cliente nunca manda el remitente, que no existe forma de
//              editar ni borrar, que la lectura conserva el orden y que los
//              códigos del trigger se traducen;
//   · la base  que un tercero no puede escribir ni leer, y que un mensaje
//              enviado es inmutable. Eso está verificado contra Postgres con
//              simulación de JWT — un mock no puede probar un trigger.
import { describe, it, expect, beforeEach, vi } from "vitest";

let insertError: { message: string } | null = null;
let updateError: { message: string } | null = null;
let rpcResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let sesion: { user: { id: string } } | null = { user: { id: "yo" } };

let ultimoInsert: Record<string, unknown> | null = null;
let ultimoUpdate: Record<string, unknown> | null = null;
let filtros: string[] = [];
let ultimaRpc: { fn: string; args: unknown } | null = null;

vi.mock("../supabase", () => {
  const cadena = () => {
    const q: Record<string, unknown> = {};
    for (const m of ["eq", "neq", "is"]) {
      q[m] = (col: string, val: unknown) => {
        filtros.push(`${m}:${col}=${String(val)}`);
        return q;
      };
    }
    // La última llamada de la cadena resuelve la promesa.
    (q as { then: unknown }).then = (resolver: (v: unknown) => unknown) =>
      resolver({ error: updateError });
    return q;
  };

  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: sesion } }) },
      from: () => ({
        insert: async (fila: Record<string, unknown>) => {
          ultimoInsert = fila;
          return { error: insertError };
        },
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

vi.mock("./journeyService", () => ({ trackEvent: vi.fn() }));
vi.mock("./patientTherapistService", () => ({ getRelationship: vi.fn() }));

const servicio = await import("./messagesService");
const { sendMessage, listMessages, markAsRead, getConversation } = servicio;
const { trackEvent } = await import("./journeyService");
const { getRelationship } = await import("./patientTherapistService");

beforeEach(() => {
  insertError = null;
  updateError = null;
  rpcResult = { data: [], error: null };
  sesion = { user: { id: "yo" } };
  ultimoInsert = null;
  ultimoUpdate = null;
  filtros = [];
  ultimaRpc = null;
  vi.mocked(trackEvent).mockClear();
  vi.mocked(getRelationship).mockReset();
});

describe("enviar", () => {
  it("no manda remitente: la autoría la pone la base", async () => {
    await sendMessage("rel-1", "Hola");
    expect(ultimoInsert).toEqual({ relationship_id: "rel-1", body: "Hola" });
    expect(ultimoInsert).not.toHaveProperty("sender_id");
  });

  it("recorta espacios y no permite un mensaje vacío", async () => {
    await sendMessage("rel-1", "  Hola  ");
    expect(ultimoInsert?.body).toBe("Hola");

    ultimoInsert = null;
    await expect(sendMessage("rel-1", "   ")).rejects.toThrow(/no puede estar vacío/i);
    expect(ultimoInsert).toBeNull();
  });

  it("recorta al límite de longitud", async () => {
    await sendMessage("rel-1", "x".repeat(5000));
    expect((ultimoInsert?.body as string).length).toBe(4000);
  });

  it("registra el evento solo si el envío salió bien", async () => {
    await sendMessage("rel-1", "Hola");
    expect(trackEvent).toHaveBeenCalledWith("MESSAGE_SENT", expect.anything());

    vi.mocked(trackEvent).mockClear();
    insertError = { message: "MESSAGE_FORBIDDEN" };
    await expect(sendMessage("rel-1", "Hola")).rejects.toThrow(/no es tuya/i);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("traduce los códigos del trigger", async () => {
    const casos: [string, RegExp][] = [
      ["MESSAGE_RELATIONSHIP_CLOSED", /cerrada/i],
      ["MESSAGE_NO_RELATIONSHIP", /no existe/i],
      ["MESSAGE_FORBIDDEN", /no es tuya/i],
    ];
    for (const [codigo, esperado] of casos) {
      insertError = { message: `ERROR: ${codigo}: del trigger` };
      await expect(sendMessage("rel-1", "Hola")).rejects.toThrow(esperado);
    }
  });

  it("un fallo desconocido no filtra el mensaje interno", async () => {
    insertError = { message: 'relation "x" does not exist at character 42' };
    await expect(sendMessage("rel-1", "Hola")).rejects.toThrow(/No se pudo completar/i);
  });
});

describe("no hay forma de editar ni borrar", () => {
  it("la superficie pública del modelo nuevo son exactamente cuatro funciones", () => {
    const nuevas = ["sendMessage", "listMessages", "markAsRead", "getConversation"];
    for (const n of nuevas) {
      expect(typeof (servicio as Record<string, unknown>)[n]).toBe("function");
    }
    const prohibidas = Object.keys(servicio).filter((k) =>
      /edit|update|delete|remove|borrar/i.test(k),
    );
    expect(prohibidas).toEqual([]);
  });

  it("marcar leído solo escribe read_at", async () => {
    await markAsRead("rel-1");
    expect(Object.keys(ultimoUpdate ?? {})).toEqual(["read_at"]);
  });
});

describe("marcar leído", () => {
  it("apunta a la conversación y excluye lo que envió quien lee", async () => {
    await markAsRead("rel-1");
    expect(filtros).toContain("eq:relationship_id=rel-1");
    expect(filtros).toContain("neq:sender_id=yo");
    expect(filtros).toContain("is:read_at=null");
  });

  it("sin sesión no escribe ni registra", async () => {
    sesion = null;
    await markAsRead("rel-1");
    expect(ultimoUpdate).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("registra MESSAGE_READ cuando salió bien", async () => {
    await markAsRead("rel-1");
    expect(trackEvent).toHaveBeenCalledWith("MESSAGE_READ", expect.anything());
  });

  it("un fallo del trigger se traduce y no registra", async () => {
    updateError = { message: "MESSAGE_IMMUTABLE" };
    await expect(markAsRead("rel-1")).rejects.toThrow(/no se puede editar/i);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe("listar", () => {
  it("lee por función, pasando solo el identificador de la conversación", async () => {
    await listMessages("rel-1");
    expect(ultimaRpc).toEqual({
      fn: "list_relationship_messages",
      args: { p_relationship_id: "rel-1" },
    });
  });

  it("conserva el orden cronológico que devuelve la base", async () => {
    rpcResult = {
      data: [
        { id: "m1", relationship_id: "r", sender_id: "a", body: "primero", read_at: null, created_at: "2026-08-01T10:00:00Z" },
        { id: "m2", relationship_id: "r", sender_id: "b", body: "segundo", read_at: null, created_at: "2026-08-01T10:05:00Z" },
        { id: "m3", relationship_id: "r", sender_id: "a", body: "tercero", read_at: null, created_at: "2026-08-01T10:09:00Z" },
      ],
      error: null,
    };
    const r = await listMessages("rel-1");
    expect(r.map((m) => m.message)).toEqual(["primero", "segundo", "tercero"]);
  });

  it("mapea el estado de leído", async () => {
    rpcResult = {
      data: [
        { id: "m1", relationship_id: "r", sender_id: "a", body: "x", read_at: "2026-08-01T11:00:00Z", created_at: "2026-08-01T10:00:00Z" },
      ],
      error: null,
    };
    expect((await listMessages("rel-1"))[0].readAt).toBe("2026-08-01T11:00:00Z");
  });

  it("una conversación ajena devuelve vacío, no un error que la delate", async () => {
    rpcResult = { data: [], error: null };
    expect(await listMessages("de-otro")).toEqual([]);
  });

  it("un fallo de lectura devuelve vacío", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    expect(await listMessages("rel-1")).toEqual([]);
  });
});

describe("conversación completa", () => {
  it("sin relación accesible no consulta mensajes", async () => {
    vi.mocked(getRelationship).mockResolvedValue(null);
    const r = await getConversation("de-otro");
    expect(r).toEqual({ relationship: null, messages: [] });
    expect(ultimaRpc).toBeNull();
  });

  it("con relación accesible devuelve ambas cosas", async () => {
    vi.mocked(getRelationship).mockResolvedValue({
      id: "rel-1",
      patientId: "p",
      therapistProfileId: "t",
      contactRequestId: null,
      status: "active",
      assignedAt: "2026-08-01T10:00:00Z",
      endedAt: null,
    });
    rpcResult = {
      data: [
        { id: "m1", relationship_id: "rel-1", sender_id: "p", body: "hola", read_at: null, created_at: "2026-08-01T10:00:00Z" },
      ],
      error: null,
    };
    const r = await getConversation("rel-1");
    expect(r.relationship?.id).toBe("rel-1");
    expect(r.messages).toHaveLength(1);
  });
});
