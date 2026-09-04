// ============================================================================
// Diario privado (autocuidado), dentro de "Mi camino".
//
// Es solo del paciente: nadie más lo ve (RLS owner-only en la base). Escribir es
// opcional y sin presión — hay prompts para empezar, pero se puede escribir
// libre. Se puede editar y borrar lo propio: es tuyo.
// ============================================================================
import { useEffect, useState } from "react";
import { BookHeart, Loader2, Pencil, Trash2, X } from "lucide-react";
import {
  JOURNAL_PROMPTS,
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  updateJournalEntry,
  type JournalEntry,
} from "../../lib/api";

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export function JournalSection() {
  const [entradas, setEntradas] = useState<JournalEntry[]>([]);
  const [cargando, setCargando] = useState(true);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");

  useEffect(() => {
    let vigente = true;
    void listJournalEntries().then((e) => {
      if (!vigente) return;
      setEntradas(e);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function recargar() {
    setEntradas(await listJournalEntries());
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      await createJournalEntry({ body: texto, prompt });
      setTexto("");
      setPrompt(null);
      await recargar();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos guardar tu entrada. Intenta de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(id: string) {
    try {
      await updateJournalEntry(id, editTexto);
      setEditId(null);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar los cambios.");
    }
  }

  async function borrar(id: string) {
    try {
      await deleteJournalEntry(id);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos borrar la entrada.");
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <BookHeart size={18} className="text-primary" />
        <h2 className="text-lg font-bold text-primary">Tu diario</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Un espacio solo tuyo para escribir cómo te sientes. Nadie más lo ve.
      </p>

      {/* Compositor */}
      <form onSubmit={guardar} className="mt-4 rounded-3xl glass-card border border-white/40 p-5">
        <div className="flex flex-wrap gap-2">
          {JOURNAL_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrompt(prompt === p ? null : p)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                prompt === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={prompt ?? "Escribe lo que quieras. A tu ritmo."}
          rows={4}
          className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white/60 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none"
        />

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando || !texto.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar entrada"
          )}
        </button>
      </form>

      {/* Entradas */}
      {cargando ? (
        <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>
      ) : entradas.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no has escrito nada. Cuando quieras, este espacio te espera.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {entradas.map((e) => (
            <li key={e.id} className="rounded-3xl glass-card border border-white/40 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {formatFecha(e.entryDate)}
                  </p>
                  {e.prompt && <p className="mt-0.5 text-xs italic text-primary/80">{e.prompt}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {editId === e.id ? (
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      aria-label="Cancelar edición"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(e.id);
                        setEditTexto(e.body);
                      }}
                      aria-label="Editar entrada"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => borrar(e.id)}
                    aria-label="Borrar entrada"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {editId === e.id ? (
                <div className="mt-2">
                  <textarea
                    value={editTexto}
                    onChange={(ev) => setEditTexto(ev.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => guardarEdicion(e.id)}
                    className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    Guardar cambios
                  </button>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {e.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
