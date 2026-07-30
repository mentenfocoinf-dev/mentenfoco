// ============================================================================
// Paso de publicación (solo admin).
//
// Es el único lugar donde se deciden la URL, el SEO y el tier: el terapeuta
// escribe contenido, el admin define cómo se distribuye. La base respalda las
// dos reglas — no se publica sin slug (constraint) y no publica quien no sea
// admin (trigger).
// ============================================================================
import { useState } from "react";
import { Globe, Loader2, X } from "lucide-react";
import { slugify, type ContentItem, type ContentPublishSettings } from "../../lib/api";
import type { PlanType } from "../../lib/supabase";

interface Props {
  item: ContentItem;
  onClose: () => void;
  onPublish: (settings: ContentPublishSettings) => Promise<void>;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none transition-colors";

export function PublishContentModal({ item, onClose, onPublish }: Props) {
  // Si el autor nunca definió slug (ya no lo hace), se sugiere desde el título.
  const [slug, setSlug] = useState(item.slug || slugify(item.titulo));
  const [metaTitle, setMetaTitle] = useState(item.meta_title ?? item.titulo);
  const [metaDescription, setMetaDescription] = useState(
    item.meta_description ?? item.resumen_breve,
  );
  const [minPlan, setMinPlan] = useState<PlanType>(item.min_plan ?? "free");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePublish() {
    if (!slug.trim()) {
      setErrorMsg("La URL (slug) es obligatoria para publicar.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await onPublish({
        slug: slug.trim(),
        meta_title: metaTitle,
        meta_description: metaDescription,
        min_plan: minPlan,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo publicar.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Publicar contenido</h2>
              <p className="text-xs text-slate-500">Define la URL, el SEO y quién lo verá.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
            >
              {errorMsg}
            </p>
          )}

          <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            {item.titulo}
          </p>

          <div>
            <label className="text-sm font-semibold text-slate-900">URL (slug)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="la-ansiedad-que-no-se-apaga"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              Quedará en <span className="font-mono">/contenido/{slug || "…"}</span>
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900">Meta título</label>
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">{metaTitle.length} caracteres (ideal ≤ 60)</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900">Meta descripción</label>
            <textarea
              rows={3}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              {metaDescription.length} caracteres (ideal ≤ 160)
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900">Disponible desde el plan</label>
            <select
              value={minPlan}
              onChange={(e) => setMinPlan(e.target.value as PlanType)}
              className={inputClass}
            >
              <option value="free">Gratuito — lo ve todo el mundo</option>
              <option value="esencial">Primeros Pasos en adelante</option>
              <option value="integral">Mi Equilibrio en adelante</option>
              <option value="premium">Mi Mundo en Foco</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Quien no tenga ese plan simplemente no verá esta pieza — no se muestra bloqueada.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handlePublish()}
              disabled={saving || !slug.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
