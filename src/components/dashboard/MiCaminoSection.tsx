// ============================================================================
// "Mi camino" — el dashboard como centro de continuidad.
//
// Cinco bloques, todos compuestos de servicios y componentes que ya existen:
//
//   1. Continúa donde lo dejaste  el MISMO componente que la Home.
//   2. Tus programas              empezados, terminados y disponibles.
//   3. Recursos recientes         lo último abierto, del propio recorrido.
//   4. Recomendado para continuar el motor de recomendaciones, anclado en el
//                                 último recurso. Sin recurso no hay bloque.
//   5. Acceso a terapeuta         el mejor match, o cómo conseguir uno.
//
// Aquí no se decide nada clínico. El siguiente paso lo calcula el Journey
// Engine, la afinidad el Recommendation Engine y el profesional el Matching
// Engine; el filtro de etapa lo aplica cada servicio. Esta pantalla solo
// ordena y dibuja.
//
// El estado de un programa —empezado, terminado, disponible— sale de cruzar sus
// pasos con el recorrido, no de una tabla de progreso: la señal de que alguien
// avanzó es que abrió las piezas, y esa señal ya está registrada.
// ============================================================================
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  PlayCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  getContentBySlug,
  getMyPreferences,
  getRecentResources,
  getSeenResources,
  listPublishedContent,
  matchTherapists,
  resolveNextStep,
  resolveRecentResource,
  type ContentMeta,
  type MatchingInput,
  type Modalidad,
  type RecommendationContext,
  type ResolvedRecentResource,
  type ThemeKey,
  type TherapyModality,
} from "../../lib/api";
import { ContinuaDondeLoDejaste } from "../home/ContinuaDondeLoDejaste";
import { RecomendacionesRelacionadas } from "../content/RecomendacionesRelacionadas";
import { MatchingPreview } from "../matching/MatchingPreview";
import { JournalSection } from "../journal/JournalSection";

type EstadoPrograma = "empezado" | "terminado" | "disponible";

interface ProgramaResumen {
  slug: string;
  titulo: string;
  resumen: string;
  tiempo: string | null;
  estado: EstadoPrograma;
  /** Pasos alcanzables en la etapa del lector, y cuántos van abiertos. */
  total: number;
  hechos: number;
  /** Coincide con un tema declarado en el onboarding. Solo afecta al orden. */
  preferido: boolean;
}

interface Datos {
  programas: ProgramaResumen[];
  recientes: ResolvedRecentResource[];
  /** Contexto del último recurso, para anclar las recomendaciones. */
  ancla: RecommendationContext | null;
  /** Entrada del matching derivada de lo último leído. */
  matching: MatchingInput | null;
  hayTerapeuta: boolean;
  /** Si no ha pasado por el onboarding, se le ofrece — nunca se le obliga. */
  tienePreferencias: boolean;
}

const VACIO: Datos = {
  programas: [],
  recientes: [],
  ancla: null,
  matching: null,
  hayTerapeuta: false,
  tienePreferencias: true,
};

const ETIQUETA_ESTADO: Record<EstadoPrograma, string> = {
  empezado: "En curso",
  terminado: "Completado",
  disponible: "Disponible",
};

const CLASE_ESTADO: Record<EstadoPrograma, string> = {
  empezado: "border-primary/30 bg-primary/10 text-primary",
  terminado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  disponible: "border-slate-200 bg-slate-50 text-slate-600",
};

/** En curso primero, luego lo que se puede empezar, y al final lo terminado. */
const ORDEN_ESTADO: Record<EstadoPrograma, number> = {
  empezado: 0,
  disponible: 1,
  terminado: 2,
};

export function MiCaminoSection() {
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    void cargar().then((d) => {
      if (!vigente) return;
      setDatos(d);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* 1 — exactamente el mismo componente que la Home */}
      <ContinuaDondeLoDejaste />

      {/* Ofrecimiento, no puerta: quien no ha pasado por el onboarding ve todo
          igual, solo con menos afinado. */}
      {!cargando && !datos.tienePreferencias && (
        <Link
          to="/onboarding"
          className="glow-hover flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4"
        >
          <Sparkles size={18} className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-primary">
              Cuéntanos qué te interesa
            </span>
            <span className="block text-xs text-muted-foreground">
              Cuatro preguntas para ajustar lo que te mostramos. Puedes saltarlo.
            </span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-primary" />
        </Link>
      )}

      {/* 2 */}
      <section>
        <h2 className="text-lg font-bold text-primary">Tus programas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rutas ordenadas por nuestro equipo. Puedes retomarlas cuando quieras.
        </p>

        {cargando ? (
          <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>
        ) : datos.programas.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Todavía no hay programas en tu etapa.
          </p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {datos.programas.map((p) => (
              <li key={p.slug}>
                <Link
                  to="/contenido/$slug"
                  params={{ slug: p.slug }}
                  className="glow-hover flex h-full flex-col rounded-3xl glass-card border border-white/40 p-5 hover:border-primary/40"
                >
                  <div className="flex items-center gap-2">
                    <Compass size={15} className="text-primary" />
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${CLASE_ESTADO[p.estado]}`}
                    >
                      {ETIQUETA_ESTADO[p.estado]}
                    </span>
                    {p.total > 0 && (
                      <span className="ml-auto text-xs font-semibold text-muted-foreground">
                        {p.hechos}/{p.total}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-bold leading-snug text-slate-900">{p.titulo}</h3>
                  <p className="mt-1 line-clamp-2 flex-grow text-sm text-foreground/75">
                    {p.resumen}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                    {p.estado === "terminado" ? (
                      <>
                        <CheckCircle2 size={13} /> Volver a verlo
                      </>
                    ) : p.estado === "empezado" ? (
                      <>
                        <PlayCircle size={13} /> Continuar
                      </>
                    ) : (
                      <>
                        <ArrowRight size={13} /> Empezar
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3 */}
      {datos.recientes.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-primary">Recursos recientes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Lo último que abriste.</p>
          <ul className="mt-4 space-y-2">
            {datos.recientes.map((r) => (
              <li key={`${r.contexto.source}-${r.id}`}>
                <Link
                  to={r.href}
                  className="glow-hover flex items-center gap-3 rounded-2xl glass-card border border-white/40 px-4 py-3 hover:border-primary/40"
                >
                  <span className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                    {r.etiqueta}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                    {r.titulo}
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3.5 — Diario privado. Siempre disponible: escribir no depende de nada. */}
      <JournalSection />

      {/* 4 — sin recurso reciente no hay nada sobre lo que recomendar */}
      {datos.ancla && (
        <RecomendacionesRelacionadas
          {...datos.ancla}
          titulo="Recomendado para continuar"
          subtitulo="A partir de lo último que abriste."
        />
      )}

      {/* 5 */}
      <section>
        <h2 className="text-lg font-bold text-primary">Acompañamiento profesional</h2>
        {datos.hayTerapeuta && datos.matching ? (
          <MatchingPreview input={datos.matching} max={1} />
        ) : (
          <div className="mt-3 rounded-3xl glass-card border border-white/40 p-6">
            <div className="flex items-start gap-3">
              <span className="shrink-0 rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">
                <UserRound size={20} strokeWidth={1.5} />
              </span>
              <div>
                <p className="font-bold text-primary">Habla con un profesional</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Cuéntanos qué te está pasando y te proponemos al especialista de nuestro equipo
                  que mejor acompaña ese proceso.
                </p>
                <Link
                  to="/contactanos"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Cuéntanos qué necesitas <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Carga ───────────────────────────────────────────────────────────────────

async function cargar(): Promise<Datos> {
  const [programasMeta, recientesCrudos, prefs] = await Promise.all([
    listPublishedContent("programa"),
    getRecentResources(5),
    getMyPreferences(),
  ]);

  const programas = await resumirProgramas(programasMeta, prefs?.themes ?? []);

  // Los recursos recientes que todavía se pueden abrir. Los que ya no —fuera de
  // etapa o despublicados— se descartan en vez de listar enlaces rotos.
  const resueltos = await Promise.all(
    recientesCrudos
      .filter((r) => r.resourceType !== "programa")
      .map((r) => resolveRecentResource(r.resourceId, r.resourceType)),
  );
  const recientes = resueltos.filter((r): r is ResolvedRecentResource => r !== null);

  const ancla = recientes[0]?.contexto ?? null;

  // El matching se ancla en lo que la persona BUSCA, nunca en cómo puntuó en un
  // test (ADR-004). Lo que declaró en el onboarding manda sobre lo inferido de
  // su lectura: es una respuesta suya, no una deducción nuestra.
  const matching = prefs?.themes.length
    ? {
        motivo: prefs.themes[0],
        especialidades: prefs.themes,
        idioma: prefs.language,
        modalidad: modalidadPreferida(prefs.modalities),
        disponibilidad: prefs.availability.length > 0 ? prefs.availability : null,
      }
    : ancla
      ? {
          motivo: ancla.themeKey ?? null,
          especialidades: ancla.themeKey ? [ancla.themeKey] : null,
          categorias: ancla.categoria ? [ancla.categoria] : null,
        }
      : null;

  const hayTerapeuta = matching ? (await matchTherapists(matching)).length > 0 : false;

  return { programas, recientes, ancla, matching, hayTerapeuta, tienePreferencias: Boolean(prefs) };
}

/**
 * De las modalidades declaradas al valor único que puntúa el motor.
 *
 * La persona puede marcar las dos —es lo honesto— y el criterio del matching es
 * un solo valor, con 'mixta' cubriendo ambas.
 */
function modalidadPreferida(modalidades: TherapyModality[]): Modalidad | null {
  const virtual = modalidades.includes("virtual");
  const presencial = modalidades.includes("presencial");
  if (virtual && presencial) return "mixta";
  if (virtual) return "virtual";
  if (presencial) return "presencial";
  return null;
}

/**
 * Estado de cada programa a partir del recorrido.
 *
 * El progreso de TODOS los programas se pide en una sola llamada: preguntar por
 * cada uno multiplicaría las consultas de una pantalla que ya carga bastante.
 *
 * `temasPreferidos` solo cambia el ORDEN dentro de cada estado. No oculta nada:
 * los programas que no coinciden con lo que alguien declaró siguen ahí.
 */
async function resumirProgramas(
  metas: ContentMeta[],
  temasPreferidos: ThemeKey[],
): Promise<ProgramaResumen[]> {
  const detalles = await Promise.all(metas.map((m) => getContentBySlug(m.slug)));

  const todosLosPasos = detalles.flatMap((d) => d.reachableSteps);
  const vistos = new Set(await getSeenResources([...new Set(todosLosPasos)]));

  return metas
    .map((m, i) => {
      const { item, reachableSteps } = detalles[i];
      const hechos = reachableSteps.filter((s) => vistos.has(s)).length;

      // Terminado solo si había algo que terminar. Un programa cuyos pasos están
      // todos fuera de la etapa no está "completado": está sin empezar.
      const estado: EstadoPrograma =
        reachableSteps.length > 0 && hechos === reachableSteps.length
          ? "terminado"
          : resolveNextStep(item?.program_steps ?? [], reachableSteps, [...vistos]) && hechos > 0
            ? "empezado"
            : "disponible";

      return {
        slug: m.slug,
        titulo: m.titulo,
        resumen: m.resumen_breve ?? "",
        tiempo: m.tiempo_lectura,
        estado,
        total: reachableSteps.length,
        hechos,
        preferido: Boolean(m.theme_key && temasPreferidos.includes(m.theme_key)),
      };
    })
    .sort(
      (a, b) =>
        ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
        Number(b.preferido) - Number(a.preferido) ||
        a.titulo.localeCompare(b.titulo),
    );
}
