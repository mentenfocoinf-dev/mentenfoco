// ============================================================================
// Cuestionario público y su resultado.
//
// Todo en cliente y sin sesión: las respuestas individuales no salen del
// navegador. Lo único que se envía —y solo si la persona lo pide— es el total, la
// banda y su correo (ver recordSubmission). Guardar el detalle convertiría una
// tabla de captación en un registro de salud que nadie consintió.
//
// Un ítem a la vez, no la lista completa: nueve preguntas sobre el ánimo en una
// sola pantalla se abandonan, y aquí abandonar significa que alguien que estaba
// buscando ayuda se va sin nada.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { getPublicTest, isComplete, scorePublicTest, type PublicTestResult } from "../lib/api";
import { TestResult } from "../components/tests/TestResult";

export const Route = createFileRoute("/tests/$slug")({
  loader: async ({ params }) => ({ test: await getPublicTest(params.slug) }),
  head: ({ loaderData }) => {
    const t = loaderData?.test;
    if (!t) return { meta: [{ title: "Test no encontrado — Mente en Foco" }] };
    return {
      meta: [
        { title: `${t.nombre} (${t.instrumento}) gratis y sin registro — Mente en Foco` },
        { name: "description", content: t.descripcion },
        { property: "og:type", content: "website" },
        { property: "og:title", content: `${t.nombre} — ${t.instrumento}` },
        { property: "og:description", content: t.descripcion },
      ],
    };
  },
  pendingComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  ),
  component: TestPublico,
});

function TestPublico() {
  const { test } = Route.useLoaderData();
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [indice, setIndice] = useState(0);
  const [resultado, setResultado] = useState<PublicTestResult | null>(null);

  if (!test) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold text-slate-900">Test no encontrado</h1>
        <p className="mb-8 text-slate-500">Este cuestionario no existe o ya no está disponible.</p>
        <Link
          to="/tests"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ArrowLeft size={16} /> Ver todos los tests
        </Link>
      </section>
    );
  }

  const items = [...test.items].sort((a, b) => a.n - b.n);
  const item = items[indice];
  const total = items.length;
  const respondidas = Object.keys(respuestas).length;
  const progreso = Math.round((respondidas / total) * 100);

  function responder(valor: number) {
    const siguientes = { ...respuestas, [item.n]: valor };
    setRespuestas(siguientes);

    if (indice < total - 1) {
      setIndice(indice + 1);
      return;
    }
    // Última pregunta: se calcula aquí, en el cliente, y se muestra sin pedir nada.
    if (isComplete(test!, siguientes)) {
      setResultado(scorePublicTest(test!, siguientes));
    }
  }

  function reiniciar() {
    setRespuestas({});
    setIndice(0);
    setResultado(null);
  }

  if (resultado) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <Link
          to="/tests"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> Ver todos los tests
        </Link>
        <TestResult test={test} resultado={resultado} onReiniciar={reiniciar} />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Link
        to="/tests"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} /> Ver todos los tests
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {test.categoria}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {test.instrumento}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={12} /> {test.tiempo_estimado ?? "Pocos minutos"}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-bold text-primary md:text-4xl">{test.nombre}</h1>
      {/* Enunciado propio de cada instrumento: "durante las últimas 2 semanas"
          es de PHQ-9 y GAD-7; Rosenberg pregunta por cómo te ves en general.
          Mostrar el encabezado equivocado cambia lo que la persona responde. */}
      <p className="mt-2 text-sm text-muted-foreground">{test.instrucciones}</p>

      {/* ── Progreso ────────────────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="mb-2 flex items-baseline justify-between text-xs font-semibold text-slate-500">
          <span>
            Pregunta {indice + 1} de {total}
          </span>
          <span>{progreso}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={progreso}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>

      {/* ── Pregunta ────────────────────────────────────────────────────────── */}
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-lg font-semibold leading-snug text-slate-900">{item.texto}</p>

        <div className="mt-6 space-y-2.5">
          {item.opciones.map((o) => {
            const elegida = respuestas[item.n] === o.valor;
            return (
              <button
                key={o.label}
                onClick={() => responder(o.valor)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-left text-sm font-semibold transition-all ${
                  elegida
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {indice > 0 && (
          <button
            onClick={() => setIndice(indice - 1)}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft size={14} /> Pregunta anterior
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Tus respuestas no salen de tu navegador. Al final verás tu resultado completo, sin registro.
      </p>
    </section>
  );
}
