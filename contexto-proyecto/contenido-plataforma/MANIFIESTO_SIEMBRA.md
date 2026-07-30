# Manifiesto de siembra — contenido de la plataforma (24 piezas + blog)

Índice autoritativo de todo el contenido para sembrar en `content_items`. Cada pieza es un `.md` con
frontmatter YAML (= columnas) + cuerpo markdown, en `contenido-plataforma/{articulos,programas,herramientas,audio,blog}/`.
El seed script recorre esas carpetas, parsea frontmatter + cuerpo, y hace **upsert por `slug`**
(idempotente). Autor de todas: `admin@test.com`; se siembran `status='publicado'`.

**Modelo SIN candados** (regla 28-jul): cada plan ve más biblioteca, nunca contenido bloqueado. El
`min_plan` de cada pieza define a partir de qué plan aparece. Distribución por tipo: 2 free · +1 esencial ·
+1 integral · +2 premium → acumulado **Free 8 · Primeros Pasos 12 · Mi Equilibrio 16 · Mi Mundo en Foco 24**.

## Asignación definitiva de `min_plan` (aplicar UPDATE a las existentes)

### Artículos (6) — `articulos/`
| Slug | Título | min_plan |
| :--- | :--- | :--- |
| `ansiedad-que-no-para` | La ansiedad que no se apaga | **free** |
| `estar-triste-no-es-estar-deprimido` | Estar triste no es estar deprimido | **free** |
| `por-que-no-puedes-dormir-aunque-estes-agotado` | Por qué no puedes dormir | **esencial** |
| `procrastinacion-no-es-pereza` | Por qué dejas todo para después | **integral** |
| `perfeccionismo-que-agota` | El perfeccionismo no te hace mejor, te agota | **premium** |
| `tdah-adultos-mente-a-mil` | TDAH en adultos | **premium** |

### Programas (6) — `programas/`
| Slug | Título | min_plan |
| :--- | :--- | :--- |
| `programa-calma` | Programa Calma (ansiedad) | **free** |
| `programa-enfoque` | Programa Enfoque (procrastinación) | **free** |
| `programa-recargar` | Programa Recargar (burnout) | **esencial** |
| `programa-reconectar` | Programa Reconectar (duelo) | **integral** |
| `programa-equilibrio` | Programa Equilibrio (regulación emocional) | **premium** |
| `programa-presencia` | Programa Presencia (mindfulness) | **premium** |

### Herramientas (6) — `herramientas/`
| Slug | Título | min_plan |
| :--- | :--- | :--- |
| `respiracion-4-6-8` | Respiración 4-6-8 | **free** |
| `anclaje-5-4-3-2-1` | Anclaje 5-4-3-2-1 | **free** |
| `diario-de-pensamientos` | El diario de pensamientos | **esencial** |
| `reestructuracion-cognitiva` | Cuestiona el pensamiento: 3 preguntas | **integral** |
| `activacion-conductual` | La agenda del agrado | **premium** |
| `escaneo-corporal` | Escaneo corporal | **premium** |

### Audio (6) — `audio/` (`audio_url`/`external_embed_url` = null → "Audio próximamente")
| Slug | Título | Tipo | min_plan |
| :--- | :--- | :--- | :--- |
| `meditacion-aterriza` | Aterriza (meditación) | meditación | **free** |
| `meditacion-empieza-en-calma` | Empieza en calma (meditación) | meditación | **free** |
| `podcast-dormir-no-es-apagarse` | Dormir no es apagarse (podcast) | podcast | **esencial** |
| `podcast-por-que-posponemos` | Por qué posponemos (podcast) | podcast | **integral** |
| `meditacion-suelta-el-dia` | Suelta el día (meditación) | meditación | **premium** |
| `meditacion-la-montana` | La montaña (meditación) | meditación | **premium** |

### Blog (2) — `blog/` — SIEMPRE `min_plan: free`, marcadas `es_blog: true`
| Slug | Título |
| :--- | :--- |
| `mitos-sobre-ir-al-psicologo` | 5 mitos sobre ir al psicólogo |
| `como-apoyar-a-alguien-que-la-esta-pasando-mal` | Cómo apoyar a alguien que la está pasando mal |

## Blog vs. Contenido (implementación)

- **`/contenido`** (con sesión): la biblioteca del miembro, los 24 ítems filtrados por su plan (sin
  candados). El blog (2) también puede aparecer aquí como artículos free.
- **`/blog`** (público, SEO): muestra los artículos `free` — los 2 marcados `es_blog: true` **más** los
  artículos de contenido con `min_plan: free` (`ansiedad-que-no-para`, `estar-triste-no-es-estar-deprimido`).
  Sin login, sin planes. Es la vitrina pública/captación. Detalle: `/blog/$slug`.
- El campo nuevo `es_blog boolean default false` marca las piezas escritas específicamente para el blog
  público (más divulgativas). No es obligatorio: `/blog` puede definirse simplemente como
  "content_type='articulo' AND min_plan='free'". `es_blog` sirve para curar cuáles destacar.

## Briefs de imagen (`public/contenido/<slug>.jpg`)

Reutilizar de `public/guias/` donde aplique; el resto de Pexels/Unsplash (libre, sin marca de agua, no
estigmatizante). Mi sandbox no baja binarios de bancos — lo hace Claude Code.

| Slug | Brief / reutilización |
| :--- | :--- |
| `ansiedad-que-no-para` | Reutilizar `guias/Cómo afrontar ataques de ansiedad.png`. |
| `estar-triste-no-es-estar-deprimido` | Reutilizar `guias/Entender un episodio depresivo.png`. |
| `por-que-no-puedes-dormir-aunque-estes-agotado` | Reutilizar `guias/Insomnio y descanso reparador.png`. |
| `procrastinacion-no-es-pereza` | Escritorio con tareas a medias / persona distraída, luz natural. |
| `perfeccionismo-que-agota` | Persona revisando algo con tensión / detalle minucioso; calma, no drama. |
| `tdah-adultos-mente-a-mil` | Mente/notas dispersas, post-its; estética luminosa, no caótica-negativa. |
| `programa-calma` | Persona respirando/serena, tono azul de marca. |
| `programa-enfoque` | Escritorio ordenado, una sola tarea, luz cálida. |
| `programa-recargar` | Reutilizar `guias/Manejo del estrés laboral.png`. |
| `programa-reconectar` | Reutilizar `guias/Cuando el duelo no avanza.png`. |
| `programa-equilibrio` | Persona en calma frente a agua/paisaje; equilibrio. |
| `programa-presencia` | Detalle de manos con taza / naturaleza, atención plena. |
| `respiracion-4-6-8` | Primer plano sereno respirando / naturaleza tranquila. |
| `anclaje-5-4-3-2-1` | Pies descalzos en el piso / manos tocando textura. |
| `diario-de-pensamientos` | Cuaderno y lápiz, luz natural, manos escribiendo. |
| `reestructuracion-cognitiva` | Persona pensativa mirando por ventana, luz suave. |
| `activacion-conductual` | Persona saliendo a caminar / pequeña actividad agradable. |
| `escaneo-corporal` | Persona acostada relajada / detalle sereno del cuerpo en calma. |
| `meditacion-aterriza` | Persona con ojos cerrados en calma, luz suave. |
| `meditacion-empieza-en-calma` | Amanecer suave por ventana / taza mañanera. |
| `podcast-dormir-no-es-apagarse` | Estética nocturna calmada / dormitorio sereno. |
| `podcast-por-que-posponemos` | Micrófono/audífonos, estética cálida de estudio. |
| `meditacion-suelta-el-dia` | Noche cálida, lámpara tenue. |
| `meditacion-la-montana` | Montaña serena al atardecer / paisaje estable. |
| `mitos-sobre-ir-al-psicologo` | Dos personas conversando con calidez / consultorio acogedor. |
| `como-apoyar-a-alguien-que-la-esta-pasando-mal` | Dos personas, una escuchando a la otra, manos/cercanía. |

## Verificación

- `admin@test.com` → "Todo el contenido" = **26 publicadas** (24 biblioteca + 2 blog; los 2 de blog son
  artículos free, así que también cuentan como biblioteca — ver conteos abajo).
- **Conteos por plan (sin candados, contenido de biblioteca):** Free 8+2 blog = 10 artículos-libres
  visibles; Primeros Pasos 12; Mi Equilibrio 16; Mi Mundo en Foco 24. En ningún caso aparece un candado.
- `/blog` (sin sesión) muestra los artículos free (los 2 de blog + los 2 artículos free) — sin login.
- Programas enlazan a sus pasos; audios muestran "Audio próximamente" + enlace cruzado.
