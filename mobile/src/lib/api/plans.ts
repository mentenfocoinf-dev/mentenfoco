// Idéntico a src/lib/api/plans.ts de la web (subset: rangos y etiquetas de plan, acceso a
// contenido). Los links de checkout de Stripe no se portan — pagos quedan fuera de la Fase 1
// móvil por decisión explícita del usuario.
import type { PlanType } from "../supabase";

export const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  esencial: 1,
  integral: 2,
  premium: 3,
};

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "Plan Gratuito",
  esencial: "Plan Esencial",
  integral: "Plan Integral",
  premium: "Plan Premium",
};

export function planRank(plan?: PlanType | null): number {
  return PLAN_RANK[plan ?? "free"] ?? 0;
}

export function hasPlanAccess(
  profile: { plan_type?: PlanType | null; role?: string | null } | null | undefined,
  minPlan: PlanType | null | undefined,
): boolean {
  if (!minPlan || minPlan === "free") return true;
  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "therapist") return true;
  return planRank(profile.plan_type) >= PLAN_RANK[minPlan];
}
