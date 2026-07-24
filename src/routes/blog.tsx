import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ArrowRight } from "lucide-react";

// ============================================================================
// Blog — estado "próximamente" honesto. Todavía no hay artículos propios de
// blog (distintos de las guías clínicas), así que en vez de simular una lista
// vacía o falsa, se canaliza al lector hacia las guías reales que sí existen.
// Cuando haya artículos, esta página listará su propia fuente.
// ============================================================================

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Mente en Foco" },
      {
        name: "description",
        content: "Artículos sobre salud mental y bienestar emocional. Muy pronto.",
      },
    ],
  }),
  component: Blog,
});

function Blog() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center md:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
        <BookOpen size={30} strokeWidth={1.5} />
      </div>
      <h1 className="mt-6 text-4xl font-bold text-primary drop-shadow-sm">Nuestro blog está en camino</h1>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        Estamos preparando artículos breves y frecuentes sobre salud mental y bienestar. Mientras
        tanto, tenemos una biblioteca de guías clínicas escritas por nuestro equipo, lista para ti.
      </p>
      <Link
        to="/guia"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
      >
        Explorar las guías <ArrowRight size={16} />
      </Link>
    </section>
  );
}
