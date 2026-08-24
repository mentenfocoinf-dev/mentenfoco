// ============================================================================
// Panel admin de Empresas (B2B) — pipeline de negociación.
//
// Solo gestiona `companies`: crear, ver, cambiar estado (prospecto → negociando
// → contrato_activo → pausado/cerrado) y notas. El vínculo empleado↔empresa y
// los reportes agregados NO están aquí: siguen bloqueados por la revisión
// jurídica del consentimiento (mecanismo inerte en la base).
// ============================================================================
import { useEffect, useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_ORDER,
  createCompany,
  listCompanies,
  updateCompanyNotes,
  updateCompanyStatus,
  type Company,
  type CompanyStatus,
} from "../../lib/api";

const STATUS_CLASS: Record<CompanyStatus, string> = {
  prospecto: "border-slate-200 bg-slate-50 text-slate-600",
  negociando: "border-amber-200 bg-amber-50 text-amber-700",
  contrato_activo: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pausado: "border-blue-200 bg-blue-50 text-blue-700",
  cerrado: "border-slate-200 bg-slate-100 text-slate-500",
};

export function CompaniesPanel() {
  const [empresas, setEmpresas] = useState<Company[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ name: "", nit: "", contactName: "", contactEmail: "", contactPhone: "" });
  const [notasDraft, setNotasDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    let vigente = true;
    void listCompanies().then((e) => {
      if (!vigente) return;
      setEmpresas(e);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function recargar() {
    setEmpresas(await listCompanies());
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreando(true);
    setError(null);
    try {
      await createCompany({
        name: form.name,
        nit: form.nit,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
      });
      setForm({ name: "", nit: "", contactName: "", contactEmail: "", contactPhone: "" });
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear la empresa.");
    } finally {
      setCreando(false);
    }
  }

  async function cambiarEstado(id: string, status: CompanyStatus) {
    setError(null);
    try {
      await updateCompanyStatus(id, status);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar el estado.");
    }
  }

  async function guardarNotas(id: string) {
    setError(null);
    try {
      await updateCompanyNotes(id, notasDraft[id] ?? "");
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar las notas.");
    }
  }

  const inputClass =
    "rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="p-6">
      <div className="flex items-center gap-2">
        <Building2 size={18} className="text-primary" />
        <h3 className="font-bold text-primary">Empresas</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Pipeline de negociación con empresas. El vínculo con empleados y los reportes agregados
        siguen pendientes de revisión jurídica.
      </p>

      {/* Alta */}
      <form onSubmit={crear} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Nombre de la empresa *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="NIT"
          value={form.nit}
          onChange={(e) => setForm({ ...form, nit: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Persona de contacto"
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Correo de contacto"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Teléfono"
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
        />
        <button
          type="submit"
          disabled={creando || !form.name.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {creando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Agregar
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Listado */}
      {cargando ? (
        <p className="mt-6 text-sm text-muted-foreground">Cargando…</p>
      ) : empresas.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Todavía no hay empresas registradas.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {empresas.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/50 bg-white/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.nit && `NIT ${c.nit}`, c.contactName, c.contactEmail, c.contactPhone]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de contacto"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-semibold ${STATUS_CLASS[c.status]}`}
                  >
                    {COMPANY_STATUS_LABELS[c.status]}
                  </span>
                  <select
                    value={c.status}
                    onChange={(e) => cambiarEstado(c.id, e.target.value as CompanyStatus)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  >
                    {COMPANY_STATUS_ORDER.map((st) => (
                      <option key={st} value={st}>
                        {COMPANY_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3">
                <textarea
                  value={notasDraft[c.id] ?? c.notes ?? ""}
                  onChange={(e) => setNotasDraft({ ...notasDraft, [c.id]: e.target.value })}
                  placeholder="Notas de la negociación…"
                  rows={2}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => guardarNotas(c.id)}
                  className="mt-2 rounded-lg border border-primary/30 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                >
                  Guardar notas
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
