// Tests de las reglas activas del Recommendation Engine (Fase 1).
//
// Se prueban las funciones puras: toda la lógica de decisión vive ahí y las
// consultas solo traen candidatos. Así los tests corren sin red ni base.
import { describe, it, expect } from "vitest";
import {
  allowedPlans,
  minutos,
  motorApagado,
  ordenarCandidatos,
  seleccionar,
  type Recommendation,
  type RecommendationKind,
} from "./recommendationsService";
import { affinityChain, isThemeKey, toThemeKey, THEME_KEYS } from "./themes";

function pieza(
  id: string,
  tipo: RecommendationKind,
  tiempo: string | null = "5 min",
): Recommendation {
  return {
    id,
    titulo: `Título ${id}`,
    descripcion: "d",
    categoria: "Ansiedad",
    tipo,
    tiempo,
    imagen: null,
    href: `/x/${id}`,
    themeKey: null,
    regla: "B4-test",
  };
}

// ── C1 + C7 ─────────────────────────────────────────────────────────────────
describe("C1/C7 — los programas apagan el motor", () => {
  it("se apaga dentro de un programa", () => {
    expect(motorApagado("programa")).toBe(true);
  });

  it("no se apaga en el resto de tipos", () => {
    for (const t of ["articulo", "herramienta", "audio", "blog", "guia"] as RecommendationKind[]) {
      expect(motorApagado(t)).toBe(false);
    }
  });
});

// ── Filtro de etapa (ADR-001) ───────────────────────────────────────────────
describe("filtro de etapa — acumulativo, nunca bloqueante", () => {
  it("free solo alcanza free", () => {
    expect(allowedPlans("free")).toEqual(["free"]);
  });

  it("cada etapa incluye todas las anteriores", () => {
    expect(allowedPlans("esencial")).toEqual(["free", "esencial"]);
    expect(allowedPlans("integral")).toEqual(["free", "esencial", "integral"]);
    expect(allowedPlans("premium")).toEqual(["free", "esencial", "integral", "premium"]);
  });

  it("una etapa nunca pierde acceso al avanzar (ADR-002)", () => {
    const orden = ["free", "esencial", "integral", "premium"] as const;
    for (let i = 1; i < orden.length; i++) {
      const previa = allowedPlans(orden[i - 1]);
      const actual = allowedPlans(orden[i]);
      for (const p of previa) expect(actual).toContain(p);
    }
  });
});

// ── Parseo de tiempo ────────────────────────────────────────────────────────
describe("minutos()", () => {
  it("lee los formatos reales del catálogo", () => {
    expect(minutos("8 min")).toBe(8);
    expect(minutos("12 min")).toBe(12);
    expect(minutos("2-3 min")).toBe(3); // toma el número pegado a "min"
  });

  it('NO confunde "Ruta de 4 pasos" con 4 minutos', () => {
    expect(minutos("Ruta de 4 pasos")).toBe(999);
  });

  it("manda al final lo que no declara duración", () => {
    expect(minutos(null)).toBe(999);
    expect(minutos(undefined)).toBe(999);
    expect(minutos("")).toBe(999);
    expect(minutos("Lectura breve")).toBe(999);
  });
});

// ── Orden: la transición de ADR-009 ─────────────────────────────────────────
describe("ordenarCandidatos — cascada lexicográfica", () => {
  it("prioriza el tipo DISTINTO al actual (entender → practicar)", () => {
    const r = ordenarCandidatos(
      [pieza("a", "articulo", "3 min"), pieza("h", "herramienta", "9 min")],
      "articulo",
    );
    expect(r[0].tipo).toBe("herramienta");
  });

  it("el tipo pesa MÁS que el tiempo: no se suman criterios", () => {
    const r = ordenarCandidatos(
      [pieza("corto", "articulo", "1 min"), pieza("largo", "guia", "30 min")],
      "articulo",
    );
    expect(r[0].id).toBe("largo");
  });

  it("a igualdad de tipo, gana lo más corto", () => {
    const r = ordenarCandidatos(
      [pieza("largo", "guia", "20 min"), pieza("corto", "guia", "4 min")],
      "articulo",
    );
    expect(r.map((x) => x.id)).toEqual(["corto", "largo"]);
  });

  it("es determinista: mismo estado, misma salida", () => {
    const entrada = [pieza("b", "guia", "5 min"), pieza("a", "guia", "5 min")];
    const uno = ordenarCandidatos(entrada, "articulo").map((x) => x.id);
    const dos = ordenarCandidatos([...entrada].reverse(), "articulo").map((x) => x.id);
    expect(uno).toEqual(dos);
    expect(uno).toEqual(["a", "b"]);
  });

  it("no muta la entrada", () => {
    const entrada = [pieza("z", "guia"), pieza("a", "guia")];
    ordenarCandidatos(entrada, "articulo");
    expect(entrada.map((x) => x.id)).toEqual(["z", "a"]);
  });
});

// ── G1 + G3 ─────────────────────────────────────────────────────────────────
describe("seleccionar — G1 y G3", () => {
  it("G1: nunca recomienda la pieza actual", () => {
    const r = seleccionar([pieza("actual", "guia"), pieza("otra", "guia")], "actual");
    expect(r.map((x) => x.id)).toEqual(["otra"]);
  });

  it("G3: tope de 3", () => {
    const r = seleccionar(
      [pieza("a", "guia"), pieza("b", "articulo"), pieza("c", "audio"), pieza("d", "herramienta")],
      "x",
    );
    expect(r).toHaveLength(3);
  });

  it("diversidad: máximo 2 del mismo tipo", () => {
    const r = seleccionar(
      [pieza("g1", "guia"), pieza("g2", "guia"), pieza("g3", "guia"), pieza("a1", "articulo")],
      "x",
    );
    expect(r.filter((x) => x.tipo === "guia")).toHaveLength(2);
    expect(r.map((x) => x.id)).toContain("a1");
  });

  it("deduplica por tipo+id, no por id solo", () => {
    // Una guía y un contenido pueden compartir identificador: son piezas
    // distintas y ambas deben poder aparecer.
    const r = seleccionar([pieza("sueño", "guia"), pieza("sueño", "articulo")], "x");
    expect(r).toHaveLength(2);
  });

  it("descarta un duplicado exacto", () => {
    const r = seleccionar([pieza("a", "guia"), pieza("a", "guia")], "x");
    expect(r).toHaveLength(1);
  });

  it("G8: sin candidatos devuelve vacío, no rellena", () => {
    expect(seleccionar([], "x")).toEqual([]);
  });

  it("G8: si lo único candidato es la pieza actual, devuelve vacío", () => {
    expect(seleccionar([pieza("actual", "guia")], "actual")).toEqual([]);
  });
});

// ── Eje temático ────────────────────────────────────────────────────────────
describe("affinityChain — orden de criterios", () => {
  it("con tema, el tema va primero", () => {
    expect(
      affinityChain({ themeKey: "ansiedad_panico", categoria: "Ansiedad", tags: ["TCC"] }),
    ).toEqual(["tema", "categoria", "tags"]);
  });

  it("sin tema, empieza por categoría", () => {
    expect(affinityChain({ themeKey: null, categoria: "Ansiedad", tags: ["TCC"] })).toEqual([
      "categoria",
      "tags",
    ]);
  });

  it("el estado de hoy —todo el catálogo sin tema y sin tags— es solo categoría", () => {
    expect(affinityChain({ themeKey: null, categoria: "Ansiedad", tags: null })).toEqual([
      "categoria",
    ]);
    expect(affinityChain({ categoria: "Ansiedad" })).toEqual(["categoria"]);
  });

  it("un criterio sin dato se omite, no se prueba en vacío", () => {
    expect(affinityChain({ categoria: "   ", tags: [] })).toEqual([]);
    expect(affinityChain({})).toEqual([]);
    expect(affinityChain({ themeKey: "trauma" })).toEqual(["tema"]);
  });

  it("nunca reordena: el tema no puede quedar detrás de los tags", () => {
    const cadena = affinityChain({
      themeKey: "sueno_descanso",
      categoria: "Ansiedad",
      tags: ["x"],
    });
    expect(cadena.indexOf("tema")).toBeLessThan(cadena.indexOf("categoria"));
    expect(cadena.indexOf("categoria")).toBeLessThan(cadena.indexOf("tags"));
  });
});

describe("theme_key — validación de vocabulario", () => {
  it("acepta los 15 temas del enum", () => {
    expect(THEME_KEYS).toHaveLength(15);
    for (const t of THEME_KEYS) expect(isThemeKey(t)).toBe(true);
  });

  it("rechaza cualquier valor fuera del vocabulario", () => {
    for (const v of ["Ansiedad", "ansiedad", "tema_inventado", "", null, undefined, 7, {}]) {
      expect(isThemeKey(v)).toBe(false);
    }
  });

  it("toThemeKey convierte lo desconocido en null, no lanza", () => {
    expect(toThemeKey("trauma")).toBe("trauma");
    expect(toThemeKey("Trauma")).toBeNull();
    expect(toThemeKey(null)).toBeNull();
    expect(toThemeKey(undefined)).toBeNull();
  });
});

// ── Recorridos completos ────────────────────────────────────────────────────
describe("recorridos reales", () => {
  it("artículo de ansiedad → herramientas antes que otro artículo", () => {
    const candidatos = [
      pieza("otro-articulo", "articulo", "9 min"),
      pieza("anclaje", "herramienta", "3 min"),
      pieza("respiracion", "herramienta", "3 min"),
      pieza("meditacion", "audio", "5 min"),
    ];
    const r = seleccionar(ordenarCandidatos(candidatos, "articulo"), "ansiedad-que-no-para");
    expect(r.map((x) => x.tipo)).toEqual(["herramienta", "herramienta", "audio"]);
    expect(r.map((x) => x.id)).not.toContain("otro-articulo");
  });

  it("guía → cruza a contenido y respeta el tope", () => {
    const candidatos = [
      pieza("g-otra", "guia", "12 min"),
      pieza("c-anclaje", "herramienta", "3 min"),
      pieza("c-audio", "audio", "5 min"),
    ];
    const r = seleccionar(ordenarCandidatos(candidatos, "guia"), "g-actual");
    expect(r[0].tipo).not.toBe("guia");
    expect(r).toHaveLength(3);
  });

  it("una sola pieza válida devuelve una, no rellena hasta 3", () => {
    const r = seleccionar(ordenarCandidatos([pieza("unica", "guia")], "articulo"), "x");
    expect(r).toHaveLength(1);
  });
});
