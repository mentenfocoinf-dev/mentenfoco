// ============================================================================
// Journaling estructurado (autocuidado) — diario PRIVADO del paciente.
//
// Cada entrada es solo de quien la escribe: la RLS de `journal_entries`
// (owner-only, auth.uid() = patient_id) lo garantiza en la base, no en esta
// capa. Por eso la lectura es directa —el cliente tiene SELECT sobre lo suyo—
// a diferencia de `user_preferences`, que sí se oculta tras un RPC.
//
// Los prompts guiados son una constante estática aquí: no hay tabla de prompts.
// Son una invitación opcional; escribir libre (sin prompt) es igual de válido.
// ============================================================================
import { supabase } from "../supabase";

/** Invitaciones opcionales para empezar a escribir. Tono sereno, sin exigir. */
export const JOURNAL_PROMPTS = [
  "¿Qué sentiste hoy?",
  "¿Qué te ayudó hoy, aunque sea algo pequeño?",
  "¿Qué te pesó hoy?",
  "¿Qué te gustaría poder soltar?",
  "¿Por qué cosa te sentiste agradecido(a) hoy?",
] as const;

export interface JournalEntry {
  id: string;
  entryDate: string;
  /** El prompt que guió la entrada, o `null` si fue escritura libre. */
  prompt: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface JournalRow {
  id: string;
  entry_date: string;
  prompt: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

function mapRow(r: JournalRow): JournalEntry {
  return {
    id: r.id,
    entryDate: r.entry_date,
    prompt: r.prompt,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function requireUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Necesitas iniciar sesión para escribir en tu diario.");
  return id;
}

/** Las entradas de quien tiene la sesión abierta, de la más reciente a la más antigua. */
export async function listJournalEntries(): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, entry_date, prompt, body, created_at, updated_at")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as JournalRow[]).map(mapRow);
}

export async function createJournalEntry(input: {
  body: string;
  prompt?: string | null;
}): Promise<void> {
  const patientId = await requireUserId();
  const body = input.body.trim();
  if (!body) throw new Error("Escribe algo antes de guardar.");

  const { error } = await supabase.from("journal_entries").insert({
    patient_id: patientId,
    body,
    prompt: input.prompt ?? null,
  });
  if (error) throw new Error("No pudimos guardar tu entrada. Intenta de nuevo.");
}

export async function updateJournalEntry(id: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("La entrada no puede quedar vacía.");

  const { error } = await supabase
    .from("journal_entries")
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("No pudimos guardar los cambios. Intenta de nuevo.");
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw new Error("No pudimos borrar la entrada. Intenta de nuevo.");
}
