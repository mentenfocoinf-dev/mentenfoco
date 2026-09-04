import { createFileRoute, Link } from "@tanstack/react-router";
import { RevealObserver } from "../components/home/RevealObserver";
import { Phone, MessageCircle, AlertTriangle, Heart } from "lucide-react";

// ============================================================================
// Líneas de crisis de Colombia. Números VERIFICADOS (24-jul-2026) contra fuentes
// oficiales (bogota.gov.co, minsalud, directorio Selia).
//
// Punto crítico: la línea 106 NO es nacional — cada ciudad opera la suya
// (Bogotá, Medellín, Cali, Cartagena). El número nacional inequívoco para
// emergencia vital es el 123. Por eso el 123 va primero y el 106 se muestra
// claramente acotado por ciudad, para no repetir el error previo del proyecto.
// ============================================================================

export const Route = createFileRoute("/lineas-de-crisis")({
  head: () => ({
    meta: [
      { title: "Líneas de crisis — Mente en Foco" },
      {
        name: "description",
        content:
          "Líneas de atención en salud mental y prevención del suicidio en Colombia, gratuitas y disponibles 24/7.",
      },
    ],
  }),
  component: LineasDeCrisis,
});

// Líneas municipales de salud mental. Se listan por ciudad porque el mismo
// número (106) cubre solo el municipio que lo opera.
const CITY_LINES = [
  { city: "Bogotá", line: "Línea 106 — 'El poder de ser escuchado'", number: "106" },
  { city: "Medellín", line: "Línea Amiga Saludable", number: "(604) 444 4448" },
  { city: "Medellín", line: "Línea de salud mental", number: "106" },
  { city: "Cali", line: "Línea de salud mental", number: "106" },
  { city: "Cartagena", line: "Línea de la Vida", number: "(605) 339 9999" },
  { city: "Barranquilla", line: "Orientación en salud mental", number: "192 opción 4" },
];

function LineasDeCrisis() {
  return (
    <div className="reveal-scope">
      <RevealObserver />
      <section className="bg-[url('/BANNER.jpg')] bg-cover bg-center bg-no-repeat py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center glass-card mx-4 rounded-3xl py-14 shadow-lg border border-white/40">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <Heart size={30} strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Líneas de crisis
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Si estás pasando por un momento difícil, no estás solo. Estas líneas son gratuitas,
            confidenciales y están disponibles para ayudarte.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        {/* Emergencia inmediata — lo primero y más visible */}
        <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-800">
                ¿Estás en peligro ahora mismo?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-red-700">
                Si tú o alguien más está en riesgo inmediato, llama a la línea de emergencias
                nacional. Está disponible las 24 horas en todo el país.
              </p>
              <a
                href="tel:123"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-105"
              >
                <Phone size={18} /> Llamar al 123
              </a>
            </div>
          </div>
        </div>

        {/* Línea de salud mental */}
        <div className="mt-8 rounded-3xl glass-card border border-white/40 p-8">
          <h2 className="text-xl font-bold text-primary">Apoyo psicológico en crisis</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            La línea <strong>106</strong> ofrece apoyo psicológico gratuito y confidencial las 24
            horas. Es un servicio <strong>de cada ciudad</strong>, así que el número puede variar
            según dónde estés. Si tu municipio no aparece abajo, marca el{" "}
            <strong>123</strong> o acude al servicio de urgencias más cercano.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {CITY_LINES.map((c) => (
              <div
                key={`${c.city}-${c.line}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/50 bg-white/50 p-4"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {c.city}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/80">{c.line}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
                  {c.number}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Otras líneas de apoyo */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl glass-card border border-white/40 p-6">
            <div className="flex items-center gap-2 text-primary">
              <Phone size={18} />
              <h3 className="font-bold">Línea Nacional de la Vida</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Orientación en salud mental y prevención del suicidio.
            </p>
            <a href="tel:3153002003" className="mt-3 inline-block text-lg font-bold text-primary">
              315 300 2003
            </a>
          </div>
          <div className="rounded-2xl glass-card border border-white/40 p-6">
            <div className="flex items-center gap-2 text-primary">
              <MessageCircle size={18} />
              <h3 className="font-bold">Línea ALBA</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompañamiento emocional y prevención.
            </p>
            <a href="tel:195" className="mt-3 inline-block text-lg font-bold text-primary">
              195
            </a>
          </div>
        </div>

        {/* Aclaración de responsabilidad */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            Mente en Foco <strong>no es un servicio de urgencias</strong>. Las líneas de esta
            página son operadas por entidades públicas y están disponibles para atención inmediata.
            Si buscas iniciar un proceso terapéutico con nosotros,{" "}
            <Link to="/contactanos" className="font-semibold text-primary hover:underline">
              escríbenos aquí
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
