# Resumen de desarrollo — Mente en Foco

> Compilado el 24 de agosto de 2026, directamente contra el código, las migraciones y el historial de
> git real del repositorio (no solo contra la documentación). Cubre todo lo construido desde el primer
> commit de producto hasta hoy.

---

## 1. Qué es Mente en Foco

Plataforma web de salud mental y bienestar emocional en Colombia: etapas de acompañamiento psicológico,
biblioteca de contenido escalonada, guías clínicas interactivas, y un portal de paciente / terapeuta /
administrador para gestión clínica real. Se posiciona como la alternativa **clínicamente seria** frente a
la competencia de "bienestar" genérico: historia clínica real, CIE-11, examen mental, firma electrónica.

## 2. Stack tecnológico

**Frontend:** React 19.2 + TypeScript 5.8, Vite 7.3 + Node 22, TanStack Router/Start (ruteo por
archivos), Tailwind CSS 4.2 + Radix/Shadcn, React Hook Form + Zod, jsPDF.
**Backend:** Supabase (Auth, PostgreSQL con Row Level Security, Edge Functions en Deno).
**Pagos:** Stripe 22 (modo test, Payment Links).
**Despliegue:** Cloudflare Workers vía `wrangler`.
**Móvil:** Expo/React Native, Fase 1 (paciente) construida y pausada.
**Metodología:** dos agentes en paralelo — Cowork (specs, documentación, sin red a Supabase ni push) y
Claude Code (ejecuta, prueba contra Supabase real, hace commit y push).

---

## 3. Línea de tiempo real (git log, primer commit de producto → hoy)

- **Abril 2026:** scaffold inicial del proyecto (template TanStack Start) y primera versión de la web
  ("Añadió web de salud mental").
- **Mayo 2026:** primer intento de despliegue en Easypanel/Lovable — Docker, Nginx, Node 22, limpieza de
  claves de Stripe hardcodeadas.
- **1 jul:** fundación clínica — catálogo CIE-11 (161 códigos), anamnesis real, PHQ-9/GAD-7, 4 categorías
  de guías nuevas, C-SSRS + MoCA/MMSE.
- **17 jul:** `therapy_sessions`, RPCs de plan, capa de servicios tipada en `src/lib/api`, dashboards
  reconstruidos sobre esa capa, mensajería paciente↔terapeuta.
- **19-21 jul:** recordatorios de sesión por correo (cron), Fase 1 app móvil (Expo, pausada), auth
  reescrita (OAuth Google, sin Facebook, login split-panel), lógica freemium, upsells, mood tracker,
  trazabilidad de alertas de crisis, consentimiento de datos.
- **22-23 jul:** ficha de paciente con 3 tipos de documento + PDF firmado, fix de visibilidad de guías,
  paywall corregido (después eliminado, ver más abajo).
- **24-25 jul:** scrape de 5 competidores, **Ola 1** del sitio público (servicios, recursos, empresas,
  home), app-shell de portal con sidebar.
- **28-30 jul:** sistema editorial de contenido (terapeuta→admin→publicado), 12 piezas sembradas, tests
  públicos, comentarios de blog, consentimiento clínico, modelo sin paywall.
- **5-14 ago:** sprint de seguridad RLS (33/37 tablas activadas, 98 políticas).
- **30 jul - 14 ago (código):** agenda unificada, matching + perfiles de terapeuta, notificaciones,
  Journey Engine — todo construido pero sin commitear hasta el 20-ago.
- **20 ago:** gobernanza de git de todo lo anterior — 4 commits que pusieron en `git log` semanas de
  trabajo que solo existían en disco (sprint de seguridad + epoch de aplicación completo).
- **22-24 ago:** cola final de backend — rate-limit y captcha de signup, fix del webhook de Stripe,
  cierre de una exposición de datos real (ADR-013), journaling, directorio público de especialistas,
  backend de Empresas/B2B (inerte), UI admin de B2B, fix de copy.

---

## 4. Funcionalidades construidas, por área

### Fundación clínica
- Catálogo CIE-11 completo (161 códigos, capítulo 6) con búsqueda.
- Anamnesis clínica real (tabla propia, RLS).
- Evaluaciones psicométricas: PHQ-9, GAD-7, C-SSRS (autoadministrables, con manejo de riesgo) + MoCA/MMSE
  (registro del clínico).
- Alertas de crisis con trazabilidad completa de resolución (quién, cuándo, qué acción).
- Ficha de paciente con 3 tipos de documento (valoración / informe / evolución) + PDF firmado
  electrónicamente (Resolución 839/2017, inmutable).

### Portal, roles y auth
- Autenticación: login split-panel, Google OAuth (sin Facebook), gate de onboarding unificado
  (contraseña temporal → consentimiento → perfil → anamnesis).
- Dashboards por rol (paciente / terapeuta / admin) sobre una capa de servicios tipada, con app-shell de
  barra lateral.
- Cuenta gratuita autoservicio con captura de leads.
- Freemium: anamnesis abierta a Free, límite de evaluaciones (C-SSRS exento), upsells conectados a Stripe.
- Mensajería paciente↔terapeuta con badge de no leídos.
- Retención: frase del día + tracker de ánimo.

### Guías, contenido y blog
- 20 guías clínicas en 8 categorías. **Sin paywall desde el 28-jul (ADR-001):** el plan filtra el
  catálogo, nunca bloquea con candado.
- Sistema editorial de contenido: tabla `content_items` (artículo/programa/herramienta/audio), workflow
  terapeuta→admin (solo admin publica), 12 piezas redactadas y sembradas, escalera por plan
  (Free 8 · Primeros Pasos 12 · Mi Equilibrio 16 · Mi Mundo en Foco 24).
- Blog interactivo separado de Contenido, con comentarios de pacientes moderados por el admin.

### Sitio público
- **Ola 1** (24-jul): landings de Servicios, Recursos, Empresas, Blog, FAQ, Líneas de crisis, home
  enriquecida.
- **Ola 2 — Tests públicos** (30-jul): GAD-7, PHQ-9, Rosenberg sin login, resultado inmediato con manejo
  de riesgo, captación opcional (no muro). C-SSRS excluido por seguridad.
- **Ola 3 — Directorio de especialistas** (23-ago): ruta pública `/especialistas` sobre una vista
  `public_therapist_directory`; decisión de negocio: el paciente elige. Contactar sigue exigiendo cuenta.

### Agenda y matching
- Agenda unificada (`appointments` + `therapy_sessions`): disponibilidad por instantes, contraofertas,
  aceptación del paciente, fuente única de horas ocupadas.
- Motor de matching (`matchingService`) + solicitudes de contacto (`therapist_contact_requests`), usado
  dentro del portal en "Mi camino" y ahora también alimentando el directorio público.
- Perfiles de terapeuta (`therapist_profiles`) con especialidades de vocabulario cerrado (enum
  `theme_key`), incluidas ya `relaciones_vinculos` (pareja) y `crianza_infancia` (padres).

### Notificaciones y autocuidado
- `notifications` + Journey Engine (`journey_events`, append-only) + sección "Mi camino" del paciente.
- Journaling estructurado (23-ago): diario privado del paciente, dueño-únicamente, con prompts guiados
  opcionales y borrado propio.

### B2B / Empresas (23-24 ago)
- Backend construido e **inerte a propósito**: entidad `companies` (pipeline de negociación, sin
  precios), vínculo `company_members`, consentimiento específico y revocable `employer_link_consents`
  (nunca reutiliza el consentimiento clínico), métricas agregadas con k-anonimato (umbral 5, nunca
  desagregado por persona).
- UI admin para gestionar el pipeline de empresas ya construida.
- El vínculo empleado↔empresa y los reportes **no están activos**: el texto del consentimiento espera
  revisión jurídica real, mismo patrón que se usó con el consentimiento clínico.

---

## 5. Seguridad — el arco completo

- **Sprint RLS (5-14 ago):** Row Level Security activado y verificado en 33 de 37 tablas, 98 políticas,
  0 FORCE. Las 4 tablas sin RLS están justificadas (catálogos públicos o tablas muertas pendientes de
  DROP).
- **Diagnóstico post-RLS (14-ago):** identificó el riesgo dominante real — no RLS, sino la falta de
  recuperación (cero backups) — y dejó un plan ordenado R1-R6.
- **R4 cerrado:** `service_role` ya no puede vaciar `journey_events` con TRUNCATE (saltaba el trigger
  append-only).
- **R5 cerrado:** el trigger de `therapist_time_blocks` ya no cancela en silencio los DELETE de
  `service_role`.
- **R3 backend cerrado:** rate-limit real (5/hora, 20/día por IP) en `public-signup`; captcha Turnstile
  cableado en Edge Function y frontend, en espera de las claves reales (fail-safe: sin claves, se omite
  el captcha pero el rate-limit sigue activo).
- **Vulnerabilidad real encontrada y cerrada — webhook de Stripe:** creaba la cuenta del paciente con
  **contraseña = su correo electrónico** (adivinable por cualquiera que supiera el email). Corregido con
  contraseña aleatoria + enlace de recuperación por correo.
- **Vulnerabilidad real encontrada y cerrada — sobre-exposición del directorio de terapeutas
  (ADR-013):** `therapist_profiles` exponía a cualquier visitante anónimo la tabla completa, incluido el
  número de licencia profesional y perfiles inactivos. Cerrada con una vista pública de columnas
  permitidas y revocación del acceso directo.
- **`admin-create-user` corregido:** ahora fuerza cambio de contraseña en el primer acceso, igual que ya
  hacía el registro público.
- **Pendiente, todo del lado del responsable (nunca de código):** activar backups/PITR (R1, crítico),
  rotar la clave de Resend y verificar el dominio propio (R2), retirar un secret de desarrollo (R6,
  depende de R2), cargar las claves de Turnstile, pasar Stripe a modo real, dominio propio, y la revisión
  jurídica (cubre el consentimiento clínico y el nuevo consentimiento de vínculo B2B).

## 6. Gobernanza de código

Todo el trabajo de agosto (agenda, matching, notificaciones, seguridad) existió primero en disco sin
comitear — un riesgo equivalente a no tener backups, pero para código. Se resolvió con dos rondas de
commits gobernados por fases (inventario completo → propuesta de agrupación temática → aprobación
explícita → ejecución), verificando en cada paso que build y los 220 tests automatizados pasaran antes de
comitear. Resultado: todo el código real del proyecto está hoy en `git log`, con mensajes que siguen
Conventional Commits, y publicado en `origin/main`.

## 7. Estado actual de la base de datos

**42 tablas · RLS activo en 38 · 108 políticas · 275 funciones · 20 enums.** Build y suite de 220 tests
automatizados en verde en cada cambio de esta cola. Toda migración de este periodo se aplicó con la
misma disciplina: baseline medido en vivo, backup del objeto tocado, prueba en transacción revertida,
varias pasadas de idempotencia, comparación de invariantes antes/después, rollback real probado, y
documentación en `contexto-proyecto/auditorias-tecnicas/`.

## 8. Lo que queda pendiente

**Bloqueado por acción externa del responsable (no es código):**
- Activar backups/PITR en Supabase (el más urgente — hoy cualquier corrupción es pérdida permanente).
- Rotar la clave de Resend y verificar el dominio propio.
- Cargar las claves de Cloudflare Turnstile.
- Retirar el secret `DEV_MAIL_REDIRECT` (depende de lo anterior).
- Dominio propio + verificación en Google Cloud.
- Pasar Stripe a modo real.

**Bloqueado por decisión o revisión legal:**
- Revisión jurídica de la política de tratamiento de datos, que ahora cubre dos consentimientos: el
  clínico (ya construido, texto pendiente) y el nuevo de vínculo B2B (ya construido, inerte).
- Activar el vínculo empleado↔empresa y sus reportes agregados, una vez resuelto lo anterior.

**Evaluado y cerrado sin necesidad de desarrollo:**
- Terapia de pareja / orientación para padres: el vocabulario de especialidades ya cubre ambos casos;
  es un asunto de contenido y de que el terapeuta marque su especialidad, no de código nuevo.

**Sin empezar, de menor prioridad:**
- Paridad móvil del terapeuta (hoy la app Expo solo tiene la Fase 1 de paciente).
- Automatización de contenido (guías/artículos nuevos), audio real, 5 categorías de guías nuevas.
- DROP de las 2 tablas muertas (`test_scores`, `guides`) — depende de que haya backups primero.

---

## 9. Dónde vive todo

- `contexto-proyecto/vision-producto/` — filosofía y 13 ADR, manda sobre todo lo demás.
- `00_CONTEXTO_MAESTRO_MENTE_EN_FOCO.md` — contexto técnico completo (stack, arquitectura, tablas).
- `01_ROADMAP_Y_TAREAS.md` — checklist vivo, la fuente más actualizada del estado del proyecto.
- `contexto-proyecto/auditorias-tecnicas/` — todos los informes de seguridad y remediación con evidencia.
- `contexto-proyecto/prompts-claude-code/` — historial completo de instrucciones de desarrollo.
