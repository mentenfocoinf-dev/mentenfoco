// Tests del Matching Clínico.
//
// `matchTherapists()` es la única función pública del servicio, así que se
// prueba a través de ella: los perfiles se inyectan sustituyendo el cliente de
// Supabase, no exportando internos. La cadena que se ejercita es la real
// —matchTherapists → listTherapists → therapist_profiles— con filas de la
// forma exacta que devuelve la tabla.
//
// Ojo con los dos vocabularios, que se parecen y no son lo mismo:
//   · la FILA usa los nombres de la base: specializations, languages,
//     modalities (array), availability;
//   · la ENTRADA usa los del motor: especialidades, idioma, modalidad
//     (valor único, con 'mixta'), disponibilidad.
// La traducción entre ambos es justo lo que hace la lectura del matching.
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TherapistProfileRecord } from "./therapistService";

let PERFILES: TherapistProfileRecord[] = [];

vi.mock("../supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: PERFILES, error: null }),
      }),
    }),
  },
}));

const { matchTherapists } = await import("./matchingService");

type Extra = Partial<Omit<TherapistProfileRecord, "profile_id" | "professional_name">>;

function perfil(id: string, nombre: string, extra: Extra = {}): TherapistProfileRecord {
  return {
    profile_id: id,
    professional_name: nombre,
    license_number: null,
    bio: null,
    specializations: [],
    languages: [],
    modalities: [],
    age_groups: [],
    availability: [],
    accepts_online: false,
    accepts_in_person: false,
    years_experience: null,
    // Verificado por defecto: cada test dice explícitamente cuándo no lo está.
    verified: true,
    active: true,
    ...extra,
  };
}

beforeEach(() => {
  PERFILES = [];
});

describe("elegibilidad", () => {
  it("un perfil sin especialidades, idiomas ni modalidad no se recomienda", async () => {
    PERFILES = [perfil("t1", "Terapeuta de Prueba")];
    expect(await matchTherapists({ motivo: "ansiedad_panico", idioma: "Español" })).toEqual([]);
  });

  it("no hay match sin profesionales", async () => {
    expect(await matchTherapists({ motivo: "trauma" })).toEqual([]);
  });

  it("un profesional sin verificar no se recomienda aunque coincida en todo", async () => {
    PERFILES = [
      perfil("sin-verificar", "Sin verificar", {
        specializations: ["trauma"],
        languages: ["Español"],
        verified: false,
      }),
    ];
    expect(
      await matchTherapists({ motivo: "trauma", especialidades: ["trauma"], idioma: "Español" }),
    ).toEqual([]);
  });
});

describe("escenarios clínicos — el orden cambia con el motivo", () => {
  beforeEach(() => {
    PERFILES = [
      perfil("ana", "Ana", {
        specializations: ["ansiedad_panico", "sueno_descanso"],
        languages: ["Español"],
      }),
      perfil("bea", "Bea", { specializations: ["relaciones_vinculos"], languages: ["Español"] }),
      perfil("caro", "Caro", {
        specializations: ["trauma", "duelo_perdida"],
        languages: ["Español"],
      }),
      perfil("dani", "Dani", { specializations: ["crianza_infancia"], languages: ["Español"] }),
    ];
  });

  it("ansiedad → primero la especialista en ansiedad", async () => {
    const r = await matchTherapists({
      motivo: "ansiedad_panico",
      especialidades: ["ansiedad_panico"],
    });
    expect(r[0].therapistId).toBe("ana");
    expect(r[0].coincidencias).toEqual(["especialidad", "motivo"]);
  });

  it("relaciones → primero la de relaciones", async () => {
    const r = await matchTherapists({
      motivo: "relaciones_vinculos",
      especialidades: ["relaciones_vinculos"],
    });
    expect(r[0].therapistId).toBe("bea");
  });

  it("trauma → primero la de trauma", async () => {
    const r = await matchTherapists({ motivo: "trauma", especialidades: ["trauma"] });
    expect(r[0].therapistId).toBe("caro");
  });

  it("infantil → primero el de crianza", async () => {
    const r = await matchTherapists({
      motivo: "crianza_infancia",
      especialidades: ["crianza_infancia"],
    });
    expect(r[0].therapistId).toBe("dani");
  });

  it("solo devuelve a quien coincide en algo", async () => {
    const r = await matchTherapists({ motivo: "trauma", especialidades: ["trauma"] });
    expect(r).toHaveLength(1);
  });

  it("tope de 3 aunque coincidan más", async () => {
    const r = await matchTherapists({ idioma: "Español" });
    expect(r).toHaveLength(3);
  });
});

describe("prioridad — un criterio pesa más que todos los inferiores juntos", () => {
  it("la especialidad gana a idioma + modalidad + disponibilidad", async () => {
    PERFILES = [
      perfil("solo-especialidad", "Zoe", { specializations: ["ansiedad_panico"] }),
      perfil("todo-lo-demas", "Ada", {
        languages: ["Español"],
        modalities: ["virtual"],
        availability: ["mananas"],
      }),
    ];
    const r = await matchTherapists({
      especialidades: ["ansiedad_panico"],
      idioma: "Español",
      modalidad: "virtual",
      disponibilidad: ["mananas"],
    });
    expect(r[0].therapistId).toBe("solo-especialidad");
    expect(r[0].score).toBeGreaterThan(r[1].score);
  });

  it("el motivo gana a idioma + modalidad + disponibilidad", async () => {
    PERFILES = [
      perfil("motivo", "Zoe", { specializations: ["trauma"] }),
      perfil("resto", "Ada", {
        languages: ["Español"],
        modalities: ["virtual", "presencial"],
        availability: ["tardes"],
      }),
    ];
    const r = await matchTherapists({
      motivo: "trauma",
      idioma: "Español",
      modalidad: "presencial",
      disponibilidad: ["tardes"],
    });
    expect(r[0].therapistId).toBe("motivo");
  });
});

describe("lectura de la tabla — de columnas a criterios", () => {
  it("las dos modalidades declaradas equivalen a 'mixta' y cubren ambas", async () => {
    PERFILES = [perfil("m", "Mix", { modalities: ["virtual", "presencial"] })];
    expect((await matchTherapists({ modalidad: "presencial" }))[0].coincidencias).toEqual([
      "modalidad",
    ]);
    expect((await matchTherapists({ modalidad: "virtual" }))[0].coincidencias).toEqual([
      "modalidad",
    ]);
  });

  it("una sola modalidad declarada no cubre la otra", async () => {
    PERFILES = [perfil("v", "Virtual", { modalities: ["virtual"] })];
    expect(await matchTherapists({ modalidad: "presencial" })).toEqual([]);
  });

  it("sin modalidades declaradas no hay coincidencia de modalidad", async () => {
    PERFILES = [perfil("n", "Nadie", { modalities: [], languages: ["Español"] })];
    const r = await matchTherapists({ idioma: "Español", modalidad: "virtual" });
    expect(r[0].coincidencias).toEqual(["idioma"]);
  });

  it("el idioma compara sin acentos ni mayúsculas", async () => {
    PERFILES = [perfil("i", "Idioma", { languages: ["Español"] })];
    expect(await matchTherapists({ idioma: "espanol" })).toHaveLength(1);
    expect(await matchTherapists({ idioma: "ESPAÑOL" })).toHaveLength(1);
  });

  it("la disponibilidad coincide por solapamiento de franjas", async () => {
    PERFILES = [perfil("d", "Disp", { availability: ["mananas", "tardes"] })];
    expect(await matchTherapists({ disponibilidad: ["tardes"] })).toHaveLength(1);
    expect(await matchTherapists({ disponibilidad: ["noches"] })).toEqual([]);
  });

  it("usa el nombre profesional, no el de la identidad", async () => {
    PERFILES = [perfil("x", "Dra. Ana Ruiz", { specializations: ["trauma"] })];
    expect((await matchTherapists({ motivo: "trauma" }))[0].nombre).toBe("Dra. Ana Ruiz");
  });
});

describe("lo que el motor NO hace", () => {
  it("la etapa del usuario no cambia el resultado", async () => {
    PERFILES = [perfil("a", "Ana", { specializations: ["ansiedad_panico"] })];
    const free = await matchTherapists({ motivo: "ansiedad_panico", etapa: "free" });
    const premium = await matchTherapists({ motivo: "ansiedad_panico", etapa: "premium" });
    expect(free).toEqual(premium);
  });

  it("es determinista: misma entrada, misma salida", async () => {
    PERFILES = [
      perfil("b", "Bea", { languages: ["Español"] }),
      perfil("a", "Ana", { languages: ["Español"] }),
    ];
    const uno = await matchTherapists({ idioma: "Español" });
    const dos = await matchTherapists({ idioma: "Español" });
    expect(uno).toEqual(dos);
    // A igual score decide el nombre, no el orden en que llegan de la base.
    expect(uno.map((m) => m.therapistId)).toEqual(["a", "b"]);
  });

  it("cada match viaja con su explicación", async () => {
    PERFILES = [
      perfil("a", "Ana", {
        specializations: ["ansiedad_panico"],
        languages: ["Español"],
        modalities: ["virtual"],
        availability: ["mananas"],
      }),
    ];
    const r = await matchTherapists({
      motivo: "ansiedad_panico",
      especialidades: ["ansiedad_panico"],
      idioma: "Español",
      modalidad: "virtual",
      disponibilidad: ["mananas"],
    });
    expect(r[0].coincidencias).toEqual([
      "especialidad",
      "motivo",
      "idioma",
      "modalidad",
      "disponibilidad",
    ]);
    expect(r[0].score).toBe(31);
  });
});
