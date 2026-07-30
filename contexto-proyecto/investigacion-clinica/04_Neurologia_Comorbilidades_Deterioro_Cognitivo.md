# Neurología, comorbilidades y deterioro cognitivo

## 1. El espectro del deterioro cognitivo

No es un salto binario de "sano" a "demencia" — es un continuo con umbrales clínicos definidos:

1. **Envejecimiento cognitivo normal** — enlentecimiento leve de la velocidad de procesamiento y
   recuperación de palabras, sin impacto funcional. No es un diagnóstico (`MG2A` en la CIE-11,
   "declive asociado al envejecimiento en la capacidad intrínseca", clasificado fuera del capítulo de
   salud mental).
2. **Declive cognitivo subjetivo** — la persona percibe un cambio, pero las pruebas neuropsicológicas
   están dentro de rango normal. No tiene código diagnóstico propio; es una señal de alerta para
   seguimiento, no un trastorno.
3. **Trastorno neurocognitivo leve** (`6D71` CIE-11 / "Mild Neurocognitive Disorder" DSM-5-TR) —
   deterioro objetivable en pruebas, pero la persona mantiene independencia funcional (puede compensar
   con más esfuerzo o estrategias). Es el escalón donde más vale la detección temprana, porque una
   fracción de casos progresa a demencia y otra se mantiene estable o mejora si la causa es reversible
   (ej. déficit de B12, hipotiroidismo, depresión con seudodemencia).
4. **Demencia / trastorno neurocognitivo mayor** (`6D80`–`6D8Z`) — deterioro en 2+ dominios cognitivos
   que sí interfiere con la independencia en actividades de la vida diaria. Aquí es donde la CIE-11
   distingue por **etiología**, no solo por severidad (ver tabla abajo).

## 2. Las 6 etiologías principales de demencia (con código CIE-11 exacto)

| Código | Tipo | Rasgo clínico distintivo |
|---|---|---|
| `6D80` | Alzheimer | Inicio insidioso, progresión gradual; memoria episódica afectada primero (dificultad para aprender información nueva); atrofia hipocampal en imagen. Causa más frecuente de demencia (~60-70% de los casos). |
| `6D81` | Vascular / cerebrovascular | Inicio más brusco o "escalonado" (empeora tras cada evento vascular); perfil cognitivo con enlentecimiento y disfunción ejecutiva más que amnesia pura; historia de ACV, hipertensión, diabetes. |
| `6D82` | Cuerpos de Lewy | Fluctuaciones cognitivas marcadas, alucinaciones visuales tempranas y detalladas, parkinsonismo, trastorno de conducta del sueño REM, hipersensibilidad a antipsicóticos (contraindicación relativa importante a documentar en anamnesis). |
| `6D83` | Frontotemporal | Inicio más temprano (con frecuencia antes de los 65 años); predomina el cambio de personalidad/conducta (desinhibición, apatía) o el deterioro del lenguaje, con memoria relativamente preservada al inicio. |
| `6D84` | Debida a sustancias psicoactivas | Incluye demencia asociada a consumo crónico de alcohol (síndrome de Korsakoff es una forma relacionada, clasificada como trastorno amnésico `6D72` si es predominantemente amnésico) u otras sustancias/medicamentos. |
| `6D85` | Debida a otra enfermedad clasificada en otro lugar | Parkinson, Huntington, VIH, priónicas (Creutzfeldt-Jakob), hidrocefalia normotensiva (potencialmente reversible con derivación quirúrgica — importante no perderla en el diagnóstico diferencial). |

`6D86` (alteraciones conductuales o psicológicas en la demencia) es un calificador transversal que se
añade a cualquiera de los anteriores cuando hay agitación, psicosis, apatía o alteración del sueño
asociadas — clínicamente relevante porque estos síntomas suelen ser el motivo real de consulta o
crisis, más que el deterioro cognitivo puro.

## 3. Herramientas de cribado cognitivo (para anamnesis / seguimiento longitudinal)

| Instrumento | Qué mide | Duración | Nota de uso |
|---|---|---|---|
| **MMSE** (Mini-Mental State Examination) | Cribado global (orientación, memoria, atención, lenguaje, praxis) | ~10 min | El más usado históricamente; menos sensible a deterioro leve y a disfunción ejecutiva/frontal que el MoCA. |
| **MoCA** (Montreal Cognitive Assessment) | Cribado global, con más peso en función ejecutiva y memoria diferida | ~10-15 min | Más sensible que el MMSE para detectar deterioro cognitivo leve; es el más recomendado actualmente para cribado temprano. |
| **CDR** (Clinical Dementia Rating) | Estadificación de severidad (0 a 3) a partir de entrevista estructurada con el paciente y un informante | ~30-45 min | No es cribado sino estadificación; útil para seguimiento longitudinal de progresión. |
| **GDS de Reisberg** (Global Deterioration Scale) | Estadificación en 7 etapas, desde ausencia de deterioro hasta demencia muy grave | Basada en observación clínica | Complementa al CDR, muy usada en contextos residenciales/geriátricos. |

Ninguna de estas escalas está actualmente en el esquema de Mente en Foco (`psychometric_evaluations`
solo contempla PHQ-9/GAD-7/C-SSRS/AUDIT-C según lo documentado). Ver recomendación en el archivo 06.

## 4. Comorbilidades neurológicas-psiquiátricas frecuentes (relevantes para anamnesis clínica)

Estas combinaciones son importantes porque cambian el manejo clínico y porque una anamnesis superficial
(como la actual de Mente en Foco, que solo pide nombre completo) las pasa por alto sistemáticamente:

- **Epilepsia + depresión/ansiedad** — la prevalencia de depresión en personas con epilepsia es varias
  veces mayor que en población general; además, algunos antidepresivos bajan el umbral convulsivo, por
  lo que la coordinación con neurología es indispensable antes de prescribir.
- **Enfermedad cardiovascular + depresión** — la depresión post-infarto es un predictor de peor
  pronóstico cardiovascular, no solo una consecuencia psicológica del evento; relación bidireccional.
- **Enfermedad tiroidea + ansiedad/depresión/manía** — el hipotiroidismo puede presentarse como
  depresión atípica con fatiga marcada; el hipertiroidismo puede simular un cuadro ansioso o maníaco.
  Es una de las causas médicas más comunes de "trastorno del ánimo secundario" (`6E62`).
- **Encefalitis autoinmune (ej. anti-receptor NMDA) + psicosis de inicio agudo** — causa reconocida y
  tratable de psicosis aguda, especialmente en personas jóvenes, que puede confundirse con un primer
  episodio psicótico primario si no se investiga (fiebre, movimientos anormales, deterioro de
  conciencia fluctuante son señales de alarma para descartarla antes de asumir un diagnóstico
  psiquiátrico primario).
- **TDAH + trastorno específico del aprendizaje** — comorbilidad muy frecuente en la infancia; ambos
  están en el mismo bloque de neurodesarrollo (`6A00–6A0Z`) pero requieren abordajes distintos y con
  frecuencia coexisten en el mismo paciente sin que se detecten ambos si solo se evalúa uno.
- **Trastorno del espectro autista + discapacidad intelectual + epilepsia** — combinación frecuente
  que requiere un enfoque de evaluación multidisciplinario, no solo psicológico.
- **Consumo de sustancias + trastorno psiquiátrico primario ("patología dual")** — es la norma clínica,
  no la excepción, en servicios de salud mental; el orden causal (¿la sustancia causó el cuadro, lo
  agravó, o es automedicación de un cuadro preexistente?) determina el plan de tratamiento.
- **Deterioro cognitivo + depresión en adultos mayores ("seudodemencia depresiva")** — una depresión
  grave en un adulto mayor puede presentarse con quejas cognitivas y bajo rendimiento en pruebas que
  simulan demencia, pero es potencialmente reversible con tratamiento antidepresivo — de ahí la
  importancia de no asumir demencia sin descartar depresión primero.

## 5. Implicación para el formulario de anamnesis

El hallazgo documentado en el handoff previo (`/anamnesis` solo pide nombre completo, pese al nombre
clínico de la ruta) es más grave a la luz de estas comorbilidades: sin preguntas sobre antecedentes
médicos/neurológicos, medicación actual, antecedentes familiares y consumo de sustancias, es imposible
hacer una diferenciación diagnóstica mínimamente segura. Ver recomendaciones concretas de campos a
añadir en el archivo `06_Recomendaciones_Implementacion_Tecnica.md`.
