// ============================================================================
// Lector de markdown compartido por guías, contenido y blog.
//
// Existe por un motivo concreto: los tres mostraban el título dos veces, una en
// el hero (desde el frontmatter) y otra como primer `# H1` del cuerpo. La
// solución NO es quitar el `#` de cada .md —los archivos son documentos válidos
// por sí solos y el próximo que se escriba volvería a traerlo—, sino omitirlo
// aquí, al renderizar. Así el arreglo vale para las tres secciones y para todo
// lo que se siembre después.
//
// Los estilos de tabla y prosa también estaban duplicados en cada ruta; al
// unificarlos, una tabla se ve igual en una guía que en un post.
// ============================================================================
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Resuelve el H1 inicial del cuerpo, que competía con el título del hero.
 *
 * Hay dos casos y el contenido real trae los dos:
 *
 *  - **Repite el título** (la mayoría de contenido y blog): se borra. Es un
 *    duplicado exacto y no aporta nada que no esté ya arriba.
 *  - **Dice otra cosa**: varias guías abren con un título técnico distinto
 *    ("El Espectro del Deterioro Cognitivo"), y `programa-calma` abre con una
 *    forma corta del suyo. Ahí se degrada a H2: borrarlo perdería texto que sí
 *    informa, pero dejarlo como H1 mantiene dos titulares apilados y dos H1 en
 *    la misma página, incorrecto para lectores de pantalla y para SEO.
 *
 * En ambos casos solo se toca si es el PRIMER bloque del documento: un `# ` más
 * abajo es una sección del texto y ahí no hay nada que arreglar.
 */
export function stripLeadingH1(markdown: string, titulo?: string): string {
  const lines = markdown.split(/\r?\n/);

  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return markdown;

  const m = /^#\s+(.*)$/.exec(lines[i].trim());
  if (!m) return markdown;

  if (titulo && normalizar(m[1]) !== normalizar(titulo)) {
    const degradado = [...lines];
    degradado[i] = `## ${m[1]}`;
    return degradado.join("\n");
  }

  const resto = lines.slice(i + 1);
  while (resto.length > 0 && resto[0].trim() === "") resto.shift();
  return resto.join("\n");
}

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacríticos, en escapes: el proyecto ya tuvo ruido de codificación
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MD_COMPONENTS = {
  table: ({ node: _n, ...props }: any) => (
    <div className="not-prose my-10 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  thead: ({ node: _n, ...props }: any) => (
    <thead className="border-b border-slate-200 bg-slate-50" {...props} />
  ),
  th: ({ node: _n, ...props }: any) => (
    <th className="whitespace-nowrap p-4 font-bold text-slate-900" {...props} />
  ),
  td: ({ node: _n, ...props }: any) => (
    <td className="border-b border-slate-100 p-4 align-top text-slate-700" {...props} />
  ),
  tr: ({ node: _n, ...props }: any) => (
    <tr className="transition-colors last:border-0 hover:bg-slate-50/50" {...props} />
  ),
};

const PROSE =
  "prose prose-slate prose-lg mx-auto max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:leading-relaxed prose-p:text-slate-700 prose-a:text-primary prose-li:text-slate-700 prose-img:rounded-xl prose-img:shadow-md hover:prose-a:text-primary/80";

interface Props {
  markdown: string;
  /** Título del hero. Se usa para reconocer el H1 que lo repite. */
  titulo?: string;
  className?: string;
}

export function ContentBody({ markdown, titulo, className }: Props) {
  const cuerpo = stripLeadingH1(markdown, titulo);

  return (
    <article className={className ? `${PROSE} ${className}` : PROSE}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {cuerpo}
      </ReactMarkdown>
    </article>
  );
}
