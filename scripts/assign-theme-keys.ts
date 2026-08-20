// ============================================================================
// Asigna `theme_key` a las 46 piezas del catálogo.
//
// Fuente única de verdad: contexto-proyecto/contenido-plataforma/
// 01_DICCIONARIO_EDITORIAL.md. El mapa de abajo es una transcripción de ese
// documento, pieza por pieza. No se decide nada aquí: si una asignación tiene
// que cambiar, cambia primero en el diccionario.
//
// Idempotente: compara antes de escribir y solo actualiza lo que difiere.
// Ejecutarlo dos veces seguidas deja "Sin cambios: 46".
//
// Uso:
//   node scripts/assign-theme-keys.ts --dry-run
//   node scripts/assign-theme-keys.ts
// ============================================================================
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { THEME_KEYS, type ThemeKey } from "../src/lib/api/themes.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(raiz, ".env"), quiet: true });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const dryRun = process.argv.includes("--dry-run");

// ── El mapa editorial ───────────────────────────────────────────────────────
// Clave: slug (contenido y blog) o id (guías). Valor: tema del diccionario.
// Las reasignaciones que no coinciden con `categoria` son deliberadas y están
// justificadas en la §3 del documento — p. ej. `ansiedad-insomnio` es de sueño
// aunque navegue bajo Ansiedad.

const CONTENIDO: Record<string, ThemeKey> = {
  // Ansiedad y pánico
  "ansiedad-que-no-para": "ansiedad_panico",
  "anclaje-5-4-3-2-1": "ansiedad_panico",
  "respiracion-4-6-8": "ansiedad_panico",
  "meditacion-aterriza": "ansiedad_panico",
  "programa-calma": "ansiedad_panico",
  // Ánimo y depresión
  "estar-triste-no-es-estar-deprimido": "animo_depresion",
  "activacion-conductual": "animo_depresion",
  // Sueño y descanso
  "por-que-no-puedes-dormir-aunque-estes-agotado": "sueno_descanso",
  "podcast-dormir-no-es-apagarse": "sueno_descanso",
  "meditacion-suelta-el-dia": "sueno_descanso",
  // Estrés y agotamiento
  "programa-recargar": "estres_burnout",
  // Autoestima y diálogo interno
  "perfeccionismo-que-agota": "autoestima_dialogo_interno",
  "diario-de-pensamientos": "autoestima_dialogo_interno",
  "reestructuracion-cognitiva": "autoestima_dialogo_interno",
  // Regulación emocional y presencia
  "programa-equilibrio": "regulacion_presencia",
  "programa-presencia": "regulacion_presencia",
  "escaneo-corporal": "regulacion_presencia",
  "meditacion-la-montana": "regulacion_presencia",
  "meditacion-empieza-en-calma": "regulacion_presencia",
  // Enfoque y procrastinación
  "procrastinacion-no-es-pereza": "enfoque_procrastinacion",
  "podcast-por-que-posponemos": "enfoque_procrastinacion",
  "programa-enfoque": "enfoque_procrastinacion",
  // Relaciones y vínculos
  "como-apoyar-a-alguien-que-la-esta-pasando-mal": "relaciones_vinculos",
  // Duelo y pérdida
  "programa-reconectar": "duelo_perdida",
  // Neurodivergencia
  "tdah-adultos-mente-a-mil": "neurodivergencia",
  // Empezar y sostener un proceso
  "mitos-sobre-ir-al-psicologo": "proceso_terapeutico",
};

const GUIAS: Record<string, ThemeKey> = {
  "ansiedad-ataques": "ansiedad_panico",
  "animo-depresion-episodio": "animo_depresion",
  "animo-prevencion-recaida": "animo_depresion",
  "ansiedad-insomnio": "sueno_descanso",
  "ansiedad-estres": "estres_burnout",
  "autoestima-autoconcepto": "autoestima_dialogo_interno",
  "autoestima-dialogo": "autoestima_dialogo_interno",
  "autoestima-limites": "relaciones_vinculos",
  "relaciones-comunicacion": "relaciones_vinculos",
  "relaciones-conflictos": "relaciones_vinculos",
  "relaciones-dependencia": "relaciones_vinculos",
  "trauma-duelo-prolongado": "duelo_perdida",
  "trauma-primeros-pasos": "trauma",
  "infantil-autonomia": "crianza_infancia",
  "infantil-pantallas": "crianza_infancia",
  "infantil-regulacion": "crianza_infancia",
  "alimentacion-atracones": "alimentacion",
  "alimentacion-relacion-comida": "alimentacion",
  "memoria-cambios-normales": "memoria_envejecimiento",
  "memoria-apoyo-familiar-demencia": "memoria_envejecimiento",
};

// ── Comprobación del vocabulario ────────────────────────────────────────────
// Un tema fuera del enum fallaría en la base; esto lo detecta antes de escribir.
const invalidos = [...Object.entries(CONTENIDO), ...Object.entries(GUIAS)].filter(
  ([, tema]) => !(THEME_KEYS as readonly string[]).includes(tema),
);
if (invalidos.length > 0) {
  console.error("Temas fuera del enum:", invalidos);
  process.exit(1);
}

interface Resultado {
  actualizadas: number;
  sinCambios: number;
  ausentes: string[];
  noMapeadas: string[];
}

async function asignar(
  tabla: "content_items" | "clinical_guides",
  columnaId: "slug" | "id",
  mapa: Record<string, ThemeKey>,
): Promise<Resultado> {
  const { data, error } = await supabase.from(tabla).select(`${columnaId}, theme_key`);
  if (error) throw new Error(`${tabla}: ${error.message}`);

  const filas = (data ?? []) as Record<string, string | null>[];
  const enBase = new Map(filas.map((f) => [f[columnaId] as string, f.theme_key]));

  const ausentes = Object.keys(mapa).filter((k) => !enBase.has(k));
  const noMapeadas = [...enBase.keys()].filter((k) => !mapa[k]);

  // Solo lo que difiere. Volver a escribir un valor idéntico movería updated_at
  // sin motivo y haría que el script dejara de ser idempotente de verdad.
  const porCambiar = Object.entries(mapa).filter(
    ([id, tema]) => enBase.has(id) && enBase.get(id) !== tema,
  );
  const sinCambios = Object.entries(mapa).filter(
    ([id, tema]) => enBase.has(id) && enBase.get(id) === tema,
  ).length;

  if (!dryRun && porCambiar.length > 0) {
    // Agrupadas por tema: una consulta por tema en vez de una por pieza.
    const porTema = new Map<ThemeKey, string[]>();
    for (const [id, tema] of porCambiar) {
      porTema.set(tema, [...(porTema.get(tema) ?? []), id]);
    }
    for (const [tema, ids] of porTema) {
      const { error: errUpd } = await supabase
        .from(tabla)
        .update({ theme_key: tema })
        .in(columnaId, ids);
      if (errUpd) throw new Error(`${tabla} [${tema}]: ${errUpd.message}`);
    }
  }

  if (porCambiar.length > 0) {
    for (const [id, tema] of porCambiar) {
      console.log(`  ${dryRun ? "·" : "✓"} ${id} → ${tema}`);
    }
  }

  return { actualizadas: porCambiar.length, sinCambios, ausentes, noMapeadas };
}

const modo = dryRun ? "DRY-RUN (no escribe nada)" : "APLICANDO";
console.log(`\n── Asignación de theme_key — ${modo} ──\n`);

console.log("Contenido:");
const contenido = await asignar("content_items", "slug", CONTENIDO);
console.log("\nGuías:");
const guias = await asignar("clinical_guides", "id", GUIAS);

console.log("\n── Resumen ──");
console.log(`Contenido actualizado: ${contenido.actualizadas}`);
console.log(`Guías actualizadas:    ${guias.actualizadas}`);
console.log(`Sin cambios:           ${contenido.sinCambios + guias.sinCambios}`);

const ausentes = [...contenido.ausentes, ...guias.ausentes];
const noMapeadas = [...contenido.noMapeadas, ...guias.noMapeadas];
if (ausentes.length > 0) console.log(`\nEn el mapa pero no en la base: ${ausentes.join(", ")}`);
if (noMapeadas.length > 0) console.log(`\nEn la base sin clasificar: ${noMapeadas.join(", ")}`);
if (ausentes.length === 0 && noMapeadas.length === 0) {
  console.log("\nEl mapa y el catálogo coinciden pieza por pieza.");
}
