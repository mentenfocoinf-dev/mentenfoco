# Prompt para Claude Code — Enriquecer Valoración/Informe/Evolución con campos de práctica real

Contexto: ya construiste la Fase 1 completa (migración `document_type`/`session_id`/`treatment_plan`,
backend, ficha de paciente, PDF) y la verificaste — buen trabajo con el backfill (insertar valoración
nueva en vez de reclasificar notas firmadas fue la decisión correcta, el trigger de inmutabilidad hizo su
trabajo). El usuario compartió después 6 documentos reales de su ejercicio profesional previo
(neuropsicología/rehabilitación cognitiva) para que los formularios reflejen mejor cómo se documenta en la
práctica real. Extraje la estructura (sin datos de pacientes reales) en
`especificaciones-producto/05_plantillas_reales_valoracion_informe_evolucion.md`, y ya ajusté los campos
exactos en la sección "Iteración 2" de `especificaciones-producto/04_ficha_paciente_valoraciones_informes_evoluciones.md`
— léela completa antes de tocar código, este prompt solo resume el orden de trabajo.

**Importante — esto es aditivo, no una reversión de tu trabajo:** todos los campos nuevos van dentro de
los mismos jsonb que ya existen (`soap_data`, `treatment_plan`). No hace falta otra migración de columnas,
salvo que decidas indexar algo nuevo. Las 20 notas ya sembradas no se tocan — quedan sin estos campos
nuevos, y eso está bien, son opcionales.

## Qué cambia por tipo de documento

1. **Valoración**: agrega al formulario `motivo_consulta`, `antecedentes_personales` (8 categorías cortas:
   patológicos, psiquiátricos, farmacológicos, hospitalarios, traumáticos, quirúrgicos, tóxico-alérgicos,
   visión, audición — pre-rellenadas desde `patient_anamnesis` pero editables como snapshot de esta
   valoración), y opcionalmente `pruebas_aplicadas`/`resultados_pruebas`/`analisis_cualitativo`/`analisis_cuantitativo`
   para cuando la valoración incluye una prueba formal. `treatment_plan` cambia de `objetivos: string[]`
   a `objetivo_general` + `objetivos_especificos` separados — ajusta el formulario y el generador de PDF.

2. **Evolución**: cambia la forma del formulario de seguimiento. El campo central pasa a ser
   `plan_intervencion` (qué se trabajó en la sesión) en vez del `resumen` genérico que tenía la Fase 1.
   Campos: `caracterizacion_breve`, `plan_intervencion`, `recomendaciones`, `observaciones_mentales`
   (reutiliza las mismas 3 categorías de `MENTAL_STATUS_OPTIONS` que ya usabas), y opcionales
   `pruebas_aplicadas`/`resultados`/`adherencia_tareas`. Si ya construiste el formulario corto de
   evolución, esto es renombrar/reorganizar campos, no un rediseño desde cero.

3. **Informe**: `recomendaciones` deja de ser un string y pasa a una lista de categorías con ítems
   (`{ categoria, items[] }[]`) — el terapeuta define la categoría libremente (ej. "Manejo médico",
   "Intervención psicológica"), no es un enum cerrado. Ajusta el formulario (permitir agregar categorías
   dinámicamente) y el generador de PDF (agrupar por categoría en vez de una lista plana).

## Verificación

Después de ajustar, entra con `terapeuta@test.com`, crea un documento de cada tipo con los campos nuevos,
fírmalo, y confirma que el PDF los muestra correctamente agrupados/formateados. Confirma también que las
notas viejas (las 20 sembradas sin estos campos) se siguen viendo y exportando bien — no deben romperse
por la ausencia de los campos nuevos. Repórtame cualquier inconsistencia, igual que en la ronda anterior.
