import { useState, useEffect } from "react";
import { LogOut, Users, Loader2, Plus, Send, Zap, BookOpen } from "lucide-react";
import { supabase, type Profile, type PatientTherapist } from "../../lib/supabase";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

const TEMPLATES = [
  {
    label: "Ansiedad: Respiración",
    title: "Respiración Diafragmática",
    frequency: "3 veces al día o en crisis",
    description: "Inhala profundamente en 4 segundos, mantén en 4 segundos y exhala suavemente en 6 segundos. Repite el ciclo 5 veces para regular el sistema nervioso parasimpático."
  },
  {
    label: "Depresión: Activación",
    title: "Activación Conductual",
    frequency: "Diario, por las mañanas",
    description: "Realiza una caminata ligera de 15 minutos al despertar, seguida de una tarea pequeña y sencilla (ej. tender la cama) para generar inercia positiva."
  },
  {
    label: "Higiene del Sueño",
    title: "Rutina de Higiene del Sueño",
    frequency: "Diario, 1 hora antes de dormir",
    description: "Apaga pantallas 1 hora antes de acostarte. Lee un libro físico o realiza estiramientos suaves. Evita la cafeína después de las 4 PM y mantén la habitación oscura."
  }
];

const TECHNIQUES = [
  {
    title: "Reestructuración Cognitiva",
    description: "Identificación y desafío de pensamientos automáticos negativos para sustituirlos por alternativas racionales."
  },
  {
    title: "Mindfulness (Atención Plena)",
    description: "Técnica de anclaje al momento presente, observando pensamientos y sensaciones sin juzgarlos."
  },
  {
    title: "Terapia de Aceptación (ACT)",
    description: "Fomenta la flexibilidad psicológica aceptando lo incontrolable y comprometiéndose con acciones alineadas a los valores personales."
  }
];

export function TherapistDashboard({ profile, onLogout }: Props) {
  const [patients, setPatients] = useState<PatientTherapist[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchPatients() {
      const { data, error } = await supabase
        .from("patient_therapist")
        .select(`
          id,
          patient_id,
          therapist_id,
          status,
          created_at,
          patient:profiles!patient_id (
            id,
            full_name,
            email,
            plan_type,
            subscription_status
          )
        `)
        .eq("therapist_id", profile.id);

      if (!error && data) {
        setPatients(data as any);
      }
      setLoading(false);
    }
    fetchPatients();
  }, [profile.id]);

  function applyTemplate(template: typeof TEMPLATES[0]) {
    setTitle(template.title);
    setFrequency(template.frequency);
    setDescription(template.description);
  }

  async function handleAssignPlan(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg("");
    setErrorMsg("");

    if (!selectedPatientId) {
      setErrorMsg("Debes seleccionar un paciente.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("clinical_recommendations").insert({
      patient_id: selectedPatientId,
      therapist_id: profile.id,
      title,
      description,
      frequency
    });

    setSubmitting(false);

    if (error) {
      setErrorMsg("Hubo un error al asignar el plan. Verifica tu conexión.");
    } else {
      setSuccessMsg("¡Recomendación asignada correctamente!");
      setTitle("");
      setDescription("");
      setFrequency("");
      setSelectedPatientId("");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  }

  const displayName = profile.full_name ?? profile.id.slice(0, 8);

  return (
    <>
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
                <p className="text-sm text-muted-foreground animate-pulse">Cargando pacientes...</p>
              ) : patients.length > 0 ? (
                <ul className="space-y-4">
                  {patients.map((p) => {
                    const pat = p.patient as any;
                    return (
                      <li key={p.id} className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-white/60 shadow-sm transition-transform hover:scale-[1.01]">
                        <div>
                          <p className="font-bold text-primary">{pat?.full_name || pat?.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Plan: <span className="font-semibold capitalize">{pat?.plan_type}</span>
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${pat?.subscription_status === 'activate' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-amber-100 border-amber-200 text-amber-700'}`}>
                          {pat?.subscription_status === 'activate' ? "Activo" : "Inactivo"}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="p-6 text-center border border-white/40 border-dashed rounded-2xl">
                  <p className="text-sm text-muted-foreground">No tienes pacientes asignados actualmente.</p>
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: Formulario Asignar Plan */}
          <div>
            <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2">
              <Plus size={20} />
              Asignar Plan / Recomendación
            </h2>
            <div className="mt-6 card-neon-hover rounded-3xl glass-card p-6 border border-white/40">
              
              {/* Plantillas Rápidas */}
              <div className="mb-6">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1"><Zap size={14} className="text-amber-500" /> Plantillas Rápidas</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="text-xs font-semibold bg-white/50 border border-white/60 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

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
              
              <form onSubmit={handleAssignPlan} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-primary">Paciente</label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm"
                  >
                    <option value="">-- Selecciona un paciente --</option>
                    {patients.map(p => {
                      const pat = p.patient as any;
                      return (
                        <option key={p.patient_id} value={p.patient_id}>
                          {pat?.full_name || pat?.email}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-primary">Asunto</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej. Ejercicios de respiración"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-primary">Frecuencia</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej. Diario antes de dormir"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-primary">Descripción</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Instrucciones detalladas..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/50 bg-white/50 backdrop-blur px-3 py-3 text-sm focus:border-primary focus:outline-none shadow-sm resize-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || patients.length === 0}
                  className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Asignando...</> : <><Send size={16} /> Enviar Recomendación</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Inferior: Repositorio de Técnicas Clínicas */}
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <h2 className="text-xl font-bold text-primary drop-shadow-sm flex items-center gap-2 mb-6">
          <BookOpen size={20} />
          Repositorio de Técnicas Clínicas
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {TECHNIQUES.map(tech => (
            <div key={tech.title} className="card-neon-hover bg-white/40 glass-card p-5 rounded-2xl border border-white/50 shadow-sm transition-all hover:-translate-y-1">
              <h3 className="font-bold text-primary mb-2">{tech.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{tech.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
