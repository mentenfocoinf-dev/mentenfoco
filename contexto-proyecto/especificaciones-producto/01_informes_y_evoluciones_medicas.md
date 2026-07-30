# Spec — Historial de informes y evoluciones médicas (terapeuta + admin)

## El problema exacto, verificado en código

`ClinicalReportModal.tsx` guarda notas clínicas (`clinical_notes`, vía `saveClinicalNote`) con modelo
SOAP, diagnóstico CIE-11 y examen mental. Pero esa nota **solo es visible dentro del propio modal**,
que el terapeuta tiene que abrir manualmente paciente por paciente desde el botón "Informe Clínico" en
`TherapistDashboard.tsx`. Confirmado por grep en todo `src/`: las funciones `getLatestNote` y
`getSignedNotesHistory` solo se usan en `clinicalService.ts` (capa de datos) y dentro de
`ClinicalReportModal.tsx` — en ningún otro componente. `AdminDashboard.tsx` no tiene **ninguna**
mención de informes, notas clínicas ni evaluaciones — cero visibilidad de administración sobre lo que
el equipo clínico está produciendo.

En la práctica esto significa: un terapeuta con 15 pacientes no tiene forma de ver "¿a quién no le
escribo una nota hace semanas?" sin entrar paciente por paciente. Y el admin, que en este proyecto es
quien más necesita supervisión de calidad clínica (ver `AdminDashboard.tsx` ya tiene RPCs de gestión de
usuarios), no puede ver nada de lo producido.

## Qué construir

### 1. Sección "Historial clínico" en TherapistDashboard (nueva, agregada, no reemplaza el modal)

Una vista que cruza, por paciente, las tres fuentes que ya existen y hoy viven separadas:
- Notas firmadas (`getSignedNotesHistory`) — fecha, diagnóstico, resumen SOAP.
- Evaluaciones psicométricas (`getPatientEvaluations` / `getLatestEvaluationsByScale`) — tendencia.
- Sesiones (`getTherapistSessions` filtradas por paciente) — asistencia, fechas.

Vista de dos niveles:
- **Nivel lista (todos los pacientes):** tabla/cards con "última nota firmada: [fecha]", "última
  evaluación: [escala, puntaje, fecha]", ordenable por "más tiempo sin nota" para que el terapeuta
  detecte a quién se le está quedando sin seguimiento — esto es, literalmente, la funcionalidad de
  "proceso completo de seguimiento" que se pidió, no solo generación de informes sueltos.
- **Nivel detalle (un paciente):** línea de tiempo cronológica mezclando notas + evaluaciones +
  sesiones en un solo feed, para leer la evolución completa de un vistazo sin saltar entre pantallas.
  Reutiliza el gráfico de tendencia PHQ-9/GAD-7 que ya existe en `PatientDashboard.tsx` (mismo
  componente, vista de terapeuta).

### 2. Panel de supervisión clínica en AdminDashboard (nuevo)

Vista de solo lectura, no de edición (el admin no debe poder alterar una nota clínica firmada — eso
rompería la Resolución 839/2017 de firma electrónica ya implementada):
- Conteo de notas firmadas por terapeuta, últimos 30 días.
- Lista de pacientes sin ninguna nota firmada (indicador de riesgo operativo: alguien está siendo
  atendido sin que quede historia clínica).
- Alertas de crisis sin resolver más de 24h (usa las columnas `resolved_at` ya construidas el 21-jul).

### 3. Servicio de datos nuevo

`src/lib/api/clinicalOverviewService.ts` (nombre sugerido): agrega funciones que ya existen
(`getSignedNotesHistory`, `getPatientEvaluations`, `getTherapistSessions`) en las formas agregadas que
necesitan las dos vistas de arriba. No debería requerir tablas nuevas — es una capa de agregación sobre
lo que ya existe en `clinical_notes`, `psychometric_evaluations`, `therapy_sessions`, `clinical_alerts`.

## Por qué esto es "proceso completo de seguimiento" y no solo informes

La petición explícita fue que esto sea un seguimiento continuo, no una generación puntual de
documentos. La línea de tiempo del punto 1 y el indicador de "sin nota hace X días" son lo que
convierte informes sueltos en un proceso — es exactamente el patrón de historia clínica longitudinal
que exige la Res. 1995 de 1999 (ver `investigacion-clinica/05_Escalas_Evaluacion_Estructura_Informes_Clinicos.md`),
y que hoy la plataforma tiene en la base de datos pero no en ninguna interfaz que lo muestre así.
