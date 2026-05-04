import { useState, useEffect } from "react";
import { LogOut, Contact, Loader2, Users, UserRound, LayoutDashboard } from "lucide-react";
import { supabase, type Profile, type CrmLead } from "../../lib/supabase";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

type TabType = "leads" | "therapists" | "patients";

export function AdminDashboard({ profile, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("leads");
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [therapists, setTherapists] = useState<Profile[]>([]);
  const [patients, setPatients] = useState<any[]>([]); // usando any para incluir joins si es necesario
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      if (activeTab === "leads") {
        const { data } = await supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
        if (data) setLeads(data);
      } else if (activeTab === "therapists") {
        const { data } = await supabase.from("profiles").select("*").eq("role", "therapist");
        if (data) setTherapists(data);
      } else if (activeTab === "patients") {
        // Obteniendo pacientes y opcionalmente buscando a sus terapeutas (esto requiere patient_therapist join)
        const { data } = await supabase.from("profiles").select(`
          *,
          patient_therapist!patient_id(
            therapist:profiles!therapist_id(full_name, email)
          )
        `).eq("role", "patient");
        if (data) setPatients(data);
      }
      setLoading(false);
    }
    fetchData();
  }, [activeTab]);

  const displayName = profile.full_name ?? "Administrador";

  return (
    <>
      <section className="gradient-soft border-b border-white/30 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex items-center justify-between glass-card p-6 rounded-3xl border border-white/40 shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Panel de Control</p>
              <h1 className="text-3xl font-bold text-primary drop-shadow-sm">{displayName}</h1>
              <span className="mt-1 inline-block rounded-full bg-purple-100 border border-purple-200 px-3 py-0.5 text-xs font-semibold text-purple-700">
                Administrador
              </span>
            </div>
            <button
              onClick={onLogout}
              className="rounded-xl border border-white/50 bg-white/40 backdrop-blur px-4 py-2 text-sm font-bold text-primary hover:bg-white/60 transition-colors shadow-sm flex items-center gap-2"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-8 flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("leads")}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-sm ${
              activeTab === "leads"
                ? "bg-primary text-primary-foreground shadow-md"
                : "glass border border-white/40 text-primary hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <Contact size={18} /> Leads (CRM)
          </button>
          <button
            onClick={() => setActiveTab("therapists")}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-sm ${
              activeTab === "therapists"
                ? "bg-primary text-primary-foreground shadow-md"
                : "glass border border-white/40 text-primary hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <Users size={18} /> Terapeutas
          </button>
          <button
            onClick={() => setActiveTab("patients")}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-sm ${
              activeTab === "patients"
                ? "bg-primary text-primary-foreground shadow-md"
                : "glass border border-white/40 text-primary hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <UserRound size={18} /> Pacientes
          </button>
        </div>

        <div className="space-y-6">
          <div className="card-neon-hover rounded-3xl glass-card p-0 border border-white/40 overflow-hidden bg-white/50 shadow-sm">
            {loading ? (
              <div className="p-12 flex justify-center items-center">
                <p className="text-sm text-muted-foreground animate-pulse flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Cargando datos...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* ── TABS RENDERING ── */}
                {activeTab === "leads" && (
                  leads.length > 0 ? (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-primary/5 text-primary border-b border-white/60">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Fecha</th>
                          <th className="px-6 py-4 font-semibold">Nombre</th>
                          <th className="px-6 py-4 font-semibold">Email</th>
                          <th className="px-6 py-4 font-semibold">Teléfono</th>
                          <th className="px-6 py-4 font-semibold">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead, index) => (
                          <tr key={lead.id} className={`border-b border-white/30 hover:bg-white/40 transition-colors ${index === leads.length - 1 ? 'border-none' : ''}`}>
                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "-"}</td>
                            <td className="px-6 py-4 font-semibold text-primary">{lead.name}</td>
                            <td className="px-6 py-4 text-slate-600">{lead.email}</td>
                            <td className="px-6 py-4 text-slate-600">{lead.phone || "-"}</td>
                            <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={lead.interest}>{lead.interest || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-12 text-center"><p className="text-sm text-muted-foreground">No hay leads registrados aún.</p></div>
                  )
                )}

                {activeTab === "therapists" && (
                  therapists.length > 0 ? (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-primary/5 text-primary border-b border-white/60">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Nombre</th>
                          <th className="px-6 py-4 font-semibold">Email (ID)</th>
                          <th className="px-6 py-4 font-semibold">Estado</th>
                          <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {therapists.map((therapist, index) => (
                          <tr key={therapist.id} className={`border-b border-white/30 hover:bg-white/40 transition-colors ${index === therapists.length - 1 ? 'border-none' : ''}`}>
                            <td className="px-6 py-4 font-semibold text-primary">{therapist.full_name || "Sin nombre"}</td>
                            <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">{therapist.id.slice(0, 8)}...</td>
                            <td className="px-6 py-4">
                              <span className="inline-block rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">Activo</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200">
                                Desactivar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-12 text-center"><p className="text-sm text-muted-foreground">No hay terapeutas registrados.</p></div>
                  )
                )}

                {activeTab === "patients" && (
                  patients.length > 0 ? (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-primary/5 text-primary border-b border-white/60">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Nombre</th>
                          <th className="px-6 py-4 font-semibold">Plan</th>
                          <th className="px-6 py-4 font-semibold">Último Acceso</th>
                          <th className="px-6 py-4 font-semibold">Terapeuta Asignado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((pat, index) => {
                          // Extraemos terapeuta desde el join (array por la estructura relacional)
                          const therapistAssigned = pat.patient_therapist?.[0]?.therapist?.full_name || "No asignado";
                          return (
                            <tr key={pat.id} className={`border-b border-white/30 hover:bg-white/40 transition-colors ${index === patients.length - 1 ? 'border-none' : ''}`}>
                              <td className="px-6 py-4 font-semibold text-primary">{pat.full_name || "Sin nombre"}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-block capitalize rounded-full px-3 py-1 text-xs font-semibold ${pat.plan_type === 'premium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'} border`}>
                                  {pat.plan_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-600">Hoy (Mock)</td>
                              <td className="px-6 py-4 text-slate-600 font-medium">{therapistAssigned}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-12 text-center"><p className="text-sm text-muted-foreground">No hay pacientes registrados.</p></div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
