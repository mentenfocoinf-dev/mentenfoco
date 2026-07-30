# Prompt para Claude Code — Fixes de UX: menús, modelo SIN candados, editor del terapeuta

Tres cambios pedidos el 28-jul. El más importante es un **cambio de filosofía de producto** (el nº 2):
nunca mostrar contenido bloqueado. Léelos completos antes de tocar código.

## 1. Fondo opaco en los menús desplegables

Al abrir los menús principales de la navbar (Servicios ▾, Recursos ▾) el fondo es transparente y el texto
se pierde contra el patrón de fondo. Dale al panel del dropdown un **fondo sólido y legible** (blanco/near-
white con sombra, o el glass pero con opacidad suficiente para contraste AA), manteniendo la línea de
marca. Verifica el contraste del texto sobre el fondo del hero con olas.

## 2. CAMBIO DE FILOSOFÍA: cero pantallas de bloqueo en todo el contenido

Decisión explícita del usuario, y **reemplaza** la lógica anterior de "mostrar todo el catálogo con
candado + paywall". El nuevo modelo:

- El contenido (guías **y** `content_items`) se **filtra por plan**: el usuario ve **solo las piezas que su
  plan incluye**, renderizadas completas. Las que no incluye, **no se muestran** (no aparecen como tarjetas
  con candado).
- **Quita** de los listados y detalles de guías/contenido: los badges de candado/plan, el `PaywallModal`, y
  la vista de "Contenido Premium" con preview borrosa. Nada debe llevar a una pantalla de "adquiere un plan
  para ver esto".
- **Público / sin sesión y página de inicio:** ven el set **gratuito**, sin candados. Donde antes iba un
  candado, va —si acaso— una invitación cálida y opcional a crear cuenta ("Crea tu cuenta y accede a más
  contenido"), nunca una barrera. La home no muestra piezas bloqueadas.
- **Más plan = más piezas visibles**, de forma acumulativa. El campo `min_plan` **se queda** (sigue
  definiendo a partir de qué plan aparece cada pieza); lo que cambia es el **renderizado**: en vez de
  "traer todo y bloquear", "traer solo lo concedido". En la práctica: los servicios/consultas de listado
  filtran por `plan_rank(min_plan) <= plan_rank(plan_del_usuario)` y ya no exponen el resto.
- Revisa `guia.tsx`, `guias.$guiaId.tsx`, el hub y detalle de `/contenido`, `PaywallModal.tsx`, y los
  servicios `guidesService`/el de contenido. El objetivo es que **no exista ningún camino** que termine en
  una pantalla de bloqueo por plan.

Por qué: el usuario quiere que la plataforma se sienta como un espacio de salud mental, no como una máquina
de cobrar. Ver contenido bloqueado daña esa percepción. La diferenciación entre planes se da por *cuánta*
biblioteca ves, no por candados.

### Rebalanceo de `min_plan` (para que el set gratuito sea completo)
Hoy los 3 programas están en `esencial`, así que un usuario Free se quedaría sin ningún programa. Ajusta
para que el set Free tenga al menos ~1 pieza de cada tipo (artículo, programa, herramienta, audio). Cuando
el usuario entregue el contenido nuevo (ver roadmap, "duplicar contenido"), afinamos la distribución
completa por tier. Por ahora deja el Free equilibrado.

## 3. Simplificar el editor del terapeuta (y mover el SEO al admin)

En "Nueva propuesta de contenido" del terapeuta:
- **Quita** el campo **URL (slug)** y el campo **Plan mínimo**. El terapeuta no debe decidir esto.
- Cambia el copy a algo cálido y humano. Los terapeutas quieren compartir su artículo/investigación con la
  comunidad, no lidiar con jerga de SEO ni con "guías de estilo". Ejemplos de reemplazo:
  - Ayuda de la sección: en vez de "Sigue la guía de estilo: gancho de apertura, secciones con 'qué
    ganas'…", algo como: *"Comparte lo que trabajas con tus pacientes. Escribe con tus palabras; nuestro
    equipo editorial lo revisa y le da el toque final antes de publicarlo."*
  - Campos que quedan para el terapeuta: **Tipo, Categoría, Título, Resumen breve, Tiempo de lectura,
    Contenido (markdown)**. Botones: Guardar borrador / Enviar a revisión (igual).
- **El admin**, al revisar y antes de publicar, completa: **slug, meta título, meta descripción y plan/tier**.

### Backend que esto requiere
- Añade a `content_items` (migración nueva): `meta_title text`, `meta_description text`. `slug` pasa a ser
  **nullable** hasta que el admin publique (o autogenerado provisional desde el título, editable por el
  admin). Al publicar, el admin debe fijar slug + meta_title + meta_description + min_plan; considera un
  check/validación de que un `content_item` no pueda quedar `publicado` sin slug.
- En el panel del admin, el formulario de publicación gana esos 4 campos (slug editable con auto-sugerencia
  desde el título, meta título, meta descripción, y selector de plan/tier). Ese es el único lugar donde se
  decide el SEO y el tier.

## Verificación
- Menús: texto legible sobre el hero de olas.
- Sin sesión y como Free: NO aparece ninguna tarjeta con candado ni ninguna pantalla de "adquiere un plan";
  se ve el set gratuito completo (con al menos 1 de cada tipo) y, a lo sumo, una invitación suave a crear
  cuenta. Como premium: se ve más biblioteca. En ningún caso un bloqueo.
- Editor del terapeuta: sin slug ni plan, copy amable. Panel del admin: al publicar puede fijar slug + meta
  título + meta descripción + tier; un contenido no se publica sin slug.
- Repórtame el recorrido y cualquier lugar donde todavía sobreviva un candado/paywall de contenido.
