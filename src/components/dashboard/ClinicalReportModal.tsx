import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Send,
  Loader2,
  Lock,
  Save,
  AlertTriangle,
  Search,
  BookOpen,
} from "lucide-react";
import { MultiSelect } from "../MultiSelect";
import { supabase } from "../../lib/supabase";

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

const MENTAL_STATUS_OPTIONS = {
  Apariencia: ["Adecuada", "Descuido personal", "Extravagante"],
  Actitud: ["Colaboradora", "Suspicaz", "Defensiva", "Hostil", "Indiferente"],
  Conciencia: ["Alerta", "Somnoliento", "Estuporoso"],
  Orientación: ["Orientado (Global)", "Desorientado en tiempo", "Desorientado en espacio"],
  Atención: ["Euproséxico (Normal)", "Hipoproséxico (Distraído)", "Hiperproséxico"],
  Lenguaje: ["Tono y fluidez normal", "Bradilalia (Lento)", "Taquilalia (Rápido)", "Mutismo"],
  Afecto: ["Eutímico", "Deprimido", "Ansioso", "Irritable", "Labil", "Aplanado"],
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

  // CIE-11 Predictive Search State
  const [diagnostic, setDiagnostic] = useState("");
  const [diagnosticSearch, setDiagnosticSearch] = useState("");
  const [cie11Results, setCie11Results] = useState<{ code: string; description: string }[]>([]);
  const [isSearchingCie11, setIsSearchingCie11] = useState(false);
  const [showCie11Dropdown, setShowCie11Dropdown] = useState(false);

  // CIE-11 Catalog State
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogData, setCatalogData] = useState<
    Record<string, { code: string; description: string }[]>
  >({});
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
    const { data } = await supabase.from("cie11_directory").select("*").order("category");
    if (data) {
      const grouped = data.reduce((acc: any, curr: any) => {
        const cat = curr.category || "Otras condiciones clínicas";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(curr);
        return acc;
      }, {});
      setCatalogData(grouped);
    }
    setIsLoadingCatalog(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    async function fetchNote() {
      setIsLoading(true);
      // Fetch Therapist Profile
      const { data: therapistData } = await supabase
        .from("profiles")
        .select("full_name, professional_card")
        .eq("id", therapistId)
        .single();

      if (therapistData) {
        setTherapistProfile(therapistData as any);
      }

      // Fetch Note
      const { data, error } = await supabase
        .from("clinical_notes")
        .select("*")
        .eq("patient_id", patientId)
        .eq("therapist_id", therapistId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setNoteId(data.id);
        setIsSigned(data.is_signed);
        if (data.soap_data) {
          setSoapData({
            s: data.soap_data.s || "",
            o: data.soap_data.o || "",
            a: data.soap_data.a || "",
            p: data.soap_data.p || "",
          });
          setSelectedComplaints(data.soap_data.complaints || []);
          setDiagnostic(data.soap_data.diagnostic || "");
          setDiagnosticSearch(data.soap_data.diagnostic || "");
        }
      } else {
        setNoteId(null);
        setIsSigned(false);
        setSoapData({ s: "", o: "", a: "", p: "" });
        setSelectedComplaints([]);
        setDiagnostic("");
        setDiagnosticSearch("");
      }
      setIsLoading(false);
    }
    fetchNote();
  }, [isOpen, patientId, therapistId]);

  // CIE-11 Search Effect
  useEffect(() => {
    if (diagnosticSearch.length >= 3 && diagnosticSearch !== diagnostic) {
      const fetchCie11 = async () => {
        setIsSearchingCie11(true);
        const { data } = await supabase
          .from("cie11_directory")
          .select("code, description")
          .or(`code.ilike.%${diagnosticSearch}%,description.ilike.%${diagnosticSearch}%`)
          .limit(15);

        if (data) setCie11Results(data);
        setIsSearchingCie11(false);
        setShowCie11Dropdown(true);
      };

      const timeoutId = setTimeout(fetchCie11, 400); // debounce
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

    const payload = {
      patient_id: patientId,
      therapist_id: therapistId,
      soap_data: {
        complaints: selectedComplaints,
        s: soapData.s,
        o: soapData.o,
        a: soapData.a,
        p: soapData.p,
        diagnostic: diagnostic,
      },
      is_signed: sign,
      signed_at: sign ? new Date().toISOString() : null,
    };

    if (noteId) {
      await supabase.from("clinical_notes").update(payload).eq("id", noteId);
    } else {
      await supabase.from("clinical_notes").insert(payload);
    }

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Informe Clínico Inteligente
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
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                <Loader2 className="animate-spin" size={20} /> Cargando historia clínica...
              </div>
            </div>
          ) : (
            <form
              id="clinical-report-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(false);
              }}
              className="mx-auto max-w-4xl space-y-12"
            >
              {/* 1. Motivo de Consulta */}
              <section>
                <h3 className="mb-4 text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  1. Motivo de Consulta
                </h3>
                <div className="max-w-2xl">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Etiquetas Clínicas
                  </label>
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
                <h3 className="mb-4 text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  2. Examen del Estado Mental
                </h3>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(MENTAL_STATUS_OPTIONS).map(([category, options]) => (
                    <div key={category}>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        {category}
                      </label>
                      <select
                        disabled={isSigned}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all hover:bg-white shadow-sm disabled:opacity-60 disabled:bg-slate-100"
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
                <h3 className="mb-4 text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  3. Evolución (Modelo SOAP)
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-700">
                        S
                      </span>
                      Subjetivo
                    </label>
                    <textarea
                      rows={3}
                      disabled={isSigned}
                      value={soapData.s}
                      onChange={(e) => setSoapData({ ...soapData, s: e.target.value })}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-400 shadow-sm disabled:opacity-60 disabled:bg-slate-100"
                      placeholder="Registre las frases textuales más relevantes del paciente sobre su estado, síntomas y percepción de la semana..."
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-emerald-700">
                        O
                      </span>
                      Objetivo
                    </label>
                    <textarea
                      rows={3}
                      disabled={isSigned}
                      value={soapData.o}
                      onChange={(e) => setSoapData({ ...soapData, o: e.target.value })}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-400 shadow-sm disabled:opacity-60 disabled:bg-slate-100"
                      placeholder="Describa lo observado clínicamente en la sesión: lenguaje corporal, afecto visible, nivel de colaboración y reactividad..."
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-700">
                        A
                      </span>
                      Análisis
                    </label>
                    <textarea
                      rows={3}
                      disabled={isSigned}
                      value={soapData.a}
                      onChange={(e) => setSoapData({ ...soapData, a: e.target.value })}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-400 shadow-sm disabled:opacity-60 disabled:bg-slate-100"
                      placeholder="Interpretación clínica del avance, impresión diagnóstica, resistencias observadas y conceptualización del caso..."
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-purple-100 text-purple-700">
                        P
                      </span>
                      Plan
                    </label>
                    <textarea
                      rows={3}
                      disabled={isSigned}
                      value={soapData.p}
                      onChange={(e) => setSoapData({ ...soapData, p: e.target.value })}
                      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-slate-400 shadow-sm disabled:opacity-60 disabled:bg-slate-100"
                      placeholder="Tareas asignadas, enfoque terapéutico para la próxima sesión y recomendaciones específicas..."
                    />
                  </div>
                </div>
              </section>

              {/* 4. Impresión Diagnóstica */}
              <section>
                <h3 className="mb-4 text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
                  4. Impresión Diagnóstica (CIE-11)
                </h3>
                <div className="max-w-2xl relative">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Búsqueda Predictiva de Diagnóstico
                  </label>

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
                            setDiagnostic(""); // reset exact match if user types
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

                  {/* Dropdown Results */}
                  {showCie11Dropdown && cie11Results.length > 0 && !isSigned && (
                    <div className="absolute z-10 mt-1 w-[calc(100%-190px)] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {cie11Results.map((result) => (
                        <button
                          key={result.code}
                          type="button"
                          className="flex w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                          onClick={() => {
                            const fullString = `${result.code} - ${result.description}`;
                            setDiagnostic(fullString);
                            setDiagnosticSearch(fullString);
                            setShowCie11Dropdown(false);
                            setShowCatalog(false);
                          }}
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

                  {/* Catalog Accordion */}
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
                                    onClick={() => {
                                      const fullString = `${item.code} - ${item.description}`;
                                      setDiagnostic(fullString);
                                      setDiagnosticSearch(fullString);
                                      setShowCatalog(false);
                                    }}
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

        {/* Footer Actions & Metadata */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 backdrop-blur">
          {/* Metadata Clínico */}
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
            {!isSigned && (
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
