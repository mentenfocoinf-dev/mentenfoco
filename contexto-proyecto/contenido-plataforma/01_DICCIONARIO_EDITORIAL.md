---
tags: [mente-en-foco, editorial, vocabulario, diccionario]
documento: diccionario editorial unificado
estado: propuesta — pendiente de aprobación
actualizado: 2026-07-30
---

# Diccionario editorial unificado

> **Qué es.** El vocabulario transversal con el que Mente en Foco entiende su propio conocimiento.
> Un eje único que atraviesa Guías, Contenido, Programas y Blog, independiente de cómo se navega.
>
> **Qué NO es.** No reemplaza `categoria`, que seguirá siendo el eje de navegación pública. No
> reemplaza `tags`, que seguirá siendo el eje de técnica y detalle. Es un tercer eje, ortogonal.

> [!important] Estado
> **Propuesta.** No se ha creado ninguna columna, no se ha migrado nada, no se ha tocado ninguna
> pieza. La asignación final de tema a cada pieza es una decisión editorial y clínica que corresponde
> al responsable del producto (ADR-007).

---

## 1. Por qué existe

Al auditar el modelo apareció un dato que lo decide todo:

```
tags únicos en guías:      42
tags únicos en contenido:  65
compartidos:                2   ← solo "TCC" y "TIP"
```

Dos vocabularios prácticamente disjuntos, y de naturaleza distinta: los de guías nombran **enfoques
terapéuticos** (`Asertividad`, `DBT`, `MBCT`, `TCC-I`) y los de contenido nombran **síntomas y
mecanismos** (`rumiación`, `anhedonia`, `higiene del sueño`). Con eso, nada puede cruzar de una
sección a otra.

Y `categoria` tampoco sirve como puente. Tres ejemplos reales del catálogo actual:

| Pieza | Categoría hoy | Problema |
| :--- | :--- | :--- |
| `ansiedad-insomnio` (guía) | **Ansiedad** | Es de sueño; el contenido de sueño está en categoría *Sueño* |
| `ansiedad-estres` (guía) | **Ansiedad** | Es burnout; `programa-recargar` (mismo tema) está en *Ánimo* |
| `programa-enfoque` | **Ánimo** | Es procrastinación; no tiene nada que ver con estado de ánimo |

`Ánimo` acumula hoy 10 piezas de contenido que incluyen depresión, procrastinación, TDAH, burnout y
meditaciones de regulación. **Eso no es un tema: es un cajón.**

### El principio de diseño

> **Un tema es un ámbito de la experiencia de la persona. No es un diagnóstico ni una técnica.**

- **No es diagnóstico** porque el producto orienta, no diagnostica (ADR-007). "Trastorno de pánico"
  sería una etiqueta clínica; "Ansiedad y pánico" es lo que alguien siente y busca.
- **No es técnica** porque las técnicas ya viven en `tags`. Si el tema fuera "TCC", una herramienta
  de TCC para el sueño tendría dos temas y habría que elegir.

Manteniendo los tres ejes ortogonales, cada uno sigue sirviendo para lo suyo:

| Eje | Responde | Dónde vive | Cambia con |
| :--- | :--- | :--- | :--- |
| `categoria` | ¿Dónde lo encuentro navegando? | Filtros públicos | El diseño de la navegación |
| `tags` | ¿Con qué enfoque o mecanismo trabaja? | Buscador, detalle | Cada pieza |
| **`theme_key`** | **¿De qué trata, en el fondo?** | **Interno** | **Casi nunca** |

---

## 2. El vocabulario — 15 temas

### Salud mental — el núcleo

#### `ansiedad_panico` — Ansiedad y pánico
Lo que ocurre cuando el sistema de alarma se queda encendido: preocupación que no se apaga,
activación física, ataques de pánico y las herramientas para bajar la intensidad en el momento.

*Piezas:* `ansiedad-ataques` · `ansiedad-que-no-para` · `anclaje-5-4-3-2-1` · `respiracion-4-6-8` ·
`meditacion-aterriza` · `programa-calma` — **6**

---

#### `animo_depresion` — Ánimo y depresión
Tristeza persistente, pérdida de interés, falta de energía. Incluye la diferencia entre estar triste
y estar deprimido, y el trabajo de reactivación.

*Piezas:* `animo-depresion-episodio` · `animo-prevencion-recaida` ·
`estar-triste-no-es-estar-deprimido` · `activacion-conductual` — **4**

---

#### `sueno_descanso` — Sueño y descanso
Insomnio, mala calidad del sueño y el círculo entre no dormir y estar peor. Incluye higiene del sueño
y cierre del día.

*Piezas:* `ansiedad-insomnio` · `por-que-no-puedes-dormir-aunque-estes-agotado` ·
`podcast-dormir-no-es-apagarse` · `meditacion-suelta-el-dia` — **4**

---

#### `estres_burnout` — Estrés y agotamiento
Carga sostenida, agotamiento laboral y la dificultad para parar. Distinto de la ansiedad: aquí el
origen es externo y prolongado.

*Piezas:* `ansiedad-estres` · `programa-recargar` — **2** ⚠️

---

#### `autoestima_dialogo_interno` — Autoestima y diálogo interno
Cómo te hablas y cómo te valoras. Incluye autocrítica, perfeccionismo y las herramientas para
cuestionar el pensamiento automático.

*Piezas:* `autoestima-autoconcepto` · `autoestima-dialogo` · `perfeccionismo-que-agota` ·
`diario-de-pensamientos` · `reestructuracion-cognitiva` — **5**

---

#### `regulacion_presencia` — Regulación emocional y presencia
Sostener emociones intensas sin que arrastren, y atención plena como práctica. Es el ámbito de las
meditaciones y del trabajo corporal.

*Piezas:* `programa-equilibrio` · `programa-presencia` · `escaneo-corporal` ·
`meditacion-la-montana` · `meditacion-empieza-en-calma` — **5**

---

#### `enfoque_procrastinacion` — Enfoque y procrastinación
Por qué se posterga lo importante —casi nunca por pereza— y cómo sostener lo que se empieza.

*Piezas:* `procrastinacion-no-es-pereza` · `podcast-por-que-posponemos` · `programa-enfoque` — **3**

---

### Vínculos y contexto

#### `relaciones_vinculos` — Relaciones y vínculos
Comunicación, conflictos, límites, dependencia emocional y cómo acompañar a alguien que la está
pasando mal.

*Piezas:* `relaciones-comunicacion` · `relaciones-conflictos` · `relaciones-dependencia` ·
`autoestima-limites` · `como-apoyar-a-alguien-que-la-esta-pasando-mal` — **5**

---

#### `duelo_perdida` — Duelo y pérdida
Elaborar una pérdida y qué ocurre cuando el duelo se estanca.

*Piezas:* `trauma-duelo-prolongado` · `programa-reconectar` — **2** ⚠️

---

#### `trauma` — Trauma
Qué pasa después de un evento traumático y los primeros pasos de estabilización.

*Piezas:* `trauma-primeros-pasos` — **1** ⚠️⚠️

---

#### `crianza_infancia` — Crianza y desarrollo infantil
Acompañar a niñas y niños: autonomía, regulación emocional, pantallas.

*Piezas:* `infantil-autonomia` · `infantil-pantallas` · `infantil-regulacion` — **3**

---

### Cuerpo, mente y ciclo vital

#### `alimentacion` — Alimentación y relación con la comida
Atracones, restricción y reconstruir una relación tranquila con la comida.

*Piezas:* `alimentacion-atracones` · `alimentacion-relacion-comida` — **2** ⚠️

---

#### `memoria_envejecimiento` — Memoria y envejecimiento
Cambios de memoria normales frente a los que merecen consulta, y acompañamiento a familiares con
demencia.

*Piezas:* `memoria-cambios-normales` · `memoria-apoyo-familiar-demencia` — **2** ⚠️

---

#### `neurodivergencia` — Neurodivergencia
TDAH y perfiles neurodivergentes en la vida adulta: atención, funciones ejecutivas, organización.

*Piezas:* `tdah-adultos-mente-a-mil` — **1** ⚠️⚠️

---

### Meta

#### `proceso_terapeutico` — Empezar y sostener un proceso
Qué es la terapia, qué esperar, mitos, y cómo funciona el acompañamiento. Habla *del proceso*, no de
un motivo de consulta.

*Piezas:* `mitos-sobre-ir-al-psicologo` — **1** ⚠️⚠️

---

## 3. Mapa completo — 46 piezas

| Tema | Guías | Contenido | Blog | Total |
| :--- | ---: | ---: | ---: | ---: |
| `ansiedad_panico` | 1 | 5 | 0 | **6** |
| `autoestima_dialogo_interno` | 2 | 3 | 0 | **5** |
| `regulacion_presencia` | 0 | 5 | 0 | **5** |
| `relaciones_vinculos` | 4 | 0 | 1 | **5** |
| `animo_depresion` | 2 | 2 | 0 | **4** |
| `sueno_descanso` | 1 | 3 | 0 | **4** |
| `enfoque_procrastinacion` | 0 | 3 | 0 | **3** |
| `crianza_infancia` | 3 | 0 | 0 | **3** |
| `estres_burnout` | 1 | 1 | 0 | **2** |
| `duelo_perdida` | 1 | 1 | 0 | **2** |
| `alimentacion` | 2 | 0 | 0 | **2** |
| `memoria_envejecimiento` | 2 | 0 | 0 | **2** |
| `trauma` | 1 | 0 | 0 | **1** |
| `neurodivergencia` | 0 | 1 | 0 | **1** |
| `proceso_terapeutico` | 0 | 0 | 1 | **1** |
| | **20** | **24** | **2** | **46** |

### Reasignaciones más significativas

Piezas cuyo tema real no coincide con su categoría de navegación:

| Pieza | Categoría hoy | Tema propuesto | Por qué |
| :--- | :--- | :--- | :--- |
| `ansiedad-insomnio` | Ansiedad | `sueno_descanso` | Une con el contenido de sueño |
| `ansiedad-estres` | Ansiedad | `estres_burnout` | Une con `programa-recargar` |
| `programa-enfoque` | Ánimo | `enfoque_procrastinacion` | No es estado de ánimo |
| `podcast-por-que-posponemos` | Ánimo | `enfoque_procrastinacion` | Ídem |
| `procrastinacion-no-es-pereza` | Ánimo | `enfoque_procrastinacion` | Ídem |
| `tdah-adultos-mente-a-mil` | Ánimo | `neurodivergencia` | Es neurodesarrollo |
| `programa-equilibrio` | Ánimo | `regulacion_presencia` | Regulación, no ánimo |
| `meditacion-la-montana` | Ánimo | `regulacion_presencia` | Ídem |
| `meditacion-suelta-el-dia` | Ánimo | `sueno_descanso` | Cierre del día |
| `autoestima-limites` | Autoestima | `relaciones_vinculos` | Los límites son relacionales |
| `diario-de-pensamientos` | Autoestima | `autoestima_dialogo_interno` | Coincide |
| `reestructuracion-cognitiva` | Autoestima | `autoestima_dialogo_interno` | Coincide |
| `escaneo-corporal` | Ansiedad | `regulacion_presencia` | Práctica corporal |
| `meditacion-empieza-en-calma` | Ansiedad | `regulacion_presencia` | Ídem |
| `programa-presencia` | Ansiedad | `regulacion_presencia` | Ídem |

**Ninguna de estas reasignaciones cambia lo que el usuario ve.** `categoria` no se toca.

---

## 4. Diagnóstico del vocabulario

### Temas duplicados
**Ninguno.** Los quince son disjuntos. El único par que roza es `ansiedad_panico` /
`regulacion_presencia` — la respiración regula y las meditaciones calman. Se separan por **intención**:
ansiedad es *bajar una alarma encendida*; regulación es *práctica sostenida*, se esté mal o no.

### Temas demasiado grandes
**Ninguno.** El mayor tiene 6 piezas. Comparar con el estado actual:

| | Antes | Después |
| :--- | ---: | ---: |
| Cajón mayor | `Ánimo` con **10** | `ansiedad_panico` con **6** |
| Ejes | 9 categorías | 15 temas |

`Ánimo` con 10 piezas heterogéneas era el problema. Queda con 4, todas de ánimo.

### Temas demasiado pequeños — 6 casos

| Tema | Piezas | Lectura |
| :--- | ---: | :--- |
| `estres_burnout` | 2 | Demanda alta y solo 2 piezas. **Hueco de contenido** |
| `duelo_perdida` | 2 | Suficiente para una ruta mínima |
| `alimentacion` | 2 | Nicho legítimo |
| `memoria_envejecimiento` | 2 | **Es el diferenciador declarado del proyecto** y tiene 2 piezas |
| `trauma` | 1 | Insuficiente |
| `neurodivergencia` | 1 | TDAH es top de búsquedas y hay 1 pieza |
| `proceso_terapeutico` | 1 | Es meta; 1 basta por ahora |

> [!important] Los temas pequeños no son un defecto del vocabulario
> Son un **mapa de calor de lo que falta escribir**. Fusionarlos para que "se vean llenos" ocultaría
> exactamente la información más útil que produce este ejercicio.

**Fusión considerada y descartada:** `trauma` (1) + `duelo_perdida` (2). La categoría actual ya los
tiene juntos bajo *Trauma*. Se rechaza por criterio clínico: duelo prolongado y TEPT son cuadros
distintos con abordajes distintos, y recomendar contenido de trauma a alguien en duelo —o al revés—
es un error que el motor cometería sistemáticamente.

**Implicación para el motor:** con 1–2 piezas, un tema no puede sostener recomendaciones internas.
La v1 necesitará una regla de respaldo: si el tema tiene menos de 3 piezas visibles para esa etapa,
recomendar por tema afín, no dejar el bloque vacío.

---

## 5. La columna `theme_key`

### Forma

**Enum de Postgres**, no texto libre. Igual que `content_type`, `plan_type` y `content_status`.

- Texto libre produce `Ansiedad`, `ansiedad`, `ansiedad_panico` como tres temas distintos. Ya pasó con
  los tags: 42 + 65 y 2 compartidos.
- El enum hace que un valor inventado **falle en la base**, no en revisión (ADR-011).

### Convención

`snake_case`, **sin acentos**, en español. Sigue la convención existente: `content_type` usa
`articulo`/`programa`, `plan_type` usa `esencial`/`integral`.

### Los 15 valores

```
ansiedad_panico · animo_depresion · sueno_descanso · estres_burnout
autoestima_dialogo_interno · regulacion_presencia · enfoque_procrastinacion
relaciones_vinculos · duelo_perdida · trauma · crianza_infancia
alimentacion · memoria_envejecimiento · neurodivergencia · proceso_terapeutico
```

### Reglas de gobierno

1. **Una pieza, un tema.** Sin arrays. Un tema secundario multiplicaría las combinaciones y volvería
   ambigua toda regla. La afinidad fina ya la dan los `tags`.
2. **Nullable al crear la columna.** Permite adopción incremental: el motor trabaja con lo que tenga
   tema e ignora el resto. No hay estado intermedio roto.
3. **Añadir un valor es fácil; quitarlo, no.** `ALTER TYPE ADD VALUE` es trivial (y necesita su propia
   migración — ver `Trampas conocidas`). Retirar uno exige reasignar las piezas primero.
4. **Cambia casi nunca.** Un tema nuevo se justifica cuando hay ≥3 piezas que no encajan en ninguno.
5. **`categoria` y `tags` no se tocan.** Este eje suma; no sustituye.

### Dónde se aplica

`content_items` y `clinical_guides`. **Mismo enum en ambas** — es lo que permite cruzar secciones, y
la razón entera de este documento.

---

## 6. Reutilización

### Recommendation Engine
El uso directo. Habilita la regla de mayor valor, hoy imposible:

> *Leíste `por-que-no-puedes-dormir` (explica el porqué) → aquí está `ansiedad-insomnio` (la guía con
> los pasos).*

Mismo `theme_key`, distinto `content_type`. La transición GUIAR ↔ EXPLICAR ↔ CONVERSAR de ADR-009 se
vuelve ejecutable. Combinado con `resolveReachableSteps()`, que ya filtra por etapa sin generar
callejones sin salida.

### Matching paciente ↔ terapeuta
El perfil profesional tiene hoy el campo *Especialidades* vacío y marcado como pendiente. Si se
puebla **con este mismo enum**, el matching se vuelve una comparación de conjuntos en vez de texto
libre. Y el `motivo_consulta` de la anamnesis puede mapearse al mismo eje.

Sin un vocabulario compartido, matching y contenido acabarían con dos taxonomías — el error que este
documento existe para evitar.

### Alex IA
Un vocabulario cerrado es lo que permite que un modelo **recupere en vez de generar**. Con
`theme_key`, la respuesta se construye sobre piezas reales y verificadas; sin él, tendría que
interpretar libremente y generar contenido clínico — prohibido por ADR-007.

Es también el límite operativo: el modelo puede clasificar una consulta dentro de 15 valores, no
inventar el decimosexto.

### SEO
Cada tema es un *topic cluster*: página pilar + piezas que enlazan a ella. Y el mapa de la §4 es
directamente el calendario editorial — `estres_burnout` con 2 piezas y alta demanda es la próxima
prioridad, sin necesidad de investigar nada.

### Analytics
El Journey Engine registra `resource_id` y `resource_type`, pero no tema. Con `theme_key`, los
eventos responden preguntas que hoy no se pueden hacer: qué temas se leen más, cuáles se abandonan,
qué tema precede a una solicitud de sesión.

> [!warning] Un límite que hay que fijar antes de construir
> Agregar `theme_key` a la analítica convierte el recorrido en un **perfil temático de salud mental**
> de una persona identificable. Cruzarlo con `severity_level` sería tentador y sería exactamente el
> tipo de uso que ADR-004 prohíbe: la recomendación se hace por lo que la persona **busca**, no por lo
> mal que puntuó. Un `severity_level` alto no es una señal de recomendación: es una señal de riesgo.

---

## 7. Lo que falta para implementar

| Paso | Quién | Bloquea |
| :--- | :--- | :--- |
| Aprobar o corregir los 15 temas | **Responsable del producto** | Sí |
| Validar las 15 reasignaciones de la §3 | **Responsable del producto** | Sí |
| Migración: enum + 2 columnas nullable | Desarrollo | No |
| Asignar tema a las 46 piezas | **Responsable del producto** | Sí |
| Motor de reglas v1 | Desarrollo | — |

La asignación de tema es un juicio editorial y clínico. La agrupación de este documento es una
**propuesta derivada del contenido real**, no una decisión tomada.

## Enlaces

- `00_guia_estilo_redaccion.md` — cómo se escribe cada pieza
- `../vision-producto/03_DECISIONES_ARQUITECTONICAS.md` — ADR-002, ADR-007, ADR-009, ADR-011
- `../especificaciones-producto/11_diferenciacion_guias_vs_contenido.md` — GUIAR / EXPLICAR / CONVERSAR
