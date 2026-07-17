import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Loader2,
  Lock,
  Save,
  Search,
  BookOpen,
  ClipboardCheck,
  History,
  Info,
} from "lucide-react";
import { MultiSelect } from "../MultiSelect";
import {
  getLatestNote,
  getSignedNotesHistory,
  saveClinicalNote,
  getTherapistProfile,
  searchCie11,
  getCie11Catalog,
  getLatestEvaluationsByScale,
  getPatientAnamnesis,
  type Cie11Entry,
  type ClinicalNote,
  type PsychometricEvaluation,
} from "../../lib/api";

interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientId: string;
  therapistId: string;
}

const CHIEF_COMPLAINTS = [
  "Ansiedad Generalizada",
  "Depresión",
  "Ataques de Pánico",
  "Fobias",
  "TDAH",
  "TEPT",
  "TOC",
  "Duelo Complicado",
  "Ruptura de Pareja",
  "Burnout Laboral",
  "Autoestima",
  "Trastorno del Sueño",
  "Regulación Emocional",
  "Trastorno Alimentario",
  "Dependencia Emocional",
  "Ideación Suicida",
  "Problemas Familiares",
  "Crecimiento Personal",
];

const MENTAL_STATUS_OPTIONS: Record<string, string[]> = {
  Apariencia: ["Adecuada", "Descuido personal", "Extravagante"],
  Actitud: ["Colaboradora", "Suspicaz", "Defensiva", "Hostil", "Indiferente"],
  Conciencia: ["Alerta", "Somnoliento", "Estuporoso"],
  Orientación: ["Orientado (Global)", "Desorientado en tiempo", "Desorientado en espacio"],
  Atención: ["Euproséxico (Normal)", "Hipoproséxico (Distraído)", "Hiperproséxico"],
  Lenguaje: ["Tono y fluidez normal", "Bradilalia (Lento)", "Taquilalia (Rápido)", "Mutismo"],
  Afecto: ["Eutímico", "Deprimido", "Ansioso", "Irritable", "Lábil", "Aplanado"],
  Pensamiento: [
    "Lógico/Coherente",
    "Fuga de ideas",
    "Bradipsiquia",
    "Ideación Suicida",
    "Ideas obsesivas",
  ],
  Sensopercepción: ["Sin alteraciones", "Alucinaciones auditivas", "Alucinaciones visuales"],
  Juicio: ["Conservado", "Debilitado", "Alterado"],
};

const SCALE_LABELS: Record<string, string> = {
  phq9: "PHQ-9 · Depresión",
  gad7: "GAD-7 · Ansiedad",
  cssrs: "C-SSRS · Riesgo suicida",
  audit_c: "AUDIT-C · Alcohol",
  moca: "MoCA · Cognitivo",
  mmse: "MMSE · Cognitivo",
};

export function ClinicalReportModal({
  isOpen,
  onClose,
  patientName,
  patientId,
  therapistId,
}: ClinicalReportModalProps) {
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [noteId, setNoteId] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [soapData, setSoapData] = useState({ s: "", o: "", a: "", p: "" });
  const [mentalExam, setMentalExam] = useState<Record<string, string>>({});

  // Contexto clínico del paciente
  const [evaluations, setEvaluations] = useState<Record<string, PsychometricEvaluation>>({});
  const [anamnesisInfo, setAnamnesisInfo] = useState<{
    completed_at: string | null;
    audit_c_score: number | null;
  } | null>(null);
  const [history, setHistory] = useState<ClinicalNote[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // CIE-11
  const [diagnostic, setDiagnostic] = useState("");
  const [diagnosticSearch, setDiagnosticSearch] = useState("");
  const [cie11Results, setCie11Results] = useState<Cie11Entry[]>([]);
  const [isSearchingCie11, setIsSearchingCie11] = useState(false);
  const [showCie11Dropdown, setShowCie11Dropdown] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogData, setCatalogData] = useState<Record<string, Cie11Entry[]>>({});
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  const [therapistProfile, setTherapistProfile] = useState<{
    full_name: string;
    professional_card?: string;
  } | null>(null);

  const fetchCatalog = async () => {
    if (showCatalog) {
      setShowCatalog(false);
      return;
    }
    if (Object.keys(catalogData).length > 0) {
      setShowCatalog(true);
      return;
    }
    setIsLoadingCatalog(true);
    setShowCatalog(true);
    setCatalogData(await getCie11Catalog());
    setIsLoadingCatalog(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    async function fetchAll() {
      setIsLoading(true);

      const [therapist, note, evals, anamnesis, signedHistory] = await Promise.all([
        getTherapistProfile(therapistId),
        getLatestNote(patientId, therapistId),
        getLatestEvaluationsByScale(patientId),
        getPatientAnamnesis(patientId),
        getSignedNotesHistory(patientId, therapistId),
      ]);

      if (therapist) setTherapistProfile(therapist);
      setEvaluations(evals);
      setAnamnesisInfo(anamnesis);
      setHistory(signedHistory.filter((n) => !note || n.id !== note.id));

      if (note) {
        setNoteId(note.id);
        setIsSigned(note.is_signed);
        const sd = note.soap_data;
        setSoapData({ s: sd?.s ?? "", o: sd?.o ?? "", a: sd?.a ?? "", p: sd?.p ?? "" });
        setSelectedComplaints(sd?.complaints ?? []);
        setDiagnostic(sd?.diagnostic ?? "");
        setDiagnosticSearch(sd?.diagnostic ?? "");
        setMentalExam(sd?.mental_exam ?? {});
      } else {
        setNoteId(null);
        setIsSigned(false);
        setSoapData({ s: "", o: "", a: "", p: "" });
        setSelectedComplaints([]);
        setDiagnostic("");
        setDiagnosticSearch("");
        setMentalExam({});
      }
      setIsLoading(false);
    }
    fetchAll();
  }, [isOpen, patientId, therapistId]);

  // Búsqueda predictiva CIE-11 (con debounce)
  useEffect(() => {
    if (diagnosticSearch.length >= 3 && diagnosticSearch !== diagnostic) {
      const timeoutId = setTimeout(async () => {
        setIsSearchingCie11(true);
        setCie11Results(await searchCie11(diagnosticSearch));
        setIsSearchingCie11(false);
        setShowCie11Dropdown(true);
      }, 400);
      return () => clearTimeout(timeoutId);
    } else {
      setCie11Results([]);
      setShowCie11Dropdown(false);
    }
  }, [diagnosticSearch, diagnostic]);

  if (!isOpen) return null;

  const handleSave = async (sign: boolean) => {
    if (isSigned) return;

    if (sign) {
      const confirmSign = window.confirm(
        "ADVERTENCIA LEGAL:\n\nAl firmar esta nota clínica, se bloqueará de forma permanente según la Resolución 839 de 2017 del Ministerio de Salud. No podrá ser modificada ni eliminada posteriormente.\n\n¿Desea proceder y firmar electrónicamente?",
      );
      if (!confirmSign) return;
    }

    setIsSubmitting(true);
    try {
      await saveClinicalNote({
        noteId,
        patientId,
        therapistId,
        soapData: {
          ...soapData,
          complaints: selectedComplaints,
          diagnostic,
          mental_exam: mentalExam,
        },
        sign,
      });
      onClose();
    } catch (err) {
      alert(
        `No pudimos guardar el informe: ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectCie11 = (entry: Cie11Entry) => {
    const fullString = `${entry.code} - ${entry.description}`;
    setDiagnostic(fullString);
    setDiagnosticSearch(fullString);
    setShowCie11Dropdown(false);
    setShowCatalog(false);
  };

  const examCompleted = Object.values(mentalExam).filter(Boolean).length;
  const examTotal = Object.keys(MENTAL_STATUS_OPTIONS).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Informe Clínico
                {isSigned && (
                  <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                    <Lock size={12} /> Firmado e Inmutable
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-500">
                Paciente: <span className="font-semibold text-primary">{patientName}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors border ${
                  showHistory
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <History size={14} /> Notas firmadas ({history.length})
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                <Loader2 className="animate-spin" size={20} /> Cargando historia clínica...
              </div>
            </div>
          ) : showHistory ? (
            /* ── Vista: historial de notas firmadas ── */
            <div className="mx-auto max-w-4xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Historial de notas firmadas</h3>
              {history.map((n) => (
                <div key={n.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">
                      Firmada el{" "}
                      {n.signed_at ? new Date(n.signed_at).toLocaleString() : "fecha no disponible"}
                    </span>
                    <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      <Lock size={10} /> Inmutable
                    </span>
                  </div>
                  {n.soap_data?.diagnostic && (
                    <p className="text-sm font-semibold text-primary mb-2">
                      Dx: {n.soap_data.diagnostic}
                    </p>
                  )}
                  <div className="grid gap-2 text-sm text-slate-600">
                    {n.soap_data?.s && (
                      <p>
                        <strong className="text-slate-800">S:</strong> {n.soap_data.s}
                      </p>
                    )}
                    {n.soap_data?.o && (
                      <p>
                        <strong className="text-slate-800">O:</strong> {n.soap_data.o}
                      </p>
                    )}
                    {n.soap_data?.a && (
                      <p>
                        <strong className="text-slate-800">A:</strong> {n.soap_data.a}
                      </p>
                    )}
                    {n.soap_data?.p && (
                      <p>
                        <strong className="text-slate-800">P:</strong> {n.soap_data.p}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form
              id="clinical-report-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(false);
              }}
              className="mx-auto max-w-4xl space-y-10"
            >
              {/* 0. Contexto del paciente (solo lectura) */}
              <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
                  <ClipboardCheck size={16} /> Contexto del paciente
                </h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(evaluations).length > 0 ? (
                    Object.entries(evaluations).map(([scale, ev]) => (
                      <div
                        key={scale}
                        className="rounded-xl border border-white bg-white/80 px-4 py-2.5 shadow-sm"
                      >
                        <p className="text-xs font-bold text-slate-700">
                          {SCALE_LABELS[scale] ?? scale.toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {scale === "cssrs"
                            ? `Riesgo: ${ev.severity_level ?? "—"}`
                            : `${ev.total_score} pts · ${ev.severity_level ?? "—"}`}{" "}
                          · {new Date(ev.evaluated_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">
                      El paciente aún no tiene evaluaciones psicométricas registradas.
                    </p>
                  )}
                  <div className="rounded-xl border border-white bg-white/80 px-4 py-2.5 shadow-sm">
                    <p className="text-xs font-bold text-slate-700">Anamnesis</p>
                    <p className="text-xs text-slate-500">
                      {anamnesisInfo?.completed_at
                        ? `Completada el ${new Date(anamnesisInfo.completed_at).toLocaleDateString()}${
                            anamnesisInfo.audit_c_score != null
                              ? ` · AUDIT-C: ${anamnesisInfo.audit_c_score}`
                              : ""
                          }`
                        : "Pendiente por diligenciar"}
                    </p>
                  </div>
                </div>
              </section>

              {/* 1. Motivo de Consulta */}
              <section>
                <h3 className="mb-1 text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  1. Motivo de Consulta
                </h3>
                <p className="mb-4 text-xs text-slate-500 flex items-center gap-1.5">
                  <Info size={13} /> Selecciona una o varias etiquetas que resuman por qué consulta
                  el paciente.
                </p>
                <div className="max-w-2xl">
                  <MultiSelect
                    options={CHIEF_COMPLAINTS}
                    selected={selectedComplaints}
                    onChange={setSelectedComplaints}
                    placeholder={
                      isSigned
                        ? "Motivos seleccionados"
                        : "Seleccionar motivos (Ej. Depresión, TDAH)..."
                    }
                    disabled={isSigned}
                  />
                </div>
              </section>

              {/* 2. Examen del Estado Mental */}
              <section>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                  <h3 className="text-lg font-bold text-slate-900">2. Examen del Estado Mental</h3>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      examCompleted === examTotal
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {examCompleted}/{examTotal}
                  </span>
                </div>
                <p className="mb-4 text-xs text-slate-500 flex items-center gap-1.5">
                  <Info size={13} /> Registra lo observado en cada área. Puedes dejar áreas sin
                  seleccionar si no aplican a esta sesión.
                </p>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(MENTAL_STATUS_OPTIONS).map(([category, options]) => (
                    <div key={category}>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        {category}
                      </label>
                      <select
                        disabled={isSigned}
                        value={mentalExam[category] ?? ""}
                        onChange={(e) =>
                          setMentalExam({ ...mentalExam, [category]: e.target.value })
                        }
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all hover:bg-white shadow-sm disabled:opacity-60 disabled:bg-slate-100 ${
                          mentalExam[category]
                            ? "border-primary/30 bg-primary/5 text-slate-800 font-medium"
                            : "border-slate-200 bg-slate-50/50 text-slate-700"
                        }`}
                      >
                        <option value="">Seleccionar...</option>
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Evolución (Modelo SOAP) */}
              <section>
                <h3 className="mb-1 text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  3. Evolución (Modelo SOAP)
                </h3>
                <p className="mb-4 text-xs text-slate-500 flex items-center gap-1.5">
                  <Info size={13} /> Describe la sesión en los cuatro componentes. Escribe con
                  lenguaje claro: esta nota hace parte de la historia clínica.
                </p>
                <div className="space-y-6">
                  {(
                    [
                      {
                        key: "s" as const,
                        letter: "S",
                        title: "Subjetivo",
                        color: "bg-blue-100 text-blue-700",
                        placeholder:
                          "Registre las frases textuales más relevantes del paciente sobre su estado, síntomas y percepción de la semana...",
                      },
                      {
                        key: "o" as const,
                        letter: "O",
                        title: "Objetivo",
                        color: "bg-emerald-100 text-emerald-700",
                        placeholder:
                          "Describa lo observado clínicamente en la sesión: lenguaje corporal, afecto visible, nivel de colaboración y reactividad...",
                      },
                      {
                        key: "a" as const,
                        letter: "A",
                        title: "Análisis",
                        color: "bg-amber-100 text-amber-700",
                        placeholder:
                          "Interpretación clínica del avance, impresión diagnóstica, resistencias observadas y conceptualización del caso...",
                      },
                      {
                        key: "p" as const,
                        letter: "P",
                        title: "Plan",
                        color: "bg-purple-100 text-purple-700",
                        placeholder:
                          "Tareas asignadas, enfoque terapéutico para la próxima sesión y recomendaciones específicas...",
                      },
                    ] as const
                  ).map((f) => (
                    <div key={f.key}>
                      <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded ${f.color}`}
                        >
                          {f.letter}
                        </span>
                        {f.title}
                      </label>
                      <textarea
                        rows={3}
                        disabled={isSigned}
                        value={soapData[f.key]}
                        onChange={(e) => setSoapData({ ...soapData, [f.key]: e.target.value })}
                        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-400 shadow-sm disabled:opacity-60 disabled:bg-slate-100"
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. Impresión Diagnóstica */}
              <section>
                <h3 className="mb-1 text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  4. Impresión Diagnóstica (CIE-11)
                </h3>
                <p className="mb-4 text-xs text-slate-500 flex items-center gap-1.5">
                  <Info size={13} /> Busca por nombre o código, o explora el catálogo completo por
                  categorías.
                </p>
                <div className="max-w-2xl relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        disabled={isSigned}
                        value={diagnosticSearch}
                        onChange={(e) => {
                          setDiagnosticSearch(e.target.value);
                          if (diagnostic && e.target.value !== diagnostic) {
                            setDiagnostic("");
                          }
                        }}
                        placeholder={
                          isSigned
                            ? "Diagnóstico fijado"
                            : "Buscar trastorno (ej. autismo, depresión)..."
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3 py-2.5 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all hover:bg-white shadow-sm disabled:opacity-60 disabled:bg-slate-100"
                      />
                      {isSearchingCie11 && (
                        <Loader2 className="absolute right-3 top-3 h-4 w-4 text-slate-400 animate-spin" />
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isSigned}
                      onClick={fetchCatalog}
                      className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                    >
                      <BookOpen size={16} />
                      {showCatalog ? "Cerrar Catálogo" : "Ver Catálogo Completo"}
                    </button>
                  </div>

                  {showCie11Dropdown && cie11Results.length > 0 && !isSigned && (
                    <div className="absolute z-10 mt-1 w-[calc(100%-190px)] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {cie11Results.map((result) => (
                        <button
                          key={result.code}
                          type="button"
                          className="flex w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                          onClick={() => selectCie11(result)}
                        >
                          <span className="font-bold text-primary shrink-0 mr-3 w-12">
                            {result.code}
                          </span>
                          <span>{result.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showCie11Dropdown &&
                    cie11Results.length === 0 &&
                    diagnosticSearch.length >= 3 &&
                    !isSearchingCie11 &&
                    !isSigned && (
                      <div className="absolute z-10 mt-1 w-[calc(100%-190px)] rounded-xl border border-slate-200 bg-white shadow-lg p-4 text-sm text-slate-500 text-center">
                        No se encontraron coincidencias en CIE-11 para "{diagnosticSearch}"
                      </div>
                    )}

                  {showCatalog && !isSigned && (
                    <div className="mt-4 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm animate-in slide-in-from-top-2 duration-200">
                      <div className="p-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-700">
                        Explorador de Categorías CIE-11
                      </div>
                      {isLoadingCatalog ? (
                        <div className="p-8 text-center text-slate-500">
                          <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />
                          Cargando catálogo oficial...
                        </div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto p-3 space-y-3">
                          {Object.entries(catalogData).map(([category, items]) => (
                            <details
                              key={category}
                              className="group border border-slate-100 rounded-lg overflow-hidden bg-white"
                            >
                              <summary className="flex cursor-pointer items-center justify-between p-3 font-semibold text-sm text-slate-800 hover:bg-slate-50 transition-colors select-none">
                                {category}
                                <span className="text-slate-400 transition-transform duration-300 group-open:rotate-180">
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                  </svg>
                                </span>
                              </summary>
                              <div className="p-2 space-y-1 bg-slate-50/50 border-t border-slate-100">
                                {items.map((item) => (
                                  <button
                                    key={item.code}
                                    type="button"
                                    onClick={() => selectCie11(item)}
                                    className="flex w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-white hover:shadow-sm rounded-md transition-all border border-transparent hover:border-slate-200"
                                  >
                                    <span className="font-bold text-primary shrink-0 mr-3 w-12">
                                      {item.code}
                                    </span>
                                    <span>{item.description}</span>
                                  </button>
                                ))}
                              </div>
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {therapistProfile && (
              <>
                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                <span>
                  Clínico Activo:{" "}
                  <strong className="text-slate-700">{therapistProfile.full_name}</strong>
                  <span className="mx-2 opacity-50">|</span>
                  T.P. / Reg. Médico:{" "}
                  <strong className="text-slate-700">
                    {therapistProfile.professional_card || "En trámite"}
                  </strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cerrar
            </button>
            {!isSigned && !showHistory && (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Guardar Borrador
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-[1.02] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Lock size={16} />
                  )}
                  Firmar Electrónicamente
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
