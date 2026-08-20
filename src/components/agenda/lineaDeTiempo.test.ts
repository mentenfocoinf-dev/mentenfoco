// Tests del ciclo de vida y de la rejilla de disponibilidad.
//
// Las dos son funciones puras que DERIVAN estado de datos que ya existen. Ahí es
// donde se puede colar un dato inventado —"confirmada" cuando no lo está, una
// hora "libre" que no lo está—, así que es lo que se prueba.
//
// Las reglas de escritura no se prueban aquí: viven en Postgres y están
// verificadas contra la base con rol real.
import { describe, it, expect } from "vitest";
import { construirHitos } from "./LineaDeTiempo";
import { construirHoras, mandaSobre, marcarRango } from "./DisponibilidadDia";
import type { OcupacionHora } from "./DisponibilidadDia";

const BASE = {
  scheduledAt: "2026-09-01T14:00:00.000Z",
  durationMinutes: 60,
  videoCallLink: "https://meet.google.com/x",
  desdeSolicitud: true,
  desdeContraoferta: false,
};

const ANTES = new Date("2026-09-01T10:00:00.000Z").getTime();
const DURANTE = new Date("2026-09-01T14:30:00.000Z").getTime();
const DESPUES = new Date("2026-09-01T20:00:00.000Z").getTime();

const buscar = (hitos: ReturnType<typeof construirHitos>, clave: string) =>
  hitos.find((h) => h.clave === clave);

describe("ciclo de vida de la sesión", () => {
  it("distingue quién la originó", () => {
    const pedida = construirHitos({ ...BASE, status: "confirmada", ahora: ANTES });
    expect(buscar(pedida, "solicitud")?.etiqueta).toBe("Solicitud recibida");

    const propia = construirHitos({
      ...BASE,
      desdeSolicitud: false,
      status: "confirmada",
      ahora: ANTES,
    });
    expect(buscar(propia, "programada")?.etiqueta).toBe("Programada por ti");
    expect(buscar(propia, "solicitud")).toBeUndefined();
  });

  it("marca la contraoferta como origen, no como paso aparte", () => {
    const hitos = construirHitos({
      ...BASE,
      desdeContraoferta: true,
      status: "confirmada",
      ahora: ANTES,
    });
    expect(buscar(hitos, "solicitud")?.etiqueta).toBe("Horario propuesto por ti");
    expect(buscar(hitos, "solicitud")?.nota).toContain("anterior");
  });

  it("una confirmada sin enlace no está lista: el hito falla", () => {
    const hitos = construirHitos({
      ...BASE,
      videoCallLink: null,
      status: "confirmada",
      ahora: ANTES,
    });
    expect(buscar(hitos, "enlace")?.estado).toBe("fallido");
    expect(buscar(hitos, "enlace")?.nota).toContain("no puede entrar");
  });

  it("cancelada corta la línea: no promete pasos que ya no van a ocurrir", () => {
    const hitos = construirHitos({ ...BASE, status: "cancelada", ahora: ANTES });
    expect(buscar(hitos, "cancelada")?.estado).toBe("fallido");
    expect(buscar(hitos, "en_curso")).toBeUndefined();
    expect(buscar(hitos, "realizada")).toBeUndefined();
  });

  it("a una cancelada no se le reprocha la falta de enlace", () => {
    const hitos = construirHitos({
      ...BASE,
      videoCallLink: null,
      status: "cancelada",
      ahora: ANTES,
    });
    expect(buscar(hitos, "enlace")?.estado).toBe("pendiente");
  });

  it("marca 'en curso' solo mientras dura de verdad", () => {
    expect(
      buscar(construirHitos({ ...BASE, status: "confirmada", ahora: ANTES }), "en_curso")?.estado,
    ).toBe("pendiente");
    expect(
      buscar(construirHitos({ ...BASE, status: "confirmada", ahora: DURANTE }), "en_curso")?.estado,
    ).toBe("actual");
    expect(
      buscar(construirHitos({ ...BASE, status: "confirmada", ahora: DESPUES }), "en_curso")?.estado,
    ).toBe("hecho");
  });

  it("avisa de la sesión que ya pasó y nadie cerró", () => {
    const hitos = construirHitos({ ...BASE, status: "confirmada", ahora: DESPUES });
    expect(buscar(hitos, "realizada")?.estado).toBe("fallido");
    expect(buscar(hitos, "realizada")?.nota).toContain("sigue sin cerrarse");
  });

  it("una realizada no arrastra avisos", () => {
    const hitos = construirHitos({ ...BASE, status: "completada", ahora: DESPUES });
    expect(buscar(hitos, "realizada")?.estado).toBe("hecho");
    expect(buscar(hitos, "realizada")?.nota).toBeUndefined();
  });

  it("no asistió también cierra la línea", () => {
    const hitos = construirHitos({ ...BASE, status: "no_asistio", ahora: DESPUES });
    expect(buscar(hitos, "no_asistio")?.estado).toBe("fallido");
    expect(buscar(hitos, "realizada")).toBeUndefined();
  });
});

describe("rejilla de disponibilidad", () => {
  const dia = new Date(2026, 8, 1); // 1 de septiembre, hora local
  const alas = (h: number) => new Date(2026, 8, 1, h, 0, 0, 0).getTime();

  it("todo libre cuando no hay nada", () => {
    const horas = construirHoras({ dia, ocupacion: new Map() });
    expect(horas).toHaveLength(12); // 07:00 … 18:00
    expect(horas.every((h) => h.estado === "libre")).toBe(true);
  });

  it("coloca cada estado en su hora", () => {
    const horas = construirHoras({
      dia,
      ocupacion: new Map([
        [alas(9), { estado: "confirmada" as const, detalle: "Ana" }],
        [alas(11), { estado: "solicitada" as const }],
      ]),
    });
    expect(horas.find((h) => h.inicio.getHours() === 9)?.estado).toBe("confirmada");
    expect(horas.find((h) => h.inicio.getHours() === 9)?.detalle).toBe("Ana");
    expect(horas.find((h) => h.inicio.getHours() === 11)?.estado).toBe("solicitada");
    expect(horas.find((h) => h.inicio.getHours() === 10)?.estado).toBe("libre");
  });

  it("lo de fuera de la ventana no entra", () => {
    const horas = construirHoras({
      dia,
      ocupacion: new Map([[alas(3), { estado: "confirmada" as const }]]),
    });
    expect(horas.every((h) => h.estado === "libre")).toBe(true);
  });

  it("lo vivo manda sobre lo cerrado en la misma hora", () => {
    expect(mandaSobre("confirmada", "cancelada")).toBe(true);
    expect(mandaSobre("confirmada", "realizada")).toBe(true);
    expect(mandaSobre("cancelada", "confirmada")).toBe(false);
    expect(mandaSobre("solicitada", "confirmada")).toBe(false);
    expect(mandaSobre("libre", undefined)).toBe(true);
  });

  it("un bloqueo manual entra por el mismo canal", () => {
    const horas = construirHoras({
      dia,
      ocupacion: new Map([[alas(8), { estado: "bloqueada" as const, detalle: "Formación" }]]),
    });
    expect(horas.find((h) => h.inicio.getHours() === 8)?.estado).toBe("bloqueada");
  });

  it("las horas que ya pasaron no se ofrecen como libres", () => {
    // Mediodía del mismo día: todo lo anterior a las 12 ya terminó.
    const horas = construirHoras({ dia, ocupacion: new Map(), ahora: alas(12) });
    expect(horas.find((h) => h.inicio.getHours() === 9)?.estado).toBe("pasada");
    expect(horas.find((h) => h.inicio.getHours() === 15)?.estado).toBe("libre");
  });
});

// El defecto que motivó `marcarRango`: en los datos reales 20 de 21 sesiones
// empiezan a los :55, así que ninguna coincidía con una hora en punto y la
// rejilla las daba todas por libres.
describe("ocupación por rango, no por hora de inicio", () => {
  const alas = (h: number, m = 0) => new Date(2026, 8, 1, h, m, 0, 0).getTime();
  const nuevo = () => new Map<number, OcupacionHora>();

  it("una sesión que no empieza en punto ocupa las dos horas que toca", () => {
    const mapa = nuevo();
    // 10:55 + 45 min = 11:40
    marcarRango(mapa, alas(10, 55), alas(11, 40), "confirmada", "Ana");
    expect(mapa.get(alas(10))?.estado).toBe("confirmada");
    expect(mapa.get(alas(11))?.estado).toBe("confirmada");
    expect(mapa.get(alas(12))).toBeUndefined();
  });

  it("una sesión larga ocupa todas sus horas", () => {
    const mapa = nuevo();
    marcarRango(mapa, alas(9), alas(12), "programada");
    expect([...mapa.keys()].sort()).toEqual([alas(9), alas(10), alas(11)]);
  });

  it("una de una hora en punto ocupa exactamente una", () => {
    const mapa = nuevo();
    marcarRango(mapa, alas(9), alas(10), "confirmada");
    expect([...mapa.keys()]).toEqual([alas(9)]);
  });

  it("respeta la prioridad: lo vivo tapa lo cerrado", () => {
    const mapa = nuevo();
    marcarRango(mapa, alas(9), alas(10), "cancelada", "vieja");
    marcarRango(mapa, alas(9), alas(10), "confirmada", "nueva");
    expect(mapa.get(alas(9))?.detalle).toBe("nueva");

    marcarRango(mapa, alas(9), alas(10), "cancelada", "otra vieja");
    expect(mapa.get(alas(9))?.detalle).toBe("nueva");
  });

  it("un rango de varios días ocupa cada hora que atraviesa", () => {
    const mapa = nuevo();
    marcarRango(mapa, alas(23), alas(23) + 3 * 3600_000, "vacaciones");
    expect(mapa.size).toBe(3);
  });
});
