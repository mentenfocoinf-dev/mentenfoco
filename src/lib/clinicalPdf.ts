// ============================================================================
// Exportación a PDF de documentos clínicos firmados.
//
// Se genera 100% en el navegador: jsPDF se carga por import dinámico dentro de
// la función, nunca en el módulo. La app hace SSR (TanStack Start sobre
// Cloudflare Workers) y jsPDF toca APIs de navegador, así que importarlo arriba
// rompería el render del servidor. Al cargarse solo en el clic, el runtime de
// borde nunca lo ve y la restricción de compatibilidad no aplica.
//
// El PDF se arma exclusivamente con datos ya persistidos y firmados: no calcula
// ni infiere nada en el momento.
// ============================================================================
import {
  DOCUMENT_LABELS,
  type ClinicalDocument,
  type DocumentType,
  type EvolucionData,
  type InformeData,
  type TreatmentPlan,
} from "./api";

export interface PdfPatient {
  full_name?: string | null;
  email?: string | null;
  cedula?: string | null;
}

export interface PdfTherapist {
  full_name?: string | null;
  professional_card?: string | null;
}

const MARGIN = 18;
const LINE = 5.5;

/** Etiquetas legibles de los campos de cada tipo, en el orden de lectura. */
const FIELD_LABELS: Record<DocumentType, [string, string][]> = {
  valoracion: [
    ["s", "Subjetivo (motivo y relato)"],
    ["o", "Objetivo (observación clínica)"],
    ["a", "Análisis"],
    ["p", "Plan"],
  ],
  evolucion: [
    ["presentacion", "Presentación"],
    ["orientacion", "Orientación"],
    ["estado_animo", "Estado de ánimo"],
    ["adherencia_tareas", "Adherencia a tareas"],
    ["resumen", "Resumen de la sesión"],
    ["plan_proxima_sesion", "Plan para la próxima sesión"],
  ],
  informe: [
    ["resumen_valoracion", "Resumen de la valoración"],
    ["resumen_evolucion", "Resumen de la evolución"],
    ["conclusiones", "Conclusiones"],
    ["recomendaciones", "Recomendaciones"],
  ],
};

export async function downloadClinicalDocumentPdf(params: {
  doc: ClinicalDocument;
  patient: PdfPatient;
  therapist: PdfTherapist;
}) {
  const { doc, patient, therapist } = params;

  if (!doc.is_signed) {
    // Doble barrera: la UI ya oculta el botón, pero un documento sin firmar no
    // debe poder salir de la plataforma con apariencia de definitivo.
    throw new Error("Solo se pueden exportar documentos firmados.");
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  /** Salta de página cuando el bloque siguiente no cabe. */
  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  function heading(text: string, size = 11) {
    ensureSpace(LINE * 2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size);
    pdf.setTextColor(30, 41, 59);
    pdf.text(text, MARGIN, y);
    y += LINE;
  }

  function paragraph(text: string) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85);
    const lines = pdf.splitTextToSize(text, usableWidth) as string[];
    for (const line of lines) {
      ensureSpace(LINE);
      pdf.text(line, MARGIN, y);
      y += LINE;
    }
  }

  function divider() {
    ensureSpace(4);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 4;
  }

  // ── Encabezado ────────────────────────────────────────────────────────────
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(30, 41, 59);
  pdf.text("Mente en Foco", MARGIN, y);
  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(DOCUMENT_LABELS[doc.document_type].toUpperCase(), MARGIN, y);
  y += 7;
  divider();

  const signedAt = doc.signed_at ? new Date(doc.signed_at) : new Date(doc.created_at);
  const meta: [string, string][] = [
    ["Paciente", patient.full_name || patient.email || "—"],
    ["Identificación", patient.cedula || "No registrada"],
    ["Profesional", therapist.full_name || "—"],
    ["Tarjeta profesional", therapist.professional_card || "No registrada"],
    ["Fecha de firma", signedAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })],
  ];

  pdf.setFontSize(9);
  for (const [label, value] of meta) {
    ensureSpace(LINE);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${label}:`, MARGIN, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 41, 59);
    pdf.text(String(value), MARGIN + 38, y);
    y += LINE;
  }
  y += 2;
  divider();

  // ── Contenido según el tipo ───────────────────────────────────────────────
  const data = (doc.soap_data ?? {}) as Record<string, unknown>;

  const diagnostic = typeof data.diagnostic === "string" ? data.diagnostic : "";
  if (diagnostic) {
    heading("Diagnóstico");
    paragraph(diagnostic);
    y += 2;
  }

  for (const [key, label] of FIELD_LABELS[doc.document_type]) {
    const raw = data[key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    heading(label);
    paragraph(value);
    y += 2;
  }

  // Examen mental (solo valoración)
  const mentalExam = data.mental_exam as Record<string, string> | undefined;
  if (doc.document_type === "valoracion" && mentalExam && Object.keys(mentalExam).length > 0) {
    heading("Examen mental");
    for (const [category, value] of Object.entries(mentalExam)) {
      if (!value) continue;
      paragraph(`${category}: ${value}`);
    }
    y += 2;
  }

  // Plan de tratamiento (solo valoración)
  const plan = doc.treatment_plan as TreatmentPlan | null;
  if (doc.document_type === "valoracion" && plan) {
    heading("Plan de tratamiento");
    if (plan.objetivos?.length) {
      paragraph("Objetivos:");
      plan.objetivos.forEach((o, i) => paragraph(`   ${i + 1}. ${o}`));
    }
    if (plan.modalidad) paragraph(`Modalidad: ${plan.modalidad}`);
    if (plan.frecuencia_sugerida) paragraph(`Frecuencia sugerida: ${plan.frecuencia_sugerida}`);
    if (plan.pronostico) paragraph(`Pronóstico: ${plan.pronostico}`);
    y += 2;
  }

  // Evaluaciones referenciadas (solo informe)
  const referenced = (data.evaluaciones_referenciadas as string[] | undefined) ?? [];
  if (doc.document_type === "informe" && referenced.length > 0) {
    heading("Evaluaciones referenciadas");
    referenced.forEach((r) => paragraph(`• ${r}`));
    y += 2;
  }

  // ── Pie legal ─────────────────────────────────────────────────────────────
  ensureSpace(LINE * 4);
  divider();
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  const legal = pdf.splitTextToSize(
    "Documento firmado electrónicamente conforme a la Resolución 839 de 2017. Su contenido es inmutable desde la fecha de firma. Este documento contiene información clínica sujeta a reserva legal.",
    usableWidth,
  ) as string[];
  for (const line of legal) {
    ensureSpace(4);
    pdf.text(line, MARGIN, y);
    y += 4;
  }

  const safeName = (patient.full_name || "paciente").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
  const stamp = signedAt.toISOString().slice(0, 10);
  pdf.save(`${doc.document_type}-${safeName}-${stamp}.pdf`);
}

/** Tipos re-exportados para que quien importe el generador no tenga que ir a api. */
export type { EvolucionData, InformeData };
