# Contexto maestro — Mente en Foco

> **Propósito de este documento.** Es el punto de entrada único para cualquier persona o IA que retome el
> proyecto. Reúne las bases, la arquitectura, el estado real y todo el trabajo hecho, con enlaces a los
> documentos detallados. Si solo vas a leer un archivo, que sea este. Última actualización: **30 de julio
> de 2026** (sprint de coherencia; el cuerpo técnico sigue siendo el del 24 de julio salvo donde se indica).
>
> **⚠️ Puesta al día 18-ago-2026:** este cuerpo describe el estado hasta el 30-jul. Entre el 30-jul y el
> 14-ago se construyó bastante más — tests públicos (Ola 2), agenda unificada + citas, perfiles de terapeuta
> + motor de matching + solicitudes de contacto, notificaciones, "Mi camino", y el **sprint de RLS (33/37
> tablas)** que inició la fase de seguridad. **El estado más reciente y fiable vive en
> `01_ROADMAP_Y_TAREAS.md` (sección "✅ Cerrado en agosto") y en `contexto-proyecto/auditorias-tecnicas/`**
> (en especial `Diagnostico_Seguridad_Post_RLS_2026-08-14.md`). Este maestro se actualizará en el próximo
> sprint de coherencia.
>
> **Regla de mantenimiento:** todo el contexto detallado vive en `contexto-proyecto/`. Este archivo es el
> resumen navegable de esa carpeta. El tracker vivo (estado por módulo, siempre al día) es
> `contexto-proyecto/diagnostico-vivo/diagnostico_sitio.html` — ábrelo para el detalle más reciente.

---

## 0. ⛔ Antes de este documento — la filosofía del producto

**Este archivo describe *cómo está hecho* el producto. Tres documentos describen *por qué es como es*,
y tienen prioridad sobre todo lo demás — incluido este contexto y el roadmap.** Viven en
`contexto-proyecto/vision-producto/` y son de lectura obligatoria antes de modificar el producto:

| Documento | Qué responde |
| :--- | :--- |
| **`00_FILOSOFIA_MENTE_EN_FOCO.md`** | En qué creemos: qué es y qué NO es Mente en Foco, misión, visión, cómo entendemos la salud mental y las relaciones con paciente y terapeuta, y los **10 principios innegociables**. |
| **`03_DECISIONES_ARQUITECTONICAS.md`** | Qué se decidió y es irreversible: **13 ADR** con contexto, consecuencias y módulos afectados. |
| **`04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md`** | Cómo suena: voz, tono, lenguaje permitido/prohibido y cómo escribir cada tipo de mensaje. |

> [!warning] Precedencia
> Si algo de este contexto maestro, del roadmap o de una spec contradice esos documentos, **manda la
> filosofía**. Se detiene la tarea y se señala el conflicto (ADR-010).

Las **reglas no negociables de §4** siguen vigentes y son compatibles: la filosofía las amplía y les da
origen, no las reemplaza. Concretamente, §4.1 es ADR-006, §4.3 es ADR-007 y §4.5 es ADR-004.

---

## 1. Qué es Mente en Foco

Plataforma web integral de **salud mental y bienestar emocional** en Colombia. Ofrece: etapas de
acompañamiento psicológico, biblioteca de contenido escalonada por etapa, guías clínicas interactivas, y
un portal de usuarios (paciente, terapeuta, administrador) para gestión clínica.

> *Nota de coherencia (30-jul):* este párrafo decía "venta de planes… membresías de contenido… guías
> (gratuitas y premium)". Se reescribió porque ADR-003 establece que **un plan es una etapa de
> acompañamiento, no un producto**, y prohíbe el vocabulario de compra y el nombre "premium" para las
> etapas. El modelo de negocio no cambió; cambió cómo se nombra.

**Posicionamiento y diferenciador (foso defensivo):** a diferencia de la competencia de "bienestar"
(BetterHelp explícitamente no diagnostica; Selia toca psiquiatría pero no neuropsicología estructurada),
Mente en Foco se posiciona como la plataforma **clínicamente seria**: historia clínica real, valoración,
informe y evolución con estándar profesional (CIE-11, examen mental, firma electrónica, PDF). Enfoque
estricto en **salud mental y neuropsicología** — no medicina general.

**Enfoque de disciplinas:** Psiquiatría, Psicología Clínica, Neuropsicología, Fonoaudiología.

---

## 2. Stack tecnológico (versiones reales, de `package.json`)

**Frontend**
- React **19.2** + TypeScript **5.8**.
- Vite **7.3** (bundler) + Node.js 22.
- **TanStack Router 1.168** + **TanStack Start 1.167** — ruteo basado en archivos (`src/routes/`,
  `routeTree.gen.ts` generado). Patrón CSR con `@tanstack/react-query`.
- Tailwind CSS **4.2** (`@tailwindcss/vite`) + primitivas Radix UI + componentes estilo Shadcn.
- Diseño *glassmorphism* propio (`glass-card`, `card-neon-hover`).
- Formularios: React Hook Form **7.71** + Zod **3.24**. Iconos: Lucide React. PDF: **jsPDF 4.2**.

**Backend / BaaS**
- **Supabase** (`@supabase/supabase-js` **2.104**): Auth (email/password + Google OAuth), PostgreSQL con
  Row Level Security, Edge Functions.

**Pagos**
- **Stripe 22** — actualmente **Payment Links en modo test** (`stripe_links.json`). El webhook crea
  cuentas con contraseña = correo (deuda pendiente, ver §9).

**Despliegue**
- **Cloudflare Workers** vía `wrangler` (`wrangler.jsonc`: `nodejs_compat`, `main:
  "@tanstack/react-start/server-entry"`). Sin dominio propio configurado aún (decisión: dominio para la
  fase final). Existen también `Dockerfile` multi-stage y `nginx.conf` de una etapa previa de despliegue
  (Easypanel/Lovable).

**App móvil** (pausada, fase final): Expo/React Native en `mobile/`, Fase 1 (paciente) construida.

---

## 3. Metodología de trabajo — DOS IAs en paralelo (crítico entenderlo)

El proyecto se desarrolla con dos agentes con roles distintos:

- **Cowork (sandbox, este entorno):** audita, investiga (clínica y competencia), diseña specs, redacta
  prompts de handoff y mantiene la documentación. **No tiene** red a Supabase en vivo ni credenciales de
  `git push`. Comparte el **mismo árbol de archivos físico** con Claude Code (escrituras visibles al
  instante sin sync). Por eso escribe documentación/specs/scripts directamente, pero **entrega** todo
  cambio de `src/`/`supabase/` y todas las pruebas en vivo a Claude Code.
- **Claude Code (local, en la máquina del usuario):** ejecuta el código, corre migraciones contra
  Supabase real, prueba logueado con las cuentas de prueba, y hace `git push`. Tiene acceso de red y git
  completos.

**Flujo típico:** el usuario pide algo → Cowork investiga + escribe la spec en
`contexto-proyecto/especificaciones-producto/` + redacta un prompt en `contexto-proyecto/prompts-claude-code/`
→ el usuario se lo pasa a Claude Code → Claude Code lo construye, prueba y commitea → reporta de vuelta →
Cowork verifica contra el código/migraciones y actualiza el tracker y la memoria.

**Estándar de commits:** Conventional Commits (`feat(...)`, `fix(...)`, `refactor(...)`).

---

## 4. Reglas NO negociables del proyecto

1. **Backend antes que frontend.** Ninguna pantalla/botón/componente se construye si la funcionalidad que
   promete no existe ya de verdad en la base de datos (tabla, RLS, RPC probada). Si no hay backend, no hay
   interfaz — ni "para mostrar cómo se vería".
2. **Enfoque estricto en salud mental / neuropsicología.** Nada de medicina general o temas ajenos.
3. **Nunca fabricar contenido clínico.** Códigos CIE-11, criterios diagnósticos, escalas: solo material
   verificable. No reproducir texto con copyright (DSM-5-TR es propiedad de la APA — solo se usan nombres
   de categorías como sinónimos de búsqueda, nunca el catálogo ni los criterios).
4. **Español neutro/colombiano, tuteo — nunca voseo argentino.**
5. **Ética comercial en salud mental.** El mensaje comercial nunca coincide con un momento de crisis real
   (ej. resultados de C-SSRS quedan fuera de cualquier muro de pago). Nada de urgencia artificial,
   escasez falsa, ni reseñas/testimonios inventados.
6. **Privacidad de terceros.** Documentos clínicos reales que el usuario comparta como referencia se usan
   solo para extraer estructura, nunca se copian datos de pacientes al repo.

---

## 5. Base de datos — tablas y migraciones (en `supabase/`)

Migraciones aplicadas (orden cronológico):

| Migración | Qué hace |
| :--- | :--- |
| `20240514_security_sprint.sql` | Modelo base seguro; guías clínicas iniciales. |
| `20240514_b2b_clinical_prescriptions.sql` | `clinical_prescriptions`. |
| `20240514_fix_rls_patients.sql` | Ajustes RLS de pacientes. |
| `20260701_seed_cie11_directory.sql` | `cie11_directory` sembrada con los 161 códigos del capítulo 6 CIE-11. |
| `20260701_create_patient_anamnesis.sql` | `patient_anamnesis` (tabla real con RLS). |
| `20260701_expand_clinical_guides.sql` | +4 categorías de guías (Ánimo, Trauma, Alimentación, Memoria). |
| `20260701_secure_psychometric_evaluations.sql` | `psychometric_evaluations` + RLS. |
| `20260701_add_moca_mmse_scale_types.sql` | MoCA/MMSE como registro del clínico. |
| `20260701_secure_clinical_alerts.sql` / `fix_clinical_alerts_fk.sql` | `clinical_alerts` (crisis). |
| `20260703_plan_tiers_admin_rpcs.sql` | `plan_rank`, `min_plan`, vista `clinical_guides_meta`, RPCs admin. |
| `20260716_create_therapy_sessions.sql` | `therapy_sessions` (agenda, videollamada, recordatorios). |
| `20260717_create_messages.sql` | `messages` (chat paciente↔terapeuta). |
| `20260717_schedule_session_reminders.sql` | Cron de recordatorios por correo (pg_cron/pg_net). |
| `20260720_signup_gratis.sql` | Cuenta gratuita autoservicio + `visible_en_plan_gratis`. |
| `20260721_alert_resolution.sql` | Trazabilidad de resolución de alertas de crisis. |
| `20260721_free_plan_evaluation_limit.sql` | Trigger: 1 eval PHQ-9/GAD-7 al mes en plan Free (C-SSRS exento). |
| `20260721_mood_entries.sql` | `mood_entries` (tracker de ánimo). |
| `20260721_oauth_profile_automation.sql` | Trigger `handle_new_auth_user` (perfil automático en OAuth). |
| `20260721_profile_completion_fields.sql` | Cédula, teléfono, contacto de emergencia. |
| `20260721_service_requests.sql` | `service_requests` (solicitar servicio adicional). |
| `20260722_clinical_document_types.sql` | `document_type` en `clinical_notes` (valoración/informe/evolución) + `session_id` + `treatment_plan`. |

**Tablas núcleo:** `profiles` (role admin/therapist/patient, plan_type, subscription_status,
must_change_password, terms_accepted_at, cedula, emergency_contact_*), `clinical_guides` (+ vista
`clinical_guides_meta`), `clinical_notes` (3 tipos de documento, firma electrónica inmutable Res.
839/2017), `patient_anamnesis`, `psychometric_evaluations`, `clinical_alerts`, `therapy_sessions`,
`messages`, `mood_entries`, `service_requests`, `crm_leads`, `cie11_directory`, `telemetry_events`.

---

## 6. Rutas / páginas (en `src/routes/`)

**Públicas:** `index` (inicio), `asesoramiento` (planes), `membresia`, `guia` + `guias.$guiaId`,
`sobre-nosotros`, `contactanos`, `blog`, `faq`, `recursos`, `lineas-de-crisis`, `empresas`,
`servicios.$slug` (landings de disciplina). **Estas 6 últimas son de la Ola 1, ya construidas.**

**Auth / onboarding:** `ingresa` (login split-panel + Google OAuth), `consentimiento`, `completar-perfil`,
`nueva-contrasena`, `anamnesis`, `compra-exitosa`. Gate secuencial unificado (`resolveRequiredGate`):
contraseña temporal → consentimiento → completar perfil → anamnesis (staff exento salvo contraseña).

**Portal (logueado):** dashboards por rol (Patient/Therapist/Admin) + `pacientes.$patientId` (ficha de
paciente con documentos tipados y PDF firmado). App-shell con barra lateral (wave 1/3).

---

## 7. Estado por módulo (resumen; detalle en el tracker HTML)

| Módulo | Estado |
| :--- | :--- |
| Autenticación y roles | ✅ Refactorizado: Google OAuth, sin Facebook, login split-panel, gate unificado. |
| Freemium / límites / upsells | ✅ Anamnesis abierta a Free; límite 1 eval/mes; modal de upgrade Stripe; `service_requests`. |
| Anamnesis clínica | ✅ Sólido. |
| Evaluaciones (PHQ-9, GAD-7, C-SSRS, MoCA, MMSE) | ✅ Sólido (autoadministrables + registro del clínico). |
| Alertas de crisis | ✅ Trazabilidad completa de resolución. |
| Guías clínicas | ✅ 20 guías, filtrado por plan, dropdown de categorías, imágenes. **Sin paywall desde el 28-jul (ADR-001):** el plan filtra el catálogo; lo que no incluye no se lista. |
| Directorio CIE-11 / diagnóstico | ✅ Búsqueda con debounce, 161 códigos, examen mental, firma 839/2017. |
| Ficha de paciente + 3 tipos de documento + PDF | ✅ Construido (valoración/informe/evolución, PDF firmado). |
| Dashboards (paciente/terapeuta/admin) | ✅ Sobre service layer; app-shell con sidebar en progreso (1/3). |
| Agenda de sesiones | ✅ Backend probado + UI + calendario + recordatorios por correo (cron cada hora). |
| Mensajería paciente↔terapeuta | ✅ Chat + inbox + badge de no leídos, en `origin/main`. |
| Sitio público (Ola 1) | ✅ Servicios, recursos, empresas, home enriquecida, commit `5be9489`. |
| Planes y pagos (Stripe) | ⚠️ Modo test; webhook con contraseña=correo (pendiente, a propósito). |
| "Alex IA" (asistente 24/7) | ⚠️ Reformulado a "Próximamente"; sin backend. |

---

## 8. Roles, credenciales de prueba y modelo comercial

**Cuentas de prueba** (entorno de test; contraseña compartida `MenteFoco2026!Test`):
`admin@test.com`, `terapeuta@test.com`, `paciente.free@test.com`, `paciente.esencial@test.com`,
`paciente.integral@test.com`, `paciente.premium@test.com`. Los 4 pacientes tienen datos clínicos
sembrados (5 sesiones + notas + evaluaciones cada uno, 2 alertas de crisis resueltas) vía
`seed_clinical_demo_data.cjs`.

**Planes (4 niveles).** `plan_type` en BD no cambia; los **nombres de presentación** se renombraron a un
tono de inversión, no de "membresía": `esencial`→ **Primeros Pasos** · `integral`→ **Mi Equilibrio** ·
`premium`→ **Mi Mundo en Foco**. `free` sigue siendo **"Plan Gratuito"**.

> *Nota de coherencia (30-jul):* esta línea decía que `free` se renombró a *"Primer Contacto"*.
> **Nunca se aplicó**: el análisis de neuromarketing (22-jul) lo propuso marcándolo como *"opcional, de
> menor prioridad que los 3 de pago"*, y el código nunca cambió. La fuente de verdad es
> `src/lib/api/plans.ts`. Decisión abierta; recomendación en el informe del sprint de coherencia. Cupos de sesión:
free=0, esencial=1, integral=4, premium=8 (`PLAN_SESSION_QUOTA`).

**Acceso a contenido — modelo vigente (ADR-001 y ADR-002).** El plan **filtra** el catálogo: lo que la
etapa no incluye no se muestra, nunca aparece bloqueado. Dos reglas distintas conviven:
- **Guías:** cualquier etapa de pago da el catálogo completo (las 20 son `free` o `esencial`; ninguna
  exige integral o premium). Una cuenta gratuita ve 15.
- **Contenido (biblioteca):** sí escalona — **Free 8 · Primeros Pasos 12 · Mi Equilibrio 16 · Mi Mundo
  en Foco 24**, con los 4 tipos representados en cada etapa.

> *Nota de coherencia (30-jul):* la frase anterior de esta sección decía que la diferenciación entre
> planes "va en otros beneficios, nunca en acceso a guías". Sigue siendo cierta **para guías**, pero
> desde el 28-jul la biblioteca de contenido sí diferencia por etapa (ADR-002). Se corrige aquí para
> que no se lea como si el contenido tampoco escalonara.

Fuente única: `src/lib/api/plans.ts`. Detalle del razonamiento:
`analisis-estrategico/analisis-neuromarketing-planes-22-jul-2026.md`.

---

## 9. Deuda de seguridad pendiente (a propósito, para la fase final)

Agrupada por decisión explícita del usuario para el cierre del proyecto. **No resolver suelto** hasta que
el usuario indique el arranque de esa fase:
- **RLS desactivado** en 5 tablas para agilizar pruebas: `psychometric_evaluations`, `clinical_alerts`,
  `patient_anamnesis`, `therapy_sessions`, `messages`. Las policies ya están escritas y comentadas.
- Stripe en modo test; webhook con contraseña = correo.
- Resend: dominio sin verificar, `SITE_URL`/`REMINDER_FROM_EMAIL` sin setear, API key sin rotar, secret
  `DEV_MAIL_REDIRECT` por eliminar, sin captcha/rate-limit en `public-signup`.
- Dominio propio + verificación de la app en Google Cloud.
- Revisión jurídica de la política de tratamiento de datos (Ley 1581/2012). Nota: el consentimiento de
  datos del signup es un modal versionado aparte y **no** cubre el consentimiento clínico de salud (ese
  es el gap de terapeuta #1, aún abierto).

---

## 10. Marco regulatorio colombiano usado en las specs

Ley 1090/2006 (deontología del psicólogo, consentimiento informado, reserva de la historia clínica),
Resolución 1995/1999 (requisitos de historia clínica), Ley 1616/2013 (planes de tratamiento integral en
salud mental), Ley 1581/2012 (habeas data), Resolución DIAN 000227/2025 (facturación electrónica — 3
campos del comprador: nombre, tipo+nº de documento, correo → justifica capturar cédula), Resolución
839/2017 (firma electrónica e inmutabilidad — ya implementada en los documentos clínicos).

---

## 11. Investigación clínica (en `contexto-proyecto/investigacion-clinica/`)

Seis documentos originales del proyecto: CIE-11 (códigos salud mental), DSM-5-TR (clasificación, con la
nota de copyright), metodologías terapéuticas basadas en evidencia (TCC, activación conductual, MBCT, TIP,
CBT-E, EMDR, Maudsley…), neurología/comorbilidades/deterioro cognitivo, escalas de evaluación y estructura
de informes clínicos, y recomendaciones de implementación técnica. **Base obligatoria antes de redactar
cualquier guía o contenido clínico** — junto con la plantilla maestra de `guias-bienestar/`.

**Guías:** 20 publicadas en 8 categorías (Ansiedad, Autoestima, Infantil, Relaciones, Ánimo, Trauma,
Alimentación, Memoria). Plantilla de estructura fija y prompt generador reutilizable (para automatizar 1
guía cada 2 días) en `contexto-proyecto/guias-bienestar/`. 5 categorías nuevas propuestas (Personalidad
—dimensional CIE-11, no clusters—, Sueño, Estrés/Burnout, Adicciones, Perinatal), pendientes de
investigación antes de redactarse.

---

## 12. Investigación de competencia (en `contexto-proyecto/investigacion-competencia/scrape-2026-07-24/`)

Scrape profundo (24-jul) de **Selia, Terapify, Terapi (CL), BetterHelp, PorqueQuieroEstarBien**. Un `.md`
por plataforma + `06_Comparativa_y_gaps.md` (el documento accionable) + `07` (estructura del panel de
paciente de Selia, para inspirar el layout de dashboards).

**Gaps ALTA prioridad de Mente en Foco** (todos los comerciales los tienen y MeF no):
1. **Tests públicos sin login** (gancho de captación + SEO). MeF tiene PHQ-9/GAD-7/C-SSRS pero encerrados
   tras login.
2. **Matching / test de afinidad** paciente-terapeuta (MeF asigna manual por admin).
3. **Directorio navegable** con perfiles ricos + home más completa.

**Cómo funciona el "gratis" en cada una** (respuesta a una pregunta recurrente): PorqueQuieroEstarBien es
filantropía (Fundación Santo Domingo) y solo da orientación breve, no terapia continua. Selia regala tests
+ orientación de 20 min (sesión desde $100.000 COP). Terapify no da sesión gratis (solo garantía de cambio
de psicólogo). BetterHelp regala seminarios grupales (uno-a-muchos). **Regla:** nunca regalar el proceso
1-a-1; lo gratis es contenido de bajo costo marginal como puerta al servicio pago (el modelo freemium que
MeF ya monta).

---

## 13. Historial de trabajo (cronológico, 16→24 jul 2026)

- **16-jul:** agenda de sesiones (migración + UI + calendario), corrección de voseo en todo el sitio,
  mensajería paciente↔terapeuta, badge de no leídos, corrección del número de emergencias, "Alex IA" →
  "Próximamente".
- **19-jul:** recordatorios de sesión por correo desplegados (Resend, cron); Fase 1 de la app móvil
  (Expo, paciente) construida y luego pausada para priorizar la web.
- **20-jul:** gap analysis clínico del panel de terapeuta (7 gaps vs. Ley 1090/1995/1616); cuenta gratuita
  autoservicio construida y probada (captura de leads, 4 guías de vitrina).
- **21-jul:** refactor de auth (Google OAuth, sin Facebook, login rediseñado); lógica freemium (anamnesis
  abierta a Free, límite de evaluaciones, C-SSRS exento); upsells (modal Stripe + service_requests);
  retención (frase del día + mood tracker); trazabilidad de alertas de crisis (gap #4 cerrado);
  consentimiento de datos en modal versionado.
- **22-jul:** migración OAuth confirmada; **reorganización total del contexto** en `contexto-proyecto/`;
  ficha de paciente + 3 tipos de documento (valoración/informe/evolución) + PDF firmado (construido y
  verificado); enriquecimiento de documentos con plantillas reales de práctica profesional; fix del bug de
  visibilidad de guías (+ 9 casos rotos que encontró Claude Code); plantilla maestra y taxonomía de guías;
  curaduría de imágenes; fix de click en guía bloqueada; reorden de membresía; renombrado de planes.
- **24-jul:** scrape profundo de las 5 competidoras; plan de reestructuración de páginas públicas (3 olas);
  **Ola 1 construida y commiteada** (servicios, recursos, empresas, blog, faq, líneas de crisis, home
  enriquecida) + app-shell de portal con sidebar (1/3).

---

## 14. Roadmap / pendientes

**Reestructuración del sitio público (plan en `especificaciones-producto/09_...md`):**
- **Ola 1 — ✅ hecha** (contenido estático + guías destacadas + landings + recursos + empresas).
- **Ola 2 — pendiente:** Tests públicos (necesita tabla `public_tests`; sacar PHQ-9/GAD-7/Rosenberg/EAT-26/
  CBI/AIS/ACE del login). Es el mayor gancho de captación.
- **Ola 3 — pendiente (fase propia):** Encontrar especialista + directorio + matching (perfil profesional
  público, reseñas, lógica de match).

**Otros abiertos:** gap de terapeuta #1 (consentimiento informado clínico, distinto del de datos);
diferenciación de contenido de autocuidado (journaling, meditaciones audio, sesiones autodirigidas — estilo
Terapi); programas por situación de vida; terapia de pareja / orientación para padres; B2B; paridad móvil
del terapeuta; **fase de seguridad final** (§9). Placeholders de la Ola 1 a llenar con datos reales:
testimonios, equipo con credenciales, política de cambio de terapeuta.

---

## 15. Mapa de la carpeta `contexto-proyecto/`

- `00_INDICE_MAESTRO.md` — índice de la carpeta.
- **`vision-producto/`** — **filosofía, ADR y sistema de lenguaje. La carpeta de mayor jerarquía del
  proyecto: manda sobre el roadmap y sobre las specs.** Ver §0.
- `diagnostico-vivo/diagnostico_sitio.html` — **tracker vivo, la fuente de verdad más reciente.**
- `investigacion-clinica/` — CIE-11, DSM-5-TR, metodologías, neurología, escalas, implementación.
- `investigacion-competencia/` — perfiles de competidores + `scrape-2026-07-24/` (el detallado).
- `analisis-estrategico/` — freemium, auth/OAuth, neuromarketing de planes.
- `especificaciones-producto/` — specs técnicas numeradas 01–09 (la 09 es el plan de páginas públicas).
- `guias-bienestar/` — plantilla maestra, taxonomía y prompt generador de guías.
- `prompts-claude-code/` — todos los prompts de handoff, cronológicos.
- `auditorias-historicas/` — documentos de mayo–julio ya desactualizados, como referencia.

---

## 16. Si eres una IA que retoma el proyecto — arranque rápido

1. **Lee primero `contexto-proyecto/vision-producto/00_FILOSOFIA_MENTE_EN_FOCO.md` y
   `03_DECISIONES_ARQUITECTONICAS.md`.** Son obligatorios y tienen prioridad sobre este documento y
   sobre el roadmap. Si vas a escribir algún texto de interfaz, suma
   `04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md`.
2. Lee este documento entero y abre `contexto-proyecto/diagnostico-vivo/diagnostico_sitio.html` para el
   estado más reciente por módulo.
3. Interioriza las **reglas no negociables** (§4), especialmente *backend antes que frontend* y *no
   fabricar contenido clínico*.
4. Entiende la **división de labores** (§3): si operas como Cowork, investiga/especifica/documenta y
   entrega el código a Claude Code; no asumas acceso a Supabase en vivo ni a `git push` desde el sandbox.
5. Antes de proponer features nuevos, revisa `investigacion-competencia/scrape-2026-07-24/06_Comparativa_y_gaps.md`
   (qué falta) y `especificaciones-producto/09_...md` (el plan de olas).
6. Cualquier cambio de código real → escribe una spec en `especificaciones-producto/` y un prompt en
   `prompts-claude-code/`, luego actualiza el tracker HTML y la memoria. Ese es el ciclo del proyecto.
