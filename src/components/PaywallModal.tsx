import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, X } from "lucide-react";
import { PLAN_LABELS } from "../lib/api";
import type { PlanType } from "../lib/supabase";

interface PaywallModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plan mínimo que desbloquea este contenido (para personalizar el mensaje). */
  requiredPlan?: PlanType;
}

export function PaywallModal({ isOpen, onOpenChange, requiredPlan }: PaywallModalProps) {
  const planLabel =
    requiredPlan && requiredPlan !== "free" ? PLAN_LABELS[requiredPlan] : "Plan Esencial";

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Fondo oscuro desenfocado */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Contenedor del Modal */}
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-8 shadow-2xl sm:rounded-3xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Encabezado */}
          <div className="flex flex-col items-center space-y-4 text-center mt-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-inner">
              <Lock className="h-10 w-10 text-primary" />
            </div>

            <Dialog.Title className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
              Contenido <Sparkles className="h-6 w-6 text-amber-400" />
            </Dialog.Title>

            <Dialog.Description className="text-base text-slate-500 leading-relaxed max-w-[90%] mx-auto">
              Esta guía contiene protocolos clínicos avanzados, ejercicios de terapia cognitiva y
              herramientas descargables. Está disponible desde el{" "}
              <strong className="text-primary">{planLabel}</strong> en adelante.
            </Dialog.Description>
          </div>

          {/* Botones de Acción */}
          <div className="mt-8 flex flex-col gap-3">
            <Link
              to="/membresia"
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-200"
            >
              Ver planes de membresía
            </Link>

            <Dialog.Close asChild>
              <button className="inline-flex w-full items-center justify-center rounded-xl border-2 border-transparent bg-slate-50 px-6 py-4 text-base font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                Quizás más tarde
              </button>
            </Dialog.Close>
          </div>

          {/* Botón de cierre (X) */}
          <Dialog.Close className="absolute right-6 top-6 rounded-full p-1 opacity-70 transition-opacity hover:bg-slate-100 hover:opacity-100 focus:outline-none">
            <X className="h-5 w-5 text-slate-500" />
            <span className="sr-only">Cerrar</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
