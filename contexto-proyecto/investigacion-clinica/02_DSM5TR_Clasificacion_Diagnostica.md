# DSM-5-TR — Clasificación diagnóstica (referencia cruzada con CIE-11)

Manual Diagnóstico y Estadístico de los Trastornos Mentales, 5ª edición, revisión de texto (American
Psychiatric Association, marzo 2022). Verificado contra la guía oficial de organización de la APA
(`psychiatry.org/File Library/.../APA-DSM5TR-TheOrganizationofDSM.pdf`) y fuentes médicas secundarias
revisadas por pares (*World Psychiatry* 2022, *Psychiatric Services* 2022).

**Nota de derechos de autor:** los criterios diagnósticos textuales del DSM-5-TR son propiedad de la
APA y no se reproducen aquí. Lo que sigue es la estructura de clasificación (nombres de categorías) y
resúmenes originales, no el texto del manual.

## Estructura general

- **Sección I** — Introducción y uso del manual.
- **Sección II** — Criterios diagnósticos y códigos (el cuerpo principal, 20 clases diagnósticas).
- **Sección III** — Medidas y modelos emergentes en investigación (ej. el modelo alternativo dimensional
  de trastornos de personalidad, condiciones para estudio futuro como el trastorno por uso de internet).

## Las 20 clases diagnósticas de la Sección II

| # | Clase diagnóstica (DSM-5-TR) | Bloque CIE-11 equivalente |
|---|---|---|
| 1 | Trastornos del neurodesarrollo | 6A00–6A0Z |
| 2 | Espectro de la esquizofrenia y otros trastornos psicóticos | 6A20–6A2Z |
| 3 | Trastorno bipolar y trastornos relacionados | 6A60–6A6Z |
| 4 | Trastornos depresivos | 6A70–6A7Z |
| 5 | Trastornos de ansiedad | 6B00–6B0Z |
| 6 | Trastorno obsesivo-compulsivo y trastornos relacionados | 6B20–6B2Z |
| 7 | Trastornos relacionados con traumas y factores de estrés | 6B40–6B4Z |
| 8 | Trastornos disociativos | 6B60–6B6Z |
| 9 | Trastorno de síntomas somáticos y trastornos relacionados | 6C20–6C2Z |
| 10 | Trastornos de la conducta alimentaria y de la ingesta de alimentos | 6B80–6B8Z |
| 11 | Trastornos de la excreción | 6C00–6C0Z |
| 12 | Trastornos del sueño-vigilia | Capítulo 07 de la CIE-11 (no el 06) |
| 13 | Disfunciones sexuales | Capítulo 17 de la CIE-11 |
| 14 | Disforia de género | Capítulo 17 de la CIE-11 (incongruencia de género) |
| 15 | Trastornos disruptivos, del control de los impulsos y de la conducta | 6C70–6C9Z |
| 16 | Trastornos relacionados con sustancias y trastornos adictivos | 6C40–6C5Z |
| 17 | Trastornos neurocognitivos | 6D70–6E0Z |
| 18 | Trastornos de la personalidad | 6D10–6D11.5 |
| 19 | Trastornos parafílicos | 6D30–6D3Z |
| 20 | Otros trastornos mentales / Trastornos de movimiento inducidos por medicamentos y otros efectos adversos / Otras condiciones que pueden ser objeto de atención clínica | Dispersos (6D50–6D5Z para facticios, 6E40 para factores psicológicos) |

## Diferencia clave de filosofía: CIE-11 vs. DSM-5-TR

- La CIE-11 es la clasificación **oficial para uso clínico y de salud pública a nivel mundial** (la que
  legalmente se usa para codificar historias clínicas, morbilidad y mortalidad). Prioriza utilidad
  clínica y facilidad de uso en atención primaria.
- El DSM-5-TR es el estándar de referencia en investigación y práctica clínica, especialmente en EE.
  UU., con criterios operacionales más detallados (número exacto de síntomas, duración mínima, etc.).
- Ambos sistemas convergieron mucho en la CIE-11 (a diferencia de la CIE-10, que estaba más alejada del
  DSM). La tabla de equivalencias de arriba es útil para que el buscador CIE-11 de la plataforma
  también reconozca el nombre "coloquial" DSM-5 que un terapeuta pueda teclear.
- Para un producto clínico como Mente en Foco, lo recomendable es que el código diagnóstico oficial
  registrado en `clinical_notes` sea siempre CIE-11 (por ser el estándar internacional vigente y el que
  eventualmente pedirán aseguradoras/entidades regulatorias), y usar el nombre DSM-5-TR solo como
  ayuda de búsqueda/sinónimo.

## Novedades introducidas en la revisión de texto de 2022 (relevantes para no quedar desactualizado)

- **Trastorno de duelo prolongado** — nuevo diagnóstico formal (equivalente a CIE-11 `6B42`), para
  duelo intenso y persistente más allá de 12 meses en adultos (6 meses en niños) que causa deterioro
  funcional significativo, diferenciándolo del duelo no complicado.
- **Trastorno del estado de ánimo no especificado** — categoría residual reincorporada para cuadros
  anímicos que no encajan claramente ni en trastornos bipolares ni depresivos (ej. agitación aguda sin
  cuadro completo).
- **Trastorno neurocognitivo leve inducido por estimulantes** — nueva entidad diagnóstica dentro de los
  trastornos relacionados con sustancias.
- Actualización de terminología y criterios para reducir estigma y aumentar sensibilidad cultural en
  varios diagnósticos (ej. lenguaje sobre suicidio, terminología racial/étnica en ejemplos clínicos).

## Nota sobre el modelo alternativo de personalidad (Sección III)

El DSM-5-TR mantiene en su cuerpo principal (Sección II) el modelo categorial clásico de 10 trastornos
de personalidad (paranoide, esquizoide, esquizotípico, antisocial, límite, histriónico, narcisista,
evitativo, dependiente, obsesivo-compulsivo), pero incluye en la Sección III un **modelo alternativo
dimensional** (AMPD) que es conceptualmente muy similar al modelo dimensional que la CIE-11 sí adoptó
como oficial (ver `6D10`–`6D11.5` en el archivo anterior). Es útil saber que ambos sistemas se están
moviendo hacia el modelo dimensional — si Mente en Foco construye una herramienta de evaluación de
personalidad a futuro, el modelo dimensional (severidad + rasgos: afectividad negativa, desapego,
antagonismo/disocialidad, desinhibición, anancastia/psicoticismo) es la dirección más alineada con
ambos estándares vigentes.
