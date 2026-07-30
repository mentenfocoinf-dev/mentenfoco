# Spec — Consentimiento informado clínico (gap de terapeuta #1)

Cierra el gap #1 del panel de terapeuta: hoy existe el consentimiento de **tratamiento de datos** (Ley
1581, modal `PrivacyPolicyModal` versionado), pero **no** el consentimiento informado del **proceso
clínico** (Ley 1090/2006), que es obligatorio antes de iniciar atención psicológica. Son dos
consentimientos distintos y ambos deben existir.

Regla del proyecto: **backend antes que frontend.** Texto del documento (fundamentado en Ley 1090 +
Doctrina No. 3 de Colpsic) ya redactado en `contenido-plataforma/legal/consentimiento-informado-clinico.md`
— **pendiente de revisión jurídica** (va en la fase de seguridad final), pero ya sirve para construir el flujo.

## 1. Backend

```sql
-- Registro de aceptación del consentimiento clínico, por paciente y versión.
create table clinical_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references profiles(id),
  version     integer not null,          -- coincide con CLINICAL_CONSENT_VERSION
  accepted_at timestamptz not null default now(),
  revoked_at  timestamptz,               -- si el paciente revoca
  created_at  timestamptz not null default now()
);
create index on clinical_consents (patient_id);
```

- Constante `CLINICAL_CONSENT_VERSION` en el front (mismo patrón que `PRIVACY_POLICY_VERSION`). Si sube la
  versión, se vuelve a pedir el consentimiento.
- El texto vive versionado (constante/markdown en el front, igual que la política de privacidad), tomado de
  `consentimiento-informado-clinico.md`.
- RLS (escrita/comentada como el resto): el paciente inserta/lee lo suyo; terapeuta y admin del paciente lo
  leen (necesitan ver que el consentimiento existe); nadie edita una fila una vez creada (solo se agrega
  `revoked_at`).

## 2. Dónde entra en el flujo (gate)

Reutiliza el patrón `resolveRequiredGate` (ya unifica password → consentimiento datos → completar-perfil →
anamnesis). El consentimiento clínico va **justo antes de la anamnesis**, porque se consiente el proceso
clínico antes de entregar la historia clínica:

`password temporal → consentimiento de datos → completar perfil → **consentimiento clínico (NUEVO)** → anamnesis`

- Aplica a la **misma población que hace anamnesis** (pacientes en proceso clínico real: con plan/terapeuta).
  Las cuentas **gratuitas de captación** (que hoy tienen `onboarding_completed=true` y no pasan por
  anamnesis) **NO** lo requieren mientras solo consuman contenido — solo entran al gate clínico cuando
  inician un proceso (adquieren plan / se les asigna terapeuta). Staff (admin/terapeuta) exento.
- Pantalla/modal tipo `ClinicalConsentModal` (calcar de `PrivacyPolicyModal`): muestra el texto, exige
  marcar aceptación explícita, registra la fila en `clinical_consents`. Sin aceptar, no avanza a anamnesis.

## 3. Visibilidad para el profesional (importante para cumplimiento)

En la **ficha de paciente** (`/pacientes/$patientId`, sección de resumen clínico), mostrar el estado del
consentimiento: "Consentimiento informado clínico: **aceptado** el [fecha], versión N" o "**pendiente**".
Es un dato que el terapeuta y el admin deben poder ver de un vistazo (respaldo ético-legal del proceso).

## 4. Revocación

El paciente puede revocar desde Ajustes ("Revocar consentimiento del proceso"): setea `revoked_at` y queda
visible para el terapeuta/admin como alerta (el proceso clínico no debería continuar sin consentimiento
vigente). No borra el registro histórico.

## 5. Qué NO cambia

- El consentimiento de **datos** (Ley 1581) sigue existiendo aparte; este es adicional, no lo reemplaza.
- La inmutabilidad de documentos firmados (Res. 839/2017) y el resto del flujo clínico no se tocan.
