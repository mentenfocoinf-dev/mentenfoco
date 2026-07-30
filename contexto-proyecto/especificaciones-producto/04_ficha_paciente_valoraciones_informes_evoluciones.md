# Spec — Ficha de paciente, 3 tipos de documento clínico, y exportación PDF

Regla explícita del usuario para esta spec: **nada de esto se construye en frontend sin que el
backend real lo respalde primero.** Cada sección de abajo separa "backend (primero)" de "frontend
(sobre ese backend)".

## 0. Qué cambia en "Mis Pacientes" (`TherapistDashboard.tsx`)

Se quita el botón "Informe Clínico" de la tarjeta de cada paciente. Toda la tarjeta pasa a ser
clicable y navega a la ficha del paciente (sección 3). El listado en sí (nombre, plan, estado) se
queda igual — solo cambia qué pasa al hacer clic.

## 1. Backend — diferenciar Valoración / Informe / Evolución

Hoy `clinical_notes` guarda todo con la misma forma (SOAP genérico). Esto resuelve, de paso, dos
pendientes que ya estaban anotados en el diagnóstico: el gap de terapeuta "plan de tratamiento
estructurado" y el de "informe formal exportable" — quedan cubiertos por el diseño de abajo, no hay
que tratarlos como tareas aparte.

```sql
-- Tipo de documento. 'valoracion' = evaluación inicial completa (una por proceso, normalmente).
-- 'evolucion' = nota breve de seguimiento por sesión. 'informe' = documento formal, generado a
-- demanda, no atado 1:1 a una sesión (para entregar a EPS, colegio, otro profesional).
ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'evolucion'
    CHECK (document_type IN ('valoracion', 'informe', 'evolucion')),
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES therapy_sessions(id),
  ADD COLUMN IF NOT EXISTS treatment_plan jsonb;

COMMENT ON COLUMN clinical_notes.document_type IS
  'valoracion: evaluacion inicial completa. evolucion: nota breve de seguimiento por sesion. informe: documento formal a demanda, no atado a una sesion.';
COMMENT ON COLUMN clinical_notes.session_id IS
  'Sesion de therapy_sessions a la que corresponde esta nota, si aplica (evoluciones normalmente si, informes normalmente no).';
COMMENT ON COLUMN clinical_notes.treatment_plan IS
  'Solo se usa en document_type=valoracion. Forma: {objetivos: text[], modalidad: text, frecuencia_sugerida: text, pronostico: text}.';

-- Backfill de las notas ya sembradas (seed_clinical_demo_data.cjs, 22-jul): la primera nota
-- cronológica de cada paciente pasa a ser su valoracion inicial; las 4 siguientes quedan como
-- evolucion. Ajustar si el criterio de "primera por paciente" no es exactamente esto en la practica.
```

**Forma de `soap_data` según `document_type`** (mismo campo jsonb, contenido distinto — no se
duplica la columna, se documenta la forma esperada por tipo):

- **`valoracion`**: `{ complaints: string[], diagnostic: string, mental_exam: Record<string,string> }`
  — igual a lo que ya existe hoy — más el `treatment_plan` de la columna nueva. Referencia (no
  reingreso) a los antecedentes de `patient_anamnesis`: la UI muestra esos datos de solo lectura, no
  los vuelve a pedir.
- **`evolucion`**: forma nueva y deliberadamente más corta —
  `{ orientacion: string, presentacion: string, estado_animo: string, resumen: string, plan_proxima_sesion: string, adherencia_tareas?: 'cumplida'|'parcial'|'no_cumplida' }`.
  Reutiliza las mismas opciones ya definidas en `MENTAL_STATUS_OPTIONS` de
  `ClinicalReportModal.tsx` para `orientacion` (categoría "Orientación"), `presentacion` (categoría
  "Apariencia") y `estado_animo` (categoría "Afecto") — no se inventan opciones nuevas, se reutilizan
  las 3 más relevantes para una nota rápida en vez de las 10 completas.
- **`informe`**: `{ resumen_valoracion: string, resumen_evolucion: string, diagnostic: string, conclusiones: string, recomendaciones: string, evaluaciones_referenciadas: string[] }`
  — los últimos dos campos (`resumen_valoracion`/`resumen_evolucion`) se pre-rellenan (borrador
  editable) a partir de la última `valoracion` firmada y las `evolucion` firmadas desde esa fecha,
  para que el terapeuta no vuelva a escribir de cero — pero el terapeuta puede editarlo todo antes de
  firmar.

**Inmutabilidad:** se mantiene exactamente el mecanismo que ya existe (`is_signed` +
`signed_at` bloquean edición, con la advertencia legal de la Resolución 839/2017 que ya está en
`ClinicalReportModal.tsx`) — aplica igual a los 3 tipos, no hay que reinventar esto.

## 2. Backend — panel de uso del plan

No existe hoy una fuente estructurada de "cuántas sesiones incluye el plan del paciente". Los
beneficios están en `PLAN_BENEFITS` (`src/lib/api/plans.ts`) como texto descriptivo ("1 sesión
individual al mes", "4 sesiones terapéuticas al mes", "8 sesiones terapéuticas al mes"). Hay que
extraer esto a datos estructurados para poder calcular contra la realidad:

```ts
// src/lib/api/plans.ts — agregar junto a PLAN_BENEFITS
export const PLAN_SESSION_QUOTA: Record<PlanType, number | null> = {
  free: null, // sin sesiones incluidas
  esencial: 1,
  integral: 4,
  premium: 8,
};
```

Con eso, un servicio nuevo (`getPatientPlanUsage(patientId)` en `clinicalService.ts` o un archivo
nuevo `patientOverviewService.ts`) calcula: sesiones ya tomadas en el mes calendario actual (contar
`therapy_sessions` con `status='completada'` y `scheduled_at` dentro del mes) vs. `PLAN_SESSION_QUOTA`
del plan; y evaluaciones aplicadas en el período (reusa la misma lógica que ya usa el badge de "límite
freemium" para el plan Free, generalizada a mostrar el historial en vez de solo bloquear).

## 3. Frontend — Ficha de paciente (ruta nueva, ej. `/portal/pacientes/$patientId` bajo el layout de terapeuta)

Construida sobre todo lo de arriba (no antes):

1. **Encabezado**: nombre, plan, estado (activo/inactivo), motivo de consulta (de la última
   `valoracion` firmada, o de la anamnesis si aún no hay valoración).
2. **Resumen clínico**: antecedentes de `patient_anamnesis` (solo lectura), diagnóstico CIE-11 activo
   (última valoración/informe), estado de alertas de crisis (resuelta/pendiente, con quién y cuándo —
   reusa lo que ya existe de `clinical_alerts`).
3. **Gráficas**: reutilizar el componente de tendencia PHQ-9/GAD-7 que ya existe en
   `PatientDashboard.tsx` — extraerlo a un componente compartido (`TrendChart.tsx`) en vez de
   duplicar el código, y usarlo aquí en modo lectura para el terapeuta.
4. **Uso del plan**: tarjeta con "sesiones este mes: X de Y" (de la sección 2) y "evaluaciones
   aplicadas: PHQ-9 [fecha], GAD-7 [fecha]..." — lista simple de `psychometric_evaluations`.
5. **Documentos**: lista unificada de `clinical_notes` (los 3 tipos, con badge de color por tipo),
   ordenada por fecha. Clic en cualquiera abre una vista de solo lectura si `is_signed=true`, o el
   formulario editable si es un borrador propio sin firmar. Tres botones de creación arriba de la
   lista: "Nueva valoración" (deshabilitado si ya existe una valoración firmada reciente — a criterio
   de Claude Code definir qué tan reciente), "Nueva evolución" (el flujo principal, rápido), "Generar
   informe" (abre el borrador pre-rellenado de la sección 1).

## 4. Frontend — Exportar a PDF

Botón "Descargar PDF" visible **solo** en documentos con `is_signed=true` (nunca en borradores — un
documento sin firmar no debe poder salir de la plataforma como si fuera definitivo). El PDF se genera
en el cliente a partir de los datos ya firmados e inmutables (no hay nada que inventar en el momento:
todo el contenido ya existe en la fila de `clinical_notes` + los datos de identificación del paciente +
`profiles.professional_card`/`full_name` del terapeuta) — esto es lo que hace que el botón tenga
"fundamentación de backend": no es un botón decorativo, renderiza datos reales ya persistidos e
inmutables.

Contenido mínimo del PDF, sea cual sea el tipo de documento: encabezado con nombre completo del
paciente y del profesional (+ tarjeta profesional), fecha de firma, tipo de documento, y el contenido
correspondiente a su `document_type`. Claude Code debe elegir la librería (ej. `jsPDF` o `pdf-lib`) que
sea compatible con el entorno de build real del proyecto — la app se despliega en Cloudflare Workers
vía `wrangler` (`wrangler.jsonc` en la raíz), así que hay que verificar que la librería elegida corra
bien en ese runtime de borde si el PDF se generara del lado servidor; si se genera 100% en el
navegador (recomendado, más simple), esta restricción no aplica.

## Iteración 2 (22-jul, misma tarde) — enriquecido con plantillas reales de práctica clínica

Todo lo de arriba **ya está construido** (migración aplicada, backend, frontend, PDF — confirmado por
Claude Code). Esta iteración no lo reemplaza: **añade** campos dentro de los mismos jsonb existentes
(`soap_data`, `treatment_plan`), sin tocar columnas ni romper lo ya firmado. Origen: el usuario compartió
6 documentos reales de su ejercicio profesional previo (neuropsicología/rehabilitación cognitiva) — la
estructura genérica extraída está en
`especificaciones-producto/05_plantillas_reales_valoracion_informe_evolucion.md`.

**Valoración — campos que se agregan a `soap_data`** (los que ya existían — `complaints`, `diagnostic`,
`mental_exam` — se quedan igual):
- `motivo_consulta: string` — párrafo corto, quién remite y para qué (distinto de `complaints`, que son
  las etiquetas de `CHIEF_COMPLAINTS`).
- `antecedentes_personales: { patologicos, psiquiatricos, farmacologicos, hospitalarios, traumaticos, quirurgicos, toxico_alergicos, vision, audicion }`
  — todos `string`, opcionales, "No refiere" por defecto. Se pre-rellenan desde `patient_anamnesis` pero
  quedan como snapshot editable de esta valoración (la valoración no debe cambiar retroactivamente si la
  anamnesis se actualiza después).
- `pruebas_aplicadas?: string[]` y `resultados_pruebas?: { aspecto, prueba, puntaje_referencia, puntaje_paciente, clasificacion, comentario? }[]`
  — solo si se aplicó alguna escala más allá de PHQ-9/GAD-7/MoCA/MMSE (que ya se registran en
  `psychometric_evaluations`); este campo es para instrumentos puntuales sin tabla propia.
- `analisis_cualitativo?: string` y `analisis_cuantitativo?: string` — opcionales, para cuando la
  valoración incluye una evaluación formal (no todo proceso terapéutico breve los necesita).

**`treatment_plan` — forma revisada** (reemplaza la de la sección 1, más fiel al formato real):
`{ objetivo_general: string, objetivos_especificos: string[], modalidad: string, frecuencia_sugerida: string, pronostico: string }`
— antes tenía solo `objetivos: string[]` genérico; ahora separa el objetivo general (uno) de los
específicos (varios), que es como aparece en los 2 informes de rehabilitación reales revisados.

**Evolución — forma corregida en `soap_data`** (esto sí cambia respecto a la sección 1 original, con
evidencia real de que el criterio anterior estaba incompleto):
`{ caracterizacion_breve: string, plan_intervencion: string, recomendaciones: string, observaciones_mentales: string, pruebas_aplicadas?: string[], resultados?: string, adherencia_tareas?: 'cumplida'|'parcial'|'no_cumplida' }`
El campo central es `plan_intervencion` (qué se trabajó en la sesión) — en la spec original ese contenido
no tenía un lugar claro (`resumen` era ambiguo). `caracterizacion_breve` es 1-2 líneas, no una reescritura
del motivo completo. `observaciones_mentales` sigue reutilizando las mismas 3 categorías de
`MENTAL_STATUS_OPTIONS` que ya se definieron (orientación, presentación, estado de ánimo) — eso no cambia.

**Informe — campos que se agregan**: `recomendaciones` deja de ser un solo string y pasa a
`{ categoria: string, items: string[] }[]` (ej. "Manejo médico", "Intervención psicológica", "Apoyo
psicosocial", "Estilo de vida" — las categorías las define el terapeuta, no son un enum fijo, porque el
material real usa categorías distintas según el tipo de caso). El resto de campos de la sección 1 se
mantiene igual.

**Qué no se toca**: las 20 notas ya sembradas y backfileadas por Claude Code (1 valoración + 5 evoluciones
por paciente) no se reescriben — los campos nuevos son opcionales, esas notas simplemente no los tienen
poblados. Solo los documentos nuevos que se creen de aquí en adelante usan la forma enriquecida.

## Qué NO cambia

- El modelo de firma electrónica (Resolución 839/2017) y su advertencia legal, igual para los 3 tipos.
- El origen de los antecedentes clínicos (`patient_anamnesis`) — se referencia, no se reingresa.
- La búsqueda CIE-11/DSM-5 de la spec 03 — se reutiliza en `valoracion` e `informe` (donde hay campo
  `diagnostic`), no aplica a `evolucion` (no lleva diagnóstico propio, hereda el de la valoración).
