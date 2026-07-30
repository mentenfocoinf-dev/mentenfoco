# Spec — Búsqueda dual CIE-11 / DSM-5-TR en el diagnóstico del informe clínico

## Lo que se pidió

Que un profesional que prefiera trabajar con CIE-11 pueda ceñirse a ese sistema, y que uno que use más
el DSM-5 pueda buscar y colocar esos códigos sin problema, en el mismo selector de diagnóstico de
`ClinicalReportModal.tsx`.

## Por qué no construyo un catálogo DSM-5 paralelo completo (y qué hago en su lugar)

Ya existe investigación propia en `investigacion-clinica/02_DSM5TR_Clasificacion_Diagnostica.md`, y
ahí mismo queda documentado por qué: **los criterios diagnósticos textuales del DSM-5-TR son propiedad
de la American Psychiatric Association** y no están para reproducirse íntegros. Además, el DSM-5-TR no
tiene "códigos propios" independientes para facturación/registro — usa códigos CIE (en EE. UU.,
CIE-10-CM); no hay una segunda numeración DSM que se pueda registrar como si fuera un sistema de
codificación alterno y válido para historia clínica en Colombia. Construir un catálogo completo de
~300 trastornos con códigos que yo no puedo verificar contra una fuente autorizada en vivo sería
inventar datos clínicos — exactamente el tipo de error que este proyecto ha evitado a propósito hasta
ahora (ver la regla de no fabricar contenido clínico en `investigacion-clinica/`).

Lo que sí es correcto y factible: el terapeuta debe poder **buscar por el nombre que usa
habitualmente** (sea la terminología CIE-11 o la DSM-5-TR, que en la mayoría de los diagnósticos
comunes de salud mental son prácticamente el mismo nombre coloquial: "depresión mayor", "trastorno de
ansiedad generalizada", "TEPT"), y que el sistema lo lleve siempre al código CIE-11 correcto, que es el
único que debe quedar registrado en `clinical_notes.soap_data.diagnostic` — por ser el estándar vigente
en Colombia y el que eventualmente pedirán aseguradoras/entes regulatorios.

## Qué construir

1. **Columna de sinónimos en `cie11_directory`**: `ALTER TABLE cie11_directory ADD COLUMN IF NOT
   EXISTS sinonimos_dsm5 text[];`. Para los diagnósticos más comunes en salud mental (los que ya cubre
   `investigacion-clinica/02_DSM5TR_Clasificacion_Diagnostica.md` en su tabla de 20 clases), poblar este
   arreglo con el nombre DSM-5-TR equivalente — usando el **nombre de la categoría diagnóstica**, no
   criterios ni texto extendido (eso sí es seguro de reproducir, es solo una etiqueta de clasificación).
2. **Búsqueda ampliada**: la función `searchCie11` (en `clinicalService.ts`) debe buscar tanto en
   `description` como en `sinonimos_dsm5` (`.or("description.ilike.%term%,sinonimos_dsm5.cs.{term}")`
   o equivalente). Así, si un terapeuta escribe "trastorno de pánico" (nombre DSM-5) o "6B01" (código
   CIE-11), ambos caminos llegan al mismo resultado correcto.
3. **UI**: un pequeño rótulo junto al resultado de búsqueda indicando "también conocido como [nombre
   DSM-5]" cuando aplique — comunica que el sistema entiende ambas convenciones sin necesidad de un
   selector de modo separado ni de mantener dos catálogos.
4. **Lo que NO cambia**: el campo que se guarda en la nota clínica sigue siendo siempre
   `${code} - ${description}` en CIE-11, exactamente como hoy. No se introduce un campo paralelo
   "diagnóstico DSM-5" en la base de datos — sería duplicar la fuente de verdad y crear el riesgo de
   que ambos campos queden inconsistentes entre sí.

## Alcance realista para esta iteración

Poblar `sinonimos_dsm5` para los diagnósticos que ya van a aparecer en la demo sembrada (spec 02):
ansiedad generalizada, depresión, duelo prolongado, trastorno de pánico — no las ~300 entradas del
DSM-5-TR completo. Ampliar la lista de sinónimos es trabajo incremental de contenido, no una tarea
técnica bloqueante.
