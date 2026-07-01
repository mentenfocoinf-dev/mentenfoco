import { useState, useEffect } from "react";
import { LogOut, Users, Loader2, Plus, Send, BookOpen, FileText } from "lucide-react";
import { supabase, type Profile, type PatientTherapist } from "../../lib/supabase";
import { ClinicalReportModal } from "./ClinicalReportModal";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

export function TherapistDashboard({ profile, onLogout }: Props) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReportPatient, setActiveReportPatient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Prescriptions Catalog State
  const [prescriptionsCatalog, setPrescriptionsCatalog] = useState<any[]>([]);

  // Assignment Form State
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPrescriptionIds, setSelectedPrescriptionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchDashboardData() {
      // Fetch Patients
      const { data: patientsData, error: patientsError } = await supabase
        .from("patient_therapist")
        .select(
          `
          patient_id,
          therapist_id,
          created_at,
          patient:profiles!patient_therapist_patient_id_fkey (
            id,
            full_name,
            plan_type,
            subscription_status
          )
        `,
        )
        .eq("therapist_id", profile.id);

      if (patientsError) {
        console.error("Error fetching patients:", patientsError);
      }
      if (patientsData) {
        console.log("Patients loaded:", patientsData);
        setPatients(patientsData);
      }

      // Fetch Prescriptions Catalog
      const { data: presData } = await supabase
        .from("clinical_prescriptions")
        .select("*")
        .order("titulo");

      if (presData) {
        setPrescriptionsCatalog(presData);
      }

      setLoading(false);
    }
    fetchDashboardData();
  }, [profile.id]);

  const openReportModal = (patientId: string, patientName: string) => {
    setActiveReportPatient({ id: patientId, name: patientName });
    setIsReportModalOpen(true);
  };

  async function handleAssignPlan(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg("");
    setErrorMsg("");

    if (!selectedPatientId || selectedPrescriptionIds.length === 0) {
      setErrorMsg("Debes seleccionar un paciente y al menos una tarea clínica.");
      setSubmitting(false);
      return;
    }

    const payload = selectedPrescriptionIds.map((id) => ({
      patient_id: selectedPatientId,
      therapist_id: profile.id,
      prescription_id: id,
      assigned_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("patient_prescriptions").insert(payload);

    setSubmitting(false);

    if (error) {
      setErrorMsg("Hubo un error al asignar las tareas. Verifica tu conexión.");
      console.error(error);
    } else {
      setSuccessMsg("¡Tareas clínicas asignadas correctamente al paciente!");
      setSelectedPrescriptionIds([]);
      setSelectedPatientId("");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  }

  const displayName = profile.full_name || profile.email || "Terapeuta";
  const selectedPrescriptions = prescriptionsCatalog.filter((p) =>
    selectedPrescriptionIds.includes(p.id),
  );

  return (
    <>
      {activeReportPatient && (
        <ClinicalReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          patientName={activeReportPatient.name}
          patientId={activeReportPatient.id}
          therapistId={profile.id}
        />
      )}

      <section className="gradient-soft border-b border-white/30 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex items-center justify-between glass-card p-6 rounded-3xl border border-white/40 shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Portal del Profesional</p>
              <h1 className="text-3xl font-bold text-primary drop-shadow-sm">{displayName}</h1>
              <span className="mt-1 inline-block rounded-full bg-blue-100 border border-blue-200 px-3 py-0.5 text-xs font-semibold text-blue-700">
                Terapeuta
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
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Panel izquierdo: Mis Pacientes */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2">
              <Users size={20} />
              Mis Pacientes
            </h2>
            <div className="card-neon-hover rounded-3xl glass-card p-6 border border-white/40 overflow-hidden">
              {loading ? (
                <p className="text-sm text-muted-foreground animate-pulse">
                  Cargando datos del dashboard...
                </p>
              ) : patients.length > 0 ? (
                <ul className="space-y-4">
                  {patients.map((p) => {
                    const pat = p.patient as any;
                    const patName = pat?.full_name || pat?.email;
                    return (
                      <li
                        key={p.patient_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/50 rounded-2xl border border-white/60 shadow-sm transition-transform hover:scale-[1.01]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-primary">{patName}</p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${pat?.subscription_status === "active" ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-amber-100 border-amber-200 text-amber-700"}`}
                            >
                              {pat?.subscription_status === "active" ? "Activo" : "Inactivo"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Plan: <span className="font-semibold capitalize">{pat?.plan_type}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => openReportModal(p.patient_id, patName)}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                        >
                          <FileText size={14} /> Informe Clínico
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-6 text-center border border-white/40 border-dashed rounded-2xl">
                  <p className="text-sm text-muted-foreground">
                    No tienes pacientes asignados actualmente.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: Formulario Asignar Prescripción */}
          <div>
            <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2">
              <Plus size={20} />
              Asignar Tarea de Intervención
            </h2>
            <div className="mt-6 card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              {successMsg && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
                  {successMsg}
                </div>
              )}
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleAssignPlan} className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-primary">
                    1. Seleccionar Paciente
                  </label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
                  >
                    <option value="">-- Selecciona un paciente --</option>
                    {patients.map((p) => {
                      const pat = p.patient as any;
                      return (
                        <option key={p.patient_id} value={p.patient_id}>
                          {pat?.full_name || pat?.email}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-primary">
                    2. Seleccionar Tarea del Catálogo
                  </label>
                  <select
                    required
                    multiple
                    value={selectedPrescriptionIds}
                    onChange={(e) => {
                      const options = Array.from(
                        e.target.selectedOptions,
                        (option) => option.value,
                      );
                      setSelectedPrescriptionIds(options);
                    }}
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm min-h-[120px]"
                  >
                    {prescriptionsCatalog.map((pres) => (
                      <option
                        key={pres.id}
                        value={pres.id}
                        className="p-2 border-b border-white/20 last:border-0 hover:bg-primary/10"
                      >
                        {pres.titulo}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Mantén presionado Ctrl (o Cmd) para seleccionar múltiples tareas.
                  </p>
                </div>

                {/* Vista Previa de la Instrucción */}
                {selectedPrescriptions.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                      Tareas Seleccionadas ({selectedPrescriptions.length})
                    </p>
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                      {selectedPrescriptions.map((sp) => (
                        <div
                          key={sp.id}
                          className="border-b border-primary/10 pb-3 last:border-0 last:pb-0"
                        >
                          <p className="text-sm font-bold text-slate-800">{sp.titulo}</p>
                          <p className="text-xs text-slate-600 italic mt-1 line-clamp-2">
                            "{sp.instruccion_paciente}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    submitting || patients.length === 0 || selectedPrescriptionIds.length === 0
                  }
                  className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Asignando...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Enviar Prescripción
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Inferior: Catálogo de Tareas Clínicas (Solo Lectura) */}
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2 mb-6">
          <BookOpen size={20} />
          Directorio de Tareas Clínicas
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {prescriptionsCatalog.length > 0 ? (
            prescriptionsCatalog.map((tech) => (
              <div
                key={tech.id}
                className="card-neon-hover flex flex-col justify-between bg-white/40 glass-card p-5 rounded-2xl border border-white/50 shadow-sm transition-all hover:-translate-y-1"
              >
                <div>
                  <h3 className="font-bold text-primary mb-2">{tech.titulo}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {tech.objetivo_clinico}
                  </p>
                </div>
                <p className="text-xs text-slate-500 border-t border-slate-200/60 pt-3">
                  <span className="font-semibold text-slate-400">Instrucción:</span>{" "}
                  {tech.instruccion_paciente.substring(0, 100)}...
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground col-span-3">
              Cargando directorio clínico...
            </p>
          )}
        </div>
      </section>
    </>
  );
}
