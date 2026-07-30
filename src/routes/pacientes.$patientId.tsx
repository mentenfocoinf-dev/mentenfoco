// ============================================================================
// Ficha de paciente (vista del terapeuta).
//
// Es una ruta propia y no una vista interna de TherapistDashboard: así cada
// paciente tiene URL propia, el botón atrás funciona y la ficha se puede
// enlazar. Como los dashboards viven dentro de /ingresa según el rol, esta ruta
// hace su propia guardia: solo terapeuta y admin.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronLeft,
  ClipboardList,
  FileText,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { TrendChart } from "../components/dashboard/TrendChart";
import { ClinicalDocumentModal } from "../components/dashboard/ClinicalDocumentModal";
import {
  ALERT_RESOLUTION_LABELS,
  DOCUMENT_BADGE_CLASSES,
  DOCUMENT_LABELS,
  formatConsentDate,
  getClinicalConsentStateById,
  getPatientAlerts,
  getPatientAnamnesis,
  getPatientDocuments,
  getPatientEvaluations,
  getPatientPlanUsage,
  getPatientProfile,
  latestSignedValoracion,
  PLAN_LABELS,
  type AlertResolutionAction,
  type ClinicalConsentState,
  type ClinicalDocument,
  type DocumentType,
  type PatientAlert,
  type PlanUsage,
  type PsychometricEvaluation,
} from "../lib/api";
import type { Profile } from "../lib/supabase";

export const Route = createFileRoute("/pacientes/$patientId")({
  head: () => ({ meta: [{ title: "Ficha de paciente — Mente en Foco" }] }),
  component: FichaPaciente,
});

function Card({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-neon-hover rounded-3xl glass-card border border-white/40 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          {icon} {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function FichaPaciente() {
  const { patientId } = Route.useParams();
  const { profile, loading: authLoading } = useAuth();

  const [patient, setPatient] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [evaluations, setEvaluations] = useState<PsychometricEvaluation[]>([]);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [anamnesis, setAnamnesis] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  // Respaldo ético-legal del proceso (Ley 1090): el profesional tiene que poder
  // verificar de un vistazo que el consentimiento existe y sigue vigente.
  const [consent, setConsent] = useState<ClinicalConsentState | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeDoc, setActiveDoc] = useState<ClinicalDocument | null>(null);
  const [newDocType, setNewDocType] = useState<DocumentType | null>(null);

  const load = useCallback(async () => {
    const p = await getPatientProfile(patientId);
    if (!p) {
      setLoading(false);
      return;
    }
    const [docs, evals, alrt, anam, use, cons] = await Promise.all([
      getPatientDocuments(patientId),
      getPatientEvaluations(patientId),
      getPatientAlerts(patientId),
      getPatientAnamnesis(patientId),
      getPatientPlanUsage(patientId, p.plan_type ?? "free"),
      getClinicalConsentStateById(patientId),
    ]);
    setPatient(p);
    setDocuments(docs);
    setEvaluations(evals);
    setAlerts(alrt);
    setAnamnesis((anam?.data as Record<string, unknown>) ?? null);
    setUsage(use);
    setConsent(cons);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Guardia de rol: la ficha contiene historia clínica de otra persona.
  if (!profile || (profile.role !== "therapist" && profile.role !== "admin")) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Lock className="text-slate-400" size={32} />
        <p className="text-sm text-slate-600">No tienes acceso a esta ficha.</p>
        <Link to="/ingresa" className="text-sm font-semibold text-primary hover:underline">
          Volver al portal
        </Link>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-slate-600">No encontramos este paciente.</p>
        <Link to="/ingresa" className="text-sm font-semibold text-primary hover:underline">
          Volver al portal
        </Link>
      </div>
    );
  }

  const valoracion = latestSignedValoracion(documents);
  const motivo =
    (valoracion?.soap_data as Record<string, string> | null)?.s ||
    (anamnesis?.motivo_consulta as string) ||
    "Sin motivo de consulta registrado.";
  const diagnostico =
    documents.find(
      (d) =>
        d.is_signed &&
        d.document_type !== "evolucion" &&
        (d.soap_data as Record<string, string> | null)?.diagnostic,
    )?.soap_data as Record<string, string> | undefined;

  const pendingAlerts = alerts.filter((a) => !a.resolved_at);
  const hasSignedValoracion = documents.some(
    (d) => d.document_type === "valoracion" && d.is_signed,
  );

  /** Borrador del informe: resume la valoración y las evoluciones ya firmadas
   *  para que el terapeuta no reescriba de cero. Todo queda editable. */
  function buildInformeDraft(): Record<string, unknown> {
    const val = valoracion?.soap_data as Record<string, string> | undefined;
    const evols = documents
      .filter((d) => d.document_type === "evolucion" && d.is_signed)
      .slice(0, 8)
      .reverse();

    const resumenEvol = evols
      .map((d) => {
        const sd = d.soap_data as Record<string, string> | null;
        const fecha = new Date(d.created_at).toLocaleDateString("es-CO");
        return `${fecha}: ${sd?.resumen || sd?.s || "Sin resumen."}`;
      })
      .join("\n");

    return {
      resumen_valoracion: [val?.s, val?.a].filter(Boolean).join("\n\n"),
      resumen_evolucion: resumenEvol,
      diagnostic: diagnostico?.diagnostic ?? "",
      conclusiones: "",
      recomendaciones: "",
      evaluaciones_referenciadas: evaluations
        .slice(0, 6)
        .map(
          (e) =>
            `${e.scale_type.toUpperCase()}: ${e.total_score} pts (${e.severity_level}) — ${new Date(
              e.evaluated_at,
            ).toLocaleDateString("es-CO")}`,
        ),
    };
  }

  return (
    <section className="gradient-soft min-h-[85vh] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/ingresa"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-primary"
        >
          <ChevronLeft size={15} /> Volver a mis pacientes
        </Link>

        {/* Encabezado */}
        <div className="card-neon-hover mb-6 rounded-3xl glass-card border border-white/40 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {patient.full_name || patient.email}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{patient.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {PLAN_LABELS[patient.plan_type ?? "free"]}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    patient.subscription_status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {patient.subscription_status === "active" ? "Activo" : "Inactivo"}
                </span>
                {pendingAlerts.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                    <AlertTriangle size={11} /> {pendingAlerts.length} alerta(s) pendiente(s)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/50 bg-white/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Motivo de consulta
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{motivo}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Documentos */}
            <Card title="Documentos clínicos" icon={<FileText size={20} />}>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setNewDocType("valoracion")}
                  disabled={hasSignedValoracion}
                  title={
                    hasSignedValoracion
                      ? "Este paciente ya tiene una valoración firmada. Registra una evolución o genera un informe."
                      : undefined
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={13} /> Nueva valoración
                </button>
                <button
                  onClick={() => setNewDocType("evolucion")}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                >
                  <Plus size={13} /> Nueva evolución
                </button>
                <button
                  onClick={() => setNewDocType("informe")}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <Plus size={13} /> Generar informe
                </button>
              </div>

              {documents.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  Todavía no hay documentos para este paciente.
                </p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <button
                        onClick={() => setActiveDoc(doc)}
                        className="glow-hover flex w-full items-center gap-3 rounded-2xl border border-white/50 bg-white/50 p-3 text-left"
                      >
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${DOCUMENT_BADGE_CLASSES[doc.document_type]}`}
                        >
                          {DOCUMENT_LABELS[doc.document_type]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {(doc.soap_data as Record<string, string> | null)?.diagnostic ||
                              (doc.soap_data as Record<string, string> | null)?.resumen ||
                              "Sin diagnóstico registrado"}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {new Date(doc.created_at).toLocaleDateString("es-CO", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                        {doc.is_signed ? (
                          <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <Lock size={10} /> Firmado
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            Borrador
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Tendencia */}
            <Card title="Evolución psicométrica" icon={<TrendingUp size={20} />}>
              <TrendChart
                evaluations={evaluations}
                emptyMessage="Este paciente aún no tiene suficientes evaluaciones PHQ-9 o GAD-7 para mostrar una tendencia."
              />
            </Card>

            {/* Resumen clínico */}
            <Card title="Resumen clínico" icon={<ClipboardList size={20} />}>
              <div className="space-y-3 text-sm">
                <ConsentimientoClinicoEstado estado={consent} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Diagnóstico activo
                  </p>
                  <p className="mt-0.5 text-slate-700">
                    {diagnostico?.diagnostic || "Sin diagnóstico registrado."}
                  </p>
                </div>
                {anamnesis && (
                  <>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Antecedentes psiquiátricos
                      </p>
                      <p className="mt-0.5 text-slate-700">
                        {(anamnesis.antecedentes_psiquiatricos_personales as string) ||
                          "Sin antecedentes registrados."}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Red de apoyo
                      </p>
                      <p className="mt-0.5 text-slate-700">
                        {(anamnesis.red_apoyo as string) || "No registrada."}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Alertas de crisis
                  </p>
                  {alerts.length === 0 ? (
                    <p className="mt-0.5 text-slate-700">Sin alertas registradas.</p>
                  ) : (
                    <ul className="mt-1 space-y-1.5">
                      {alerts.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-slate-700">
                            {new Date(a.created_at).toLocaleDateString("es-CO")}
                          </span>
                          {a.resolved_at ? (
                            <span className="ml-2 text-emerald-700">
                              Atendida —{" "}
                              {ALERT_RESOLUTION_LABELS[
                                a.resolution_action as AlertResolutionAction
                              ] ?? a.resolution_action}
                            </span>
                          ) : (
                            <span className="ml-2 font-bold text-red-600">Pendiente</span>
                          )}
                          {a.resolution_notes && (
                            <p className="mt-1 text-slate-500">{a.resolution_notes}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Columna lateral */}
          <div className="space-y-6">
            <Card title="Uso del plan" icon={<CalendarCheck size={20} />}>
              {usage && (
                <>
                  <p className="text-xs capitalize text-slate-500">{usage.periodLabel}</p>
                  {usage.quota === null ? (
                    <p className="mt-2 text-sm text-slate-700">
                      El plan gratuito no incluye sesiones terapéuticas.
                      <span className="mt-1 block text-xs text-slate-500">
                        Sesiones completadas este mes: {usage.used}
                      </span>
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        {usage.used}
                        <span className="text-lg text-slate-400"> / {usage.quota}</span>
                      </p>
                      <p className="text-xs text-slate-500">sesiones completadas este mes</p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(100, (usage.used / usage.quota) * 100)}%`,
                          }}
                        />
                      </div>
                      {usage.used >= usage.quota && (
                        <p className="mt-2 text-xs font-semibold text-amber-700">
                          Cupo del mes agotado.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </Card>

            <Card title="Evaluaciones aplicadas" icon={<ShieldCheck size={20} />}>
              {evaluations.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Sin evaluaciones aún.</p>
              ) : (
                <ul className="space-y-1.5">
                  {evaluations.slice(0, 8).map((e, i) => (
                    <li
                      key={`${e.scale_type}-${e.evaluated_at}-${i}`}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold uppercase text-slate-700">
                        {e.scale_type}
                      </span>
                      <span className="text-slate-500">
                        {e.total_score} pts · {e.severity_level}
                      </span>
                      <span className="text-slate-400">
                        {new Date(e.evaluated_at).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      {(activeDoc || newDocType) && (
        <ClinicalDocumentModal
          documentType={activeDoc?.document_type ?? newDocType!}
          existing={activeDoc}
          patient={patient}
          therapist={profile}
          draft={!activeDoc && newDocType === "informe" ? buildInformeDraft() : null}
          onClose={() => {
            setActiveDoc(null);
            setNewDocType(null);
          }}
          onSaved={() => {
            setActiveDoc(null);
            setNewDocType(null);
            void load();
          }}
        />
      )}
    </section>
  );
}

/**
 * Estado del consentimiento informado clínico (Ley 1090).
 *
 * Tres estados con peso distinto, y por eso tres tratamientos visuales:
 * aceptado es información de respaldo (verde discreto); pendiente es algo que
 * falta (ámbar); revocado es una ALERTA, porque el proceso clínico no debería
 * continuar sin consentimiento vigente y el profesional tiene que enterarse sin
 * buscarlo.
 */
function ConsentimientoClinicoEstado({ estado }: { estado: ClinicalConsentState | null }) {
  if (!estado || estado.estado === "no_aplica") return null;

  if (estado.estado === "revocado") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
          <AlertTriangle size={13} /> Consentimiento clínico revocado
        </p>
        <p className="mt-1 text-xs leading-relaxed text-red-800">
          El paciente revocó su consentimiento el{" "}
          {formatConsentDate(estado.consent.revoked_at as string)}. El proceso de atención no
          debería continuar sin consentimiento vigente.
        </p>
      </div>
    );
  }

  if (estado.estado === "pendiente") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
          Consentimiento informado clínico
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Pendiente — se le pedirá al paciente al entrar a su portal.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
        Consentimiento informado clínico
      </p>
      <p className="mt-1 text-xs text-emerald-800">
        Aceptado el {formatConsentDate(estado.consent.accepted_at)}, versión{" "}
        {estado.consent.version}.
      </p>
    </div>
  );
}
