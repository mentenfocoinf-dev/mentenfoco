# Prompt para Claude Code — SEO técnico, hardening de lanzamiento y observabilidad

> Pégalo tal cual en Claude Code. Todo lo de aquí es **código/configuración del repo**, no gestiones
> externas (proveedor de hosting, dominio, Google Workspace, pasarela de pago para Colombia, etc. —
> esas decisiones siguen en `GUIA_ACTIVACIONES_MANUALES.html` y no se tocan en este prompt).

## Contexto

Se recibió un análisis externo (no específico de este proyecto) sobre todo lo que suele faltar antes de
lanzar una plataforma como esta: SEO técnico, seguridad, backups, monitoreo, CI/CD, etc. Se verificó
contra el código real cuáles de esos puntos ya están cubiertos y cuáles no. Este prompt cubre
**exclusivamente los que se confirmaron como huecos reales en el repo** (no se repiten los que ya
estaban resueltos: rate limiting de R3, CSP en `src/start.ts`, RLS, backups/PITR — esos ya están en el
roadmap con su propio dueño).

Antes de tocar nada: lee `contexto-proyecto/vision-producto/04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md`
(tono) y confirma en tu propia exploración que los hallazgos de abajo siguen siendo ciertos — este
prompt se escribió sin acceso a Supabase en vivo, solo leyendo código, así que verifica antes de asumir.

## ⛔ Alcance

Trabaja **por fases separadas**, cada una en su propio grupo de commits, con el mismo patrón de siempre:
FASE 0 (diagnóstico en vivo, sin escribir nada) → propuesta → aprobación → ejecución → verificación. No
mezcles fases distintas en un mismo commit. Si alguna fase toca RLS, backend o cualquier tabla, sigue el
protocolo completo de baseline + backup + rollback probado ya establecido en el proyecto — no lo repito
aquí, ya lo conoces.

---

## FASE A — SEO técnico (huecos confirmados: no hay ninguno de esto hoy)

1. **`robots.txt` real** en `public/robots.txt`. Debe permitir crawl de las rutas públicas
   (`/`, `/asesoramiento`, `/membresia`, `/guia`, `/guias/*`, `/contenido`, `/contenido/*`, `/blog`,
   `/blog/*`, `/servicios/*`, `/sobre-nosotros`, `/contactanos`, `/faq`, `/lineas-de-crisis`,
   `/empresas`, `/rehabilitacion-cognitiva`, `/tests`) y **bloquear explícitamente** todo lo
   autenticado/clínico (`/pacientes/*`, `/anamnesis`, `/completar-perfil`, `/conversacion/*`,
   `/notificaciones`, `/onboarding`, `/consentimiento*`, `/nueva-contrasena`, `/compra-exitosa`, y
   cualquier ruta de dashboard que encuentres). Referencia al sitemap (punto 2).

2. **`sitemap.xml`** generado, no estático a mano — tiene que reflejar exactamente las guías, piezas de
   contenido y posts de blog **publicados** en Supabase (no todos existen todavía como página real, y
   los nuevos se agregan seguido). Investiga en FASE 0 si conviene como ruta server-side de TanStack
   Start que arma el XML en cada request (con caché corta) o como script que lo regenera en build —
   dime cuál elegiste y por qué antes de implementarlo. Incluye solo rutas públicas indexables (la
   misma lista del robots.txt). Excluye cualquier guía/contenido con `status != 'publicado'`.

3. **`<link rel="canonical">` — no existe ni uno solo hoy.** Agrega un canonical por defecto en
   `__root.tsx` (usando la URL absoluta de la ruta actual) y verifica que las rutas con slug dinámico
   (`guias.$guiaId`, `contenido.$slug`, `blog.$slug`, `servicios.$slug`, `tests.$slug`,
   `ejercicios.$slug`) generen su propio canonical con el slug real, no el genérico del root. Esto
   importa especialmente donde puede haber query params o donde una pieza podría alcanzarse por más de
   una ruta.

4. **Auditoría de `robots: noindex` en rutas privadas.** Hoy solo `conversacion.$relationshipId.tsx`,
   `notificaciones.tsx` y `onboarding.tsx` lo hacen. **Confirmado que `anamnesis.tsx` y
   `pacientes.$patientId.tsx` NO tienen ningún override de `robots` y heredan `index, follow` del
   root** — son formulario de historia clínica y ficha de paciente respectivamente, no deberían ser
   indexables bajo ninguna circunstancia. Audita TODAS las rutas autenticadas/de dashboard
   (`PatientDashboard`, `TherapistDashboard`, `AdminDashboard` y cualquier ruta bajo esos, más
   `completar-perfil`, `consentimiento`, `consentimiento-clinico`, `nueva-contrasena`,
   `compra-exitosa`) y agrega `{ name: "robots", content: "noindex, nofollow" }` a cada una que no lo
   tenga. Considera extraer un helper (`headMetaPrivado()` o similar) para no repetir el objeto a mano
   en cada archivo y que sea imposible olvidarlo en una ruta nueva.

5. **Datos estructurados (JSON-LD) — no hay ninguno.** Agrega:
   - `Organization` en el layout raíz (nombre, logo, `sameAs` si hay redes reales).
   - `Article` en `blog.$slug.tsx` y `contenido.$slug.tsx` (título, fecha de publicación, autor).
   - `FAQPage` en `faq.tsx` si el contenido ya está en formato pregunta/respuesta.
   Sé conservador con el vocabulario clínico: no uses tipos de schema.org que impliquen diagnóstico
   médico automatizado (nada de `MedicalWebPage`/`MedicalCondition` con afirmaciones propias) — esto es
   contenido editorial/informativo, no una herramienta de diagnóstico, y el schema no debería sugerir lo
   contrario.

6. **Open Graph — completar lo que falta.** Ya existe `og:image`/`og:title` genérico en el root y en 11
   rutas puntuales (verificado). Revisa que TODAS las rutas de contenido público con slug dinámico
   (guías, contenido, blog, servicios) generen su propio `og:image` (usar `cover_image`/`imageName` de
   cada pieza, con fallback al banner genérico) — hoy varias probablemente heredan el genérico sin
   personalizar.

---

## FASE B — Legal/consentimiento público (hueco confirmado)

**No existe ninguna ruta pública de Política de Privacidad ni Términos y Condiciones.** Lo único
encontrado (`consentimiento.tsx`) es el flujo de consentimiento clínico dentro de la plataforma
(post-login), no una página pública enlazable desde el footer. Para una plataforma que recolecta datos
de salud mental esto no es opcional.

- Crea rutas públicas `/politica-privacidad`, `/terminos-y-condiciones` y `/politica-cookies` (esta
  última solo si FASE D de este mismo prompt se implementa; si no, sáltala por ahora).
- **No redactes el contenido legal tú mismo** — deja el texto como placeholder claramente marcado
  ("[PENDIENTE DE REVISIÓN LEGAL — no publicar así]") y avísame para que un abogado lo redacte/revise;
  esto ya está anotado como pendiente en el roadmap (P5, revisión jurídica). Tu trabajo aquí es solo
  dejar la infraestructura de rutas + enlaces desde el footer (`__root.tsx`) lista para recibir ese
  texto.

---

## FASE C — Webhook de Stripe: idempotencia (hueco confirmado)

Revisado `supabase/functions/stripe-webhook/index.ts`: **no hay ningún control de idempotencia** —
no se guarda ni consulta `event.id` de Stripe antes de aplicar los efectos del evento. Stripe garantiza
solo entrega "al menos una vez", no "exactamente una vez" — un reintento de red puede hacer que el mismo
`checkout.session.completed` llegue dos veces.

Con el fix reciente de la contraseña espejo, el efecto de una entrega duplicada hoy sería reenviar el
correo de recuperación de contraseña una segunda vez (molesto, no crítico) — pero cualquier efecto
nuevo que se agregue a futuro (facturación, notificación, conteo de sesiones) heredaría el mismo riesgo
si no se arregla ahora.

- Diagnóstico en vivo primero (FASE 0): ¿ya existe alguna tabla de eventos procesados o hay que crearla?
- Propuesta: tabla `stripe_processed_events (event_id text primary key, processed_at timestamptz)`
  (o el nombre que sigas usando en el proyecto), insertar el `event.id` ANTES de aplicar los efectos
  (o en la misma transacción), y salir temprano con 200 OK si el `event.id` ya existe — el objetivo es
  que reintentos de Stripe sean no-ops seguros, no que se rechacen (Stripe interpretaría un error como
  "reintentar más", empeorando el problema).
- Sigue el patrón de migración con backup/rollback ya establecido, aunque sea una tabla nueva pequeña.

---

## FASE D — Analítica y monitoreo mínimos (huecos confirmados: no hay nada de esto hoy)

**No se encontró ningún script de analítica (GA4, Clarity) ni ninguna integración de monitoreo de
errores (Sentry o similar) en todo el repo.** Antes de publicar en producción esto dejaría al equipo
sin forma de saber si algo se rompe o si el embudo de conversión funciona.

Esta fase depende de decisiones externas (qué proveedor usar, crear las cuentas) que no te corresponden
a ti — pero sí puedes dejar la integración lista para conectar el ID/DSN el día que se decida:

1. **Capa de eventos propia, desacoplada del proveedor.** Crea un helper simple
   (`src/lib/analytics.ts` o similar) con una función `track(evento, propiedades?)` que hoy solo haga
   `console.debug` en desarrollo y sea un no-op seguro si no hay proveedor configurado (variable de
   entorno ausente = no truena, no envía nada). Instrumenta como mínimo estos eventos donde ya existe
   la acción correspondiente en el código: `registro_completado`, `plan_consultado` (al ver
   `/asesoramiento`), `checkout_iniciado` (al hacer click en un Payment Link), `contenido_abierto` (al
   abrir una guía/pieza de contenido), `sesion_reservada` (al confirmar una cita en el sistema de
   agenda). El día que se decida GA4/Clarity/PostHog, conectar el proveedor real es cambiar una función,
   no reinstrumentar toda la app.
2. **Gancho para monitoreo de errores.** Deja un `try/catch` global o un error boundary de React (si no
   existe ya uno) que hoy solo haga `console.error` estructurado (sin datos clínicos ni PII en el
   mensaje), y dónde exactamente se conectaría un SDK de Sentry (o similar) cuando se cree la cuenta —
   coméntalo en el código con una nota clara, no lo dejes implícito.
3. **Endpoint de healthcheck.** Agrega una ruta simple (`/api/health` o equivalente en TanStack Start)
   que responda 200 con un JSON mínimo (estado del proceso, no de la base de datos si eso implica una
   query cara) — es lo que un servicio externo de uptime (UptimeRobot, BetterStack, etc.) necesita para
   avisar si el sitio cae. No mencionado en el análisis externo que recibí, pero es estándar antes de
   cualquier lanzamiento.

No crees cuentas de Sentry/GA/etc. tú — eso es un paso manual que va a `GUIA_ACTIVACIONES_MANUALES.html`.

---

## FASE E — CI (integración continua) — hueco confirmado

**No existe ningún workflow de CI** (`.github/workflows/` está vacío/no existe). Hoy nada impide que un
build roto o con tests en rojo llegue al Dockerfile de producción salvo que Claude Code o el usuario lo
noten manualmente.

- Crea un workflow de GitHub Actions mínimo que corra en cada push/PR a `main`: instalar dependencias,
  typecheck, lint (si existe), correr los 220 tests, y `build`. Que falle visiblemente si algo se rompe.
- **No agregues despliegue automático (CD) en este paso** — el despliegue a Easypanel sigue siendo
  decisión aparte del usuario; esto es solo la red de seguridad de "no mergear código roto".

---

## FASE F — Extras de bajo esfuerzo, alto valor (no mencionados en el análisis externo que recibí)

Ninguno de estos requiere decisiones externas, son puramente técnicos:

1. **`public/.well-known/security.txt`** (RFC 9116): un archivo de 5 líneas con un contacto para
   reportes de vulnerabilidad responsable. Estándar en cualquier plataforma que maneje datos sensibles,
   y hoy no existe.
2. **`manifest.json` (PWA) + `apple-touch-icon`**: no existe ningún manifest — hoy si alguien intenta
   "Agregar a pantalla de inicio" en móvil no pasa nada bien. Es un archivo pequeño (nombre, íconos,
   color de tema) que ya tienes disponible en `/GOLO.png`.
3. **Confirmar que el 404 real devuelve status HTTP 404, no 200.** Existe `NotFoundComponent` en
   `__root.tsx`, pero verifica en SSR que el servidor responda con el código de estado correcto — un 404
   que responde 200 confunde a Google (indexa páginas "que no existen") y es un error común en apps SPA
   migradas a SSR.
4. **Verificación de Google Search Console**: deja un meta tag `<meta name="google-site-verification"
   content="PENDIENTE">` comentado o hendido en el root, listo para pegar el código real el día que el
   usuario registre la propiedad — evita que se olvide en medio de otras 40 tareas.

---

## Verificación antes de terminar (cada fase)

- Build ✓ y los tests en verde después de cada fase (no acumules fases sin probar).
- Para FASE A: prueba manual con al menos una guía, una pieza de contenido y un post de blog reales —
  confirma que el canonical, el OG image y el JSON-LD de cada uno apuntan a datos correctos, no al
  genérico.
- Para FASE A punto 4: dame la lista completa de rutas que terminaste marcando `noindex` — quiero
  verificarla contra el árbol de rutas completo antes de dar por cerrado ese punto.
- Para FASE C: prueba explícitamente el caso de reenviar el mismo `event.id` dos veces (simulado, no en
  Stripe real) y confirma que la segunda vez es un no-op limpio con 200 OK.
- No hace falta esperar mi aprobación entre fases si cada una es independiente y de bajo riesgo (A, D,
  E, F) — sí espera aprobación explícita antes de tocar la tabla nueva de FASE C (toca datos de pagos) y
  antes de publicar cualquier texto de FASE B (aunque sea placeholder, confírmame el copy exacto antes
  de que quede visible en producción).

## Entrega

Al cerrar cada fase: qué archivos tocaste, capturas o confirmación de la verificación de arriba, y
commit(s) siguiendo Conventional Commits (`feat(seo): ...`, `fix(webhook): ...`, `chore(ci): ...`). No
mezcles fases en un mismo commit aunque las hagas en la misma sesión.
