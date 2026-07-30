// ============================================================================
// Hub de tests públicos — la puerta de entrada.
//
// Sin login y sin muro: es lo que la competencia usa como gancho y lo que aquí
// estaba encerrado tras la sesión. La promesa del badge ("gratis · sin registro
// · confidencial") es literal, no marketing: el resultado se ve completo sin
// dejar nada, y no se guarda ninguna respuesta individual.
//
// `tests.index.tsx` y no `tests.tsx`: con un hermano `tests.$slug.tsx`, un
// `tests.tsx` se convertiría en layout padre y el hub se dibujaría encima de
// cada cuestionario. Ver [[Trampas conocidas]].
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Clock, HeartHandshake, Loader2, ShieldCheck, Smile, Sparkles } from "lucide-react";
import { HeroImagen } from "../components/HeroImagen";
import { listPublicTests, type PublicTestMeta } from "../lib/api";

export const Route = createFileRoute("/tests/")({
  head: () => ({
    meta: [
      { title: "Tests de salud mental gratis y sin registro — Mente en Foco" },
      {
        name: "description",
        content:
          "Evalúa tu ansiedad, tu estado de ánimo y tu autoestima con cuestionarios clínicos validados. Gratis, sin registro y con resultado inmediato.",
      },
      { property: "og:title", content: "Tests de salud mental gratis — Mente en Foco" },
      {
        property: "og:description",
        content:
          "GAD-7, PHQ-9 y Escala de Rosenberg. Resultado inmediato con interpretación en lenguaje claro.",
      },
    ],
  }),
  loader: async () => ({ tests: await listPublicTests() }),
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: TestsHub,
});

/** Icono por categoría. Genérico si aparece una categoría nueva. */
const CATEGORY_ICON: Record<string, typeof Brain> = {
  Ansiedad: Brain,
  Ánimo: Smile,
  Autoestima: HeartHandshake,
};

function TestsHub() {
  const { tests } = Route.useLoaderData();

  return (
    <>
      <HeroImagen image="/tests.jpg">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <div className="glass-card mx-4 rounded-3xl border border-white/40 py-16 shadow-lg">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-4 py-1.5 text-xs font-bold text-primary">
              <ShieldCheck size={12} /> Gratis · sin registro · confidencial
            </span>
            <h1 className="mt-5 text-4xl font-bold text-primary drop-shadow-sm md:text-5xl">
              Evalúate ahora
            </h1>
            <p className="mx-auto mt-4 max-w-2xl px-4 text-muted-foreground">
              Cuestionarios clínicos validados, los mismos que usa nuestro equipo. Respondes en
              minutos y recibes tu resultado al instante, con una explicación en lenguaje claro.
            </p>
          </div>
        </div>
      </HeroImagen>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {tests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Estamos preparando los cuestionarios. Vuelve pronto.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tests.map((t) => (
              <TestCard key={t.id} test={t} />
            ))}
          </div>
        )}

        {/* Aviso al pie y no al principio: la persona vino a hacer un test, no a
            leer un descargo. Pero tiene que estar, y sin letra escondida. */}
        <div className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-sm font-bold text-slate-800">Un cribado no es un diagnóstico</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Estos cuestionarios son herramientas de orientación: te ayudan a poner nombre a lo que
            sientes y a decidir el siguiente paso. Un diagnóstico solo lo puede hacer un profesional
            de la salud mental en una valoración. Tus respuestas no quedan asociadas a tu identidad.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Si estás pasando por un momento de riesgo,{" "}
            <Link to="/lineas-de-crisis" className="font-bold text-primary hover:underline">
              consulta las líneas de atención inmediata
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}

function TestCard({ test }: { test: PublicTestMeta }) {
  const Icon = CATEGORY_ICON[test.categoria] ?? Sparkles;

  return (
    <Link
      to="/tests/$slug"
      params={{ slug: test.slug }}
      className="card-neon-hover group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon size={24} strokeWidth={1.75} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {test.categoria}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {test.instrumento}
        </span>
      </div>

      <h2 className="mt-3 text-xl font-bold text-primary transition-colors group-hover:text-primary/80">
        {test.nombre}
      </h2>
      <p className="mt-2 flex-grow text-sm leading-relaxed text-foreground/80">
        {test.descripcion}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
          <Clock size={13} /> {test.tiempo_estimado ?? "Pocos minutos"}
        </span>
        <span className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 font-bold text-primary transition-colors group-hover:bg-primary/20">
          Empezar
        </span>
      </div>
    </Link>
  );
}
