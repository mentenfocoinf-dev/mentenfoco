# Prompt para Claude Code — Sembrar el contenido inicial + imágenes + enlazar el hub

Contexto: ya construiste el sistema de contenido (tablas + panel de revisión + lector). El usuario aprobó
el tono del artículo modelo, así que **ya tenemos las 12 piezas reales listas para sembrar**. Están en
`contexto-proyecto/contenido-plataforma/`, cada una como un `.md` con frontmatter YAML (= columnas de
`content_items`) + cuerpo markdown. El índice autoritativo con todo (slugs, categorías, min_plan, briefs de
imagen) es `contexto-proyecto/contenido-plataforma/MANIFIESTO_SIEMBRA.md` — léelo primero.

Objetivo de esta tanda: que un paciente entre a "Recursos" y vea una biblioteca llena, no un enlace solo.

## 1. Sembrar las 12 piezas como publicadas

Ajusta/usa tu `seed_content_items.cjs` para que recorra estas 4 carpetas y haga **upsert por `slug`**
(idempotente), parseando frontmatter + cuerpo:
- `contexto-proyecto/contenido-plataforma/articulos/` — 3 artículos (el cuerpo empieza tras el frontmatter;
  ya les quité las notas de producción, el cuerpo es 100% publicable).
- `contexto-proyecto/contenido-plataforma/programas/` — 3 programas (traen `program_steps` en el
  frontmatter; siémbralo en la columna jsonb).
- `contexto-proyecto/contenido-plataforma/herramientas/` — 3 herramientas.
- `contexto-proyecto/contenido-plataforma/audio/` — 3 audios (`audio_url`/`external_embed_url` = null → la
  UI muestra "Audio próximamente"; el `audio_kind` viene en el frontmatter).

Todas se siembran con `status='publicado'`, `author_id` = `admin@test.com`, `published_by` = ese mismo
admin, `published_at` = ahora. El frontmatter trae: `content_type`, `audio_kind`, `categoria`, `slug`,
`titulo`, `resumen_breve`, `cover_image`, `tiempo_lectura`, `min_plan`, `tags`, y según el tipo
`en_resumen`/`faq`/`key_takeaway`/`clinical_refs`/`program_steps`. Mapea lo que exista; lo que no venga,
déjalo null.

**Ojo con el frontmatter:** algunos campos son multilínea (listas, jsonb como `program_steps`,
`clinical_refs`, `faq`). Usa un parser YAML de verdad (no regex). Si algún artículo no trae `en_resumen`/
`faq` como campo estructurado y lo tiene dentro del markdown, no pasa nada — el cuerpo markdown se renderiza
completo igual; esos campos estructurados son un extra opcional.

## 2. Imágenes (`public/contenido/<slug>.jpg`)

Briefs completos en el manifiesto (sección "Briefs de imagen"). Donde indico reutilizar una guía existente,
**copia** el archivo de `public/guias/` al nuevo nombre en `public/contenido/`. Para las demás, descárgalas
de Pexels/Unsplash (libre, sin marca de agua, criterio no estigmatizante). Mi sandbox no puede bajar
binarios de bancos — por eso lo haces tú.

## 3. Enlazar el hub (lo que faltaba para que se vea)

Ahora que hay contenido, **enlaza `/contenido`**:
- En la sección "Recursos" del portal del paciente: agrega una tarjeta "Explorar contenido"
  (artículos, programas, herramientas, meditaciones) junto a la de guías existente.
- En el menú "Recursos ▾" de la navbar pública.
Sin dejar enlaces a páginas vacías: ya no lo están.

## 4. Verificación (recórrela y repórtame)

- `admin@test.com` → pestaña Contenido → "Todo el contenido" muestra **12 publicadas**.
- `paciente.free@test.com` → ve las piezas `free` completas y las `esencial` con candado/paywall.
- `paciente.premium@test.com` → ve las 12 completas.
- Un programa abre y sus pasos enlazan a los artículos/herramientas correctos; un audio muestra "Audio
  próximamente" + el resumen + su enlace cruzado.
- La sección "Recursos" del paciente y el hub `/contenido` ya NO están vacíos.

Repórtame el conteo final y cualquier pieza que no haya cuadrado (slug, imagen o enlace).
