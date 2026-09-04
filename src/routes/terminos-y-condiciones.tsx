// ============================================================================
// Términos y condiciones — PLACEHOLDER.
//
// Igual que la política de privacidad: la infraestructura de ruta + enlace en el
// footer queda lista, pero el texto legal lo redacta/revisa un profesional del
// derecho (P5 del roadmap). Marcada `noindex` hasta que llegue el texto real.
// Al llegar la versión definitiva: reemplazar el contenido y QUITAR META_NOINDEX.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { META_NOINDEX } from "../lib/seo";

export const Route = createFileRoute("/terminos-y-condiciones")({
  head: () => ({
    meta: [META_NOINDEX, { title: "Términos y condiciones — Mente en Foco" }],
  }),
  component: TerminosYCondiciones,
});

function TerminosYCondiciones() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold text-primary md:text-4xl">Términos y condiciones</h1>

      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-800">
        [PENDIENTE DE REVISIÓN LEGAL — no publicar así]
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Este documento está en revisión jurídica. Aquí describiremos las condiciones de uso de la
        plataforma, los derechos y responsabilidades de cada parte, el alcance del acompañamiento y
        sus límites. Publicaremos la versión definitiva en cuanto la revise un profesional del
        derecho.
      </p>

      <p className="mt-4 text-xs text-muted-foreground">Última actualización: pendiente.</p>
    </section>
  );
}
