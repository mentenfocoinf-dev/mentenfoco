# Prompt para Claude Code — Consentimiento informado clínico (gap de terapeuta #1)

Construye el consentimiento informado **clínico** (Ley 1090/2006), que hoy falta. Es distinto del
consentimiento de **datos** (Ley 1581) que ya existe como `PrivacyPolicyModal` — ambos deben coexistir.
Spec completa: `contexto-proyecto/especificaciones-producto/12_consentimiento_informado_clinico.md`. Texto
del documento (ya redactado, fundamentado en Ley 1090 + Doctrina No. 3 de Colpsic): `contenido-plataforma/
legal/consentimiento-informado-clinico.md`. Léelos antes de empezar.

Regla del proyecto: **backend antes que frontend.**

## 1. Backend (migración)
- Tabla `clinical_consents` (`patient_id`, `version`, `accepted_at`, `revoked_at` nullable, `created_at`),
  índice por `patient_id`, exactamente como en la sección 1 de la spec.
- RLS escrita (déjala comentada/lista si el proyecto sigue con RLS apagado en pruebas, como el resto):
  el paciente inserta/lee lo suyo; el terapeuta y el admin asignados lo leen; una fila no se edita salvo
  para setear `revoked_at`.

## 2. Constante + texto versionado
- `CLINICAL_CONSENT_VERSION` (empieza en 1), mismo patrón que `PRIVACY_POLICY_VERSION`.
- El texto del consentimiento, versionado en el front (constante/markdown), tomado del archivo
  `consentimiento-informado-clinico.md`. Renderízalo con el mismo componente markdown que ya usas.

## 3. Gate de onboarding
- Agrega el consentimiento clínico al flujo `resolveRequiredGate`, **justo antes de la anamnesis**:
  `password → consentimiento de datos → completar perfil → consentimiento clínico → anamnesis`.
- Aplica a la misma población que hace anamnesis (pacientes en proceso clínico: con plan/terapeuta). Las
  cuentas gratuitas de captación (hoy `onboarding_completed=true`, sin anamnesis) **no** lo requieren
  mientras solo consuman contenido. Staff exento.
- `ClinicalConsentModal` (o pantalla `/consentimiento-clinico`): calca `PrivacyPolicyModal`. Muestra el
  texto, exige aceptación explícita (checkbox), y al aceptar inserta la fila en `clinical_consents`. Sin
  aceptar no avanza. Verifica contra `CLINICAL_CONSENT_VERSION` (si no hay fila con la versión vigente, se
  pide).

## 4. Visibilidad para el profesional
- En la ficha de paciente (`/pacientes/$patientId`, resumen clínico), muestra: "Consentimiento informado
  clínico: aceptado el [fecha], versión N" o "pendiente". Terapeuta y admin deben verlo.

## 5. Revocación
- En Ajustes del paciente, opción "Revocar consentimiento del proceso" → setea `revoked_at`. En la ficha
  del paciente, si está revocado, muéstralo como alerta al terapeuta/admin. No borra el registro.

## Verificación
- Con un paciente en proceso clínico (ej. `paciente.esencial@test.com`) que aún no lo haya aceptado: al
  entrar al gate, aparece el consentimiento clínico antes de la anamnesis; sin aceptar no avanza; al
  aceptar, se crea la fila y continúa.
- Las cuentas gratuitas de captación NO quedan atascadas en este paso.
- En la ficha de ese paciente, el terapeuta ve "aceptado el [fecha], v1".
- Revocar desde Ajustes marca `revoked_at` y se refleja como alerta en la ficha.
- Repórtame el recorrido y si el texto necesita ajustes de formato al renderizar.
