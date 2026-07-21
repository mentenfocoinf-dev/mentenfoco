// ============================================================================
// Modal de mejora de plan.
//
// Sustituye al enlace que sacaba al paciente del panel hacia /membresia: el
// upsell ocurre sin perder el contexto del dashboard.
//
// Los botones usan los Payment Links de Stripe ya definidos en plans.ts, que
// hoy apuntan a modo test. Al pasar a producción basta con cambiar STRIPE_LINKS.
// ============================================================================
import { ArrowUpRight, Check, Sparkles, X } from "lucide-react";
import { PLAN_OFFERS, PLAN_BENEFITS, PLAN_RANK, buildCheckoutLink } from "../../lib/api";
import type { Profile, PlanType } from "../../lib/supabase";

interface Props {
  profile: Profile;
  onClose: () => void;
}

/** Beneficios que un plan añade respecto al inmediatamente inferior: es lo que
 *  realmente motiva el cambio, en vez de repetir toda la matriz en cada tarjeta. */
function incrementalBenefits(plan: PlanType): string[] {
  return PLAN_BENEFITS.filter((b) => b.minPlan === plan).map((b) => b.label);
}

export function PlanUpgradeModal({ profile, onClose }: Props) {
  const currentRank = PLAN_RANK[profile.plan_type ?? "free"];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="upgrade-title" className="text-lg font-bold text-slate-900">
                Mejora tu plan
              </h2>
              <p className="text-xs text-slate-500">
                Elige el acompañamiento que mejor se ajuste a tu proceso.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {PLAN_OFFERS.map((offer) => {
              const isCurrent = PLAN_RANK[offer.plan] === currentRank;
              const isDowngrade = PLAN_RANK[offer.plan] < currentRank;
              const perks = incrementalBenefits(offer.plan);

              return (
                <div
                  key={offer.plan}
                  className={`flex flex-col rounded-2xl border p-5 transition-all ${
                    offer.highlighted && !isCurrent
                      ? "border-primary/40 bg-primary/5 shadow-md"
                      : "border-slate-200 hover:border-primary/30 hover:shadow-md"
                  }`}
                >
                  {offer.highlighted && !isCurrent && (
                    <span className="mb-2 self-start rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                      Recomendado
                    </span>
                  )}

                  <p className="text-sm font-bold text-slate-900">{offer.name}</p>
                  <p className="mt-1">
                    <span className="text-2xl font-bold text-slate-900">{offer.price}</span>
                    <span className="text-xs text-slate-500">{offer.period}</span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{offer.desc}</p>

                  {perks.length > 0 && (
                    <ul className="mt-4 flex-1 space-y-1.5">
                      {perks.slice(0, 4).map((label) => (
                        <li key={label} className="flex items-start gap-2 text-xs text-slate-600">
                          <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                          <span>{label}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {isCurrent ? (
                    <p className="mt-5 rounded-xl bg-slate-100 px-4 py-2.5 text-center text-xs font-bold text-slate-500">
                      Tu plan actual
                    </p>
                  ) : isDowngrade ? (
                    <p className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-center text-xs font-medium text-slate-400">
                      Incluido en tu plan
                    </p>
                  ) : (
                    <a
                      href={buildCheckoutLink(offer.link, profile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] hover:bg-primary/90"
                    >
                      Elegir {offer.name} <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            El pago se procesa de forma segura a través de Stripe. Puedes cancelar cuando quieras.
          </p>
        </div>
      </div>
    </div>
  );
}
