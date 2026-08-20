// ============================================================================
// Qué queda libre en un día, de un vistazo.
//
// Una lista de sesiones responde "qué tengo". Esto responde "qué me queda", que
// es la pregunta que se hace alguien cuando un paciente pide otra hora.
//
// ── Qué se pinta y qué no ───────────────────────────────────────────────────
//
// La ocupación es una comparación de instantes: no depende de husos, ni de
// reglas de negocio, ni de nada que pueda desviarse del servidor. Se calcula
// aquí sin riesgo, con las sesiones, solicitudes y bloqueos YA cargados — no
// hay una consulta nueva.
//
// El horario laboral NO se pinta. Hoy lo aproxima `franja_de()` en el servidor,
// que evalúa en UTC; replicar esa regla en el navegador con horas locales daría
// dos respuestas distintas a la misma pregunta. Así que la franja declarada se
// enseña como texto —un dato—, no como una capa pintada que pretenda ser
// autoridad.
//
// Todo lo demás sí: libre, pasada, vacaciones, bloqueada, por confirmar,
// confirmada, programada, realizada y cancelada. Son situaciones distintas que
// piden decisiones distintas, no una escala de "más o menos ocupado".
// ============================================================================
import { AVAILABILITY_LABELS, type AvailabilitySlot } from "../../lib/api";

/**
 * Qué hay en una hora.
 *
 * No es una escala de "más o menos ocupado": son situaciones distintas que
 * piden decisiones distintas. `solicitada` espera respuesta; `confirmada` está
 * cerrada; `realizada` y `cancelada` son pasado —y la cancelada vuelve a estar
 * libre, por eso se distingue de un hueco que nunca se usó—.
 */
export type EstadoHora =
  | "libre"
  | "pasada"
  | "vacaciones"
  | "bloqueada"
  | "solicitada"
  | "confirmada"
  | "programada"
  | "realizada"
  | "cancelada";

export interface HoraDelDia {
  /** Instante de inicio del bloque. */
  inicio: Date;
  estado: EstadoHora;
  /** Con quién, cuando está ocupada. */
  detalle?: string;
}

/** Cuál gana cuando dos cosas caen en la misma hora. Lo vivo manda sobre lo cerrado. */
const PRIORIDAD: Record<EstadoHora, number> = {
  confirmada: 8,
  programada: 7,
  solicitada: 6,
  vacaciones: 5,
  bloqueada: 4,
  realizada: 3,
  cancelada: 2,
  pasada: 1,
  libre: 0,
};

export function mandaSobre(nuevo: EstadoHora, actual: EstadoHora | undefined): boolean {
  return actual === undefined || PRIORIDAD[nuevo] > PRIORIDAD[actual];
}

// Los colores no son nuevos: son los que ya usa el resto del módulo. Ámbar para
// lo que espera respuesta, primario para lo agendado, gris para lo cerrado.
const CLASES: Record<EstadoHora, string> = {
  libre: "border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-700",
  pasada: "border-slate-200 bg-slate-50/60 text-slate-300",
  vacaciones: "border-slate-300 bg-slate-100 text-slate-500",
  bloqueada: "border-slate-300 bg-slate-100 text-slate-400",
  solicitada: "border-amber-300 bg-amber-50 text-amber-700",
  confirmada: "border-primary/30 bg-primary/10 text-primary",
  programada: "border-primary/20 bg-primary/5 text-primary",
  realizada: "border-slate-200 bg-slate-50 text-slate-500",
  cancelada: "border-slate-200 bg-white text-slate-300 line-through",
};

const ETIQUETAS: Record<EstadoHora, string> = {
  libre: "Libre",
  pasada: "Pasada",
  vacaciones: "Vacaciones",
  bloqueada: "Bloqueado",
  solicitada: "Por confirmar",
  confirmada: "Confirmada",
  programada: "Programada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

/**
 * Las que de verdad quitan hueco.
 *
 * Una cancelada no ocupa nada: vuelve a estar libre. Una pasada tampoco
 * "ocupa" —simplemente ya no se puede usar—, y por eso no cuenta como hora
 * libre pero tampoco como ocupada.
 */
const OCUPAN: EstadoHora[] = ["solicitada", "confirmada", "programada", "bloqueada", "vacaciones"];

/** Ni ocupadas ni ofrecibles: no suman al recuento de huecos. */
const NO_OFRECIBLES: EstadoHora[] = [...OCUPAN, "pasada"];

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** Lo que ocupa una hora concreta, ya resuelto por quien conoce los datos. */
export interface OcupacionHora {
  estado: EstadoHora;
  detalle?: string;
}

/**
 * Construye la rejilla de un día.
 *
 * `ocupacion` va indexada por el instante de inicio del bloque. Los bloqueos
 * manuales entran por el mismo canal, con estado `bloqueada`: cuando exista la
 * tabla, basta con añadirlos al mapa — este componente ya sabe pintarlos y
 * `mandaSobre` ya sabe dónde encajan en la prioridad.
 */
export function construirHoras({
  dia,
  desde = 7,
  hasta = 19,
  ocupacion,
  ahora = Date.now(),
}: {
  dia: Date;
  desde?: number;
  hasta?: number;
  ocupacion: Map<number, OcupacionHora>;
  ahora?: number;
}): HoraDelDia[] {
  const horas: HoraDelDia[] = [];
  for (let h = desde; h < hasta; h++) {
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, 0, 0, 0);
    const puesto = ocupacion.get(inicio.getTime());
    // Una hora que ya pasó no está "libre": no se puede ofrecer. Pintarla en
    // verde invitaba a intentar agendar en ella y a que el servidor lo negara.
    const yaPaso = inicio.getTime() + 3600_000 <= ahora;
    horas.push({
      inicio,
      estado: puesto?.estado ?? (yaPaso ? "pasada" : "libre"),
      detalle: puesto?.detalle,
    });
  }
  return horas;
}

/**
 * Marca en el mapa TODAS las horas que un rango toca, no solo la primera.
 *
 * Una sesión de 45 minutos a las 10:55 va de 10:55 a 11:40 y deja sin usar dos
 * bloques horarios: el de las 10 y el de las 11. Marcar solo la hora de inicio
 * —y peor, solo si empieza en punto— hacía que la rejilla enseñara libre lo que
 * `available_hours` ya no ofrecía. En los datos reales, 20 de 21 sesiones
 * empiezan a los :55, así que la rejilla mentía casi siempre.
 */
export function marcarRango(
  mapa: Map<number, OcupacionHora>,
  desdeMs: number,
  hastaMs: number,
  estado: EstadoHora,
  detalle?: string,
) {
  // Se empieza en la hora en punto que contiene el inicio y se avanza de hora
  // en hora mientras el bloque siga solapando el rango.
  const primera = new Date(desdeMs);
  primera.setMinutes(0, 0, 0);
  for (let t = primera.getTime(); t < hastaMs; t += 3600_000) {
    if (t + 3600_000 <= desdeMs) continue; // el bloque termina antes de empezar
    if (mandaSobre(estado, mapa.get(t)?.estado)) mapa.set(t, { estado, detalle });
  }
}

export function DisponibilidadDia({
  horas,
  franja,
}: {
  horas: HoraDelDia[];
  franja?: AvailabilitySlot[];
}) {
  // Una hora con una sesión cancelada vuelve a estar libre: cuenta como hueco.
  // Una que ya pasó, no.
  const libres = horas.filter((h) => !NO_OFRECIBLES.includes(h.estado)).length;
  const presentes = [...new Set(horas.map((h) => h.estado))].filter((e) => e !== "libre");

  return (
    <div className="rounded-2xl border border-white/40 glass-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-primary">Disponibilidad del día</p>
        <p className="text-xs text-muted-foreground">
          {libres} {libres === 1 ? "hora libre" : "horas libres"} de {horas.length}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
        {horas.map((h) => (
          <div
            key={h.inicio.toISOString()}
            title={h.detalle ? `${ETIQUETAS[h.estado]} · ${h.detalle}` : ETIQUETAS[h.estado]}
            className={`rounded-xl border px-2 py-1.5 text-center ${CLASES[h.estado]}`}
          >
            <p className="text-xs font-bold">
              {dosDigitos(h.inicio.getHours())}:{dosDigitos(h.inicio.getMinutes())}
            </p>
            <p className="truncate text-[10px] font-semibold">{h.detalle ?? ETIQUETAS[h.estado]}</p>
          </div>
        ))}
      </div>

      {/* Leyenda solo de lo que aparece: explicar colores ausentes es ruido. */}
      {presentes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {presentes.map((e) => (
            <span
              key={e}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${CLASES[e]}`}
            >
              {ETIQUETAS[e]}
            </span>
          ))}
        </div>
      )}

      {franja && franja.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Atiendes en:{" "}
          {franja
            .map((f) => AVAILABILITY_LABELS[f])
            .join(", ")
            .toLowerCase()}
          . Fuera de esa franja el servidor no acepta solicitudes, aunque la hora figure libre.
        </p>
      )}
    </div>
  );
}
