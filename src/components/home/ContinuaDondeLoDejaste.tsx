// ============================================================================
// "Continúa donde lo dejaste" — la banda superior de la Home.
//
// Es el punto de continuidad de la plataforma: en vez de devolver siempre a la
// misma portada, retoma lo que la persona ya empezó. Tres casos, en orden
// estricto de prioridad, y solo uno se dibuja:
//
//   1. Hay un programa empezado  → el siguiente paso (Journey Engine).
//   2. Hay recursos abiertos     → continuar leyendo el último.
//   3. No hay recorrido          → tres piezas para empezar.
//
// El orden no es estético. Un programa es una ruta que un profesional ordenó, y
// compite mejor que cualquier sugerencia lateral: mientras esté a medias, es lo
// que hay que ofrecer. Solo cuando no hay ruta abierta tiene sentido mirar la
// última lectura, y solo cuando no hay nada se muestra por dónde empezar.
//
// Todo el cálculo es de servicios que ya existen. Aquí no se decide qué es un
// siguiente paso —eso lo hace resolveNextStep()— ni qué se puede ver —eso lo
// hace el filtro de etapa de cada servicio—. Esto solo elige el caso.
//
// Sin sesión no hay recorrido legible: el recorrido solo lo puede leer su
// dueño. Un visitante anónimo cae siempre en el caso 3, que es correcto.
// ============================================================================
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Clock, Compass } from "lucide-react";
import {
  getContentBySlug,
  getMyPreferences,
  getRecentResources,
  getRecommendations,
  getSeenResources,
  listPublishedContent,
  resolveNextStep,
  resolveRecentResource,
  RESOURCE_TYPE_LABELS,
  type ContentMeta,
  type JourneyStepInput,
  type RecommendationContext,
  type ResolvedRecentResource,
} from "../../lib/api";
import { JourneyNextStep } from "../journey/JourneyNextStep";
import { RecomendacionesRelacionadas } from "../content/RecomendacionesRelacionadas";

interface ProgramaActivo {
  slug: string;
  titulo: string;
  steps: JourneyStepInput[];
  alcanzables: string[];
}

type Lectura = ResolvedRecentResource;

type Estado =
  | { caso: "cargando" }
  | { caso: "programa"; programa: ProgramaActivo }
  | { caso: "lectura"; lectura: Lectura }
  /** Hay temas declarados: el motor SÍ puede personalizar. */
  | { caso: "sugerencias"; contexto: RecommendationContext }
  | { caso: "empezar"; piezas: ContentMeta[] }
  | { caso: "nada" };

export function ContinuaDondeLoDejaste() {
  const [estado, setEstado] = useState<Estado>({ caso: "cargando" });

  useEffect(() => {
    let vigente = true;

    void resolverCaso().then((r) => {
      if (vigente) setEstado(r);
    });

    return () => {
      vigente = false;
    };
  }, []);

  if (estado.caso === "cargando" || estado.caso === "nada") return null;

  // Con temas declarados se delega en el bloque de recomendaciones: trae su
  // propio título, su propio cálculo y su propio registro. Por eso este caso no
  // dibuja la cabecera de la banda — tendría dos.
  if (estado.caso === "sugerencias") {
    return (
      <section className="border-b border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-4 pb-10 md:px-6">
          <RecomendacionesRelacionadas
            {...estado.contexto}
            titulo="Por dónde empezar"
            subtitulo="A partir de los temas que nos contaste que te interesan."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-200 bg-slate-50/60">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
          {estado.caso === "empezar" ? "Por dónde empezar" : "Continúa donde lo dejaste"}
        </h2>

        {estado.caso === "programa" && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Tienes {estado.programa.titulo} a medias.
            </p>
            {/* Se delega en el mismo componente que usa el lector del programa:
                así el siguiente paso se calcula y se registra en un solo sitio. */}
            <JourneyNextStep
              programaId={estado.programa.slug}
              steps={estado.programa.steps}
              alcanzables={estado.programa.alcanzables}
            />
          </>
        )}

        {estado.caso === "lectura" && <TarjetaLectura lectura={estado.lectura} />}

        {estado.caso === "empezar" && <ParaEmpezar piezas={estado.piezas} />}
      </div>
    </section>
  );
}

function TarjetaLectura({ lectura }: { lectura: Lectura }) {
  return (
    <div className="mt-4 rounded-3xl border border-primary/20 bg-primary/5 p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">{lectura.etiqueta}</p>
      <h3 className="mt-2 text-xl font-bold leading-snug text-slate-900">{lectura.titulo}</h3>
      {lectura.descripcion && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/75">
          {lectura.descripcion}
        </p>
      )}
      <Link
        to={lectura.href}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
      >
        Continuar leyendo <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function ParaEmpezar({ piezas }: { piezas: ContentMeta[] }) {
  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">
        Tres piezas de nuestro equipo para abrir camino.
      </p>
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {piezas.map((p) => (
          <li key={p.slug}>
            <Link
              to="/contenido/$slug"
              params={{ slug: p.slug }}
              className="card-neon-hover flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                {p.content_type === "programa" ? <Compass size={13} /> : <BookOpen size={13} />}
                {RESOURCE_TYPE_LABELS[p.content_type] ?? "Recurso"}
              </span>
              <h3 className="mt-2 text-base font-bold leading-snug text-slate-900">{p.titulo}</h3>
              <p className="mt-2 line-clamp-3 flex-grow text-sm leading-relaxed text-foreground/75">
                {p.resumen_breve}
              </p>
              {p.tiempo_lectura && (
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Clock size={12} /> {p.tiempo_lectura}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Elección del caso ───────────────────────────────────────────────────────

async function resolverCaso(): Promise<Estado> {
  const recientes = await getRecentResources(8);

  // 1. Programa a medias. Se considera empezado el programa que la persona
  //    abrió, no cualquier pieza suelta que resulte ser un paso: entrar en el
  //    programa es el gesto que declara la intención de recorrerlo.
  const ultimoPrograma = recientes.find((r) => r.resourceType === "programa");
  if (ultimoPrograma) {
    const programa = await cargarPrograma(ultimoPrograma.resourceId);
    if (programa) return { caso: "programa", programa };
  }

  // 2. Última lectura que todavía se pueda abrir. Si la primera ya no está
  //    publicada o quedó fuera de la etapa, se prueba la siguiente en vez de
  //    ofrecer un enlace roto.
  for (const r of recientes) {
    if (r.resourceType === "programa") continue;
    const lectura = await resolveRecentResource(r.resourceId, r.resourceType);
    if (lectura) return { caso: "lectura", lectura };
  }

  // 3. Sin recorrido, pero con temas declarados en el onboarding: el motor SÍ
  //    tiene sobre qué anclar. `currentId` vacío porque no hay pieza actual de
  //    la que separarse; el filtro de etapa lo sigue aplicando el motor.
  const prefs = await getMyPreferences();
  const tema = prefs?.themes[0];
  if (tema) {
    const contexto: RecommendationContext = {
      source: "contenido",
      currentId: "",
      categoria: "",
      tipoActual: "articulo",
      themeKey: tema,
      tags: null,
    };
    // Se comprueba que el tema tenga piezas visibles antes de elegir el caso: un
    // tema con una sola pieza —o toda fuera de la etapa— dejaría la banda vacía.
    const hay = (await getRecommendations(contexto)).length > 0;
    if (hay) return { caso: "sugerencias", contexto };
  }

  // 4. Ni recorrido ni preferencias. No se puede personalizar nada y tampoco se
  //    debe fingir que sí: las piezas más recientes que la etapa incluye.
  const piezas = await listPublishedContent();
  if (piezas.length === 0) return { caso: "nada" };
  return { caso: "empezar", piezas: piezas.slice(0, 3) };
}

/** Carga el programa y decide si de verdad le queda un paso pendiente. */
async function cargarPrograma(slug: string): Promise<ProgramaActivo | null> {
  const { item, reachableSteps } = await getContentBySlug(slug);
  if (!item || item.content_type !== "programa") return null;

  const steps = (item.program_steps ?? []) as JourneyStepInput[];
  // Se resuelve aquí para poder ELEGIR el caso: si el programa está terminado
  // —o ningún paso está en la etapa— no hay banda de programa y se pasa al
  // siguiente caso. El cálculo es el mismo que usa el lector, no una copia.
  const vistos = await getSeenResources(reachableSteps);
  if (!resolveNextStep(steps, reachableSteps, vistos)) return null;

  return { slug, titulo: item.titulo, steps, alcanzables: reachableSteps };
}
