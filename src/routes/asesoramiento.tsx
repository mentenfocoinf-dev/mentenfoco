import { createFileRoute, Link } from "@tanstack/react-router";
import { HeroImagen } from "../components/HeroImagen";
import { useState, useEffect } from "react";
import {
  Check,
  ClipboardList,
  HeartHandshake,
  MessageSquareHeart,
  Minus,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { FlipPlanCard } from "../components/plans/FlipPlanCard";
import { ProcesoInfografia, type PasoProceso } from "../components/ProcesoInfografia";
import {
  trackEvent,
  PLAN_OFFERS,
  DEFAULT_HIGHLIGHTED_OFFER,
  PLAN_BENEFITS,
  PLAN_LABELS,
  PLAN_RANK,
  buildCheckoutLink,
} from "../lib/api";
import type { PlanType } from "../lib/supabase";

// Columnas de la tabla comparativa. Labels desde PLAN_LABELS para no duplicar
// nombres (misma fuente que la página de planes).
const COMPARE_PLANS: { plan: PlanType; label: string }[] = [
  { plan: "free", label: PLAN_LABELS.free },
  { plan: "esencial", label: PLAN_LABELS.esencial },
  { plan: "integral", label: PLAN_LABELS.integral },
  { plan: "premium", label: PLAN_LABELS.premium },
];

/** Cabecera de cada tarjeta de plan. Ver public/planes/. */
const PLAN_IMAGES: Record<string, string> = {
  esencial: "/planes/primeros-pasos.jpg",
  integral: "/planes/mi-equilibrio.jpg",
  premium: "/planes/mi-mundo-en-foco.jpg",
};

const PROCESO: PasoProceso[] = [
  {
    icon: MessageSquareHeart,
    title: "Cuéntanos qué necesitas",
    desc: "Nos escribes y coordinamos tu valoración inicial.",
  },
  {
    icon: ClipboardList,
    title: "Valoración inicial",
    desc: "Un profesional entiende tu caso y proponen juntos un plan.",
  },
  {
    icon: HeartHandshake,
    title: "Acompañamiento",
    desc: "Trabajas con tu especialista según el plan que elijas.",
  },
  {
    icon: TrendingUp,
    title: "Seguimiento",
    desc: "Medimos tu evolución y ajustamos el camino contigo.",
  },
];

const PLAN_FAQ = [
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí. Puedes ampliar tu acompañamiento cuando quieras desde tu portal, y sumar más sesiones y contenido.",
  },
  {
    q: "¿Qué incluye cada plan exactamente?",
    a: "La tabla comparativa de arriba muestra qué incluye cada etapa. Cada una contiene todo lo de la anterior.",
  },
  {
    q: "¿La cuenta gratuita da acceso a sesiones?",
    a: "No. La cuenta gratuita te deja conocer la plataforma y ver una selección de guías. El acompañamiento con especialista está en los planes de pago.",
  },
];

export const Route = createFileRoute("/asesoramiento")({
  head: () => ({
    meta: [
      { title: "Asesoramiento — Mente en Foco" },
      {
        name: "description",
        content: "Tres planes de asesoramiento psicológico diseñados a tu medida.",
      },
      { property: "og:title", content: "Asesoramiento — Mente en Foco" },
      {
        property: "og:description",
        content: "Tres planes de asesoramiento psicológico diseñados a tu medida.",
      },
    ],
  }),
  component: Asesoramiento,
});

// Detalle de sesiones y acompañamiento de cada plan (la parte comercial:
// precio, enlace y descripción vive en src/lib/api/plans.ts)
const PLAN_FEATURES: Record<string, string[]> = {
  esencial: [
    "1 sesión con tu especialista al mes",
    "Valoración inicial completa y cercana",
    "Material de apoyo práctico para tu día a día",
    "Seguimiento continuo por nuestra plataforma",
    "Acceso a la biblioteca completa de guías clínicas",
  ],
  integral: [
    "4 sesiones terapéuticas al mes",
    "Un plan de bienestar claro y a tu medida",
    "Nuestro equipo completo analiza tu avance",
    "Acompañamiento y apoyo semanal",
    "Acceso total a nuestras guías y herramientas",
    "Webinars en vivo y meditaciones guiadas",
  ],
  premium: [
    "8 sesiones terapéuticas al mes",
    "Atención médica y psicológica unida para ti",
    "Todo el equipo evalúa tu progreso mensualmente",
    "Sesiones de apoyo para tu familia",
    "Acompañamiento médico cuidadoso (si lo necesitas)",
    "Prioridad siempre que necesites agendar",
    "Acceso completo a todo el contenido de la plataforma",
  ],
};

function Asesoramiento() {
  useEffect(() => {
    trackEvent("PLAN_VIEWED", { resource_type: "asesoramiento" });
  }, []);

  // Deriva el nombre del plan destacado en vez de repetirlo aquí: un nombre
  // hardcodeado ("Integral") dejó de coincidir con plan.name la última vez que
  // se renombraron los planes, y ninguna tarjeta quedaba preseleccionada.
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    DEFAULT_HIGHLIGHTED_OFFER.name,
  );
  const { profile } = useAuth();

  return (
    <>
      <HeroImagen image="/cabecera-planes.jpg">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6 md:py-20 glass-card mx-4 rounded-3xl mt-8">
          <h1 className="text-4xl font-bold text-primary md:text-5xl drop-shadow-sm">
            Planes de Intervención Clínica
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Planes diseñados para tu bienestar. Nuestro equipo de especialistas trabaja unido,
            usando métodos comprobados científicamente para apoyarte a ti y a tu familia.
          </p>
        </div>
      </HeroImagen>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {PLAN_OFFERS.map((plan) => (
            <FlipPlanCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              desc={plan.desc}
              features={PLAN_FEATURES[plan.plan] ?? []}
              checkoutUrl={buildCheckoutLink(plan.link, profile)}
              image={PLAN_IMAGES[plan.plan]}
              highlighted={plan.highlighted}
              selected={selectedPlan === plan.name}
              onSelect={() => setSelectedPlan(plan.name)}
            />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Cada plan incluye el nivel de contenido digital correspondiente.
        </p>
      </section>

      {/* ── Cómo funciona el proceso ── */}
      <section className="bg-primary/5 py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="text-center text-3xl font-bold text-primary drop-shadow-sm">
            Cómo funciona el proceso
          </h2>
          <ProcesoInfografia pasos={PROCESO} className="mt-14" />
        </div>
      </section>

      {/* ── Tabla comparativa (reutiliza PLAN_BENEFITS) ── */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 className="mb-2 text-center text-3xl font-bold text-primary drop-shadow-sm">
          Compara los niveles de acceso
        </h2>
        <p className="mb-8 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
          Cada nivel incluye todo lo del nivel anterior.
        </p>
        <div className="overflow-x-auto rounded-3xl border border-white/60 glass-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/60 bg-primary/5">
                <th className="px-5 py-4 text-left font-bold text-primary">Beneficio</th>
                {COMPARE_PLANS.map((c) => (
                  <th key={c.plan} className="px-4 py-4 text-center font-bold text-primary">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_BENEFITS.map((b, i) => (
                <tr
                  key={b.label}
                  className={`border-b border-white/40 hover:bg-white/40 transition-colors ${
                    i === PLAN_BENEFITS.length - 1 ? "border-none" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-800">{b.label}</p>
                    <p className="text-xs text-muted-foreground">{b.detail}</p>
                  </td>
                  {COMPARE_PLANS.map((c) => (
                    <td key={c.plan} className="px-4 py-3.5 text-center">
                      {PLAN_RANK[b.minPlan] <= PLAN_RANK[c.plan] ? (
                        <Check size={18} className="mx-auto text-emerald-500" />
                      ) : (
                        <Minus size={16} className="mx-auto text-slate-300" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ de planes ── */}
      <section className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
        <h2 className="mb-8 text-center text-3xl font-bold text-primary drop-shadow-sm">
          Preguntas sobre los planes
        </h2>
        <div className="space-y-3">
          {PLAN_FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-white/50 bg-white/50 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
                {f.q}
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="card-neon-hover rounded-3xl glass-card p-10 md:p-14 text-center">
          <h2 className="text-2xl font-semibold text-primary drop-shadow-sm">
            ¿Tienes dudas sobre qué plan elegir?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Agenda una llamada gratuita de 15 minutos y te ayudamos a encontrar la opción ideal.
          </p>
          <Link
            to="/contactanos"
            className="mt-6 inline-flex rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 shadow-lg shadow-primary/20"
          >
            Solicitar orientación
          </Link>
        </div>
      </section>
    </>
  );
}
