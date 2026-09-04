// ============================================================================
// Política de privacidad — PLACEHOLDER.
//
// La infraestructura de ruta + enlace en el footer queda lista, pero el texto
// legal NO lo redacta el equipo de producto: lo escribe/revisa un profesional
// del derecho (P5 del roadmap). Hasta entonces la página se marca `noindex`
// para que un placeholder no se indexe. Al llegar la versión definitiva:
// reemplazar el contenido y QUITAR META_NOINDEX.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { META_NOINDEX } from "../lib/seo";

export const Route = createFileRoute("/politica-privacidad")({
  head: () => ({
    meta: [META_NOINDEX, { title: "Política de privacidad — Mente en Foco" }],
  }),
  component: PoliticaPrivacidad,
});

function PoliticaPrivacidad() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold text-primary md:text-4xl">Política de privacidad</h1>

      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-800">
        [PENDIENTE DE REVISIÓN LEGAL — no publicar así]
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Este documento está en revisión jurídica. Aquí explicaremos cómo recogemos, tratamos y
        protegemos tus datos personales —incluidos los datos de salud—, con qué base legal, durante
        cuánto tiempo y qué derechos puedes ejercer. Publicaremos la versión definitiva en cuanto la
        revise un profesional del derecho.
      </p>

      <p className="mt-4 text-xs text-muted-foreground">Última actualización: pendiente.</p>
    </section>
  );
}
