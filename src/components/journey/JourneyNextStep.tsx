// ============================================================================
// "Tu siguiente paso".
//
// No es una recomendación. El bloque de recomendaciones sugiere de lado
// —"también te puede servir"— y por eso ofrece hasta tres. Esto continúa una
// ruta que un profesional ya ordenó, y por eso ofrece UNO. Ofrecer tres
// siguientes pasos es no tener ninguno.
//
// Vive solo dentro de un programa, que es donde existe una ruta de verdad. Ahí
// el motor de recomendaciones está apagado por C1, así que los dos nunca
// compiten por la misma pantalla.
//
// Si no hay siguiente paso —programa terminado, ningún paso alcanzable en la
// etapa del lector, o ningún paso enlazable— no se dibuja nada. Un CTA que
// lleva a "no encontrado" es peor que ningún CTA.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  getSeenResources,
  resolveNextStep,
  trackEvent,
  type JourneyStepInput,
  type JourneyNextStepResult,
} from "../../lib/api";

interface Props {
  /** Slug del programa que se está leyendo. Solo para el registro. */
  programaId: string;
  steps: JourneyStepInput[] | null;
  /** Pasos que el plan del lector alcanza de verdad. Ver resolveReachableSteps(). */
  alcanzables: string[];
}

export function JourneyNextStep({ programaId, steps, alcanzables }: Props) {
  // Solo se pregunta por los pasos de ESTE programa, nunca por el recorrido
  // completo: la función de la base devuelve lo que ya se le pasa.
  const clave = `${programaId}|${alcanzables.join("|")}`;

  // El resultado se guarda JUNTO A la clave que lo produjo. Al saltar de un
  // programa a otro el componente no se desmonta: durante el render en que las
  // props ya son del programa nuevo y el estado todavía es del viejo, la clave
  // no coincide y el paso anterior no se dibuja ni se registra. Limpiar el
  // estado en el efecto no bastaba — el efecto de registro ve el valor previo
  // en ese mismo commit. Pasó en la verificación: /contenido/programa-enfoque
  // registró el primer paso de programa-calma.
  const [resuelto, setResuelto] = useState<{
    clave: string;
    paso: JourneyNextStepResult | null;
  }>({ clave: "", paso: null });
  const registrado = useRef<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const ids = alcanzables;
    void getSeenResources(ids).then((vistos) => {
      if (vigente) setResuelto({ clave, paso: resolveNextStep(steps, ids, vistos) });
    });
    return () => {
      vigente = false;
    };
    // `alcanzables` es un array nuevo en cada render; `clave` lo compara por
    // contenido y ya incluye el programa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, clave]);

  const paso = resuelto.clave === clave ? resuelto.paso : null;

  // El guard no es paranoia: en StrictMode el efecto corre dos veces y duplicaría
  // el evento. Ya pasó con el registro de los tests públicos.
  useEffect(() => {
    if (!paso) return;
    const marca = `${programaId}:${paso.resourceId}`;
    if (registrado.current === marca) return;
    registrado.current = marca;
    trackEvent("NEXT_STEP_SHOWN", {
      resource_id: paso.resourceId,
      resource_type: paso.resourceType,
      step_order: paso.orden,
    });
  }, [paso, programaId]);

  if (!paso) return null;

  return (
    <section className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6 md:p-8">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Tu siguiente paso</p>

      <h2 className="mt-2 text-xl font-bold leading-snug text-slate-900">
        {paso.orden}. {paso.titulo}
      </h2>
      {paso.descripcion && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/75">
          {paso.descripcion}
        </p>
      )}

      <Link
        to={paso.href}
        onClick={() =>
          trackEvent("NEXT_STEP_OPENED", {
            resource_id: paso.resourceId,
            resource_type: paso.resourceType,
            step_order: paso.orden,
          })
        }
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
      >
        {paso.empezado ? "Continuar por aquí" : "Empezar por aquí"}
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
