import { useState, useEffect, useCallback } from "react";
import {
  LogOut,
  Contact,
  Loader2,
  Users,
  UserRound,
  UserPlus,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Archive,
  Eye,
  MessageCircle,
  ClipboardList,
  Building2,
} from "lucide-react";
import { supabase, type Profile, type CrmLead, type PlanType } from "../../lib/supabase";
import { ContentEditorModal } from "../content/ContentEditorModal";
import { PublishContentModal } from "../content/PublishContentModal";
import { CommentModerationQueue } from "../blog/CommentModerationQueue";
import { TestSubmissionsPanel } from "./TestSubmissionsPanel";
import { CompaniesPanel } from "./CompaniesPanel";
import {
  countPendingComments,
  getAdminDirectory,
  assignPatientToTherapist,
  unassignPatient,
  setUserPlan,
  setUserStatus,
  createUser,
  PLAN_LABELS,
  listAllContent,
  approveContent,
  requestContentChanges,
  publishContent,
  archiveContent,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_CLASSES,
  CONTENT_TYPE_LABELS,
  type AdminDirectory,
  type DirectoryPatient,
  type DirectoryTherapist,
  type ContentItem,
  type ContentPublishSettings,
} from "../../lib/api";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

type TabType =
  | "leads"
  | "empresas"
  | "therapists"
  | "patients"
  | "contenido"
  | "comentarios"
  | "tests";

const PLAN_OPTIONS: PlanType[] = ["free", "esencial", "integral", "premium"];

export function AdminDashboard({ profile, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("patients");
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [directory, setDirectory] = useState<AdminDirectory>({ therapists: [], patients: [] });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // ── Panel de revisión de contenido ─────────────────────────────────────
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentEditor, setContentEditor] = useState<{ open: boolean; item: ContentItem | null }>({
    open: false,
    item: null,
  });
  const [publishFor, setPublishFor] = useState<ContentItem | null>(null);
  const [changesFor, setChangesFor] = useState<ContentItem | null>(null);
  // Badge de la pestaña: lo que espera moderación es lo que reclama atención.
  const [pendingComments, setPendingComments] = useState(0);
  const [changeNotes, setChangeNotes] = useState("");

  const refreshContent = useCallback(async () => {
    setContentItems(await listAllContent());
  }, []);

  // ── Modal "Nuevo usuario" ──────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "patient" as "patient" | "therapist",
    plan_type: "free" as PlanType,
  });

  const notify = (type: "ok" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const refreshDirectory = useCallback(async () => {
    try {
      const dir = await getAdminDirectory();
      setDirectory(dir);
    } catch (err) {
      console.error("[AdminDashboard] Error cargando directorio:", err);
      notify("error", "No pudimos cargar el directorio. Intenta de nuevo.");
    }
  }, []);

  // El contador de la pestaña se carga al entrar al panel, no al abrir la cola:
  // si no, el admin no sabría que hay algo esperando hasta hacer clic.
  useEffect(() => {
    void countPendingComments().then(setPendingComments);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      if (activeTab === "leads") {
        const { data, error } = await supabase
          .from("crm_leads")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) console.error("[AdminDashboard] Error cargando leads:", error.message);
        if (data) setLeads(data);
      } else if (activeTab === "contenido") {
        await refreshContent();
      } else if (activeTab === "comentarios") {
        // La cola la carga el propio componente; aquí solo se refresca el badge.
        setPendingComments(await countPendingComments());
      } else {
        await refreshDirectory();
      }
      setLoading(false);
    }
    fetchData();
  }, [activeTab, refreshDirectory, refreshContent]);

  // ── Acciones del panel de revisión ─────────────────────────────────────
  async function handleContentAction(item: ContentItem, action: "aprobar" | "archivar") {
    setBusyRow(item.id);
    try {
      if (action === "aprobar") {
        await approveContent(item.id, profile.id);
        notify("ok", "Contenido aprobado.");
      } else {
        await archiveContent(item.id);
        notify("ok", "Contenido archivado.");
      }
      await refreshContent();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusyRow(null);
    }
  }

  /** Publicar pasa siempre por el modal: ahí el admin fija URL, SEO y tier. */
  async function handlePublishWithSettings(settings: ContentPublishSettings) {
    if (!publishFor) return;
    await publishContent(publishFor.id, profile.id, settings);
    notify("ok", "Contenido publicado.");
    setPublishFor(null);
    await refreshContent();
  }

  async function handleRequestChanges() {
    if (!changesFor || !changeNotes.trim()) return;
    setBusyRow(changesFor.id);
    try {
      await requestContentChanges(changesFor.id, profile.id, changeNotes);
      notify("ok", "Se enviaron los cambios solicitados al autor.");
      setChangesFor(null);
      setChangeNotes("");
      await refreshContent();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setBusyRow(null);
    }
  }

  // ── Acciones ───────────────────────────────────────────────────────────
  async function handleAssign(patientId: string, therapistId: string) {
    setBusyRow(patientId);
    try {
      if (therapistId === "") {
        await unassignPatient(patientId);
        notify("ok", "Asignación retirada correctamente.");
      } else {
        await assignPatientToTherapist(patientId, therapistId);
        notify("ok", "Paciente asignado correctamente.");
      }
      await refreshDirectory();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Error al asignar.");
    } finally {
      setBusyRow(null);
    }
  }

  async function handlePlanChange(patientId: string, plan: PlanType) {
    setBusyRow(patientId);
    try {
      await setUserPlan(patientId, plan, plan === "free" ? "inactive" : "active");
      notify("ok", `Plan actualizado a ${PLAN_LABELS[plan]}.`);
      await refreshDirectory();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Error al cambiar el plan.");
    } finally {
      setBusyRow(null);
    }
  }

  async function handleToggleTherapist(therapist: DirectoryTherapist) {
    const isInactive = therapist.subscription_status === "inactive";
    if (!isInactive) {
      const confirmed = window.confirm(
        `¿Seguro que deseas desactivar a ${therapist.full_name ?? "este terapeuta"}?`,
      );
      if (!confirmed) return;
    }
    setBusyRow(therapist.id);
    try {
      await setUserStatus(therapist.id, isInactive ? "active" : "inactive");
      notify("ok", isInactive ? "Terapeuta activado." : "Terapeuta desactivado.");
      await refreshDirectory();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Error al actualizar el estado.");
    } finally {
      setBusyRow(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createUser({
        email: newUser.email.trim(),
        password: newUser.password,
        full_name: newUser.full_name.trim(),
        role: newUser.role,
        plan_type: newUser.role === "patient" ? newUser.plan_type : "free",
      });
      notify("ok", `Cuenta creada para ${newUser.full_name}.`);
      setShowCreateModal(false);
      setNewUser({ full_name: "", email: "", password: "", role: "patient", plan_type: "free" });
      await refreshDirectory();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "No pudimos crear la cuenta.");
    } finally {
      setCreating(false);
    }
  }

  const displayName = profile.full_name ?? "Administrador";
  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "patients", label: "Pacientes", icon: <UserRound size={18} /> },
    { key: "therapists", label: "Terapeutas", icon: <Users size={18} /> },
    { key: "leads", label: "Leads (CRM)", icon: <Contact size={18} /> },
    { key: "empresas", label: "Empresas", icon: <Building2 size={18} /> },
    { key: "contenido", label: "Contenido", icon: <FileText size={18} /> },
    {
      key: "comentarios",
      label: pendingComments > 0 ? `Comentarios (${pendingComments})` : "Comentarios",
      icon: <MessageCircle size={18} />,
    },
    { key: "tests", label: "Tests públicos", icon: <ClipboardList size={18} /> },
  ];

  const reviewQueue = contentItems.filter((i) => i.status === "en_revision");

  return (
    <>
      {/* ── Modal: crear usuario ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserPlus size={20} className="text-primary" /> Nuevo usuario
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              La cuenta queda activa de inmediato con la contraseña temporal que definas aquí.
            </p>

            <form onSubmit={handleCreateUser} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Nombre completo</label>
                <input
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="Ej. Laura Gómez"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Correo electrónico</label>
                <input
                  required
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="usuario@correo.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Contraseña temporal</label>
                <input
                  required
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Compártela con la persona; podrá cambiarla desde "Olvidaste tu contraseña".
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Rol</label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value as "patient" | "therapist" })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="patient">Paciente</option>
                    <option value="therapist">Terapeuta</option>
                  </select>
                </div>
                {newUser.role === "patient" && (
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Plan inicial</label>
                    <select
                      value={newUser.plan_type}
                      onChange={(e) =>
                        setNewUser({ ...newUser, plan_type: e.target.value as PlanType })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                    >
                      {PLAN_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {PLAN_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={creating}
                className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Creando cuenta...
                  </>
                ) : (
                  "Crear cuenta"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <section className="page-fade-in gradient-soft border-b border-white/30 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex items-center justify-between glass-card p-6 rounded-3xl border border-white/40 shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Panel de Control</p>
              <h1 className="text-3xl font-bold text-primary drop-shadow-sm">{displayName}</h1>
              <span className="mt-1 inline-block rounded-full bg-purple-100 border border-purple-200 px-3 py-0.5 text-xs font-semibold text-purple-700">
                Administrador
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
              >
                <UserPlus size={16} /> Nuevo usuario
              </button>
              <button
                onClick={onLogout}
                className="rounded-xl border border-white/50 bg-white/40 backdrop-blur px-4 py-2 text-sm font-bold text-primary hover:bg-white/60 transition-colors shadow-sm flex items-center gap-2"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="page-fade-in mx-auto max-w-7xl px-4 py-12 md:px-6">
        {feedback && (
          <div
            className={`mb-6 flex items-center gap-2 rounded-xl border p-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
              feedback.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {feedback.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </div>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-sm ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "glass border border-white/40 text-primary hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
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
                {/* ── CONTENIDO: cola de revisión + catálogo ── */}
                {activeTab === "contenido" && (
                  <div className="space-y-8 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-xl">
                        <h2 className="text-lg font-bold text-primary">Revisión de contenido</h2>
                        <p className="mt-1 text-sm text-slate-600">
                          Los terapeutas proponen; tú apruebas y publicas. Eres el único rol con
                          potestad de publicación.
                        </p>
                      </div>
                      <button
                        onClick={() => setContentEditor({ open: true, item: null })}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                      >
                        <UserPlus size={16} /> Crear contenido
                      </button>
                    </div>

                    {/* Cola de revisión */}
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                        <Send size={15} /> Esperando revisión ({reviewQueue.length})
                      </h3>
                      {reviewQueue.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-6 text-center">
                          <p className="text-sm text-muted-foreground">
                            No hay propuestas pendientes de revisión.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {reviewQueue.map((item) => (
                            <li
                              key={item.id}
                              className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-500">
                                    {CONTENT_TYPE_LABELS[item.content_type]} · {item.categoria}
                                  </p>
                                  <p className="mt-0.5 font-bold text-primary">{item.titulo}</p>
                                  <p className="text-xs text-slate-500">{item.resumen_breve}</p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <button
                                    onClick={() => setContentEditor({ open: true, item })}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                  >
                                    <Eye size={13} /> Revisar / editar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setChangesFor(item);
                                      setChangeNotes("");
                                    }}
                                    disabled={busyRow === item.id}
                                    className="rounded-lg border border-orange-300 px-3 py-2 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-60"
                                  >
                                    Solicitar cambios
                                  </button>
                                  <button
                                    onClick={() => void handleContentAction(item, "aprobar")}
                                    disabled={busyRow === item.id}
                                    className="rounded-lg border border-sky-300 px-3 py-2 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-60"
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    onClick={() => setPublishFor(item)}
                                    disabled={busyRow === item.id}
                                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    Publicar
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Catálogo completo */}
                    <div>
                      <h3 className="mb-3 text-sm font-bold text-slate-700">
                        Todo el contenido ({contentItems.length})
                      </h3>
                      {contentItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 p-6 text-center">
                          <p className="text-sm text-muted-foreground">
                            Todavía no hay contenido creado.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {contentItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/60 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CONTENT_STATUS_CLASSES[item.status]}`}
                                  >
                                    {CONTENT_STATUS_LABELS[item.status]}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {CONTENT_TYPE_LABELS[item.content_type]} · {item.categoria}
                                  </span>
                                </div>
                                <p className="mt-1 truncate font-semibold text-slate-800">
                                  {item.titulo}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2">
                                <button
                                  onClick={() => setContentEditor({ open: true, item })}
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                  Editar
                                </button>
                                {item.status !== "publicado" && item.status !== "archivado" && (
                                  <button
                                    onClick={() => setPublishFor(item)}
                                    disabled={busyRow === item.id}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    Publicar
                                  </button>
                                )}
                                {item.status !== "archivado" && (
                                  <button
                                    onClick={() => void handleContentAction(item, "archivar")}
                                    disabled={busyRow === item.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60"
                                  >
                                    <Archive size={12} /> Archivar
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* ── EMPRESAS (B2B) ── */}
                {activeTab === "empresas" && <CompaniesPanel />}

                {/* ── LEADS ── */}
                {activeTab === "leads" &&
                  (leads.length > 0 ? (
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
                          <tr
                            key={lead.id}
                            className={`border-b border-white/30 hover:bg-white/40 transition-colors ${index === leads.length - 1 ? "border-none" : ""}`}
                          >
                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                              {lead.created_at
                                ? new Date(lead.created_at).toLocaleDateString()
                                : "-"}
                            </td>
                            <td className="px-6 py-4 font-semibold text-primary">{lead.name}</td>
                            <td className="px-6 py-4 text-slate-600">{lead.email}</td>
                            <td className="px-6 py-4 text-slate-600">{lead.phone || "-"}</td>
                            <td
                              className="px-6 py-4 text-slate-600 max-w-xs truncate"
                              title={lead.interest}
                            >
                              {lead.interest || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-sm text-muted-foreground">No hay leads registrados aún.</p>
                    </div>
                  ))}

                {/* ── TERAPEUTAS ── */}
                {activeTab === "therapists" &&
                  (directory.therapists.length > 0 ? (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-primary/5 text-primary border-b border-white/60">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Nombre</th>
                          <th className="px-6 py-4 font-semibold">Email</th>
                          <th className="px-6 py-4 font-semibold">Pacientes</th>
                          <th className="px-6 py-4 font-semibold">Estado</th>
                          <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {directory.therapists.map((therapist, index) => (
                          <tr
                            key={therapist.id}
                            className={`border-b border-white/30 hover:bg-white/40 transition-colors ${index === directory.therapists.length - 1 ? "border-none" : ""}`}
                          >
                            <td className="px-6 py-4 font-semibold text-primary">
                              {therapist.full_name || "Sin nombre"}
                            </td>
                            <td className="px-6 py-4 text-slate-600">{therapist.email || "—"}</td>
                            <td className="px-6 py-4 text-slate-600">
                              <span className="inline-flex items-center gap-1.5">
                                <UserRound size={14} className="text-slate-400" />
                                {therapist.patient_count}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold border ${
                                  therapist.subscription_status === "inactive"
                                    ? "bg-slate-100 border-slate-200 text-slate-600"
                                    : "bg-emerald-100 border-emerald-200 text-emerald-700"
                                }`}
                              >
                                {therapist.subscription_status === "inactive"
                                  ? "Inactivo"
                                  : "Activo"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleToggleTherapist(therapist)}
                                disabled={busyRow === therapist.id}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-transparent disabled:opacity-50 ${
                                  therapist.subscription_status === "inactive"
                                    ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
                                    : "text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                                }`}
                              >
                                {busyRow === therapist.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : therapist.subscription_status === "inactive" ? (
                                  "Activar"
                                ) : (
                                  "Desactivar"
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No hay terapeutas registrados. Crea el primero con "Nuevo usuario".
                      </p>
                    </div>
                  ))}

                {/* ── PACIENTES ── */}
                {activeTab === "patients" &&
                  (directory.patients.length > 0 ? (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-primary/5 text-primary border-b border-white/60">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Nombre</th>
                          <th className="px-6 py-4 font-semibold">Email</th>
                          <th className="px-6 py-4 font-semibold">Plan</th>
                          <th className="px-6 py-4 font-semibold">Estado</th>
                          <th className="px-6 py-4 font-semibold">Terapeuta asignado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {directory.patients.map((pat: DirectoryPatient, index) => (
                          <tr
                            key={pat.id}
                            className={`border-b border-white/30 hover:bg-white/40 transition-colors ${index === directory.patients.length - 1 ? "border-none" : ""}`}
                          >
                            <td className="px-6 py-4 font-semibold text-primary">
                              {pat.full_name || "Sin nombre"}
                            </td>
                            <td className="px-6 py-4 text-slate-600">{pat.email || "—"}</td>
                            <td className="px-6 py-4">
                              <select
                                value={pat.plan_type}
                                disabled={busyRow === pat.id}
                                onChange={(e) =>
                                  handlePlanChange(pat.id, e.target.value as PlanType)
                                }
                                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize focus:outline-none focus:border-primary disabled:opacity-50 ${
                                  pat.plan_type === "premium"
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : pat.plan_type === "integral"
                                      ? "bg-primary/5 border-primary/20 text-primary"
                                      : pat.plan_type === "esencial"
                                        ? "bg-blue-50 border-blue-200 text-blue-700"
                                        : "bg-slate-50 border-slate-200 text-slate-600"
                                }`}
                              >
                                {PLAN_OPTIONS.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold border ${
                                  pat.subscription_status === "active"
                                    ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                                    : "bg-amber-100 border-amber-200 text-amber-700"
                                }`}
                              >
                                {pat.subscription_status === "active" ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <select
                                  value={pat.therapist_id ?? ""}
                                  disabled={busyRow === pat.id}
                                  onChange={(e) => handleAssign(pat.id, e.target.value)}
                                  className="rounded-lg border border-slate-200 bg-white/70 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-primary disabled:opacity-50 min-w-[180px]"
                                >
                                  <option value="">— Sin asignar —</option>
                                  {directory.therapists
                                    .filter((t) => t.subscription_status !== "inactive")
                                    .map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.full_name || t.email}
                                      </option>
                                    ))}
                                </select>
                                {busyRow === pat.id && (
                                  <Loader2 size={14} className="animate-spin text-primary" />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No hay pacientes registrados. Crea el primero con "Nuevo usuario".
                      </p>
                    </div>
                  ))}
              </div>
            )}

            {activeTab === "tests" && <TestSubmissionsPanel />}

            {activeTab === "comentarios" && (
              <CommentModerationQueue
                moderatorId={profile.id}
                onFeedback={(tipo, msg) => {
                  notify(tipo, msg);
                  void countPendingComments().then(setPendingComments);
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* Editor / revisión de una pieza. El admin sí puede publicar desde aquí. */}
      {contentEditor.open && (
        <ContentEditorModal
          authorId={profile.id}
          existing={contentEditor.item}
          onClose={() => {
            setContentEditor({ open: false, item: null });
            void refreshContent();
          }}
          onSaved={() => void refreshContent()}
          footerExtra={
            contentEditor.item && contentEditor.item.status !== "publicado" ? (
              <button
                onClick={() => {
                  setPublishFor(contentEditor.item);
                  setContentEditor({ open: false, item: null });
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
              >
                <CheckCircle2 size={15} /> Publicar
              </button>
            ) : null
          }
        />
      )}

      {/* Publicación: único lugar donde se fijan URL, SEO y tier */}
      {publishFor && (
        <PublishContentModal
          item={publishFor}
          onClose={() => setPublishFor(null)}
          onPublish={handlePublishWithSettings}
        />
      )}

      {/* Solicitar cambios: las notas vuelven al terapeuta autor */}
      {changesFor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Solicitar cambios</h2>
            <p className="mt-1 text-sm text-slate-500">
              El autor verá estas notas y podrá corregir y reenviar la pieza.
            </p>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              {changesFor.titulo}
            </p>
            <textarea
              rows={5}
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="Ej. Falta el bloque 'En resumen' y la sección de FAQ. El tono del cierre quedó muy clínico."
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:border-primary focus:outline-none"
            />
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setChangesFor(null);
                  setChangeNotes("");
                }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleRequestChanges()}
                disabled={!changeNotes.trim() || busyRow === changesFor.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-60"
              >
                {busyRow === changesFor.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                Enviar solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
