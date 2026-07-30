# Plantilla maestra de estructura de guías — Mente en Foco

Esta no es una estructura nueva inventada hoy: es la **formalización del patrón que ya usan las 20
guías existentes** en `supabase/20240514_security_sprint.sql` y `supabase/20260701_expand_clinical_guides.sql`
(verificado leyendo el contenido completo de ambas migraciones). El objetivo de este documento es que
cualquier guía nueva — escrita por el usuario, por Claude Code, o generada automáticamente cada 2 días
en el futuro — siga siempre el mismo orden, para que el catálogo se sienta como una sola voz editorial
y no como piezas sueltas.

## Campos de metadatos (tabla `clinical_guides`)

| Campo | Qué va ahí | Ejemplo real |
| :--- | :--- | :--- |
| `id` | slug único, `categoria-tema-especifico` | `trauma-duelo-prolongado` |
| `categoria` | una de la taxonomía (ver `01_taxonomia_categorias.md`) | `Trauma` |
| `etiquetas` | 3 etiquetas: modelo/enfoque terapéutico + código o tema CIE-11 + población/contexto | `['Duelo', 'TIP', 'CIE-11']` |
| `titulo` | pregunta o afirmación corta, en segunda persona o impersonal, nunca alarmista | `Cuando el duelo no avanza` |
| `descripcionBreve` | 1 frase, promete el ángulo práctico de la guía | `La diferencia entre un duelo doloroso y un duelo que quedó atascado.` |
| `tiempoLectura` | entre 11 y 15 min en las 20 existentes — mantener ese rango | `13 min` |
| `imageName` | nombre de archivo en `public/guias/`, coincide con el título | `Cuando el duelo no avanza.png` |
| `es_premium` | `true` salvo que sea una de las 4 de vitrina gratuita | — |
| `min_plan` | `free` solo para las guías de vitrina; el resto siempre `esencial` (nunca `integral`/`premium` — ver spec 06, cualquier plan pago desbloquea todo) | `esencial` |

## `fundamentoClinico` (campo corto, se muestra como preview/teaser)

Un párrafo de 80-120 palabras que explica, en lenguaje llano, qué es el fenómeno clínico y por qué
ocurre — sin jerga sin explicar, sin diagnosticar al lector. Es lo que ve alguien decidiendo si vale la
pena leer la guía completa.

## `ejercicioPractico` (campo corto)

Una técnica concreta con nombre en mayúsculas (ej. "REGISTRO ABC PARA CONDUCTAS DIFÍCILES", "PAUSA ANTES
DEL ATRACÓN"), seguida de 3-4 pasos numerados, accionables hoy mismo, sin requerir materiales especiales.

## `contenidoCompleto` (markdown largo — la guía en sí)

Estructura fija, en este orden exacto:

### 1. `# Título` (H1, puede repetir o expandir el `titulo` corto)

### 2. `## Fundamento Clínico`

Explicación más profunda que el campo corto: mecanismo (neurobiológico y/o conductual), código(s) CIE-11
relevante(s) citados explícitamente (ej. "CIE-11 6B42"), y — cuando aplique — el círculo o patrón que
sostiene el problema (ej. círculo anhedonia-evitación en depresión, ciclo restricción-atracón en TCA).
Este es el "por qué le pasa esto a mi cerebro/cuerpo", nunca un diagnóstico personalizado al lector.

### 3. `## Diferenciación Diagnóstica`

**Siempre una tabla**, nunca un párrafo. Columnas típicas: la variante normal/esperable vs. el cuadro
clínico (a veces con una tercera columna para una variante más grave/compleja). Filas: duración,
funcionalidad, un rasgo distintivo específico del tema. Este es el elemento que más diferencia a Mente en
Foco de contenido genérico de bienestar — le da al lector un criterio real para saber si lo que le pasa
amerita ayuda profesional, no solo "date el gusto de un baño relajante".

### 4. `## Protocolo de Intervención: [Nombre del modelo/enfoque]`

El nombre del modelo con mejor evidencia para el tema (TCC, Activación Conductual, MBCT, TIP, CBT-E,
EMDR, terapia familiar Maudsley, etc. — nunca inventado, siempre un modelo real y verificable). Subdividido
en subsecciones numeradas (`### 1.`, `### 2.`...), típicamente 4-5, cada una con:
- Un concepto o técnica en **negrita** al inicio.
- Explicación de por qué funciona (mecanismo), no solo instrucción mecánica.

**La última subsección es siempre "Cuándo derivar/escalar/buscar ayuda profesional"** — esto es
obligatorio en las 20 guías existentes y debe seguir siéndolo: toda guía de autoayuda en salud mental
necesita un cierre claro de "esto ya no es autoayuda, es momento de un profesional", con las señales
concretas que lo indican (ideación de muerte, pérdida de funcionalidad, síntomas físicos de riesgo, etc.
según el tema).

## Reglas transversales (para cualquier guía nueva)

- Nunca reemplaza al DSM-5-TR con texto propio ni reproduce criterios diagnósticos textuales de ningún
  manual con derechos de autor — el fundamento clínico se explica con palabras propias, citando el código
  CIE-11 como referencia, nunca copiando la definición oficial palabra por palabra.
- Nunca da instrucciones de autoayuda que sustituyan una evaluación de riesgo — si el tema puede tocar
  ideación suicida (Ánimo, Trauma, Personalidad, Adicciones), la guía debe mencionar explícitamente que
  eso amerita evaluación inmediata, no esperar al final del protocolo.
- Lenguaje: español neutro/colombiano, tuteo, nunca voseo (ver [[sin-voseo-espanol-neutro]] en memoria).
- La guía debe ser leíble por alguien sin formación clínica — cualquier término técnico (anhedonia,
  rumiación, disociación) se explica la primera vez que aparece, no se asume conocido.
