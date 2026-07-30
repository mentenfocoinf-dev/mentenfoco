# Sistema de contenido de la plataforma — schema + workflow editorial

Objetivo: montar el área de contenido del portal del paciente (artículos/blog, programas, herramientas,
audio) con un **flujo de publicación real**: los terapeutas pueden redactar y **enviar a revisión**, pero
**solo los administradores publican**. Basado en el estudio editorial de Selia (ver
`contenido-plataforma/00_guia_estilo_redaccion.md`) y en la decisión del usuario (24-jul): incluir los 4
apartados; el audio arranca con **resúmenes de temas de alto impacto** (los archivos de audio se agregan
después); empezar con schema + 1 artículo modelo para aprobar el tono antes de producir en volumen.

Regla del proyecto: **backend antes que frontend.** Este documento define primero las tablas; nada de UI
de contenido se construye sin ellas.

## 1. Un solo modelo unificado: `content_items`

Cuatro tipos de contenido comparten el mismo flujo editorial (redacción → revisión → publicación) y el
mismo gating por plan, así que conviene **una tabla unificada** con campos específicos por tipo, en vez de
4 tablas paralelas. Es más simple para el panel de revisión del admin (una sola cola) y para el listado.

```sql
create type content_type as enum ('articulo', 'programa', 'herramienta', 'audio');
create type audio_kind  as enum ('meditacion', 'podcast');   -- solo cuando content_type='audio'
create type content_status as enum (
  'borrador',            -- el autor lo está escribiendo
  'en_revision',         -- enviado por un terapeuta, esperando al admin
  'cambios_solicitados', -- el admin pidió ajustes (con notas)
  'aprobado',            -- el admin lo aprobó, listo para publicar
  'publicado',           -- visible para los pacientes/público según plan
  'archivado'            -- retirado de circulación
);

create table content_items (
  id uuid primary key default gen_random_uuid(),
  content_type   content_type not null,
  audio_kind     audio_kind,                 -- null salvo audio
  categoria      text not null,              -- reutiliza la taxonomía de guías (Ansiedad, Ánimo, Trauma, Sueño...)
  titulo         text not null,
  slug           text unique not null,
  resumen_breve  text not null,              -- 1 frase, para las tarjetas del listado
  cover_image    text,                       -- nombre de archivo en public/contenido/ (ver §5)
  tiempo_lectura text,                        -- "8 min" (artículos) o duración del audio
  -- CUERPO (markdown, se renderiza con ReactMarkdown igual que las guías) --
  body_md        text,                        -- el artículo/herramienta completo en markdown
  en_resumen     text[],                      -- bullets del bloque "En resumen"
  faq            jsonb,                        -- [{ "q": "...", "a": "..." }]
  key_takeaway   text,                         -- la frase de cierre / conclusión destacada
  clinical_refs  jsonb,                        -- fundamentación: [{ "fuente": "...", "nota": "..." }]
  -- CAMPOS DE AUDIO (para más adelante; ahora solo se llena el resumen del tema) --
  audio_url         text,                      -- archivo propio, cuando exista
  external_embed_url text,                     -- embed de YouTube/Spotify, si se usa
  -- PROGRAMA: lista ordenada de pasos/módulos (cada uno puede enlazar a otro content_item) --
  program_steps  jsonb,                        -- [{ "orden": 1, "titulo": "...", "descripcion": "...", "content_item_id": "uuid|null" }]
  -- GATING Y ETIQUETAS --
  min_plan       plan_type not null default 'free',  -- mismo gating que las guías
  tags           text[],
  -- WORKFLOW EDITORIAL --
  status         content_status not null default 'borrador',
  author_id      uuid not null references profiles(id),   -- terapeuta o admin que lo redactó
  reviewed_by    uuid references profiles(id),            -- admin que revisó
  reviewed_at    timestamptz,
  review_notes   text,                                    -- feedback del admin al terapeuta
  published_by   uuid references profiles(id),            -- SIEMPRE un admin
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

**Tabla opcional de versiones** (`content_revisions`) para guardar el historial de cambios cuando un admin
edita lo que envió un terapeuta — recomendable pero no bloqueante para la v1; se puede añadir después.

## 2. Roles y permisos (el corazón del pedido)

- **Terapeuta:** crea `content_items` en estado `borrador`; edita **solo los suyos** mientras están en
  `borrador` o `cambios_solicitados`; los envía con "Enviar a revisión" (→ `en_revision`). **No puede
  publicar.** Ve el estado de sus envíos y las `review_notes` del admin. Es la opción de "ayudar a nutrir
  el blog" que pediste.
- **Administrador:** ve el **panel de revisión** (cola de `en_revision`), y puede: **aprobar**
  (→ `aprobado`), **solicitar cambios** (→ `cambios_solicitados` con `review_notes`), **editar** cualquier
  ítem, y **publicar** (→ `publicado`, `published_by = su id`). Puede además crear y publicar directamente
  (su propio contenido puede saltar a `publicado`). Puede `archivar`. **Es el único con potestad de dejar
  algo en `publicado`.**
- **Paciente / público:** solo lee ítems en `publicado`, con el gating de `min_plan` (igual que las guías:
  cualquier plan pago desbloquea; algunos ítems quedan libres como vitrina).

## 3. RLS (se escribe ahora, se activa en la fase de seguridad como el resto)

- `SELECT` público/paciente: solo `status = 'publicado'` y `plan_rank(min_plan) <= plan_rank(mi_plan)`
  (misma lógica que `clinical_guides`).
- `SELECT` del autor: sus propios ítems en cualquier estado.
- `SELECT` admin: todo.
- `INSERT`: terapeutas y admins (autor = `auth.uid()`).
- `UPDATE` a `status='publicado'` o `published_by`: **solo admin** (constraint + policy). Un terapeuta no
  puede autopublicarse aunque manipule el cliente.
- `UPDATE` de contenido: el autor mientras esté en `borrador`/`cambios_solicitados`; el admin siempre.

## 4. Estructura de cada tipo de contenido (qué va en `body_md` y campos)

La **anatomía y el tono** están en `contenido-plataforma/00_guia_estilo_redaccion.md` (extraída de Selia).
Resumen por tipo:

- **Artículo:** `body_md` con la anatomía completa (hook → secciones con "qué ganas" → "qué esperar" →
  conclusión), + `en_resumen[]`, + `faq`, + `key_takeaway`, + `clinical_refs`. Ejemplo completo:
  `contenido-plataforma/articulos/articulo-modelo-01.md`.
- **Programa:** `resumen_breve` + `body_md` (hero emocional + "qué vas a lograr") + `program_steps` (los
  módulos ordenados, cada uno puede apuntar a un artículo/herramienta existente). Estructura tipo "Programa
  Duelo" de Selia pero con nuestro tono.
- **Herramienta / ejercicio:** `body_md` con la instrucción paso a paso + `clinical_refs`. Más corto y
  accionable que un artículo (tipo el `ejercicioPractico` de las guías, pero como pieza propia).
- **Audio (meditación/podcast):** por ahora **solo el resumen del tema** de alto impacto (`resumen_breve` +
  `body_md` con la descripción del tema y qué trabaja), `audio_url`/`external_embed_url` en null hasta que
  existan las grabaciones. Ejemplos: `contenido-plataforma/audio-temas/`.

## 5. Imágenes

Las imágenes de contenido van en `public/contenido/` con nombre = slug del ítem (igual convención que
`public/guias/`). **Mi sandbox no puede descargar de bancos de imágenes** (allowlist), así que la
descarga la hace Claude Code con briefs curados; donde el tema coincida con una guía existente se puede
reutilizar la imagen de `public/guias/`. Los briefs por ítem van junto a cada pieza de contenido.

## 6. Qué NO cambia / se reutiliza

- El renderizado markdown (ReactMarkdown + remark-gfm) ya existe para guías — se reutiliza.
- El gating por plan (`plan_rank`/`min_plan`/`clinical_guides_meta`) — mismo patrón.
- La taxonomía de categorías de `guias-bienestar/01_taxonomia_categorias.md` — compartida entre guías y
  contenido.
