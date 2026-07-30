# Plantillas reales de práctica clínica — estructura extraída (sin datos de pacientes)

Fuente: 6 documentos reales de neuropsicología/rehabilitación cognitiva del ejercicio profesional previo
del usuario, subidos para extraer el formato. **Importante:** este documento guarda solo la estructura
(secciones, campos, tipo de dato) — deliberadamente no reproduce nombres, números de identificación,
diagnósticos ni narrativas clínicas de las personas reales de los PDF originales. Esos PDF no se copian a
este repo por ser información de salud de terceros ajenos a Mente en Foco.

Se identificaron 4 familias de documento en el material real:

## A. Historia clínica / valoración inicial (intake completo)

Encabezado de datos personales (nombre, tipo/número de documento, fecha de nacimiento, edad, género,
dirección, ciudad, escolaridad, estado civil, ocupación, EPS, acompañante/relación, fecha de evaluación,
remitido por). En Mente en Foco esto ya vive en `profiles` + `patient_anamnesis` — no se reconstruye.

Luego:
- **Motivo de consulta**: párrafo corto, quién remite y para qué.
- **Caracterización del problema**: narrativa de examen mental (conciencia, orientación, atención,
  lenguaje, pensamiento, afecto, juicio/insight) + resumen de queja subjetiva actual + nivel de
  autonomía (ABVD/AIVD).
- **Antecedentes personales**, en formato de lista corta por categoría (no un solo bloque de texto):
  patológicos, psiquiátricos, farmacológicos, hospitalarios, traumáticos, quirúrgicos, tóxico-alérgicos,
  visión, audición. Cada uno con su propio valor corto ("No refiere" cuando aplica).
- **Pruebas y/o test aplicados**: lista de instrumentos usados en esta valoración (ej. entrevista
  estructurada, escalas específicas, batería neuropsicológica).
- **Resultados de las pruebas aplicadas**: tabla `Aspecto | Prueba/Escala | Puntaje de referencia |
  Puntaje del paciente`, seguida de:
  - **Análisis cualitativo**: narrativa de cómo se comportó el paciente durante la evaluación.
  - **Análisis cuantitativo**: desglose por dominio (ej. atención, memoria, funciones ejecutivas), cada
    ítem con puntaje normalizado + clasificación (Normal / Alteración leve / Alteración grave) + comentario
    opcional.
- **Análisis general / impresión diagnóstica**: síntesis + código diagnóstico (en nuestro caso, siempre
  CIE-11).
- **Objetivos**: general (uno) + específicos (lista).
- **Plan de tratamiento**: modalidad, frecuencia sugerida, enfoque.
- **Recomendaciones**: agrupadas por categoría (ej. manejo médico/psiquiátrico, intervención
  psicológica/neuropsicológica, apoyo psicosocial, estilo de vida) — no una lista plana única.
- Firma: profesional + cargo + tarjeta profesional + nota legal (Ley 1090/2006, "no tiene carácter
  pericial ni testimonial") + "informe válido por N páginas".

## B. Evolución por sesión (seguimiento)

Formato mucho más corto, repetido una vez por sesión, con esta estructura fija (confirma que la
diferenciación Valoración vs. Evolución que ya se especificó en el doc 04 es el criterio correcto — este
material la valida con un ejemplo real):

- Fecha, hora, profesional que atendió.
- **Caracterización del problema**: 1-2 líneas, recordatorio breve del motivo (no se reescribe toda la
  historia).
- **Pruebas y/o test aplicados** (si se reaplicó alguna escala en esta sesión — opcional).
- **Resultados de las áreas de evaluación** (opcional, solo si aplica alguna prueba).
- **Impresión diagnóstica**: se repite el código vigente (hereda de la valoración, no se reinventa).
- **Plan de intervención**: qué se trabajó en la sesión — este es el campo central, siempre presente.
- **Recomendaciones**: qué debe hacer el paciente hasta la próxima sesión.
- **Observaciones**: 2-3 líneas de estado mental durante la sesión (alerta, orientación, ánimo,
  adherencia).

## C. Informe formal de prueba (ej. neuropsicológica, de inteligencia)

Mismo esqueleto que A, pero centrado en una sola batería de evaluación puntual (no en un proceso
terapéutico continuo): motivo de consulta → caracterización del problema → antecedentes personales →
pruebas aplicadas → tabla de resultados por dominio con puntuación normalizada/clasificación/comentario →
análisis cualitativo → análisis cuantitativo → análisis general → impresión diagnóstica →
recomendaciones categorizadas → firma.

## D. Informe de rehabilitación (inicial y final de un ciclo de terapias)

Variante de A centrada en el proceso de rehabilitación en sí: caracterización y valoración inicial →
antecedentes médicos relacionados (checklist sí/no/no evaluado) → exploración por dominio (tabla:
dominio | hallazgo) → objetivos (general + específicos) → plan de tratamiento (enfoque, encuadre) →
evolución del ciclo completo (cuántas sesiones, qué se logró, qué persiste) → recomendaciones → firma.

## Qué de esto entra a Mente en Foco y cómo

No se construyen 4 tipos de documento — el usuario ya definió 3 (Valoración/Informe/Evolución) y ese
criterio se mantiene. Lo que aporta este material es **enriquecer el contenido de esos 3 tipos** con
campos que la práctica real usa y que la spec 04 no tenía: antecedentes personales estructurados por
categoría, pruebas aplicadas + tabla de resultados, análisis cualitativo/cuantitativo, recomendaciones
categorizadas, y — el hallazgo más importante — la evolución real no tiene "resumen libre + plan próxima
sesión" como se había specc-ado, sino un campo central de **plan de intervención** (qué se hizo en la
sesión) acompañado de recomendaciones y observaciones breves. Ver adenda en
`04_ficha_paciente_valoraciones_informes_evoluciones.md` (sección "Iteración 2") para los campos exactos
ajustados, y el prompt
`prompts-claude-code/prompt-claude-code-22-jul-2026-enriquecer-documentos-clinicos.md` para la ejecución.
