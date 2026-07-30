// ============================================================================
// Tests públicos (capa de captación, sin login).
//
// Separada de las evaluaciones del portal a propósito: aquí no hay paciente, no
// hay historia clínica y no hay seguimiento. Alguien que no nos conoce responde
// un cribado y ve su resultado — el registro es una invitación, nunca un peaje.
//
// Este servicio NUNCA lee `public_test_submissions`. Es dato de captación con
// correos de terceros, y la policy que lo reserva al admin está escrita pero
// comentada mientras RLS siga apagado: si el cliente lo consultara, hoy lo
// obtendría. La app solo escribe ahí.
// ============================================================================
import { supabase } from "../supabase";

export interface PublicTestOption {
  label: string;
  valor: number;
}

export interface PublicTestItem {
  n: number;
  texto: string;
  /** El ítem de ideación del PHQ-9. Una respuesta > 0 activa los recursos de crisis. */
  riesgo?: boolean;
  opciones: PublicTestOption[];
}

export interface PublicTestBand {
  min: number;
  max: number;
  etiqueta: string;
  interpretacion: string;
  recomendacion: string;
  /** Banda en la que el resultado prioriza crisis y calla lo comercial. */
  alerta?: boolean;
}

export interface PublicTest {
  id: string;
  slug: string;
  nombre: string;
  instrumento: string;
  categoria: string;
  descripcion: string;
  /** Encabezado del instrumento; define la ventana temporal que se mide. */
  instrucciones: string;
  tiempo_estimado: string | null;
  items: PublicTestItem[];
  bandas: PublicTestBand[];
  activo: boolean;
}

/** Metadatos del hub: sin ítems ni bandas, que solo hacen falta al responder. */
export type PublicTestMeta = Omit<PublicTest, "items" | "bandas">;

const META_COLUMNS =
  "id, slug, nombre, instrumento, categoria, descripcion, instrucciones, tiempo_estimado, activo";

export async function listPublicTests(): Promise<PublicTestMeta[]> {
  const { data, error } = await supabase
    .from("public_tests")
    .select(META_COLUMNS)
    .eq("activo", true)
    .order("categoria");

  if (error) {
    console.error("[publicTests] Error listando tests:", error.message);
    return [];
  }
  return (data ?? []) as PublicTestMeta[];
}

export async function getPublicTest(slug: string): Promise<PublicTest | null> {
  const { data, error } = await supabase
    .from("public_tests")
    .select("*")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("[publicTests] Error cargando el test:", error.message);
    return null;
  }
  return (data as PublicTest) ?? null;
}

// ── Cálculo del resultado ───────────────────────────────────────────────────

export interface PublicTestResult {
  score: number;
  banda: PublicTestBand;
  /**
   * El resultado tiene que priorizar los recursos de crisis y NO mostrar
   * mensaje comercial. Se activa por dos vías independientes: la banda marcada
   * como alerta, o una respuesta positiva en el ítem de riesgo — aunque el total
   * quede bajo. Un puntaje moderado con ideación presente sigue siendo riesgo.
   */
  riesgo: boolean;
  /** Solo para explicar por qué se priorizó: no se muestra el valor crudo. */
  riesgoPorItem: boolean;
}

/**
 * `respuestas` está indexado por `item.n` (1-based), no por posición: si algún
 * día un test se siembra con ítems no consecutivos, el puntaje sigue cuadrando.
 */
export function scorePublicTest(
  test: PublicTest,
  respuestas: Record<number, number>,
): PublicTestResult {
  let score = 0;
  let riesgoPorItem = false;

  for (const item of test.items) {
    const valor = respuestas[item.n];
    if (valor === undefined) continue;
    score += valor;
    if (item.riesgo && valor > 0) riesgoPorItem = true;
  }

  const banda = resolveBand(test, score);
  return {
    score,
    banda,
    riesgo: riesgoPorItem || banda.alerta === true,
    riesgoPorItem,
  };
}

/**
 * Banda que contiene el puntaje. El seed valida que las bandas cubran todo el
 * rango sin huecos, pero si alguna vez no fuera así, es mejor caer en la banda
 * más cercana que dejar a alguien mirando una pantalla sin interpretación.
 */
function resolveBand(test: PublicTest, score: number): PublicTestBand {
  const bandas = [...test.bandas].sort((a, b) => a.min - b.min);
  return (
    bandas.find((b) => score >= b.min && score <= b.max) ??
    (score < bandas[0].min ? bandas[0] : bandas[bandas.length - 1])
  );
}

/** ¿Están respondidos todos los ítems? */
export function isComplete(test: PublicTest, respuestas: Record<number, number>): boolean {
  return test.items.every((i) => respuestas[i.n] !== undefined);
}

// ── Registro del envío ──────────────────────────────────────────────────────

/**
 * Deja constancia de que el test se hizo, al mostrar el resultado y SIN correo.
 *
 * Se registra siempre, no solo cuando alguien deja su correo: el dato que
 * importa para la captación es cuánta gente completa cada test y en qué bandas
 * cae, y eso se perdería si solo se guardara a quien además se suscribe.
 *
 * No se guarda ninguna respuesta individual, solo el total y la banda: no hace
 * falta más, y guardar el detalle convertiría una tabla de marketing en un
 * registro de salud de alguien que nunca lo consintió.
 *
 * Devuelve el id para poder añadir el correo después. Si falla, la persona no se
 * entera ni pierde nada —ya vio su resultado—, así que el error no la interrumpe.
 */
export async function recordSubmission(
  testSlug: string,
  score: number,
  banda: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("public_test_submissions")
    .insert({ test_slug: testSlug, score, banda })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[publicTests] No se pudo registrar el envío:", error.message);
    return null;
  }
  return (data?.id as string) ?? null;
}

/**
 * Añade el correo a un envío ya registrado, si la persona lo deja.
 *
 * Va como update y no como fila nueva para que un test completado siga siendo un
 * envío, no dos. Si no se conoce el id (porque el registro inicial falló), se
 * inserta uno completo: mejor un dato de contacto guardado que perdido.
 */
export async function attachEmailToSubmission(
  submissionId: string | null,
  testSlug: string,
  score: number,
  banda: string,
  email: string,
): Promise<void> {
  const limpio = email.trim();
  if (!limpio) return;

  if (submissionId) {
    const { error } = await supabase
      .from("public_test_submissions")
      .update({ email: limpio })
      .eq("id", submissionId);
    if (!error) return;
    console.error("[publicTests] No se pudo añadir el correo:", error.message);
  }

  const { error } = await supabase
    .from("public_test_submissions")
    .insert({ test_slug: testSlug, score, banda, email: limpio });
  if (error) console.error("[publicTests] No se pudo registrar el correo:", error.message);
}

// ── Lectura de administración ───────────────────────────────────────────────

export interface TestSubmission {
  id: string;
  test_slug: string;
  score: number | null;
  banda: string | null;
  email: string | null;
  created_at: string;
}

/**
 * Envíos registrados, para el panel del admin.
 *
 * Solo se llama desde ahí: `anon` tiene revocado el SELECT sobre esta tabla
 * (20260730f), así que una llamada desde la capa pública fallaría con permiso
 * denegado — que es exactamente lo que se busca.
 */
export async function listTestSubmissions(soloConEmail = false): Promise<TestSubmission[]> {
  let query = supabase
    .from("public_test_submissions")
    .select("id, test_slug, score, banda, email, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (soloConEmail) query = query.not("email", "is", null);

  const { data, error } = await query;
  if (error) {
    console.error("[publicTests] Error cargando los envíos:", error.message);
    return [];
  }
  return (data ?? []) as TestSubmission[];
}
