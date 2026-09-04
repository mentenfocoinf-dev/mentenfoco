// ============================================================================
// Empresas (B2B) — gestión del pipeline de negociación desde el panel admin.
//
// Solo la parte SEGURA: crear/ver/actualizar `companies` (estado del pipeline,
// notas). El vínculo empleado↔empresa y los reportes agregados NO se tocan aquí
// — siguen bloqueados por la revisión jurídica del consentimiento.
//
// La tabla `companies` tiene RLS admin-only en la base: esta capa solo dibuja;
// la barrera la impone Postgres (get_my_role()='admin').
// ============================================================================
import { supabase } from "../supabase";

export type CompanyStatus = "prospecto" | "negociando" | "contrato_activo" | "pausado" | "cerrado";

export const COMPANY_STATUS_ORDER: CompanyStatus[] = [
  "prospecto",
  "negociando",
  "contrato_activo",
  "pausado",
  "cerrado",
];

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  prospecto: "Prospecto",
  negociando: "En negociación",
  contrato_activo: "Contrato activo",
  pausado: "Pausado",
  cerrado: "Cerrado",
};

export interface Company {
  id: string;
  name: string;
  nit: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: CompanyStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompanyRow {
  id: string;
  name: string;
  nit: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: CompanyStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: CompanyRow): Company {
  return {
    id: r.id,
    name: r.name,
    nit: r.nit,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, nit, contact_name, contact_email, contact_phone, status, notes, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as CompanyRow[]).map(mapRow);
}

export interface CreateCompanyInput {
  name: string;
  nit?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

export async function createCompany(input: CreateCompanyInput): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("La empresa necesita un nombre.");

  const { error } = await supabase.from("companies").insert({
    name,
    nit: input.nit?.trim() || null,
    contact_name: input.contactName?.trim() || null,
    contact_email: input.contactEmail?.trim() || null,
    contact_phone: input.contactPhone?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error("No pudimos crear la empresa. Intenta de nuevo.");
}

export async function updateCompanyStatus(id: string, status: CompanyStatus): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("No pudimos actualizar el estado. Intenta de nuevo.");
}

export async function updateCompanyNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("No pudimos guardar las notas. Intenta de nuevo.");
}
