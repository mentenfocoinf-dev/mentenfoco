// ============================================================================
// Fuente única de verdad para planes, beneficios y enlaces de pago.
// Toda la interfaz debe leer de aquí: nada de precios o beneficios sueltos
// en los componentes.
// ============================================================================
import type { PlanType } from "../supabase";

export const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  esencial: 1,
  integral: 2,
  premium: 3,
};

// Nombres de etapa del acompañamiento, no de nivel de producto (ADR-003). El
// renombrado desde la nomenclatura de SaaS (Esencial/Integral/Premium) viene de
// analisis-neuromarketing-planes-22-jul-2026.md.
//
// `free` pasó de "Plan Gratuito" a "Primer Contacto" el 30-jul: era la única
// etapa que se nombraba por su modelo de precio en vez de por el momento del
// proceso, y esa excepción rompía el sistema. El identificador técnico no cambia.
export const PLAN_LABELS: Record<PlanType, string> = {
  free: "Primer Contacto",
  esencial: "Primeros Pasos",
  integral: "Mi Equilibrio",
  premium: "Mi Mundo en Foco",
};

export function planRank(plan?: PlanType | null): number {
  return PLAN_RANK[plan ?? "free"] ?? 0;
}

/**
 * Etapas cuyo contenido alcanza a ver quien está en `plan`.
 *
 * El filtro de etapa es acumulativo (ADR-002): avanzar nunca quita acceso. Vive
 * aquí y no en cada servicio porque contenido, guías y recomendaciones tienen
 * que filtrar con exactamente el mismo criterio — si divergen, el motor podría
 * recomendar una pieza que el lector luego no encuentra.
 */
export function allowedPlans(plan: PlanType): PlanType[] {
  return (Object.keys(PLAN_RANK) as PlanType[]).filter((p) => PLAN_RANK[p] <= PLAN_RANK[plan]);
}

/**
 * Regla central de acceso a contenido por nivel de plan.
 * Admins y terapeutas siempre tienen acceso (necesitan ver el material
 * que trabajan con sus pacientes).
 */
export function hasPlanAccess(
  profile: { plan_type?: PlanType | null; role?: string | null } | null | undefined,
  minPlan: PlanType | null | undefined,
): boolean {
  if (!minPlan || minPlan === "free") return true;
  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "therapist") return true;
  return planRank(profile.plan_type) >= PLAN_RANK[minPlan];
}

// ── Enlaces de pago (Stripe Payment Links, modo test) ──────────────────────
export const STRIPE_LINKS = {
  esencial: "https://buy.stripe.com/test_dRm6oH3zU0eMg7g64D5Vu03",
  integral: "https://buy.stripe.com/test_28EbJ16M63qYaMWakT5Vu04",
  premium: "https://buy.stripe.com/test_5kQ6oHfiCd1y7AKboX5Vu05",
  membresiaMensual: "https://buy.stripe.com/test_3cI28r3zU0eM3kugJh5Vu01",
  membresiaAnual: "https://buy.stripe.com/test_cNi7sLc6q3qY4oy8cL5Vu06",
} as const;

/**
 * Construye el enlace de pago vinculado a la cuenta del usuario logueado,
 * para que el webhook de Stripe actualice su perfil en lugar de crear uno nuevo.
 */
export function buildCheckoutLink(
  baseLink: string,
  profile?: { id: string; email?: string | null } | null,
): string {
  if (!profile) return baseLink;
  const email = encodeURIComponent(profile.email ?? "");
  return `${baseLink}?client_reference_id=${profile.id}&prefilled_email=${email}`;
}

/**
 * Sesiones terapéuticas incluidas por mes en cada plan.
 *
 * PLAN_BENEFITS describe esto en prosa de venta ("4 sesiones terapéuticas al
 * mes"); esta tabla es el mismo dato en forma estructurada, para poder
 * contrastarlo contra las sesiones realmente tomadas. `null` = el plan no
 * incluye sesiones. Si cambian los textos de PLAN_BENEFITS, estos números
 * tienen que moverse con ellos.
 */
export const PLAN_SESSION_QUOTA: Record<PlanType, number | null> = {
  free: null,
  esencial: 1,
  integral: 4,
  premium: 8,
};

// ── Matriz de beneficios ────────────────────────────────────────────────────
// Cada beneficio declara el plan mínimo que lo incluye. Con esto se pintan
// tanto las tarjetas de venta como el detalle "qué incluye mi plan" del
// dashboard del paciente.
export interface PlanBenefit {
  label: string;
  detail: string;
  minPlan: PlanType;
}

export const PLAN_BENEFITS: PlanBenefit[] = [
  {
    label: "Portal personal y evaluaciones de bienestar",
    detail: "Cuestionarios PHQ-9, GAD-7 y C-SSRS con seguimiento de tu evolución.",
    minPlan: "free",
  },
  {
    label: "Guías gratuitas de bienestar",
    detail: "Recursos abiertos escritos por nuestro equipo clínico.",
    minPlan: "free",
  },
  {
    label: "Biblioteca completa de guías clínicas",
    detail: "Protocolos completos, ejercicios descargables y material de apoyo.",
    minPlan: "esencial",
  },
  {
    label: "1 sesión individual al mes",
    detail: "Sesión con tu especialista asignado y valoración inicial completa.",
    minPlan: "esencial",
  },
  {
    label: "Seguimiento continuo por la plataforma",
    detail: "Tareas y recomendaciones personalizadas de tu terapeuta.",
    minPlan: "esencial",
  },
  {
    label: "4 sesiones terapéuticas al mes",
    detail: "Acompañamiento semanal con tu especialista.",
    minPlan: "integral",
  },
  {
    label: "Plan de bienestar personalizado",
    detail: "Nuestro equipo completo analiza tu avance y ajusta tu plan.",
    minPlan: "integral",
  },
  {
    label: "Webinars en vivo y meditaciones guiadas",
    detail: "2 webinars mensuales y biblioteca de audios para ansiedad y sueño.",
    minPlan: "integral",
  },
  {
    label: "Alex — IA de apoyo (Próximamente)",
    detail:
      "Agente especializado en salud mental — función en desarrollo, disponible próximamente.",
    minPlan: "integral",
  },
  {
    label: "8 sesiones terapéuticas al mes",
    detail: "Cuidado intensivo con todo el equipo experto a tu lado.",
    minPlan: "premium",
  },
  {
    label: "Atención médica y psicológica integrada",
    detail: "Acompañamiento médico cuidadoso cuando lo necesitas.",
    minPlan: "premium",
  },
  {
    label: "Sesiones de apoyo para tu familia",
    detail: "Tu red de apoyo también recibe acompañamiento.",
    minPlan: "premium",
  },
  {
    label: "Comunidad privada y condiciones preferentes",
    detail: "Espacio moderado por psicólogos y condiciones preferentes en talleres.",
    minPlan: "premium",
  },
  {
    label: "Prioridad de agenda",
    detail: "Agenda tus sesiones con prioridad siempre que lo necesites.",
    minPlan: "premium",
  },
];

/** Beneficios incluidos en un plan dado. */
export function benefitsForPlan(plan: PlanType): PlanBenefit[] {
  return PLAN_BENEFITS.filter((b) => PLAN_RANK[b.minPlan] <= PLAN_RANK[plan]);
}

/** Beneficios que se suman al avanzar de etapa. */
export function lockedBenefitsForPlan(plan: PlanType): PlanBenefit[] {
  return PLAN_BENEFITS.filter((b) => PLAN_RANK[b.minPlan] > PLAN_RANK[plan]);
}

// ── Definición comercial de los planes que se ofrecen ───────────────────────
export interface PlanOffer {
  plan: PlanType;
  name: string;
  price: string;
  period: string;
  desc: string;
  link: string;
  highlighted?: boolean;
}

export const PLAN_OFFERS: PlanOffer[] = [
  {
    plan: "esencial",
    name: "Primeros Pasos",
    price: "$180.000",
    period: "/mes",
    desc: "El paso inicial para cuidar de ti con la guía de un especialista.",
    link: STRIPE_LINKS.esencial,
  },
  {
    plan: "integral",
    name: "Mi Equilibrio",
    price: "$480.000",
    period: "/mes",
    desc: "Acompañamiento completo con varios especialistas trabajando para ti.",
    link: STRIPE_LINKS.integral,
    highlighted: true,
  },
  {
    plan: "premium",
    name: "Mi Mundo en Foco",
    price: "$950.000",
    period: "/mes",
    desc: "Cuidado integral y constante con todo nuestro equipo experto a tu lado.",
    link: STRIPE_LINKS.premium,
  },
];

/** El plan que aparece pre-seleccionado en /asesoramiento al cargar la página. */
export const DEFAULT_HIGHLIGHTED_OFFER = PLAN_OFFERS.find((o) => o.highlighted) ?? PLAN_OFFERS[0];

// La opción de solo contenido se mapea al eje único de etapas:
// mensual -> nivel Integral de contenido, anual -> nivel Premium (acceso total).
export const MEMBERSHIP_TIERS = [
  {
    plan: "integral" as PlanType,
    name: "Mi Equilibrio, mes a mes",
    price: "$70.000",
    period: "/mes",
    note: "Cancela cuando quieras. Incluye el contenido del nivel Integral.",
    link: STRIPE_LINKS.membresiaMensual,
  },
  {
    plan: "premium" as PlanType,
    name: "Mi Mundo en Foco, todo el año",
    price: "$700.000",
    period: "/año",
    note: "Equivale a 10 meses e incluye todo el contenido de la plataforma.",
    link: STRIPE_LINKS.membresiaAnual,
    highlight: true,
  },
];
