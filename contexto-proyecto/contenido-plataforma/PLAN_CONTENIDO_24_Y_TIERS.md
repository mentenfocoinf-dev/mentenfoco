# Plan de contenido: de 12 a 24 piezas + escalera de planes + blog

Objetivo (28-jul): doblar el contenido a 24 piezas para que la diferencia entre planes **pagos** sea real
(hoy todos los pagos ven lo mismo). Investigación previa (demanda 2025: burnout, autoestima, TDAH,
procrastinación, perfeccionismo, regulación emocional) + base clínica del repo. **Regla: cero temas
repetidos** — ni con las guías existentes ni entre piezas de contenido.

## Temas ya usados (NO repetir)

- Contenido actual: ansiedad, depresión (triste vs. deprimido), sueño/insomnio, duelo, burnout;
  herramientas de respiración/anclaje/diario; audios de grounding, sueño y cierre del día.
- Guías existentes (tampoco repetir): autoestima/autoconcepto, diálogo interno, límites sanos, comunicación
  en pareja, memoria/demencia, atracones/alimentación, motricidad, berrinches, apego, apoyo escolar,
  ruptura.

## Las 12 piezas NUEVAS (temas frescos, alto impacto, con evidencia)

**Artículos (3):**
1. `procrastinacion-no-es-pereza` — "Por qué dejas todo para después (y no es pereza)". Procrastinación
   como evitación emocional. (Alta demanda, fresco.)
2. `perfeccionismo-que-agota` — "El perfeccionismo no te hace mejor, te agota". Perfeccionismo
   desadaptativo. (Alta demanda.)
3. `tdah-adultos-mente-a-mil` — "TDAH en adultos: cuando tu mente va a mil y nada se termina". (TDAH =
   top de búsquedas; encaja con el diferenciador neuro de MeF.)

**Programas (3):**
1. `programa-enfoque` — Enfoque: vencer la procrastinación y sostener lo que empiezas.
2. `programa-equilibrio` — Equilibrio emocional: manejar emociones intensas sin que te arrastren.
3. `programa-presencia` — Presencia: atención plena para el día a día.

**Herramientas (3):**
1. `reestructuracion-cognitiva` — "Cuestiona el pensamiento: 3 preguntas que lo cambian todo" (TCC).
2. `activacion-conductual` — "La agenda del agrado: pequeñas dosis de bienestar" (activación conductual).
3. `escaneo-corporal` — "Escaneo corporal: suelta la tensión que ni notas" (body scan).

**Audio (3):**
1. `meditacion-empieza-en-calma` — Meditación matutina de intención (5 min).
2. `podcast-por-que-posponemos` — Podcast sobre procrastinación y enfoque.
3. `meditacion-la-montana` — Meditación "La montaña": estabilidad ante emociones difíciles.

## Escalera de planes (24 piezas = 6 por tipo, acumulativo, SIN candados)

Cada plan ve **más** biblioteca; nunca contenido bloqueado. Distribución por tipo: 2 free · +1 esencial ·
+1 integral · +2 premium. Totales acumulados: **Free 8 · Primeros Pasos 12 · Mi Equilibrio 16 · Mi Mundo
en Foco 24.**

| Tipo | free (2) | esencial +1 | integral +1 | premium +2 |
| :--- | :--- | :--- | :--- | :--- |
| **Artículos** | ansiedad-que-no-para · estar-triste-no-es-estar-deprimido | por-que-no-puedes-dormir | procrastinacion-no-es-pereza | perfeccionismo-que-agota · tdah-adultos-mente-a-mil |
| **Programas** | programa-calma · programa-enfoque | programa-recargar | programa-reconectar | programa-equilibrio · programa-presencia |
| **Herramientas** | respiracion-4-6-8 · anclaje-5-4-3-2-1 | diario-de-pensamientos | reestructuracion-cognitiva | activacion-conductual · escaneo-corporal |
| **Audio** | meditacion-aterriza · meditacion-empieza-en-calma | podcast-dormir-no-es-apagarse | podcast-por-que-posponemos | meditacion-suelta-el-dia · meditacion-la-montana |

**Nota:** esto reasigna el `min_plan` de varias piezas existentes (ej. `programa-calma` pasa a free,
`diario-de-pensamientos` a esencial, `meditacion-suelta-el-dia` a premium). La tabla de arriba es la
asignación **definitiva**; el prompt de Claude Code aplica el UPDATE. Cada tier tiene siempre los 4 tipos
representados, así que ningún plan se queda sin programas/herramientas/audio.

## Blog vs. Contenido (resolución del solapamiento que notaste)

Tienes razón: "Blog y artículos" y "Contenido" mostraban artículos, y confunde. La separación limpia:

- **Contenido** (`/contenido`, con sesión) = la **biblioteca del miembro**: artículos + programas +
  herramientas + audio, escalonada por plan. Es la experiencia dentro de la plataforma.
- **Blog y artículos** (`/blog`, público) = la **cara pública y de SEO**: muestra los **artículos
  gratuitos** (los `free`), sin login y sin planes. Es el top del embudo — atrae tráfico y capta leads.
  "Llenar el blog" = tener buenos artículos gratuitos, que es justo lo que la escalera garantiza (los
  artículos free alimentan el blog).

Así no hay redundancia confusa: el blog es la vitrina pública de los artículos gratis; el contenido es la
biblioteca completa del miembro. Los mismos artículos free aparecen en ambos a propósito (uno para captar,
otro para la experiencia de miembro). Para darle cuerpo al blog desde ya, se suman 2 artículos de blog
cortos y públicos (mitos sobre terapia, cómo apoyar a alguien) — ver `blog/`.

## Fuentes de la investigación

- [Temas de psicología más buscados 2025](https://www.pageon.ai/es/blog/psychology-research-topics)
- [Autocompasión vs. autocrítica (evidencia, cortisol)](https://jesusmatos.net/autocompasion-vs-autocritica-el-entrenamiento-que-baja-el-cortisol/)
- Base clínica propia: `investigacion-clinica/03_Metodologias_Terapeuticas_Basadas_en_Evidencia.md` y `04_Neurologia_...md`.
