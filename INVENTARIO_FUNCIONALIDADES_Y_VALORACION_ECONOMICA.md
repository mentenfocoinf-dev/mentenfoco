# Inventario de funcionalidades y distribución por plan — base para valoración económica

Fecha: 04-sep-2026. Fuente: código y datos reales del repositorio (`plans.ts`, `guidesService.ts`,
`contentService.ts`, `cognitiveRehabService.ts`, migraciones SQL de siembra, `MANIFIESTO_SIEMBRA.md`,
`PLAN_CONTENIDO_24_Y_TIERS.md`, `01_taxonomia_categorias.md`), no de reportes anteriores — varios de
esos reportes previos (incluyendo resúmenes míos) no mencionaban el módulo de rehabilitación cognitiva
ni la regla real de acceso a guías, así que este documento corrige esos puntos ciegos.

**Cómo usarlo:** cada sección lista una pieza de valor (contenido, ejercicio, sesión, capacidad de
plataforma) y a partir de qué plan aparece. Al final hay una tabla maestra y notas explícitas sobre
qué beneficios de venta ya tienen backend real y cuáles todavía son solo texto comercial — esa
distinción es la que más importa para no sobrevalorar planes con promesas no construidas.

---

## 1. Guías clínicas (biblioteca gratuita/vitrina + biblioteca completa)

**Total: 20 guías activas en 8 categorías.** Fuente: `01_taxonomia_categorias.md` +
`clinical_guides`/`clinical_guides_meta`.

| Categoría | Nº de guías | Cobertura clínica (CIE-11) |
| :--- | :--- | :--- |
| Ansiedad | 3 | 6B0x |
| Autoestima | 3 | tema transversal |
| Infantil | 3 | regulación emocional / neurodesarrollo |
| Relaciones | 3 | tema transversal |
| Ánimo | 2 | 6A70–6A72 |
| Trauma | 2 | 6B40–6B42 |
| Alimentación | 2 | 6B80–6B8Z |
| Memoria | 2 | 6D71, 6D80–6D8Z |

**Regla de acceso real (verificada en `20260703_plan_tiers_admin_rpcs.sql` y confirmada por decisión
explícita del usuario, documentada en `06_fix_visibilidad_guias_y_expansion_categorias.md`):**

- 4 guías son de "vitrina" (`visible_en_plan_gratis`) — las ve cualquier persona, con cuenta o sin ella.
- Las 16 restantes están marcadas `es_premium = true`, y **todas** se guardan con `min_plan = 'esencial'`
  (el plan pago más barato) — nunca `integral` ni `premium`.
- Esto significa que **cualquier plan pago desbloquea las 20 guías completas por igual**. No hay
  diferenciación de guías entre Primeros Pasos, Mi Equilibrio y Mi Mundo en Foco — fue una decisión de
  producto explícita ("la diferenciación entre esencial/integral/premium debe darse en otros beneficios,
  nunca en acceso a guías"), no un descuido.

**Implicación directa para la valoración:** las guías clínicas son un argumento de venta de "gratis vs.
pago", no un argumento para justificar el precio de Mi Equilibrio o Mi Mundo en Foco sobre Primeros Pasos.

**Pendiente de catálogo (no contar en el inventario actual):** hay 5 categorías nuevas planeadas
(Personalidad, Sueño, Estrés laboral/Burnout, Adicciones, Salud mental perinatal) que están **solo
investigadas a nivel de enfoque clínico, sin una sola guía escrita todavía** — no deben incluirse en
ninguna valoración de contenido actual.

---

## 2. Biblioteca de contenido (artículos, programas, herramientas, audio)

**Total: 24 piezas de biblioteca + 2 piezas de blog público.** Fuente: `MANIFIESTO_SIEMBRA.md` /
`PLAN_CONTENIDO_24_Y_TIERS.md` (índice autoritativo de siembra, aplicado en `content_items`).

Distribución por tipo: 2 en `free` + 1 en `esencial` + 1 en `integral` + 2 en `premium`, por cada uno
de los 4 tipos (acumulativo, sin candados: cada plan ve estrictamente más que el anterior).

| Tipo | Free (2) | + Primeros Pasos | + Mi Equilibrio | + Mi Mundo en Foco (2) |
| :--- | :--- | :--- | :--- | :--- |
| Artículos | La ansiedad que no se apaga · Estar triste no es estar deprimido | Por qué no puedes dormir | Por qué dejas todo para después | El perfeccionismo no te hace mejor, te agota · TDAH en adultos |
| Programas | Programa Calma · Programa Enfoque | Programa Recargar | Programa Reconectar | Programa Equilibrio · Programa Presencia |
| Herramientas | Respiración 4-6-8 · Anclaje 5-4-3-2-1 | El diario de pensamientos | Cuestiona el pensamiento (reestructuración cognitiva) | La agenda del agrado (activación conductual) · Escaneo corporal |
| Audio | Aterriza · Empieza en calma | Dormir no es apagarse (podcast) | Por qué posponemos (podcast) | Suelta el día · La montaña |

**Totales acumulados por plan:** Free **8** piezas · Primeros Pasos **12** · Mi Equilibrio **16** ·
Mi Mundo en Foco **24**. A diferencia de las guías, aquí sí hay una escalera real: cada plan pago
efectivamente ve más biblioteca que el anterior.

**Blog público (2 piezas, siempre `free`, no requieren cuenta):** "5 mitos sobre ir al psicólogo" y
"Cómo apoyar a alguien que la está pasando mal". Son vitrina de captación (SEO/top de embudo), y también
cuentan como contenido de biblioteca gratuito porque son artículos `min_plan: free`.

**Nota técnica sobre el audio:** ninguna de las 6 piezas de audio tiene archivo real todavía
(`audio_url`/`external_embed_url` = null); la UI muestra "Audio próximamente". Para la valoración, el
"audio" hoy es guion/estructura lista pero sin producción de audio real — no cuenta como el mismo tipo
de activo terminado que un artículo o una herramienta interactiva.

---

## 3. Rehabilitación cognitiva (ejercicios/minijuegos)

Módulo completo y funcional que **no aparecía en ningún resumen o auditoría anterior de este proyecto**
— se descubrió al revisar el código para este inventario. Vive en `/rehabilitacion-cognitiva` +
`/ejercicios/$slug`, con catálogo en la tabla `cognitive_exercises` y progreso en
`user_exercise_sessions`. Minijuegos originales (no clones de plataformas como NeuronUp).

**Total real: 14 ejercicios publicados**, todos en franja de edad `adultos` (el sistema ya soporta
`ninos`/`adolescentes`/`adultos_mayores`, pero **no hay un solo ejercicio publicado todavía para esas
franjas** — es una capacidad construida pero con catálogo vacío fuera de adultos).

**Distribución por plan (esta es la única pieza de contenido, junto con la biblioteca, que sí
diferencia entre planes pagos):**

| Plan | Ejercicios | Ejemplos |
| :--- | :--- | :--- |
| Free (incluye 1 visible incluso sin cuenta) | 8 | Pares de memoria*, Stroop de colores, Cálculo mental, Encuentra el diferente, Cuenta rápido, Patrón igual, ¿Qué hora es?, ¿Qué día sigue? |
| + Primeros Pasos (esencial) | 4 | Secuencia, Figuras iguales, Ordena los pasos, Forma la palabra |
| + Mi Equilibrio (integral) | 2 | Emoción y situación, La respuesta adecuada |
| + Mi Mundo en Foco (premium) | 0 | — (premium hereda los 14, no tiene ejercicios exclusivos propios) |

\* "Pares de memoria" es el único marcado `visible_anonimo = true` (jugable sin cuenta, sin guardar progreso).

**Cobertura por área de rehabilitación** (`REHAB_AREAS`, objetivo de diseño declarado en el código:
"cada área debería llegar a ≥5 juegos"; un ejercicio puede tocar más de un área/dominio a la vez):

| Área | Ejercicios que la cubren | Estado vs. objetivo (≥5) |
| :--- | :--- | :--- |
| Atención | Stroop, Encuentra el diferente, Cuenta rápido, Patrón igual | 4 — cerca |
| Lenguaje | Forma la palabra, Ordena los pasos, Emoción y situación, La respuesta adecuada | 4 — cerca |
| Velocidad de procesamiento | Cálculo mental, Encuentra el diferente, Stroop | 3 — por debajo |
| Memoria | Pares de memoria, Secuencia | 2 — por debajo |
| Funciones ejecutivas | Ordena los pasos, Encuentra el diferente | 2 — por debajo |
| Habilidades visoespaciales | Figuras iguales, Patrón igual | 2 — por debajo |
| Cálculo | Cálculo mental, Cuenta rápido | 2 — por debajo |
| Orientación | ¿Qué hora es?, ¿Qué día sigue? | 2 — por debajo |
| Cognición social | Emoción y situación, La respuesta adecuada | 2 — por debajo |

**Implicación para la valoración:** el módulo es real, jugable y con progreso guardado — no es un
mockup — pero su catálogo todavía es de tamaño "demo" (2-4 ejercicios por área, ninguna área llega al
objetivo interno de 5). Es un diferenciador de producto legítimo frente a competencia que no lo tiene,
pero valorarlo como si fuera un catálogo maduro tipo NeuronUp sobrestimaría lo que hay hoy.

---

## 4. Acompañamiento humano (sesiones y seguimiento)

Fuente: `PLAN_SESSION_QUOTA` en `plans.ts`. Este es el componente de mayor costo marginal real (tiempo
de un terapeuta humano), a diferencia de las secciones 1-3 que son contenido de costo marginal ~0 una
vez producido.

| Plan | Sesiones incluidas / mes |
| :--- | :--- |
| Primer Contacto (free) | 0 |
| Primeros Pasos (esencial) | 1 |
| Mi Equilibrio (integral) | 4 |
| Mi Mundo en Foco (premium) | 8 |

Capacidades de plataforma que sostienen esto (construidas y en producción, no solo prometidas):
sistema de matching paciente-terapeuta, agenda/calendario de citas, mensajería/conversación
paciente-terapeuta, notificaciones, formulario de anamnesis, tests públicos de tamizaje (PHQ-9, GAD-7,
C-SSRS) con seguimiento de evolución, journaling estructurado, y un directorio público de especialistas
(Ola 3). Estas son funcionalidades de producto que habilitan el servicio, no "piezas" que se cuenten por
plan — están disponibles como parte de tener cualquier cuenta activa, y son las que en teoría permiten
que el acompañamiento de 1, 4 u 8 sesiones se sienta como seguimiento continuo y no como citas sueltas.

**B2B (empresas):** backend construido (cuenta empresarial completa, empleados vinculados visiblemente
a su empleador, reportes agregados/anónimos únicamente — nunca datos clínicos individuales), pero
**inactivo en producción**: la pieza de consentimiento del empleado está en estado de borrador,
pendiente de revisión legal antes de conectarse a producción. No debe incluirse todavía en una
valoración de ingresos actuales — es un servicio construido pero no vendible hoy.

---

## 5. Precios vigentes (Stripe, modo test)

| Plan | Precio | Periodo |
| :--- | :--- | :--- |
| Primeros Pasos (esencial) | $180.000 COP | /mes |
| Mi Equilibrio (integral) — destacado | $480.000 COP | /mes |
| Mi Mundo en Foco (premium) | $950.000 COP | /mes |
| Membresía "Mi Equilibrio, mes a mes" (solo contenido, sin sesiones) | $70.000 COP | /mes |
| Membresía "Mi Mundo en Foco, todo el año" (solo contenido, sin sesiones) | $700.000 COP | /año (≈10 meses) |

**Nota:** estos son los Payment Links de Stripe en **modo test** — según el roadmap, el paso a modo
producción (claves live) sigue pendiente. No son necesariamente los precios finales de lanzamiento, son
los precios sobre los que hoy se puede razonar.

---

## 6. Qué es real y qué es solo texto de venta (crítico para no sobrevalorar)

`PLAN_BENEFITS` en `plans.ts` (la fuente de los textos de venta) incluye beneficios que **no tienen
ningún módulo de backend detrás**, verificado por búsqueda directa en el código:

| Beneficio anunciado (plan) | ¿Tiene backend real? |
| :--- | :--- |
| "Alex — IA de apoyo" (integral+) | No. El propio texto ya dice "Próximamente" — es el único beneficio que la plataforma admite abiertamente que no existe aún. |
| "Webinars en vivo y meditaciones guiadas" (integral+) | No se encontró ninguna tabla, servicio ni ruta de webinars. Las "meditaciones guiadas" son las piezas de audio de la sección 2, que a su vez no tienen archivo de audio real todavía. |
| "Atención médica y psicológica integrada" (premium) | No se encontró módulo médico (historia clínica médica, recetas, especialidad médica) — solo lo psicológico está construido. |
| "Sesiones de apoyo para tu familia" (premium) | No se encontró un tipo de sesión familiar distinto en `sessionsService`/`appointmentService` — las sesiones son la misma cuota individual de la sección 4. |
| "Comunidad privada" (premium) | No se encontró ninguna funcionalidad de comunidad/foro/espacio grupal. |
| "Prioridad de agenda" (premium) | No hay un campo o regla de prioridad en el sistema de agenda revisado; la cuota de sesiones sí es real, la "prioridad" como mecánica no se verificó en código. |

Esto no significa que haya que quitar esas promesas de la página de ventas — son parte del
posicionamiento de Mi Mundo en Foco como el plan "todo incluido" — pero **para una valoración económica
rigurosa, el valor entregable verificable hoy en premium es: 8 sesiones/mes + 24 piezas de biblioteca +
20 guías (igual que cualquier plan pago) + 14 ejercicios cognitivos completos**, no los 5 beneficios de
la tabla de arriba. Si el precio de $950.000 se está justificando ante inversionistas o socios
corporativos citando esos beneficios, vale la pena decidir explícitamente si se construyen antes de
venderlos con más fuerza, o si se dejan como "hoja de ruta" y se ajusta el discurso comercial mientras
tanto.

---

## 7. Tabla maestra — qué recibe cada plan hoy (solo lo verificado en código/datos)

| | Primer Contacto (free) | Primeros Pasos ($180k/mes) | Mi Equilibrio ($480k/mes) | Mi Mundo en Foco ($950k/mes) |
| :--- | :--- | :--- | :--- | :--- |
| Sesiones/mes | 0 | 1 | 4 | 8 |
| Guías clínicas | 4 de 20 (vitrina) | 20 de 20 | 20 de 20 | 20 de 20 |
| Piezas de biblioteca (artículo/programa/herramienta/audio) | 8 de 24 | 12 de 24 | 16 de 24 | 24 de 24 |
| Ejercicios de rehabilitación cognitiva | 8 de 14 | 12 de 14 | 14 de 14 | 14 de 14 |
| Tests de tamizaje, journaling, matching, agenda, mensajería | Sí (todo plan con cuenta) | Sí | Sí | Sí |
| Beneficios "todo incluido" de venta (IA, webinars, médico, familia, comunidad, prioridad) | No | No | No | Anunciados, sin backend verificado |

**Lectura directa para pricing:** el salto de valor verificable entre Primeros Pasos → Mi Equilibrio →
Mi Mundo en Foco está sostenido casi enteramente por (a) la cuota de sesiones humanas, que es el único
costo marginal real y el que más justifica una escalera de precio empinada, y (b) una diferencia
modesta de contenido (4 piezas de biblioteca y 2 ejercicios cognitivos por salto de plan). Las guías no
aportan diferenciación entre pagos. Los beneficios "premium" de mayor peso discursivo (IA, médico,
familia, comunidad) todavía no tienen sustento técnico — si la valoración económica de Mi Mundo en Foco
depende de justificar su precio frente a Mi Equilibrio, hoy esa justificación descansa en 4 sesiones
extra al mes más que en cualquier otra cosa construida.
