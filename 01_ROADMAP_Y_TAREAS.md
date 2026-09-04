# Roadmap y tareas — Mente en Foco

> **Cómo usar este documento.** Es la lista viva de tareas del proyecto, en formato checklist. Marca
> `- [x]` lo hecho y `- [ ]` lo pendiente. Está pensado para que tengas siempre a la mano qué falta, sin
> tener que pedir que se actualice nada. Complementa a `00_CONTEXTO_MAESTRO_MENTE_EN_FOCO.md` (el contexto
> completo) y reemplaza al viejo `diagnostico_sitio.html` como tracker del día a día.
> Última actualización: **21 de agosto de 2026** (puesta al día tras el trabajo de agosto: agenda unificada,
> perfiles de terapeuta + motor de matching, notificaciones, el sprint de RLS 33/37, y la cola de backend
> del 20-21 ago: journaling, directorio público Ola 3 + cierre de sobre-exposición ADR-013, fix de
> `admin-create-user`, backend B2B inerte). El cuerpo previo del 29-jul se conserva intacto abajo; lo nuevo
> va en la sección **"✅ Cerrado en agosto"** y en los estados actualizados del plan de trabajo.

---

## ⛔ Este roadmap está subordinado a la filosofía

Antes de ejecutar cualquier tarea de esta lista, lee **`contexto-proyecto/vision-producto/`**:

- **`00_FILOSOFIA_MENTE_EN_FOCO.md`** — en qué creemos (10 principios innegociables).
- **`03_DECISIONES_ARQUITECTONICAS.md`** — qué se decidió y es irreversible (ADR-001 a ADR-013).
- **`04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md`** — cómo suena todo texto de interfaz.

**Si una tarea de este roadmap contradice alguno de esos documentos, manda la filosofía**: se detiene
la tarea y se señala el conflicto (ADR-010). El roadmap se ajusta a la filosofía, nunca al revés.

Los principios de abajo siguen vigentes y están recogidos y ampliados en los ADR — se mantienen aquí
tal cual para no perder el histórico de cuándo se adoptó cada uno.

---

## 🎯 Principios de producto (no negociables)

- [x] Backend antes que frontend (nada de UI sin datos reales detrás).
- [x] Enfoque estricto en salud mental / neuropsicología.
- [x] Nunca fabricar contenido clínico; español neutro, tuteo, sin voseo.
- [x] **Cero pantallas de bloqueo** (28-jul). Se filtra por plan y se muestra solo lo concedido; nunca
  candados ni paywall. Más plan = más piezas.
- [x] **NUEVO (29-jul): Guías / Contenido / Blog son 3 secciones separadas, con reglas distintas.** Ninguna
  pieza se publica en más de una, y ~~ningún tema se repite entre secciones~~ **cada sección trata el tema
  con su propio propósito y voz**. Guías = guías clínicas estructuradas (GUIAR); Contenido = biblioteca
  (artículo/programa/herramienta/audio) que EXPLICA; Blog = espacio comunitario e interactivo que CONVERSA
  (posts de terapeuta + comentarios moderados de pacientes).
  > *Corrección de coherencia (30-jul):* la exclusividad temática se anotó aquí el 29-jul por la mañana y
  > **quedó derogada el mismo día** al resolver A3 (ver más abajo) y formalizarse como **ADR-009**: un
  > mismo tema puede vivir en las tres secciones; lo prohibido es que dos digan lo mismo con la misma voz.
  > Se deja el texto tachado, no eliminado, para que quede el registro de la regla anterior.

---

## ✅ Completado (lo que ya está construido y verificado)

### Base clínica y de datos
- [x] Catálogo CIE-11 (161 códigos capítulo 6) sembrado.
- [x] Anamnesis clínica real con tabla propia y RLS.
- [x] Evaluaciones psicométricas: PHQ-9, GAD-7, C-SSRS (autoadministrables) + MoCA/MMSE (del clínico).
- [x] Alertas de crisis con trazabilidad de resolución (quién y qué acción).
- [x] Ficha de paciente + 3 tipos de documento (Valoración / Informe / Evolución) + PDF firmado.
- [x] Datos de prueba sembrados (5 sesiones + notas + evaluaciones por paciente).

### Portal y roles
- [x] Auth: login split-panel, Google OAuth, sin Facebook, gate de onboarding unificado.
- [x] Dashboards por rol (paciente / terapeuta / admin) con app-shell de barra lateral.
- [x] Agenda de sesiones + calendario + recordatorios por correo (cron cada hora).
- [x] Mensajería paciente↔terapeuta + badge de no leídos.
- [x] Cuenta gratuita autoservicio (captura de leads).
- [x] Freemium: anamnesis abierta a Free, límite de evaluaciones (C-SSRS exento), upsells conectados a Stripe.
- [x] Retención: frase del día + tracker de ánimo.

### Guías y contenido
- [x] 20 guías clínicas en 8 categorías, con dropdown de categorías.
- [x] Renombrado de planes a Primeros Pasos / Mi Equilibrio / Mi Mundo en Foco (solo labels).
- [x] Sistema de contenido: tabla `content_items` (artículo/programa/herramienta/audio) + workflow
  terapeuta→admin (solo admin publica, blindado por trigger).
- [x] Panel de revisión del admin + editor del terapeuta + lector `/contenido`.
- [x] 12 piezas de contenido redactadas (3 artículos, 3 programas, 3 herramientas, 3 audios) — sembradas.
- [x] Sitio público Ola 1: landings de Servicios, Recursos, Empresas, Blog, FAQ, Líneas de crisis, home enriquecida.

> **Nota (18-ago):** lo anterior es el estado hasta el 29-jul. Todo el trabajo de agosto (tests públicos,
> agenda unificada, matching, notificaciones, "Mi camino", sprint RLS) está en la sección
> **"✅ Cerrado en agosto"** más abajo, para no reescribir el histórico de julio.

---

## ✅ Cerrado el 28–29 jul (por Claude Code)

- [x] **Arreglos de UX (28-jul):** menús desplegables con fondo opaco/legible; modelo **sin candados** en
  guías y contenido (filtra por plan, muestra solo lo concedido, se quitaron `PaywallModal` y preview
  borrosa); editor del terapeuta simplificado (sin slug ni plan, copy amable) con el admin fijando slug +
  meta título + meta descripción + tier al publicar.
- [x] **Contenido a 24 + tiers + blog (28-jul):** sembradas las 12 nuevas, aplicada la escalera
  Free 8 · Primeros Pasos 12 · Mi Equilibrio 16 · Mi Mundo en Foco 24 (cada tier con los 4 tipos).
- [x] **Blog interactivo + rediseño (29-jul):** título ya no se duplica; Blog separado de Contenido
  (`content_type='blog'`, sin espejo); comentarios de pacientes con moderación (`blog_comments`, solo
  admin aprueba) + cola en el panel admin; tarjetas de plan con volteo ("Descubrir plan" → detalle →
  "Adquirir plan"); "Cómo funciona" como infografía; imágenes de alta calidad en toda la página.

---

## ✅ A3 resuelto (29-jul) — diferenciación por propósito y redacción, sin borrar nada

- [x] **Decisión:** Guías y Contenido pueden tocar el mismo tema si su finalidad y voz son distintas.
  **Guías = GUIAR** (práctico, pasos, ejercicio). **Contenido = EXPLICAR/INVESTIGAR** (artículo divulgativo,
  el porqué). **Blog = CONVERSAR** (comunidad + comentarios). Regla y detalle en
  `especificaciones-producto/11_diferenciacion_guias_vs_contenido.md`. No requiere migración: es editorial.
- [ ] Curaduría ligera pendiente: revisar que ninguna guía se lea como artículo largo, ni ningún contenido
  como lista de pasos seca (ajuste incremental, no bloqueante).

---

## ✅ Cerrado en agosto (30-jul → 14-ago) — no estaba en el roadmap del 29-jul

Trabajo confirmado por migraciones (`supabase/2026080*`–`2026081*`), servicios (`src/lib/api/`) y
componentes. Se documenta aquí para que el tracker vuelva a reflejar la realidad.

### Tests públicos (Ola 2) — ✅ construido
- [x] Tablas `public_tests` + `public_test_submissions`, 3 tests sembrados (GAD-7, PHQ-9, Rosenberg),
  hub `/tests` + `tests.$slug`, resultado inmediato con manejo de riesgo, captación opcional (no muro).
  C-SSRS excluido por seguridad. (Migraciones `20260730c`–`f`.)

### Agenda unificada y citas — ✅ construido
- [x] `appointments` colgada de la relación terapéutica; **agenda unificada** como fuente única de horas
  ocupadas (`20260803j`, `20260803k`, `20260804*`, `20260805`): disponibilidad por instantes, citas a la
  hora en punto, cadena de contraofertas, aceptación del paciente, cierre. Servicios `appointmentService`,
  `sessionsService`, `timeBlocksService`, `useAgenda`. UI: `AgendaClinica`, `AgendaPaciente`, `WeeklyAgenda`.

### Perfiles de terapeuta + Matching + solicitudes de contacto — ✅ backend / ⏳ falta directorio público
- [x] `therapist_profiles` (qué atiende el profesional, separado de la identidad), `user_preferences`
  (lo que la persona declara en onboarding), `therapist_contact_requests` (solicitud paciente→terapeuta
  con estado e historia). Migraciones `20260803c/e/f/g`.
- [x] **Motor de matching** (`matchingService.matchTherapists`) + `therapistContactService` (crear/aceptar/
  rechazar/cancelar solicitud). Se usa hoy dentro del portal en **"Mi camino"** del paciente
  (`MiCaminoSection` → `MatchingPreview`).
- [x] **Directorio público de especialistas (Ola 3) — CERRADO (21-ago), backend + frontend commiteados y
  publicados.** Decisión de negocio: el paciente elige. Backend: `supabase/20260821_public_therapist_directory.sql`
  — **corrección de seguridad (ADR-013)** además de Ola 3: `therapist_profiles` exponía a `anon` la tabla
  entera (incl. `license_number`, `availability`, perfiles inactivos). Cerrado con **vista
  `public_therapist_directory`** (11 columnas allowlist, `active+verified`) + política SELECT de la base
  solo `authenticated` + `REVOKE` a anon. Contacto sigue exigiendo cuenta. Disciplina completa (tx
  revertida, 4 idempotencia, round-trip). Frontend: ruta pública `/especialistas` consumiendo la vista.
  Detalle: `auditorias-tecnicas/Backend_Journaling_y_Directorio_2026-08-21.md`. Commits `fff1b26` (backend
  + docs) y `6c4f174` (frontend) — ambos en `origin/main`.

### Journaling estructurado (autocuidado) — ✅ CERRADO (21-ago), backend + frontend
- [x] **`journal_entries` — diario privado del paciente.** `supabase/20260821_journal_entries.sql`: tabla
  owner-only espejo de `mood_entries` **+ DELETE del propietario**, RLS activo (anon denegado), prompts
  guiados como constante estática (sin tabla). Disciplina completa. Vive dentro de "Mi camino"
  (`JournalSection` en `MiCaminoSection`). Commits `183b80c` (backend) y `6c4f174` (frontend) — ambos en
  `origin/main`.

### Notificaciones y "Mi camino" (Journey Engine) — ✅ construido
- [x] `notifications` (escucha hechos ya registrados: solicitudes, asignaciones, mensajes, pasos ofrecidos)
  + `notificationService`, `NotificacionesBadge`, ruta `/notificaciones`, hook `useNovedades`.
- [x] `journey_events` (registro append-only del recorrido) + `journeyService`, sección "Mi camino",
  `recentResources`, tarjeta de recursos recientes. Migraciones `20260803b/d/g`, `20260804d`, `20260814`.

### Sprint de seguridad — RLS ✅ / recuperación y secretos ⏳ (¡la fase de seguridad ARRANCÓ!)
- [x] **RLS activado y verificado en 33 de 37 tablas, 98 políticas, 0 FORCE** (5–14 ago). Las 4 sin RLS
  están justificadas: `cie11_directory` y `public_tests` (catálogos públicos), `guides` y `test_scores`
  (tablas muertas, DROP aplazado por falta de backups). Serie de migraciones `20260805b`–`20260814` y
  diagnósticos en `contexto-proyecto/auditorias-tecnicas/`.
- [x] Verificado (medido, no leído): guardas de las funciones `admin_*` efectivas (`anon`/paciente →
  `ADMIN_REQUIRED`), `admin-create-user` exige rol admin, `stripe-webhook` valida firma, ningún secreto
  hardcodeado en los 388 archivos versionados.
- [ ] **Lo que RLS no resuelve y quedó como riesgo dominante** (ver `Diagnostico_Seguridad_Post_RLS_2026-08-14.md`
  y la fase de seguridad abajo): cero backups + PITR off (CRÍTICO), clave de Resend sin rotar (ALTO),
  `public-signup` sin rate-limit/captcha (ALTO), y dos defectos de trigger menores (H-JE-001, H-TB-001).

> ⚠️ **Ojo con el estado de git:** al 18-ago el `HEAD` de `main` está en el trabajo del 30-jul
> (commit `46d3c53`). Todo lo de agosto (migraciones + servicios + auditorías) está en el árbol de
> archivos pero **conviene confirmar que quedó commiteado y con push**. Tarea de higiene para Claude Code.

---

## 🗺️ PLAN DE TRABAJO (orden recomendado)

Prioricé por impacto competitivo vs. esfuerzo y dependencias. Cada fase indica si necesita decisión tuya o
si puedo dejar el prompt de Claude Code directo.

### Paso 0 — Desbloquear A3 (rápido, tu decisión) 🟡
Elegir cómo resolver el solapamiento Guías↔Contenido (arriba). Es lo único que hoy incumple la regla de "no
repetir temas". En cuanto elijas opción, dejo el prompt y queda cerrado.

> *Nota de coherencia (30-jul):* **este paso ya está resuelto** — ver la sección "A3 resuelto (29-jul)"
> más arriba y **ADR-009**. La regla de "no repetir temas" que se cita aquí quedó derogada. Se deja el
> texto para no alterar el histórico del roadmap; el estado real es cerrado.

### Paso 1 — Ola 2: Tests públicos sin login 🎯 ✅ CERRADO (30-jul, verificado en el árbol al 18-ago)
El gap #1 frente a Selia/Terapify/PQEB (ellos captan con tests gratis; nosotros los tenemos escondidos tras
login). Backend `public_tests` + resultado inmediato + invitación (no muro) a registrarse (sin diagnóstico,
C-SSRS excluido por seguridad, manejo de riesgo en PHQ-9 ítem 9).
- [x] Spec (`especificaciones-producto/13_tests_publicos_ola2.md`) + prompt
  (`prompt-claude-code-30-jul-2026-tests-publicos-ola2.md`). Lanzamiento con 3 tests (GAD-7, PHQ-9,
  Rosenberg); resto en batch posterior al verificar ítems.
- [ ] **Pendiente Claude Code:** construir tablas, sembrar los 3 tests, hub `/tests` + flujo + resultado +
  captación opcional + manejo de riesgo.
  > *Nota de coherencia (30-jul):* **construido y verificado el 30-jul.** Tablas `public_tests` y
  > `public_test_submissions`, los 3 tests sembrados, hub `/tests`, flujo, resultado con manejo de
  > riesgo por dos vías y captación opcional. Ver [[Estado actual]] del vault. El checkbox se deja como
  > está para no alterar el roadmap en un sprint de coherencia documental; conviene marcarlo al cerrar.

### Paso 2 — Gap de terapeuta #1: consentimiento informado clínico ✅ CONSTRUIDO (29–30 jul)
Completitud clínico-legal (Ley 1090/2006), distinto del consentimiento de datos.
- [x] Texto redactado + spec + prompt.
- [x] Claude Code construyó: tabla `clinical_consents` con triggers de inmutabilidad **y autoría** (cerró
  un agujero real: con la anon key se podía consentir por otro — acto personal e indelegable), paso en el
  gate antes de anamnesis (población = plan de pago o terapeuta asignado), pantalla
  `/consentimiento-clinico` (checkbox obligatorio, sin marketing), estado en la ficha del paciente
  (verde/ámbar/rojo-revocado) y revocación desde Ajustes. Verificado por API y lógica.
- [ ] **Tu validación:** recorrer logueado como `paciente.esencial@test.com` (dejado con consentimiento
  aceptado v1). Texto pendiente de revisión jurídica (fase de seguridad).

### Paso 3 — Ola 3: Encontrar especialista + matching + directorio ✅ CERRADO (21-ago)
El gap más grande vs. competencia, cerrado. Decisión de negocio: **el paciente elige**. Directorio público
`/especialistas` construido sobre la vista `public_therapist_directory` (ver sección de arriba); de paso
cerró una sobre-exposición real de datos (ADR-013). Reseñas de terapeutas no incluidas en este alcance —
quedan como posible mejora futura, no bloqueante.
- [x] Backend del matching + solicitudes de contacto + perfiles de terapeuta (agosto).
- [x] Matching dentro del portal (paciente logueado, sección "Mi camino").
- [x] Directorio público navegable (`/especialistas`), decisión de negocio resuelta, backend + frontend
  commiteados y publicados (21-ago).

### Paso 4 — Contenido en marcha (incremental, en paralelo)
- [ ] Automatización de 1 guía/artículo cada 2 días (prompt generador ya existe en `guias-bienestar/`).
- [ ] Audio real: grabar/enchufar meditaciones y podcast (hoy "Audio próximamente").
- [ ] 5 categorías nuevas de guías (Personalidad, Sueño, Estrés/Burnout, Adicciones, Perinatal), previa
  investigación — respetando la regla de no repetir temas entre secciones.
- [x] ~~Capa de autocuidado tipo Terapi: journaling estructurado.~~ Cerrado 21-ago, ver sección de arriba.
- [ ] (Futuro) Más piezas por tier para diferenciar aún más integral vs. premium.

### Paso 5 — Producto complementario (cuando toque)
- [~] **Programas ampliados (terapia de pareja, orientación para padres) — v1 NO requiere desarrollo (21-ago).**
  Decisión: v1 = especialización + contenido, sin tocar el modelo de sesión (que asume un `patient_id`), sin
  anamnesis conjunta, sin precio diferenciado. Verificado: `specializations` es `theme_key[]` (enum cerrado,
  no free-text), y el enum **ya incluye** `relaciones_vinculos` (pareja) y `crianza_infancia` (padres). Por
  tanto **no hace falta código**: es operativo/de contenido — un terapeuta marca esas especialidades y se crean
  guías/contenido que las respalden. *(Caveat: `theme_key` es un ámbito de la experiencia, no un formato de
  servicio; si se quisiera un eje "formato" distinto —p.ej. mostrar "Terapia de pareja" como servicio— sería
  su propio sprint, no v1.)* Un modelo de sesión multi-persona queda para v2 si hay demanda real.
- [~] **B2B / Empresas — backend INERTE aplicado (21-ago), pendiente de revisión legal + frontend.**
  `supabase/20260821_b2b_companies.sql`: entidad `companies` (estado de negociación, sin precios), vínculo
  `company_members`, consentimiento **separado y revocable** `employer_link_consents` (nunca reutiliza
  `clinical_consents`, ADR-008), y función `company_aggregate_metrics` con **k-anonimato (umbral 5)** —
  solo conteos, nunca desagregado. RLS admin-only en `companies`; sin rol `company_admin` nuevo. Disciplina
  completa (tx revertida 8/8, 4 idempotencia, round-trip). **INERTE: 0 filas, sin UI, sin flujo real.**
  ⚠️ El **texto del consentimiento** y toda conexión a producción quedan **PENDIENTES DE REVISIÓN JURÍDICA**
  (patrón del consentimiento clínico). Detalle: `auditorias-tecnicas/Backend_B2B_Empresas_2026-08-21.md`.
  Commit `319625e`, publicado en `origin/main`.
- [x] **UI admin del pipeline B2B (21-ago).** Tab "Empresas" en el panel admin: crear empresa, ver, mover el
  estado (prospecto → negociando → contrato_activo → pausado/cerrado) y notas. Lee/escribe `companies`
  (RLS admin-only), sin migración. **No toca** el vínculo empleado↔empresa ni los reportes (siguen bloqueados
  por la revisión legal). Commit `2dd378e`. **Falta (post-legal):** revisión jurídica del consentimiento +
  frontend del vínculo empleado↔empresa antes de activar esa parte.
- [ ] Paridad móvil del terapeuta (app Expo, hoy solo Fase 1 paciente).

### Paso FINAL — Fase de seguridad (antes de cualquier lanzamiento real; agrupada, espera tu señal) 🔒
Ver sección de seguridad abajo. No se arranca hasta que lo indiques.

---

## 🔒 Fase de seguridad final — EN CURSO (RLS + R4/R5 + Commit B + cola de backend cerrados; entrando a la fase de "configuraciones")

El sprint de RLS (5–14 ago) ya se ejecutó: **33/37 tablas con RLS, 98 políticas** en su momento — estado
actual real tras la cola de backend del 22-24 ago: **42 tablas, RLS en 38, 108 políticas, 275 funciones,
20 enums**. El diagnóstico `Diagnostico_Seguridad_Post_RLS_2026-08-14.md` dejó el riesgo dominante (cero
backups) y el orden R1–R6. **18-ago:** Commit A cerró la gobernanza de git de todo lo relacionado a
seguridad/RLS y aplicó R4+R5. Detalle completo en `Remediacion_Seguridad_2026-08-18.md`.

> **Nota (24-ago):** el número "33/37" queda como registro histórico de ese sprint, no como baseline
> vigente — cada migración desde entonces tomó su propio baseline en vivo (nunca heredado), y cualquier
> sprint de base de datos futuro debe seguir haciendo lo mismo, no asumir un número de un reporte anterior.

**Orden de prioridad acordado para la fase de configuraciones (24-ago), del más al menos crítico:**
**P0 Backups/PITR → P0b Exportación lógica cifrada (retención legal 15 años) → P1 Resend (rotar +
verificar dominio) → P1 Turnstile E2E → P2 `DEV_MAIL_REDIRECT` → P3 Stripe a modo real → P4 dominio propio
+ Google Cloud → P5 revisión jurídica → P6 DROP de tablas muertas → P7 producto posterior (móvil,
contenido).** Regla firme: no se declara el sistema
"production-ready" ni se reabren los DROP aplazados mientras P0 no esté cerrado. No se vuelve a invertir
tiempo en subir el porcentaje de RLS salvo que un diagnóstico nuevo encuentre una vulnerabilidad real.

- [x] **RLS activado y verificado (33/37).** Guardas admin medidas efectivas; sin secretos hardcodeados.
- [x] **R4 · H-JE-001 cerrado (18-ago).** `REVOKE TRUNCATE ON journey_events FROM service_role`. Probado
  en transacción, 4 pasadas de idempotencia, rollback real verificado. `service_role` ya no puede vaciar
  `journey_events`.
- [x] **R5 · H-TB-001 cerrado (18-ago).** Corregida la rama `service_role`/sistema del trigger
  `enforce_time_block_ownership` para respetar `TG_OP` en DELETE. `service_role` ya borra bloqueos por
  `id` sin cancelar la fila en silencio.
- [x] **Commit A (18-ago, SHA `f3f9701`).** 65 archivos: 24 migraciones de seguridad (`20260812`–`818`) +
  24 backups de ACL + 17 auditorías técnicas. Verificado sin secretos, sin tocar `src/`, `.agents/`,
  `.claude/` ni `.gitignore`. **Rama local 14 commits por delante de `origin/main` — falta el `git push`.**
- [x] **Commit B (18-ago) — gobernanza de git del resto del producto, cerrada.** Los ~246 archivos sin
  commitear (código de agosto + migraciones de features + docs) se agruparon en 3 commits temáticos tras
  confirmar tests 220/220 y build verde: **B1** `86c68a1` (90 archivos — `src/` completo, agenda unificada,
  matching, notificaciones, Journey Engine), **B2** `8423611` (65 archivos — historia retroactiva de
  migraciones de features, ya aplicadas en la base real), **B3** `2acd278` (14 archivos — docs y los
  maestros de raíz). Se descartaron 74 archivos de ruido puro LF→CRLF (`.agents/`, `.claude/`, config) tras
  confirmar 0 cambio real. Rama quedó 17 commits por delante de `origin/main`; **push autorizado (20-ago)
  pero pendiente de ejecución manual** — el clasificador de permisos del harness bloqueó `git push` desde
  Claude Code; hay que correr `git push origin main` a mano o habilitar el permiso.
- [~] **P0 · R1 · Backups + PITR (CRÍTICO — bloquea todo lo demás). Guía + script listos (24-ago); falta la
  activación del responsable.** Estado verificado hoy por Management API: `pitr_enabled: false`, **0 copias
  recuperables**, add-on `pitr` disponible pero no aplicado. Requiere plan **Pro/Team/Enterprise** + compute
  Small; add-on de pago (7d ~$100 / 14d ~$200 / 28d ~$400 al mes). **Recomendación: 28 días** (dato clínico
  irreemplazable; Ley 1581/2012 principio de seguridad). Guía paso a paso para el responsable:
  `auditorias-tecnicas/Guia_R1_Backups_PITR.md`. Verificación de solo lectura: `node scripts/verify-pitr.cjs`.
  **La activación (upgrade + panel) la hace el responsable; el agente solo verifica.** **Compuerta:** hasta
  que el script confirme ≥1 copia recuperable, siguen bloqueados los DROP de `test_scores`/`guides` y toda
  operación estructural irreversible. *(Ítem separado: ver P0b abajo.)*
- [ ] **P0b · Exportación lógica periódica cifrada — retención legal de 15 años (CRÍTICO, componente legal).**
  PITR (P0) es recuperación operativa con ventana móvil (28 días máx.); **no** cubre la conservación de la
  historia clínica que exige la **Resolución 1995/1999 (mod. 839/2017): mínimo 15 años desde la última
  atención**. Hace falta un mecanismo aparte de **dumps lógicos periódicos cifrados, conservados fuera de
  Supabase**, con su política de retención y prueba de restauración. Tiene componente jurídico → coordinar
  con P5. No estaba en el roadmap antes del 24-ago; nace del hallazgo de la guía R1
  (`auditorias-tecnicas/Guia_R1_Backups_PITR.md`). Sin diseñar aún — pendiente de decisión de alcance.
- [ ] **R2 · Rotar la clave de Resend + verificar dominio propio (ALTO).** Comprometida y sin rotar desde el
  19-jul. **Confirmado (25-ago) por `node scripts/verify-resend.cjs`: sigue SIN rotar** (`RESEND_API_KEY`
  updated 2026-07-19) y el dominio de envío todavía no está verificado (Resend en modo prueba). **La ejecutas
  tú** en Resend + actualizas el secret `RESEND_API_KEY`; luego el script confirma la fecha nueva. **R6
  depende de esto.**
- [~] **R3 · Rate-limit + captcha en `public-signup` (ALTO) — BACKEND APLICADO, captcha escrito pendiente
  de claves (20-ago).** Detalle: `Remediacion_R3_Rate_Limit_Captcha_2026-08-20.md`.
  - **Backend de rate-limit APLICADO:** `supabase/20260820_signup_rate_limit.sql` (+ backup) crea la tabla
    `signup_rate_limit(ip_hash, window_start, count)` con **RLS activo sin políticas** (deny-all) y la
    función atómica `enforce_signup_rate_limit` (`SECURITY DEFINER`, execute solo `service_role`) con
    umbral **5/hora, 20/día por IP**. Disciplina completa: baseline → backup → prueba en tx revertida →
    4 pasadas idempotencia → validación viva → invariantes → rollback real (vuelve exacto a baseline) →
    reaplicación. Un DEFECTO DE SCRIPT (REVOKE FROM PUBLIC no quitaba EXECUTE a `anon`/`authenticated` por
    default privileges a roles nombrados) fue aislado y corregido. Estado base: tablas 38, RLS 34,
    políticas 98, funciones 274. R4/R5 intactos.
  - **Captcha (Turnstile) + cableado ESCRITO:** `public-signup/index.ts` verifica el token contra
    Cloudflare y aplica el rate-limit por IP hasheada antes de crear cuenta (403 sin captcha válido, 429
    sobre el límite); `SignupModal.tsx` renderiza el widget y manda `captcha_token`. Ambos lados están
    **gated por su env**: sin claves, el widget no aparece y el backend omite el captcha (fail-safe), pero
    **el rate-limit sigue activo**. build ✓ + tests 220/220.
  - **Falta (responsable):** crear el widget en Cloudflare y cargar **`VITE_TURNSTILE_SITE_KEY`** (frontend,
    público) y **`TURNSTILE_SECRET_KEY`** (env del Edge Function, nunca por chat). Confirmado (25-ago) por
    `node scripts/verify-turnstile.cjs`: `TURNSTILE_SECRET_KEY` **AUSENTE** → captcha inerte. Cuando se cargue,
    el script lo confirma y se hace la prueba de rechazo E2E (403 sin token, sin bypass, sin crear cuentas).
    Sin esto, el captcha no está verificado end-to-end. Código commiteado y publicado (`469ab23`); `public-signup` ya está
    desplegado (`ACTIVE`, version 5) — falta cargar las claves y la prueba de rechazo (403 sin token).
- [ ] **R6 · Retirar `DEV_MAIL_REDIRECT`** (limpieza, panel de secretos). **Bloqueado por R2 — reconfirmado
  20-ago:** el dominio propio de Resend sigue sin verificar (modo prueba). El código lo usa para redirigir
  correos mientras el dominio no está verificado; quitarlo antes rompería el envío a leads reales.
  **No se tocó el código de `DEV_MAIL_REDIRECT`.** Retomar solo cuando R2 (rotación + dominio verificado)
  quede cerrado.
- [x] **Webhook de Stripe — contraseña = correo, cerrado (20-ago).** `stripe-webhook/index.ts` creaba la
  cuenta del paciente con `password = customerEmail` (adivinable por cualquiera que supiera el correo;
  ADR-013, expone a un tercero). Fix: contraseña **aleatoria cripto** (nunca el email) + `must_change_password:
  true` solo para cuentas nuevas del webhook + envío del **enlace `recovery` por Resend** para que el usuario
  cree su propia clave — es lo que `/compra-exitosa` ya prometía (se alineó backend↔frontend, ADR-006). Sin
  migración (columna y gate ya existían). 0 cuentas afectadas hoy (Stripe en test). build ✓ + tests 220/220.
  Nota: la entrega del correo depende de R2 (dominio Resend); la seguridad no. Detalle en
  `auditorias-tecnicas/Fix_Stripe_Webhook_Password_2026-08-20.md`.
- [x] **`admin-create-user` — `must_change_password` añadido (21-ago).** Ahora el UPDATE de perfil setea
  `must_change_password: true` para paciente y terapeuta creados por admin, forzando que el usuario cree su
  propia clave en el primer acceso (gate existente). Una línea, sin migración. build ✓ + tests 220/220.
  Commit `d0ba4f0`, publicado en `origin/main`.
- [x] **Copy del enlace de recovery alineado (21-ago).** `/compra-exitosa` prometía *"válido por 24 horas"*
  pero el recovery de Supabase caduca en ~1 h. Copy corregido: dice que el enlace caduca y cómo pedir otro,
  sin afirmar una duración concreta ni urgencia. Commit `29cb72e`. *(Opción futura opcional: subir la
  expiración en el panel de Auth a 24 h — configuración de panel, no de código.)*
- [ ] Stripe a modo real (depende de que el responsable cargue las claves live; aparte de este fix de código).
- [ ] Solo **después de R1**: retomar los DROP aplazados de `test_scores` y `guides`.
- [ ] Dominio propio + verificación de la app en Google Cloud.
- [ ] Revisión jurídica de la política de tratamiento de datos (Ley 1581/2012).

### P8 — Hardening web/infra (25-ago, evaluación contra 20 pilares de seguridad)
Informe completo: `auditorias-tecnicas/Security_Assessment_20_Pilares_2026-08-25.md`. Evaluó el proyecto
contra 20 pilares de seguridad web estándar, verificando lo incierto contra el código real (no plantilla
genérica). La mayoría de pilares ya estaban cubiertos (RLS, mínimo privilegio, mass-assignment bloqueado
por `enforce_profile_ownership`, auth en servidor, XSS, hashing). 3 brechas reales, código/config sin
dependencia externa:
- [x] **Pilar 20 (SCA) — vulnerabilidad crítica de runtime, corregida.** `npm audit` encontró 20
  vulnerabilidades; triaje con evidencia (no supuesto) separó dependencias de producción vs. tooling de
  build. **`seroval` (CVSS 9.8, GHSA-mv8w-475r-vwqw) era la única crítica y SÍ es runtime de producción**
  (serialización SSR de TanStack Start, transitiva de `@tanstack/react-start`) — corregida con
  `npm audit fix` (solo `package-lock.json`, sin cambios de mayor versión, build ✓ + tests 220/220).
  Quedan 0 vulnerabilidades. Las 9 altas restantes son todas build/deploy tooling (vite, miniflare, sharp,
  etc.) — no llegan al bundle ni al Worker; agrupadas abajo para Dependabot/CI.
- [x] **Pilar 18 (cabeceras HTTP) — implementado y verificado en vivo.** El deploy es Cloudflare **Worker**
  (no Pages), así que un `public/_headers` no habría aplicado — se investigó el mecanismo real y se usó
  middleware global de TanStack Start (`src/start.ts`, `createMiddleware` + `setResponseHeaders`,
  autodescubierto por el plugin). Fuerza X-Frame-Options, nosniff, Referrer-Policy, HSTS,
  Permissions-Policy; **CSP en `Report-Only`** (calibrada a Supabase/Turnstile/Fonts) para no arriesgar el
  SSR de un producto clínico vivo con una política sin probar. Verificado consultando la respuesta HTTP
  real del dev server, no solo por lectura de archivo.
  - **Pendiente (responsable):** verificar las cabeceras tras desplegar (`curl -I` o securityheaders.com)
    y, cuando el Report-Only no muestre violaciones legítimas en consola, pasar
    `Content-Security-Policy-Report-Only` → `Content-Security-Policy` (enforcing) en `src/start.ts`.
- [ ] **Pilar 2 (secret-scanning automatizado)** — hoy compensado a mano en cada commit (revisión de
  diffs antes de comitear), sin herramienta tipo gitleaks/CI. Pendiente, no urgente.
- [ ] **9 vulnerabilidades altas de dependencias de build** (vite, undici/ws vía miniflare, sharp,
  postcss, nanoid, etc.) — no tocan producción, pero conviene Dependabot/CI para no acumular. Pendiente.
- Commits: `dc251de` (informe), `26ab191` (fix seroval), `a4144f4` (cabeceras HTTP) — sin pushear, junto
  con `1e23e96`/`df09692` de P0/P1 anteriores.

---

## 🗂️ Dónde está cada cosa

- **Filosofía, ADR y sistema de lenguaje: `contexto-proyecto/vision-producto/` — lectura obligatoria
  y con prioridad sobre este roadmap.**
- Contexto completo: `00_CONTEXTO_MAESTRO_MENTE_EN_FOCO.md` (raíz).
- Este roadmap: `01_ROADMAP_Y_TAREAS.md` (raíz).
- Specs técnicas: `contexto-proyecto/especificaciones-producto/`.
- Contenido redactado: `contexto-proyecto/contenido-plataforma/` (+ `MANIFIESTO_SIEMBRA.md`).
- Prompts para Claude Code: `contexto-proyecto/prompts-claude-code/` (cronológicos, fecha real en el nombre).
- Investigación (clínica y competencia): `contexto-proyecto/investigacion-clinica/` y `.../investigacion-competencia/`.

> Nota sobre la migración a Obsidian: como acordamos, el contenido del día se queda local y se migra al
> vault al cierre. Este archivo es el que debe vivir en Obsidian como tablero de tareas siempre a la mano.
