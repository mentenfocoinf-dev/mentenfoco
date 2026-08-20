// Tests de resolveNextStep(): la decisión de "cuál es tu siguiente paso".
//
// Se prueba la función pura. El progreso real lo trae getSeenResources() por
// RPC, y aquí se inyecta como lista: así los tests corren sin red ni sesión.
import { describe, it, expect } from "vitest";
import { resolveNextStep, type JourneyStepInput } from "./journeyService";

/** Los pasos de un programa real: tres enlazados y uno sin enlace. */
const PASOS: JourneyStepInput[] = [
  { orden: 1, titulo: "Entiende qué te pasa", slug_relacionado: "ansiedad-que-no-para", ref_kind: "contenido" },
  { orden: 2, titulo: "Practica el anclaje", slug_relacionado: "anclaje-5-4-3-2-1", ref_kind: "contenido" },
  { orden: 3, titulo: "Haz tu GAD-7", slug_relacionado: null, ref_kind: null },
  { orden: 4, titulo: "Profundiza", slug_relacionado: "ansiedad-ataques", ref_kind: "guia" },
];

const TODOS = ["ansiedad-que-no-para", "anclaje-5-4-3-2-1", "ansiedad-ataques"];

describe("usuario nuevo — nada abierto todavía", () => {
  it("ofrece el primer paso alcanzable", () => {
    const r = resolveNextStep(PASOS, TODOS, []);
    expect(r?.orden).toBe(1);
    expect(r?.resourceId).toBe("ansiedad-que-no-para");
    expect(r?.href).toBe("/contenido/ansiedad-que-no-para");
  });

  it('lo presenta como "empezar", no como "continuar"', () => {
    expect(resolveNextStep(PASOS, TODOS, [])?.empezado).toBe(false);
  });
});

describe("programa iniciado", () => {
  it("continúa por el primer paso no abierto", () => {
    const r = resolveNextStep(PASOS, TODOS, ["ansiedad-que-no-para"]);
    expect(r?.orden).toBe(2);
    expect(r?.empezado).toBe(true);
  });

  it("no se salta pasos aunque se haya abierto uno posterior", () => {
    const r = resolveNextStep(PASOS, TODOS, ["ansiedad-ataques"]);
    expect(r?.orden).toBe(1);
  });

  it("respeta el orden declarado, no el orden del array", () => {
    const desordenados = [...PASOS].reverse();
    expect(resolveNextStep(desordenados, TODOS, [])?.orden).toBe(1);
  });

  it("resuelve la ruta de guía cuando el paso apunta a una guía", () => {
    const r = resolveNextStep(PASOS, TODOS, ["ansiedad-que-no-para", "anclaje-5-4-3-2-1"]);
    expect(r?.href).toBe("/guias/ansiedad-ataques");
    expect(r?.resourceType).toBe("guia");
  });
});

describe("programa terminado — sin CTA", () => {
  it("devuelve null cuando ya se abrieron todos los pasos alcanzables", () => {
    expect(resolveNextStep(PASOS, TODOS, TODOS)).toBeNull();
  });

  it("un paso sin enlace no impide dar el programa por terminado", () => {
    // El paso 3 ("haz tu GAD-7") nunca es candidato: no tiene destino.
    const r = resolveNextStep(PASOS, TODOS, TODOS);
    expect(r).toBeNull();
  });
});

describe("filtro de etapa — nunca se ofrece contenido inaccesible", () => {
  it("usuario free: solo se ofrece lo que su etapa alcanza", () => {
    // 'ansiedad-ataques' es de etapa esencial: no está entre los alcanzables.
    const free = ["ansiedad-que-no-para", "anclaje-5-4-3-2-1"];
    expect(resolveNextStep(PASOS, free, [])?.orden).toBe(1);
    expect(resolveNextStep(PASOS, free, free)).toBeNull(); // terminado para él
  });

  it("usuario premium: el paso de etapa superior sí se ofrece", () => {
    const r = resolveNextStep(PASOS, TODOS, ["ansiedad-que-no-para", "anclaje-5-4-3-2-1"]);
    expect(r?.resourceId).toBe("ansiedad-ataques");
  });

  it("un paso fuera de etapa nunca aparece, ni siendo el único pendiente", () => {
    const soloFree = ["ansiedad-que-no-para"];
    expect(resolveNextStep(PASOS, soloFree, ["ansiedad-que-no-para"])).toBeNull();
  });
});

describe("sin siguiente paso — no se dibuja nada", () => {
  it("programa sin pasos", () => {
    expect(resolveNextStep([], TODOS, [])).toBeNull();
    expect(resolveNextStep(null, TODOS, [])).toBeNull();
    expect(resolveNextStep(undefined, TODOS, [])).toBeNull();
  });

  it("ningún paso alcanzable en la etapa del lector", () => {
    expect(resolveNextStep(PASOS, [], [])).toBeNull();
  });

  it("pasos sin enlace: no hay destino que ofrecer", () => {
    const sinEnlace: JourneyStepInput[] = [
      { orden: 1, titulo: "Haz tu GAD-7", slug_relacionado: null, ref_kind: null },
      { orden: 2, titulo: "Escribe cómo te fue", slug_relacionado: "", ref_kind: null },
    ];
    expect(resolveNextStep(sinEnlace, TODOS, [])).toBeNull();
  });
});

describe("siempre uno, nunca una lista", () => {
  it("devuelve un único objeto, no un array", () => {
    const r = resolveNextStep(PASOS, TODOS, []);
    expect(Array.isArray(r)).toBe(false);
    expect(r).toMatchObject({ orden: 1 });
  });

  it("no muta la entrada al ordenar", () => {
    const entrada = [...PASOS];
    resolveNextStep(entrada, TODOS, []);
    expect(entrada.map((s) => s.orden)).toEqual([1, 2, 3, 4]);
  });
});
