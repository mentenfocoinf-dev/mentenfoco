// ============================================================================
// Pasos obligatorios antes de entrar al portal.
//
// Punto ÚNICO donde se decide si un usuario puede ver el dashboard o debe
// resolver algo primero. Antes esta lógica vivía dispersa en useAuth (cambio de
// contraseña y anamnesis por separado); al sumar el consentimiento y los datos
// de facturación habrían quedado cuatro flujos divergentes de "pantalla
// obligatoria", imposibles de razonar juntos.
//
// El orden importa y es deliberado:
//   1. contraseña     — credencial temporal enviada por correo, lo más urgente
//   2. datos (1581)   — sin autorización no se debería tratar ningún otro dato
//   3. datos mínimos  — identificación para facturar y contacto de emergencia
//   4. clínico (1090) — se consiente el proceso ANTES de entregar la historia
//   5. anamnesis      — entrevista clínica, el paso más largo, va al final
//
// Los pasos 2 y 4 son consentimientos DISTINTOS y ambos obligatorios: el de
// datos autoriza tratar nombre, correo y teléfono; el clínico consiente el
// proceso de atención psicológica. Ninguno reemplaza al otro.
// ============================================================================
import type { Profile } from "../supabase";

export const GATE_ROUTES = {
  password: "/nueva-contrasena",
  consent: "/consentimiento",
  profile: "/completar-perfil",
  clinicalConsent: "/consentimiento-clinico",
  anamnesis: "/anamnesis",
} as const;

export type GateRoute = (typeof GATE_ROUTES)[keyof typeof GATE_ROUTES];

/** Rutas que el usuario puede visitar mientras tiene un paso pendiente. */
const ALWAYS_ALLOWED = ["/compra-exitosa"];

function isBlank(value?: string | null): boolean {
  return !value || value.trim().length === 0;
}

/** ¿Faltan los datos mínimos para operar con este paciente? */
export function needsProfileCompletion(profile: Profile): boolean {
  return (
    isBlank(profile.cedula) ||
    isBlank(profile.phone) ||
    isBlank(profile.emergency_contact_name) ||
    isBlank(profile.emergency_contact_phone)
  );
}

/**
 * Lo que el perfil por sí solo no puede responder sobre el consentimiento
 * clínico: si el paciente está en proceso y si tiene la versión vigente vigente.
 *
 * Va como parámetro aparte —y no como columna de `profiles`— porque el registro
 * es histórico y vive en `clinical_consents`. Lo resuelve
 * clinicalConsentService.getClinicalConsentState() antes de llamar aquí.
 *
 * Si llega `undefined`, el paso clínico NO se evalúa. Es deliberado: así una
 * llamada que todavía no cargó ese estado nunca bloquea al usuario por
 * desconocimiento (fallar hacia "dejar pasar" y no hacia "atascar a todos").
 */
export interface ClinicalConsentGateInput {
  /** Paciente con plan de pago o terapeuta asignado. */
  inClinicalProcess: boolean;
  /** Existe fila de la versión vigente y sin revocar. */
  hasCurrentConsent: boolean;
}

/**
 * Devuelve la ruta del paso pendiente, o null si el usuario puede pasar.
 *
 * Terapeutas y admin solo pasan por el cambio de contraseña: no tienen ficha
 * clínica ni se les factura, así que el resto de pasos no les aplica.
 */
export function resolveRequiredGate(
  profile: Profile,
  clinical?: ClinicalConsentGateInput,
): GateRoute | null {
  if (profile.must_change_password === true) return GATE_ROUTES.password;

  if (profile.role !== "patient") return null;

  if (!profile.terms_accepted_at) return GATE_ROUTES.consent;
  if (needsProfileCompletion(profile)) return GATE_ROUTES.profile;

  // Antes de la anamnesis: se consiente el proceso antes de entregar la historia
  // clínica. Solo a quien está en proceso — una cuenta gratuita de captación no
  // tiene proceso que consentir y no debe quedar atascada aquí.
  if (clinical?.inClinicalProcess && !clinical.hasCurrentConsent) {
    return GATE_ROUTES.clinicalConsent;
  }

  if (profile.onboarding_completed === false) return GATE_ROUTES.anamnesis;

  return null;
}

/**
 * ¿Hay que sacar al usuario de donde está? Se separa de resolveRequiredGate
 * para que la propia pantalla del paso no se redirija a sí misma en bucle.
 */
export function shouldRedirectToGate(
  profile: Profile,
  currentPath: string,
  clinical?: ClinicalConsentGateInput,
): GateRoute | null {
  const gate = resolveRequiredGate(profile, clinical);
  if (!gate) return null;
  if (currentPath === gate || ALWAYS_ALLOWED.includes(currentPath)) return null;
  return gate;
}
