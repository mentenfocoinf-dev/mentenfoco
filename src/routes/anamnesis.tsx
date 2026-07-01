import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { FileText, Loader2, ArrowRight, HeartPulse, ShieldAlert, Users, Pill, Brain, Plus, Trash2 } from "lucide-react";
import { MultiSelect } from "../components/MultiSelect";

export const Route = createFileRoute("/anamnesis")({
  head: () => ({
    meta: [
      { title: "Onboarding y Anamnesis — Mente en Foco" },
      { name: "description", content: "Completa tu perfil clínico para iniciar." },
    ],
  }),
  component: Anamnesis,
});

const ANTECEDENTES_MEDICOS_OPCIONES = [
  "Enfermedad cardiovascular",
  "Enfermedad tiroidea",
  "Trastorno neurológico",
  "Epilepsia",
  "Diabetes",
  "Enfermedad autoinmune",
  "Ninguno conocido",
];

const AUDIT_C_PREGUNTAS = [
  {
    texto: "¿Con qué frecuencia consumís alguna bebida alcohólica?",
    opciones: [
      "Nunca",
      "Una vez al mes o menos",
      "2 a 4 veces al mes",
      "2 a 3 veces por semana",
      "4 o más veces por semana",
    ],
  },
  {
    texto: "¿Cuántas bebidas con alcohol tomás en un día típico de consumo?",
    opciones: ["1 o 2", "3 o 4", "5 o 6", "7 a 9", "10 o más"],
  },
  {
    texto: "¿Con qué frecuencia tomás 6 o más bebidas en una sola ocasión?",
    opciones: [
      "Nunca",
      "Menos de una vez al mes",
      "Mensualmente",
      "Semanalmente",
      "A diario o casi a diario",
    ],
  },
];

interface Medicacion {
  nombre: string;
  dosis: string;
  prescriptor: string;
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-sm";
const labelClass = "text-sm font-semibold text-slate-900";

function Anamnesis() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [motivoConsulta, setMotivoConsulta] = useState("");
  const [antecedentesMedicos, setAntecedentesMedicos] = useState<string[]>([]);
  const [antecedentesMedicosOtros, setAntecedentesMedicosOtros] = useState("");
  const [medicacion, setMedicacion] = useState<Medicacion[]>([]);
  const [antPsiqPersonales, setAntPsiqPersonales] = useState("");
  const [antPsiqFamiliares, setAntPsiqFamiliares] = useState("");
  const [auditC, setAuditC] = useState<(number | null)[]>([null, null, null]);
  const [tabaco, setTabaco] = useState("");
  const [otrasSustancias, setOtrasSustancias] = useState("");
  const [tieneAutolesion, setTieneAutolesion] = useState<boolean | null>(null);
  const [detalleAutolesion, setDetalleAutolesion] = useState("");
  const [redApoyo, setRedApoyo] = useState("");
  const [cribadoAplica, setCribadoAplica] = useState(false);
  const [cambiosMemoria, setCambiosMemoria] = useState(false);
  const [familiarNoto, setFamiliarNoto] = useState(false);
  const [interfiereActividades, setInterfiereActividades] = useState(false);

  // Si ya completó el onboarding, no debería estar aquí
  if (profile?.onboarding_completed) {
    navigate({ to: "/ingresa", replace: true });
    return null;
  }

  // Si es terapeuta o admin, redirigir de vuelta al dashboard
  if (profile?.role === "therapist" || profile?.role === "admin") {
    navigate({ to: "/ingresa", replace: true });
    return null;
  }

  function addMedicacion() {
    setMedicacion((prev) => [...prev, { nombre: "", dosis: "", prescriptor: "" }]);
  }

  function updateMedicacion(index: number, field: keyof Medicacion, value: string) {
    setMedicacion((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  function removeMedicacion(index: number) {
    setMedicacion((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Por favor, ingresa tu nombre completo.");
      return;
    }
    if (!motivoConsulta.trim()) {
      setErrorMsg("Contanos brevemente el motivo de tu consulta.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const auditCRespondido = auditC.every((v) => v !== null);
    const auditCPuntaje = auditCRespondido ? (auditC as number[]).reduce((a, b) => a + b, 0) : null;

    const anamnesisData = {
      motivo_consulta: motivoConsulta.trim(),
      antecedentes_medicos: {
        seleccionados: antecedentesMedicos,
        otros: antecedentesMedicosOtros.trim(),
      },
      medicacion_actual: medicacion.filter((m) => m.nombre.trim() !== ""),
      antecedentes_psiquiatricos_personales: antPsiqPersonales.trim(),
      antecedentes_psiquiatricos_familiares: antPsiqFamiliares.trim(),
      consumo_sustancias: {
        alcohol_audit_c: { respuestas: auditC, puntaje: auditCPuntaje },
        tabaco: tabaco.trim(),
        otras_sustancias: otrasSustancias.trim(),
      },
      autolesion: {
        tiene_antecedentes: tieneAutolesion ?? false,
        detalle: detalleAutolesion.trim(),
      },
      red_apoyo: redApoyo.trim(),
      cribado_cognitivo: cribadoAplica
        ? {
            aplica: true,
            cambios_memoria: cambiosMemoria,
            familiar_noto_cambios: familiarNoto,
            interfiere_actividades: interfiereActividades,
          }
        : null,
    };

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName, onboarding_completed: true })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      const { error: anamnesisError } = await supabase.from("patient_anamnesis").upsert(
        {
          patient_id: profile.id,
          data: anamnesisData,
          audit_c_score: auditCPuntaje,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "patient_id" },
      );

      if (anamnesisError) throw anamnesisError;

      window.location.href = "/ingresa";
    } catch (err) {
      console.error("[Anamnesis] Error al guardar:", err);
      setErrorMsg("Error al guardar. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16">
      <div className="card-neon-hover w-full max-w-3xl rounded-3xl glass bg-white/60 p-10 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Bienvenido a tu Espacio</h1>
          <p className="mt-3 text-slate-600">
            Esta información nos ayuda a que tu terapeuta te conozca antes de la primera sesión. Podés
            dejar en blanco lo que no quieras compartir todavía — nada de esto bloquea tu acceso, salvo
            tu nombre y el motivo de consulta.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <SectionCard icon={<FileText size={18} />} title="Datos básicos">
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nombre completo *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María García López"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Motivo de consulta *</label>
                <textarea
                  required
                  rows={3}
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value)}
                  placeholder="¿Qué te gustaría trabajar en terapia?"
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<HeartPulse size={18} />}
            title="Antecedentes médicos generales"
            subtitle="Marcá lo que aplique. Es información opcional."
          >
            <div className="space-y-4">
              <MultiSelect
                options={ANTECEDENTES_MEDICOS_OPCIONES}
                selected={antecedentesMedicos}
                onChange={setAntecedentesMedicos}
                placeholder="Seleccionar antecedentes..."
              />
              <div>
                <label className={labelClass}>Otros antecedentes médicos</label>
                <textarea
                  rows={2}
                  value={antecedentesMedicosOtros}
                  onChange={(e) => setAntecedentesMedicosOtros(e.target.value)}
                  placeholder="Cualquier otra condición médica relevante"
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<Pill size={18} />} title="Medicación actual" subtitle="Opcional.">
            <div className="space-y-3">
              {medicacion.map((med, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <input
                    type="text"
                    value={med.nombre}
                    onChange={(e) => updateMedicacion(index, "nombre", e.target.value)}
                    placeholder="Nombre del medicamento"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={med.dosis}
                    onChange={(e) => updateMedicacion(index, "dosis", e.target.value)}
                    placeholder="Dosis"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={med.prescriptor}
                    onChange={(e) => updateMedicacion(index, "prescriptor", e.target.value)}
                    placeholder="Quién lo prescribe"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeMedicacion(index)}
                    className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Eliminar medicación"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMedicacion}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors"
              >
                <Plus size={16} /> Agregar medicación
              </button>
            </div>
          </SectionCard>

          <SectionCard icon={<Brain size={18} />} title="Antecedentes psiquiátricos">
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Personales</label>
                <textarea
                  rows={3}
                  value={antPsiqPersonales}
                  onChange={(e) => setAntPsiqPersonales(e.target.value)}
                  placeholder="Diagnósticos previos, tratamientos previos, hospitalizaciones"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Familiares</label>
                <textarea
                  rows={2}
                  value={antPsiqFamiliares}
                  onChange={(e) => setAntPsiqFamiliares(e.target.value)}
                  placeholder="Antecedentes de salud mental en tu familia"
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Users size={18} />}
            title="Consumo de sustancias"
            subtitle="Las respuestas son confidenciales y solo las ve tu terapeuta."
          >
            <div className="space-y-5">
              {AUDIT_C_PREGUNTAS.map((pregunta, qIndex) => (
                <div key={qIndex}>
                  <label className={labelClass}>{pregunta.texto}</label>
                  <select
                    value={auditC[qIndex] ?? ""}
                    onChange={(e) =>
                      setAuditC((prev) =>
                        prev.map((v, i) => (i === qIndex ? Number(e.target.value) : v)),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Seleccionar...
                    </option>
                    {pregunta.opciones.map((opcion, oIndex) => (
                      <option key={oIndex} value={oIndex}>
                        {opcion}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label className={labelClass}>Consumo de tabaco</label>
                <input
                  type="text"
                  value={tabaco}
                  onChange={(e) => setTabaco(e.target.value)}
                  placeholder="Ej. No fumo / Fumo ocasionalmente / 10 cigarrillos por día"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Otras sustancias</label>
                <input
                  type="text"
                  value={otrasSustancias}
                  onChange={(e) => setOtrasSustancias(e.target.value)}
                  placeholder="Cualquier otro consumo que quieras mencionar"
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<ShieldAlert size={18} />}
            title="Antecedentes de autolesión"
            subtitle="Preguntamos esto de rutina a todas las personas que empiezan terapia con nosotros, no por algo que hayas dicho. Tu respuesta nos ayuda a cuidarte mejor."
          >
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTieneAutolesion(false)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    tieneAutolesion === false
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  No, nunca
                </button>
                <button
                  type="button"
                  onClick={() => setTieneAutolesion(true)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    tieneAutolesion === true
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Sí, en algún momento
                </button>
              </div>
              {tieneAutolesion === true && (
                <div>
                  <label className={labelClass}>Contanos un poco más, si te sentís cómodo/a</label>
                  <textarea
                    rows={3}
                    value={detalleAutolesion}
                    onChange={(e) => setDetalleAutolesion(e.target.value)}
                    placeholder="Podés dejarlo en blanco y hablarlo directamente con tu terapeuta"
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard icon={<Users size={18} />} title="Red de apoyo">
            <textarea
              rows={2}
              value={redApoyo}
              onChange={(e) => setRedApoyo(e.target.value)}
              placeholder="¿Con quién contás hoy? Familia, pareja, amistades..."
              className={inputClass}
            />
          </SectionCard>

          <SectionCard
            icon={<Brain size={18} />}
            title="Salud cognitiva"
            subtitle="Marcá esto si sos adulto mayor o si te preocupa tu memoria o la de un familiar."
          >
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cribadoAplica}
                  onChange={(e) => setCribadoAplica(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                Quiero responder unas preguntas rápidas sobre memoria
              </label>

              {cribadoAplica && (
                <div className="space-y-3 pl-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cambiosMemoria}
                      onChange={(e) => setCambiosMemoria(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    He notado cambios en mi memoria últimamente
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={familiarNoto}
                      onChange={(e) => setFamiliarNoto(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    Algún familiar o allegado me ha comentado lo mismo
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={interfiereActividades}
                      onChange={(e) => setInterfiereActividades(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    Esto interfiere con actividades diarias (manejar dinero, tomar medicamentos, etc.)
                  </label>
                </div>
              )}
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !name.trim() || !motivoConsulta.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  Completar Perfil y Acceder <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
