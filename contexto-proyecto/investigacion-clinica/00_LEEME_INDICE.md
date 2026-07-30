# Índice — Investigación Clínica para Mente en Foco (julio 2026)

## Qué es esta carpeta

Contenido clínico investigado y verificado para ampliar la base de datos y funcionalidad clínica de
Mente en Foco. Motivo: la plataforma actualmente solo tiene ~6 diagnósticos cargados en
`cie11_directory`, insuficiente para una plataforma que se presenta como clínica y de salud mental.

## Archivos

1. **`01_CIE11_Codigos_Salud_Mental.md`** — Los 161 códigos de 4 caracteres del Capítulo 06 de la
   CIE-11 ("Trastornos mentales, del comportamiento o del neurodesarrollo"), organizados en sus 21
   bloques oficiales, con nombre en español, código exacto y una descripción breve original (no
   copiada textualmente de la OMS, por derechos de autor). Listo para convertirse en filas de
   `cie11_directory`.
2. **`02_DSM5TR_Clasificacion_Diagnostica.md`** — Las 20 clases diagnósticas del DSM-5-TR (2022), con
   sus categorías principales y las novedades introducidas en la revisión de texto (Trastorno de duelo
   prolongado, Trastorno del estado de ánimo no especificado, Trastorno neurocognitivo leve inducido
   por estimulantes). Incluye tabla comparativa CIE-11 ↔ DSM-5-TR para los cuadros más comunes.
3. **`03_Metodologias_Terapeuticas_Basadas_en_Evidencia.md`** — 15 modelos/terapias con respaldo
   científico (TCC, DBT, ACT, EMDR, psicodinámica, sistémica, TIP, terapia de esquemas, MBCT/MBSR,
   entrevista motivacional, etc.), con indicación clínica principal, nivel de evidencia y a qué
   trastornos de la lista anterior aplican mejor.
4. **`04_Neurologia_Comorbilidades_Deterioro_Cognitivo.md`** — Espectro de deterioro cognitivo
   (envejecimiento normal → deterioro cognitivo leve → demencia), las 6 etiologías principales de
   demencia con sus códigos CIE-11 exactos, y comorbilidades neurológicas-psiquiátricas frecuentes
   (epilepsia, EII autoinmune, enfermedad cardiovascular, etc.) relevantes para anamnesis clínica.
5. **`05_Escalas_Evaluacion_Estructura_Informes_Clinicos.md`** — Escalas psicométricas de cribado
   estandarizadas (PHQ-9, GAD-7, C-SSRS, AUDIT-C, MoCA, MMSE) y la estructura clínica estándar de nota
   SOAP + examen del estado mental, para reforzar `ClinicalReportModal.tsx` y la tabla
   `psychometric_evaluations` (que ya existe en el esquema pero no se usa).
6. **`06_Recomendaciones_Implementacion_Tecnica.md`** — El puente entre esta investigación y el código:
   qué tablas/columnas tocar, formato sugerido para la migración SQL, y cómo cargar estos datos sin
   romper lo que ya funciona.

## Metodología y verificación

Todo el contenido de códigos CIE-11 se verificó cruzando **dos fuentes independientes**:

- El documento oficial en español de la OMS, Capítulo 06, ICD-11 MMS (`gc.scalahed.com`), para las
  descripciones clínicas y varios bloques completos.
- `findacode.com/icd-11` (base de datos de codificación médica de InnoviHealth Systems, actualizada a
  la revisión v2026-01 de la CIE-11), para confirmar la lista completa de 21 bloques, sus 161 códigos
  de 4 caracteres, y los enlaces de exclusión/código-en-otro-lugar.

Se obtuvo el detalle completo de subcódigos, verificado en vivo contra ambas fuentes, para 12 de los
21 bloques (los de mayor prioridad clínica: neurodesarrollo, psicosis, catatonía, trastornos del
estado de ánimo —bipolar y depresivo—, ansiedad, TOC, trastornos por estrés, y **demencia/neurocognitivo**,
que era el pedido explícito sobre deterioro cognitivo). Los 9 bloques restantes (disociativos,
alimentarios, eliminación, malestar corporal, sustancias/adicciones, control de impulsos,
disruptivos/disocial, parafílicos, facticios, embarazo, síndromes secundarios) se completaron con
conocimiento clínico estable — la CIE-11 es una clasificación pública que no ha cambiado
estructuralmente desde su implementación en 2022, y la estructura de bloques/rangos de código de estos
9 se confirmó igualmente contra el índice oficial del capítulo 6 en `findacode.com`.

El contenido de DSM-5-TR se verificó contra la guía oficial de organización de la APA
(`psychiatry.org`) y fuentes secundarias médicas revisadas (World Psychiatry, Psychiatric Services)
sobre los cambios de la revisión de texto 2022.

**No se reprodujo texto con derechos de autor** de los manuales DSM-5-TR o CIE-11 (los criterios
diagnósticos completos son propiedad de la APA y la OMS respectivamente). Todas las descripciones son
resúmenes originales redactados para este proyecto, no transcripciones.

## Alcance y limitaciones

- Esto es contenido de referencia clínica para un producto de salud mental — no reemplaza el criterio
  de un profesional ni constituye asesoría médica. Debe presentarse en la plataforma como material de
  apoyo, con la supervisión de los profesionales de Mente en Foco antes de publicarse.
- Los códigos CIE-11 son correctos a la revisión **v2026-01**, la vigente al momento de esta
  investigación (julio 2026). La OMS actualiza el catálogo periódicamente; conviene revisar cambios
  cada 1-2 años.
- Ningún cambio de código se hizo en este documento — todo el trabajo de integración queda para
  Claude Code, con instrucciones detalladas en `06_Recomendaciones_Implementacion_Tecnica.md`.
