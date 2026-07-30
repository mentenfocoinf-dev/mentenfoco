# Prompt para Claude Code — Título duplicado, blog interactivo, separación estricta y rediseño

Cuatro frentes pedidos el 29-jul. Regla del proyecto: **backend antes que frontend** en todo lo que toque
datos. Léelo completo antes de empezar.

---

## 1. Título duplicado al entrar a un contenido

En el detalle de contenido/guía/blog el título sale **dos veces**: una en el hero (desde el frontmatter) y
otra como primer `# H1` del cuerpo markdown. Arréglalo en el **renderer**: al mostrar el cuerpo, **omite el
primer encabezado H1** (o el H1 cuyo texto coincida con el título). No lo resuelvas borrando los `#` de cada
`.md` — hazlo en el componente lector para que aplique a todo (guías, contenido y blog) de una vez.

---

## 2. Separación ESTRICTA de Guías / Contenido / Blog (regla nueva del usuario)

Regla, sin excepciones: **Guías, Contenido y Blog son 3 secciones distintas, con reglas distintas. Ninguna
pieza se publica en más de una, y ningún tema se repite entre secciones.**

- **Guías** (`/guia`) = las guías clínicas estructuradas existentes (tabla `clinical_guides`). No cambian.
- **Contenido** (`/contenido`) = biblioteca del miembro: `content_type` en (`articulo`, `programa`,
  `herramienta`, `audio`). **NO** muestra blog.
- **Blog** (`/blog`) = sección propia e **interactiva** (ver punto 3). `content_type = 'blog'`.

Cambios que esto exige:
- Agrega `'blog'` al enum `content_type`. Los 2 posts de blog (`blog/`) vienen ya con `content_type: blog`
  en su frontmatter (`autor_rol`, `admite_comentarios`). Reasigna en la siembra.
- **Quita el "espejo" del blog**: `/blog` deja de mostrar artículos free de Contenido. `/blog` muestra
  **solo** `content_type='blog'`. `/contenido` filtra fuera los `blog`. Elimina/retira la lógica de
  `es_blog` que hacía que el blog jalara artículos de contenido (y la columna si ya no se usa).
- Verifica que ningún ítem aparezca en dos rutas.

> **Nota / pendiente que NO ejecutes aún (requiere OK del usuario porque implica mover/retirar piezas):**
> hoy Guías y Contenido **comparten temas** (ansiedad, depresión, sueño, duelo, estrés) — eso viola la regla
> nueva. La propuesta de reconciliación está en `01_ROADMAP_Y_TAREAS.md`; el usuario debe aprobarla antes de
> tocar esas piezas. Por ahora solo separa Blog de Contenido (arriba), que es lo no destructivo.

---

## 3. Blog interactivo: comentarios de pacientes con moderación

El blog deja de ser una lista de artículos y pasa a ser un espacio de comunidad: un terapeuta publica un
post y los **pacientes pueden comentar** aportando técnicas y recomendaciones para otros; esos comentarios
**se revisan antes de publicarse**.

**Backend primero:**
- Tabla `blog_comments`: `id`, `post_id` (fk a `content_items` con `content_type='blog'`), `author_id`
  (paciente), `body text`, `status` (`pendiente` | `aprobado` | `rechazado`, default `pendiente`),
  `reviewed_by`, `reviewed_at`, `created_at`.
- Regla (trigger + RLS, como el resto): un comentario **solo pasa a `aprobado` si lo aprueba un admin**
  (opcionalmente también el terapeuta autor del post). El público ve solo comentarios `aprobado`; el
  paciente ve además los suyos propios en `pendiente`. Un paciente no puede autopublicar su comentario.
- Deja las policies escritas/comentadas como en las demás tablas si RLS sigue apagado en pruebas.

**Frontend:**
- En el detalle de un post de blog (`/blog/$slug`): debajo del artículo, lista de comentarios **aprobados**
  + un formulario para comentar (solo pacientes con sesión). Al enviar: "Tu comentario fue enviado y se
  publicará tras revisión". Muestra al paciente su propio comentario en estado "en revisión".
- En el panel del admin: una **cola de moderación de comentarios** (aprobar / rechazar), junto a la de
  contenido. Opcional: el terapeuta autor ve/modera los comentarios de sus propios posts.
- Cada post de blog trae `admite_comentarios: true` en su frontmatter; respétalo (si algún post lo pone en
  false, no muestra la caja de comentarios).

---

## 4. Rediseño: menos plano, más profesional (con imágenes de alta calidad)

El usuario ve la página muy plana (planes, "cómo funciona el proceso", y en general). Incorpora imágenes de
alta calidad **alusivas** al tema, y dos rediseños concretos. Cuida SIEMPRE que **el texto se lea bien**
(overlays/contraste sobre imágenes).

### 4a. Tarjetas de planes con animación de volteo
Rediseña las tarjetas de plan (en `/membresia` y `/asesoramiento`) al estilo tarjeta limpia y moderna
(como una tarjeta con imagen, bordes redondeados y sombra suave):
- **Cara frontal:** nombre del plan, precio, una línea de descripción, y un botón **"Descubrir plan"**
  (ya no "Adquirir"/"Elegir" directo).
- Al hacer clic en "Descubrir plan", la tarjeta **se voltea con animación 3D** (flip) y muestra la **cara
  trasera** con el detalle del plan (la lista de beneficios).
- Al final de la cara trasera, ahí sí, el botón **"Adquirir plan"** (el checkout actual) + un botón para
  volver a voltear.
- Que se vea limpio y profesional; mantené el resaltado del plan "Más popular". Texto siempre legible.

### 4b. "Cómo funciona el proceso" como infografía
Convierte la sección actual (4 tarjetas numeradas planas) en una **infografía gráfica**: iconos dentro de
círculos, conectados entre sí (líneas/flechas), estética como un diagrama de proceso profesional. Cada paso
con su ícono alusivo (ej. conversación, valoración, acompañamiento, seguimiento), título y descripción
breve, con la línea que guía la vista de un paso al siguiente. Que se entienda de un vistazo.

### 4c. Imágenes de alta calidad en toda la página
Suma imágenes temáticas de alta resolución donde hoy hay bloques planos: hero del inicio, cabecera de
Planes, landings de Servicios, Empresas, Recursos, Nosotros. Descárgalas de Pexels/Unsplash (libres, sin
marca de agua, **criterio no estigmatizante** — nada de imágenes que se lean como "ahogándose",
"desplomado", etc.), alta resolución, y con overlay/gradiente donde vaya texto encima para que se lea. Van
en `public/` con nombres claros.

---

## Verificación (recórrela y repórtame)

- Entrar a cualquier contenido/guía/blog: el título aparece **una sola vez**.
- `/blog` (sin sesión): solo posts de blog (los 2), con su detalle; NO aparecen artículos de contenido.
  `/contenido` no muestra los posts de blog. Ninguna pieza en dos secciones.
- Como paciente con sesión: puedo comentar en un post; el comentario queda "en revisión" y no es público
  hasta que el admin lo apruebe. Como admin: veo la cola de comentarios y puedo aprobar/rechazar; un
  aprobado aparece público. Un paciente NO puede autopublicar (probar por API).
- Planes: la tarjeta muestra "Descubrir plan", se voltea con animación, la cara trasera tiene el detalle y
  "Adquirir plan"; texto legible.
- "Cómo funciona" se ve como infografía con íconos y conexiones, no como tarjetas planas.
- Imágenes nuevas cargan (200), alta calidad, texto legible encima.
- Repórtame qué quedó pendiente o si alguna imagen no cumplió el criterio.
