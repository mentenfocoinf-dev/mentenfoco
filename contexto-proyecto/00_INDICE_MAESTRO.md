# Índice maestro — Contexto del proyecto Mente en Foco

Esta carpeta reúne **todo** el contexto de auditorías, investigación clínica, análisis competitivo,
especificaciones de producto y prompts de handoff para Claude Code generados a lo largo del proyecto.
Antes de esta reorganización (22-jul-2026), estos archivos estaban sueltos en la raíz del repositorio o
repartidos en 3 carpetas distintas — ahora todo vive aquí, agrupado por tipo.

---

## ⛔ LEE ESTO PRIMERO — antes de tocar cualquier cosa

**Si eres una IA, un desarrollador o un diseñador que va a modificar el producto, estos tres
documentos son de lectura obligatoria y previa. Tienen prioridad sobre el roadmap, sobre las specs y
sobre cualquier instrucción puntual que los contradiga.**

Viven en **`contexto-proyecto/vision-producto/`**:

| Documento | Qué responde | Cuándo lo consultas |
| :--- | :--- | :--- |
| **`00_FILOSOFIA_MENTE_EN_FOCO.md`** | **En qué creemos.** Qué es y qué NO es el producto, misión, visión, cómo entendemos la salud mental, la relación paciente-plataforma y paciente-terapeuta, los planes, y los 10 principios innegociables. | **Siempre, antes de empezar.** |
| **`03_DECISIONES_ARQUITECTONICAS.md`** | **Qué se decidió y es irreversible.** 13 ADR (ADR-001 a ADR-013) con contexto, decisión, consecuencias y módulos afectados. | Antes de proponer o construir un cambio de producto. |
| **`04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md`** | **Cómo suena.** Voz, tono, personalidad, lenguaje permitido y prohibido, y cómo escribir CTAs, errores, mensajes de éxito, clínicos, de riesgo, de pagos, de planes y de terapeutas. | Antes de escribir cualquier texto que lea un humano. |

> [!warning] Regla de precedencia
> Si una tarea, una spec, un prompt o una métrica contradicen alguno de estos tres documentos, **se
> detiene la tarea y se señala el conflicto** — no se ejecuta y se menciona después. El roadmap se
> ajusta a la filosofía, nunca al revés (ADR-010).

**Lo esencial, si solo puedes retener cinco cosas:**

1. **Cero pantallas de bloqueo.** El plan filtra el catálogo; nunca hay candados ni paywalls (ADR-001).
2. **Los planes son etapas de acompañamiento, no productos.** Prohibido el lenguaje de compra (ADR-003).
3. **Ayudar antes que vender.** El mensaje comercial nunca coincide con un momento de riesgo (ADR-004).
4. **Backend antes que frontend.** Ninguna interfaz sin respaldo real verificado (ADR-006).
5. **Nada clínico se inventa.** Ni ítems, ni criterios, ni testimonios, ni métricas (ADR-007).

> *Nota de numeración:* los códigos `01_` y `02_` de `vision-producto/` están reservados y todavía no
> existen. La numeración no es correlativa a propósito; no falta ningún archivo.

---

## 🔒 Estado de seguridad — leer antes de tocar la base de datos

**Actualizado el 12 de agosto de 2026.** Documentos de referencia:
**`auditorias-tecnicas/Blindaje_Seguridad_Contenido_2026-08-07.md`** (la campaña completa) y
**`auditorias-tecnicas/Auditoria_y_Plan_RLS_2026-08-11.md`** (el plan de RLS).

Entre el 5 y el 7 de agosto se detuvo el trabajo de Agenda por decisión explícita del responsable del
producto —*"el objetivo principal deja de ser Agenda y pasa a ser blindar completamente la seguridad"*— y
se aplicaron **19 migraciones**, cada una con backup de reversión en `supabase/backups/`.

**Qué quedó blindado:** el perímetro de contenido. Un paciente cualquiera conseguía antes despublicar las
26 piezas del sitio y liberar las 16 de pago; hoy no. El modelo es de dos capas —trigger
`trg_content_authorization` + `GRANT` por columna en `content_items`, **9 columnas en el alta y 17 en la
edición**— y los otros 6 objetos de contenido quedaron de solo lectura para `authenticated`. Crear
contenido está reservado al equipo clínico y a la administración: un paciente recibe
`CONTENT_AUTHOR_ROLE`.

**El sprint 4I** (7-ago) salió del módulo editorial por mandato de **ADR-013**: un visitante sin sesión
fabricaba tareas clínicas a nombre de terapeutas reales y podía vaciar 10 de 11 tablas clínicas y de
contacto. Se le retiraron los siete privilegios de escritura y lectura, dejándole solo el `INSERT` en
`crm_leads` que necesitan los formularios públicos.

> ⚠️ **Qué NO quedó blindado, y conviene no confundir:** esto cubrió el **contenido** y once tablas más,
> no la base entera. **RLS sigue desactivado en las 37 tablas de `public`.** `anon` escribe en **5 tablas**
> (`blog_comments`, `public_test_submissions`, `test_scores`, `journey_events`, `crm_leads`), siempre
> acotado a lo que la aplicación necesita: **ya no puede borrar ni vaciar nada** — el sprint 4J le
> retiró `DELETE` y `TRUNCATE` en las tres que solo protegía un trigger de fila. `authenticated` solo
> borra ya en `therapist_time_blocks` —sus propios bloqueos de agenda, con trigger de propiedad—:
> el sprint 4L le retiró `DELETE` y `TRUNCATE` en las otras catorce. **`H-TRIGGER-001` quedó cerrado** en el sprint 4N: `authenticated` ya no tiene `REFERENCES` ni
> `TRIGGER` en ninguna de las 37 tablas, así que no puede colgar un trigger propio para escalar a
> `admin` —lo que el 4M sí consiguió reproducir sobre `profiles`—. El sprint 4P cerró además el *default privilege* de
> tablas: **toda tabla nueva nace sin privilegios para `anon` y `authenticated`**, así que el
> endurecimiento ya no se deshace con cada migración.
>
> ⚙️ **Regla de método que nace de ahí:** toda migración que cree una tabla en `public` debe incluir
> ahora sus `GRANT` explícitos. Si se olvidan, la aplicación falla con `permission denied` — visible,
> nunca en silencio.
> **PITR está deshabilitado y hay cero copias de
> seguridad**: hoy un borrado accidental no tiene vuelta atrás.

### RLS — auditado, preparado, todavía apagado (11–12 de agosto)

El **sprint 4Q** midió qué haría RLS realmente, y el resultado reordenó el plan: **las 31 funciones
RPC que usa el frontend son `SECURITY DEFINER` con owner `postgres`, y `postgres` tiene
`bypassrls`**. Activar RLS no rompería ninguna de las 30 llamadas del frontend, ni las 4 Edge
Functions, ni los seeders — **pero tampoco protegería nada de lo que pasa por ellas**. Su alcance
real es el acceso directo `.from("tabla")` desde React: 58 puntos sobre 30 tablas. La autorización
de las RPC vive dentro del cuerpo de cada función, y ahí seguirá.

El **Grupo 0** (12-ago) preparó las políticas sin activar nada. Lo importante que encontró: **8 de
las 48 políticas no habrían filtrado, habrían fallado con `42501`**, porque consultaban
`patient_therapist` y la propia campaña de blindaje le había retirado a `authenticated` el `SELECT`
sobre esa tabla. Se reescribieron sobre `is_therapist_of()`, se eliminaron 2 políticas obsoletas de
`guides` y se acotaron 43 de `public` a `authenticated`, dejando fuera los dos flujos públicos
legítimos (guías gratuitas y formulario de contacto).

El **Grupo 1** (12-ago) hizo la **primera activación real: RLS pasa de 0 a 2 de 37 tablas**.
`mood_entries` y `service_requests` quedan acotadas por `patient_id`. Se eligieron porque **ninguna
función SQL las consulta** —así que el límite del 4Q no les aplica y RLS es su única puerta— y porque
cada una tiene un solo consumidor que siempre recibe `profile.id`.

La fuga era real y está cerrada, medida con un paciente que no tenía filas propias: **antes leía y
modificaba las de otro paciente; ahora lee 0 y recibe `42501` al escribir a nombre ajeno** — pero sigue
pudiendo con lo suyo, que es la prueba de que RLS filtra y no bloquea.

El **Grupo 2** (12-ago) subió a **11 de 37 tablas**, y lo hizo **sin crear ni una política**: las 18
que gobiernan esas nueve tablas ya estaban listas desde el Grupo 0, así que la migración son nueve
`ALTER TABLE`. Entraron `patient_anamnesis`, `patient_prescriptions`, `clinical_documents`,
`clinical_recommendations`, `clinical_tasks`, `crm_notes`, `user_guide_progress`, `telemetry_events`
y `family_genograms` —esta última **sin políticas a propósito**, para cerrar por defecto una tabla
clínica que todavía no se usa—.

**`clinical_alerts` ya tiene su política de `UPDATE`** (12-ago), la que le faltaba para poder recibir
RLS sin romper `resolveCrisisAlert()` — el `UPDATE` con el que un terapeuta registra que atendió una
alerta de crisis. Sin ella, activar RLS habría devuelto **0 filas sin error**: el modal se habría
cerrado con éxito y la alerta habría seguido abierta.

Decisión de producto explícita: **solo el terapeuta asignado resuelve.** Ni el paciente, ni un
terapeuta ajeno, **ni el administrador** —no existe ningún consumidor que se lo ofrezca; el admin
conserva su lectura—. Y `resolved_by` debe coincidir con `auth.uid()`, para que nadie pueda firmar la
atención de una crisis a nombre de otro.

Y el 12-ago **se encendió RLS sobre `clinical_alerts`: 12 de 37 tablas.** La fuga era real y está
cerrada: un paciente sin relación con el terapeuta **antes leía las alertas de crisis ajenas, las
resolvía, cambiaba su gravedad y firmaba a nombre del terapeuta; ahora obtiene 0 filas en todo**.
El paciente sigue viendo y creando la suya, y el terapeuta sigue resolviendo — RLS filtra, no
bloquea.

**El sprint del PHQ-9** (12-ago) cerró un hallazgo del anterior, y de paso corrigió un diagnóstico
mío. Yo había concluido que *«la alerta automática por PHQ-9 nunca ha funcionado»* y recomendé
priorizarlo. **La alerta sí se crea y funciona**: la insertan `CssrsModal` y `PsychometricScaleModal`
tras guardar la evaluación en `psychometric_evaluations`, con el `test_score_id` correcto. Lo roto
era un **trigger muerto** sobre `test_scores`, tabla obsoleta con 0 filas y cero referencias en todo
el código — vestigio del modelo anterior a `20260701_fix_clinical_alerts_fk.sql`. Se retiró el
trigger y su función; no se reescribió sobre `psychometric_evaluations` porque habría creado una
**segunda alerta duplicada** por cada evaluación de riesgo.

> ✅ **`test_scores` cerrado el 14-ago** (`20260814_test_scores_revoke.sql`), y **no con RLS**:
> `REVOKE ALL PRIVILEGES ... FROM anon, authenticated`. Los 8 privilegios y los **42 grants por
> columna** a cero; `anon` y `authenticated` desaparecen de la ACL. `service_role` y `postgres`
> intactos. **RLS sigue en 29/37 y las políticas en 92: este sprint no crea ninguna.**
>
> Lo que estaba abierto no era la lectura —0 filas, nada que leer— sino que **un visitante sin sesión
> podía fabricar un registro de ideación suicida a nombre de un paciente real**: `INSERT` con
> `patient_id` ajeno e `item_9_score=3`, sin CHECK, sin trigger, sin capa ninguna. Medido.
>
> 🧩 **Por qué REVOKE y no RLS, que es la lección del sprint:** una política **filtra** los
> privilegios que ya existen, **no los quita**. Revocados INSERT y UPDATE, a RLS no le queda nada que
> filtrar. Poner RLS aquí habría subido el contador a 30/37 sin cerrar nada más, y habría vuelto
> permanente una tabla pendiente de eliminación. **Cuando la ACL está mal puesta, la corrección es la
> ACL.**
>
> 🧹 **Sigue pendiente el `DROP`.** Es la conclusión correcta —0 filas, 0 consumidores, 0
> dependencias externas, sustituida por `psychometric_evaluations`— pero sería la primera operación
> irreversible del plan y **PITR está desactivado con cero copias**. Espera a que existan. Cuando
> llegue, su backup tendrá que **reconstruir el DDL desde el catálogo**: la tabla **no está en
> ninguna migración del repositorio**. `clinical_alerts.test_score_id` no se toca —su FK apunta a
> `psychometric_evaluations` desde el 1 de julio— y su renombrado a `evaluation_id` queda fuera de
> alcance.
>
> 🧹 **Queda abierto, sin corregir:** el frontend **se traga el error** al crear la alerta
> (`console.error` y seguir). Esa es la fragilidad real del camino de crisis, y está en React.
> Y el default ACL de `supabase_admin` concede `arwdDxtm` a `anon` en las tablas nuevas de `public`
> que él cree — no en las que crean las migraciones, que corren como `postgres`.

El **Grupo 3A** (12-ago) subió a **15 de 37**: `profiles`, `patient_therapist` y `therapy_sessions`,
con **una sola política nueva**. Cerró la fuga más seria que quedaba —**cualquier paciente con sesión
leía los 8 perfiles completos, con `email`, `session_token` y `role`; ahora ve solo el suyo**— y un
hueco que no protegía nadie: un terapeuta podía crear sesiones de terapia para pacientes que no eran
suyos. El `INSERT` de `profiles` queda cerrado a propósito: ningún código cliente crea perfiles, solo
las Edge Functions con `service_role`.

El **Grupo 3B** (12-ago) cerró el Grupo 3 con `appointments`: **16 de 37**. Era la tabla que más
cuidado pedía —6 triggers, y un `INSERT` que no envía `patient_id` sino que lo deriva un trigger
desde `relationship_id`—, así que antes de escribir nada se midió si el `WITH CHECK` de una política
llega a ver esas columnas derivadas. **Sí las ve: se evalúa después de los triggers `BEFORE`.**
Sin política, el `UPDATE` de una cita devolvía 0 filas en silencio.

> 🧩 **Regla que deja este sprint:** una política de `SELECT` no solo gobierna las lecturas — también
> hace falta para que un `INSERT ... RETURNING` funcione. En `appointments` se añadió por eso, como
> protección preventiva: hoy el frontend inserta sin `.select()`, pero añadirlo rompería el alta de
> citas con `42501`.

El **Grupo 4** (13-ago) llegó a **19 de 37** con las tablas públicas: `crm_leads`,
`public_test_submissions` y `blog_comments`, con 9 políticas. Cerró dos fugas medidas —**cualquier
usuario con sesión leía y modificaba los leads comerciales con nombre, correo y teléfono**, y
**`anon` veía los comentarios del blog aún no aprobados**— sin tocar los flujos públicos: el
formulario de contacto, el registro de tests y la lectura de comentarios aprobados siguen intactos.

`crm_leads` no necesitó ninguna política nueva: sus dos existentes ya eran las correctas, solo
faltaba encender RLS.

> 🚧 **`content_items` quedó aplazada, y con motivo.** La vista `content_items_meta` es de `postgres`
> y **no tiene `security_invoker`**, así que se ejecuta con `bypassrls` y **esquiva RLS por
> completo**: con RLS activo en la tabla, `anon` seguía leyendo las 26 piezas por la vista y 0 por la
> tabla. Activarlo daría una protección aparente. Su sprint debe estudiar a la vez: RLS de
> `content_items`, `security_invoker` de la vista, los consumidores públicos, la moderación de
> `blog_comments` y la lógica de `min_plan`.

**Ese sprint ya está hecho** (13-ago). Diagnóstico previo en
**`auditorias-tecnicas/Diagnostico_RLS_content_items_2026-08-12.md`**; aplicación en
`20260813_content_items_rls.sql`. **RLS llega a 20 de 37**, con 5 políticas y el `ALTER VIEW … SET
(security_invoker = true)` **en la misma migración**.

**El muro de pago no existía a nivel de datos.** `anon`, sin sesión, leía por la tabla el `body_md`
completo de las **8 piezas premium**; hoy lee 0 y sigue leyendo los 11 cuerpos `free` —filtra, no
bloquea—. Lo aplicaba solo el frontend al construir la consulta. El daño era comercial y de
propiedad intelectual: **no había dato clínico ni personal expuesto.**

- **No se podía partir en dos.** Las políticas sin el `ALTER VIEW` dejaban la vista sirviendo las 26
  piezas y hacían creer que estaba cerrado —medido: 10 por la tabla, 26 por la vista—; el
  `ALTER VIEW` sin políticas no cambiaba nada. Primer sprint de RLS que toca dos objetos a la vez.
- **Divergencia frontend/SQL en `min_plan`:** `getViewerPlan()` trata a admin y terapeuta como
  *premium* por rol, pero `get_my_plan_rank()` solo mira `plan_type` — y **ambos lo tienen en
  `free`**. Sin una rama de rol clínico explícita, el equipo clínico habría pasado de ver 26 piezas
  a 10: regresión, no cierre de fuga. **Es paridad con React; si cambia, hay que cambiarlo en los
  dos sitios.**
- **Las escrituras entraron en el mismo sprint.** Con RLS y solo políticas de `SELECT`, el `INSERT`
  fallaba con `42501` y **los 6 `UPDATE` del flujo editorial devolvían 0 filas en silencio**.

> 🧩 **Lo que este sprint deja claro, tras aislarlo:** RLS **no** cerró el `UPDATE` de un paciente
> sobre pieza ajena —con RLS apagado, la misma sentencia ya fallaba con `CONTENT_NOT_AUTHOR`: lo
> cerraba el trigger—, y el `42501` del `DELETE` y de las escrituras de `anon` **es de ACL, no de
> RLS** (`permission denied for table` ≠ `violates row-level security policy`). Lo que RLS aporta
> aquí es **la lectura**. Trigger y RLS son capas distintas: el trigger decide *quién* crea y *qué
> escritura* es válida, RLS decide *sobre qué fila*. Por eso la política de UPDATE lleva
> `WITH CHECK (true)`: duplicar las transiciones de estado crearía una segunda fuente de verdad.

> 🧩 **Lección repetida:** una política de `SELECT` no solo gobierna lecturas — también hace falta
> para que un `INSERT ... RETURNING` funcione. Apareció en `appointments` (Grupo 3B) y otra vez en
> `public_test_submissions`, donde `recordSubmission` usa `.select("id")`.

**`clinical_notes` entró el 13-ago: RLS 21 de 37, 74 políticas** (`20260813_clinical_notes_rls.sql`),
tras el diagnóstico conjunto de las dos tablas clínicas en
`auditorias-tecnicas/Diagnostico_RLS_clinical_notes_consents_2026-08-13.md`.

Cerró **dos cosas distintas**, y la segunda es nueva en todo el plan:

- **Lectura.** Cualquier usuario con sesión leía **las 24 historias clínicas** con `soap_data` y
  `treatment_plan` completos —paciente propietario, paciente ajeno y terapeuta sin relación, los tres
  veían 24—. Hoy los tres ven 0; el terapeuta asignado y el admin siguen viendo 24.
- **Integridad.** `clinical_notes` **no tiene trigger de autoría**, así que un paciente podía crear
  una nota con `is_signed = true` a nombre de su terapeuta: un documento clínico falsificado con firma
  ajena. La medición previa decía *«NADA. Se crea.»*; hoy da `42501`. **Es la primera política de RLS
  del proyecto que cierra un agujero de integridad y no de lectura** — en las demás tablas la
  escritura ya la gobernaba un trigger.

**Decisión de producto aplicada:** el paciente **no** lee `clinical_notes`. Ninguna pantalla se las
muestra y el acceso que existía era un camino no diseñado a un `jsonb` clínico crudo.

> 🧩 **Lo que hubo que separar, otra vez:** el `INMUTABILIDAD_CLINICA` al editar una nota firmada es
> del **trigger** y frena también al autor; el `42501` del `DELETE` es de la **ACL** —el trigger
> `BEFORE DELETE` ni llega a ejecutarse—; y los `0 filas` del paciente y del terapeuta ajeno sí son de
> RLS, aislados comprobando que **la misma fila sin firmar sí acepta el UPDATE de su autor**.

**`clinical_consents` cerró el plan el 13-ago: RLS 22 de 37, 79 políticas**
(`20260813_clinical_consents_rls.sql`). Cierra la lectura de **quién está en proceso clínico**:
antes cualquier usuario con sesión —incluido un tercero sin relación con nadie— veía los 2
consentimientos; hoy cada paciente ve el suyo, el terapeuta el de sus pacientes y el admin todos.

Aquí RLS **no cerró la escritura, porque ya estaba cerrada**: `enforce_clinical_consent_authorship`
ya devolvía `CLINICAL_CONSENT_AUTHOR_MISMATCH` a quien intentaba consentir o revocar por otro,
incluido el terapeuta asignado. Las políticas de escritura son **defensa en profundidad deliberada**,
por si el trigger se retira algún día.

> 🧩 **Lo que este sprint enseña: RLS se evalúa ANTES que el trigger.** Tras activarlo, el
> `CLINICAL_CONSENT_AUTHOR_MISMATCH` del `UPDATE` ajeno se convierte en **0 filas en silencio** —la
> fila ya no le llega al trigger—. No es regresión: la protección sigue, cambia el modo de fallo, y
> se verificó con dos controles (el admin sí modifica esa misma fila, y el `INSERT` ajeno sigue
> disparando el trigger). El frontend no lo nota: `revokeClinicalConsent` lee antes y aborta con un
> mensaje propio.

**El diagnóstico de las 15 sin grupo** (13-ago,
`auditorias-tecnicas/Diagnostico_RLS_15_restantes_2026-08-13.md`) las clasificó por riesgo medido y
sacó tres hallazgos:

- **`psychometric_evaluations` — hecha el mismo día. RLS 23 de 37, 80 políticas**
  (`20260813_psychometric_evaluations_rls.sql`). Cerró la lectura de **40 evaluaciones PHQ-9 y GAD-7**
  con `severity_level` y `raw_answers` —el PHQ-9 incluye el ítem 9, de ideación suicida—: un tercero
  sin ninguna relación las leía todas.
- **`messages` sigue bloqueada** por dos criterios de parada: una decisión de producto sin resolver
  —hoy el admin lee los cuerpos de la conversación terapéutica— y **cuatro suscripciones Realtime
  `postgres_changes`**, cuyo comportamiento con RLS no se puede verificar desde SQL. Su escritura ya
  la cubren seis triggers; lo que falta es la lectura.
- **`therapist_profiles` — hecha también el 13-ago. RLS 24 de 37, 83 políticas**
  (`20260813_therapist_profiles_rls.sql`). El trigger comprobaba propiedad pero **no que quien crea
  un perfil profesional tenga rol `therapist`**: cualquier usuario con sesión podía darse de alta
  como profesional con el número de matrícula que quisiera. Hoy recibe `42501`; el terapeuta
  legítimo sin perfil sigue dándose de alta.

> ⚠️ **Corrección a lo que escribí en ese diagnóstico.** Dije que la fila auto-insertada «entra en el
> directorio **y en el matching**». **La segunda mitad era falsa:** `matchingService.ts:224` filtra
> `.filter((t) => t.verified)` y es el único consumidor de `listTherapists()`. La fila entra en el
> **resultado SQL**, no en el del matching, y **no alcanza al paciente por la aplicación**. Nunca se
> midió lo que muestra la interfaz y no se afirma.

> 🧩 **Lo que enseña el sprint de `psychometric_evaluations`: tener políticas no es estar preparado.**
> La tabla traía 4 del Grupo 0, pero la del terapeuta decía `auth.uid() = therapist_id` y
> `therapist_id` está **NULL en las 40 filas**: encender RLS sin más habría dejado al terapeuta y al
> admin viendo el historial psicométrico **vacío y sin error**. Se corrigió a
> `is_therapist_of(patient_id)` en la misma migración. Y fue **el primer backup que tuvo que
> restaurar una política en vez de solo borrarla**.

**`clinical_guides` cerró el 13-ago con el sprint más corto del plan: RLS 25 de 37, y las políticas
se quedan en 83** (`20260813_clinical_guides_rls.sql`). Dos sentencias —`ENABLE ROW LEVEL SECURITY`
y `ALTER VIEW … security_invoker = true`— y **cero políticas nuevas**: la del Grupo 0 ya era
correcta, con su rama de rol clínico incluida. Cerró que cualquiera, sin sesión, leyera las **5 guías
de pago con su contenido completo** (4.523 caracteres de media); `anon` pasa de 20 a 15 por tabla y
por vista.

> 🧩 **Lo que deja este sprint: una política escrita no protege nada hasta que RLS se enciende, y una
> vista sin `security_invoker` la anula.** Medido: escenario A `tabla anon 15 · vista anon 20`;
> escenario B `15 · 15`. Es la segunda vez —tras `content_items`— que tabla y vista tienen que ir en
> la misma migración.

**`messages` cerró el 13-ago, tras dos sprints bloqueada: RLS 26 de 37, 86 políticas**
(`20260813_messages_rls.sql`). Tres políticas de participante
—`auth.uid() = patient_id OR auth.uid() = therapist_id`—, sin DELETE. Era la última tabla de riesgo
alto: **cualquier usuario con sesión leía el texto íntegro de una conversación terapéutica ajena**;
hoy solo la leen las dos partes.

**Los dos criterios que la bloqueaban se resolvieron midiendo, no suponiendo:**

- **El admin deja de leer los cuerpos.** Decisión de producto aprobada con evidencia: **0
  referencias a `messages` en `AdminDashboard` y en `adminService`**, y las 4 RPC vivas filtran por
  `auth.uid()`. No había consumidor; la capacidad era implícita. No es analogía con
  `clinical_notes` —allí el admin sí lee—: una nota clínica es un documento *sobre* el paciente, una
  conversación es un intercambio *entre* dos personas.
- **Realtime.** Se resolvió leyendo `realtime.apply_rls`: con RLS activo, Realtime **asume el rol y
  los claims del suscriptor** y prueba la fila contra las políticas. Sin política de SELECT las 4
  suscripciones `postgres_changes` se habrían apagado **en silencio**; con ella siguen, porque las 4
  filtran por una de las dos partes.

> 🧩 **La escritura ya estaba cerrada, y conviene no apuntársela a RLS.** Con RLS apagado, los
> intrusos ya recibían `MESSAGE_FORBIDDEN`, el cuerpo ya era inmutable (`MESSAGE_IMMUTABLE`), el
> `DELETE` lo cortaba la ACL y `enforce_message_insert` ya forzaba `sender_id := auth.uid()`.
> **Lo que faltaba era la lectura.**

> ⚠️ **Pendiente declarado:** la **entrega Realtime extremo a extremo por WebSocket no se verificó**
> —`realtime.subscription` tenía 0 filas al medir—. El mecanismo está validado; el chat en vivo
> conviene comprobarlo abriendo la app con dos sesiones.

**`notifications` cerró el 14-ago: RLS 27 de 37, 88 políticas**
(`20260814_notifications_rls.sql`). Dos políticas de destinatario —`auth.uid() = user_id`—, sin
INSERT ni DELETE.

**La fuga era de metadatos, no de contenido, y conviene no confundirlo:** cualquier usuario con
sesión leía `id`, `user_id` y `read_at` de todas las filas —**quién fue notificado, cuántas veces y
si lo había leído**—, lo que en la práctica revelaba quién tiene conversación terapéutica activa.
**`title` y `body` nunca estuvieron expuestos**: los cierran los grants por columna, que no se
tocaron y que siguen dando `42501` después de RLS.

> 🧩 **Lo que enseña esta tabla: la ACL de tabla no explica todo.** `authenticated` figura como
> `--w-` pero **escribe 10 columnas y lee 3**, por grants de columna. Esa asimetría parece peligrosa
> y no lo es: `enforce_notification_rules` congela todo salvo `read_at`. Y la creación sigue siendo
> exclusiva del sistema: `push_notification` solo la ejecuta `service_role`, disparada por 6
> triggers de otras tablas.

**`therapist_contact_requests` cerró el 14-ago: RLS 28 de 37, 91 políticas**
(`20260814_therapist_contact_requests_rls.sql`). Tres políticas de participante: leen las dos partes,
solo el paciente crea, las dos escriben. Sin DELETE. La tabla queda en **0 filas permanentes**.

**Aportación deliberadamente pequeña, y así se documentó antes de aplicarla:** lo único que era
legible por cualquiera era el **`id`** —un UUID opaco— y con él el número de solicitudes. Las otras
cuatro columnas ya las cerraba la ACL por columna, que no se tocó. **Se aplicó por coherencia con las
otras 27 tablas, no porque hubiera una fuga grave.**

> 🧩 **Aquí el trigger es la autoridad, y las políticas no lo duplican.**
> `enforce_contact_request_rules` es el control de autorización más completo de la base: el paciente
> solo puede cancelar, el terapeuta solo aceptar o rechazar, y solo desde `pending`. Verificado con
> RLS activo: cuando el solicitante intenta auto-aceptarse o el terapeuta intenta cancelar, **RLS deja
> llegar a la fila y es el trigger el que rechaza**. Y `CONTACT_REQUEST_CLOSED` y
> `CONTACT_REQUEST_APPEND_ONLY` **frenan también a `service_role`**: la tabla es append-only y de una
> sola transición para todos.

**`journey_events` cerró el 14-ago: RLS 29 de 37, 92 políticas**
(`20260814_journey_events_rls.sql`). **Una sola política, de INSERT:**
`WITH CHECK (user_id IS NULL OR auth.uid() = user_id)`. Sin SELECT, sin UPDATE, sin DELETE.

> 🧩 **La primera política del plan cuyo valor es de integridad y no de confidencialidad.**
> **No había fuga de lectura**: `20260730g` ya había revocado SELECT a `anon` y a `authenticated`, y
> los cinco actores daban `42501` en las seis columnas medidas —por **ACL**, no por RLS—. Lo que
> estaba abierto era **escribir a nombre de otro**: cualquiera, incluso **sin sesión**, podía
> insertar un evento atribuido a un usuario real, retrodatarlo, y —vía
> `notify_from_journey_event` [DEFINER]— **hacerle aparecer una notificación real en la bandeja**.
> Medido: `notifications` pasó de 2 a 3. Ahora `42501` por RLS, y el trigger ni se evalúa.

> ⚠️ **La política de julio que el proyecto tenía escrita no habría servido.**
> `20260730g:139` dejó comentada una `WITH CHECK (true)`. Se midió en simulación revertida: **no
> cierra nada**, `anon` sigue escribiendo como el terapeuta. La diferencia entre `(true)` y
> `(user_id IS NULL OR auth.uid() = user_id)` es todo el valor del sprint. Lección para las
> políticas que queden pendientes en otros archivos: **una política comentada no es un diseño
> verificado.**

> 📌 **Dos cosas que este sprint NO corrige, a propósito:** `created_at` sigue siendo retrodatable
> —la política ata la identidad, no la fecha; solo se puede retrodatar lo propio—, y **H-JE-001**:
> el trigger append-only es `FOR EACH ROW` y **TRUNCATE no dispara triggers de fila**, así que
> `service_role` puede vaciar la tabla. RLS no protege contra TRUNCATE. Sigue pendiente también la
> **retención a 24 meses**, y lo que retendría incluye 6 filas con `score` y `band` de PHQ-9/GAD-7.

**El sprint Catálogo + Auditoría** (14-ago, `20260814_prescriptions_revisions.sql`) subió a
**RLS 31 de 37**, con **0 políticas nuevas**: siguen siendo 92. Dos tablas, un sprint, **dos
mecanismos distintos**.

- **`clinical_prescriptions`** — `REVOKE INSERT, UPDATE` a `authenticated` + RLS **conservando su
  política del Grupo 0**. Se conserva el SELECT. `authenticated` pasa de `raw----m` a `r------m`.
- **`content_revisions`** — `REVOKE ALL` a `anon` y `authenticated` + RLS con **0 políticas**. Los 21
  grants por columna a 0.

> 🧩 **Aquí cierra el REVOKE, no RLS — y esta vez está probado por el SQLSTATE.** Las 9 denegaciones
> de escritura en `clinical_prescriptions` y las 8 de `content_revisions` dieron todas
> `42501 permission denied for table` —ACL—, y **ninguna** dio `new row violates row-level security
> policy`. En las dos tablas el problema nunca fue la falta de RLS: era que la ACL concedía escritura
> a `authenticated` **desde el día que se crearon**, 2024 en una y julio de 2026 en la otra.
> **Una política filtra los privilegios que existen; no los quita.**

> ⚠️ **Lo que estaba abierto en `clinical_prescriptions`, medido y revertido:** un paciente reescribió
> la instrucción de *«Activación Conductual Matutina»* por *«deja de tomar tu medicación y no vayas a
> la consulta»*. Ese texto es **lo que el paciente lee en su `PatientDashboard` como indicación de su
> terapeuta**, y afecta a todos los pacientes con esa plantilla asignada. Ninguna capa lo impedía.

> 🧩 **La política del Grupo 0 era imprescindible, y no se tocó.** El embed
> `patient_prescriptions → clinical_prescriptions` se resuelve **con el rol de quien llama**, así que
> RLS sobre el padre le alcanza. Sin política devuelve **0 filas y sin error**: al ser un `LEFT JOIN`,
> el título llega en `NULL`. Verificado tras aplicar: el embed sigue devolviendo
> *«Activación Conductual Matutina»* con su instrucción real.

> 📌 **`content_revisions` se conserva, no se elimina.** A diferencia de `guides` y `test_scores`
> tiene una promesa de producto escrita en `20260724_content_items.sql` —*«para que el autor pueda
> ver qué se le cambió»*— y un modelo de RLS ya redactado en comentario. **La auditoría no se
> implementó** en este sprint: la tabla queda cerrada y lista. Sigue con 0 filas y 0 consumidores.
> Y como en `test_scores`: revocado todo, **su RLS no tiene nada que filtrar** — es homogeneidad, no
> protección añadida.

> 🔎 **Detalle de Postgres que conviene recordar para futuros rollbacks:** un `REVOKE` **parcial**
> modifica la entrada de `relacl` **en sitio** y el rollback la restaura dígito a dígito; un
> `REVOKE ALL` **borra la entrada** y el `GRANT` la reañade **al final**, así que la cadena cambia de
> orden aunque los privilegios sean idénticos. Se vio en las dos tablas a la vez y explica el mismo
> matiz que apareció en `test_scores`.

**El sprint Preferencias y Bloqueos** (14-ago, `20260814_preferences_timeblocks_rls.sql`) **cierra el
plan**: RLS **33 de 37**, **98 políticas**. 6 políticas de propiedad, **ningún REVOKE** — las dos ACL
ya eran mínimas.

- **`user_preferences`** — SELECT, INSERT y UPDATE con `auth.uid() = profile_id`. Sin DELETE: la ACL
  ya lo niega.
- **`therapist_time_blocks`** — SELECT, INSERT y DELETE con `auth.uid() = therapist_id`. Sin UPDATE:
  la ACL ya lo niega.

> 🧩 **Este sprint no cerró ninguna fuga, y así queda dicho.** El trigger y la ACL ya cubrían todo:
> el ajeno chocaba con `USER_PREFERENCES_FORBIDDEN` y `BLOCK_FORBIDDEN`, y las columnas de contenido
> daban `42501` por ACL de columna incluso para el titular. Lo único legible por un tercero era
> `profile_id` en una y `id`+`therapist_id` en la otra: identificadores opacos. **RLS aporta el
> modelo explícito y la independencia del trigger, no una corrección urgente.**

> ⚠️ **La lección técnica del sprint, y la más reutilizable de todo el plan:**
> **un `DELETE ... WHERE id = X` necesita política de SELECT.** Postgres tiene que *leer* la fila para
> resolver el `WHERE`, y con RLS esa lectura la gobiernan las políticas de SELECT. Sin ella el
> borrado devuelve **0 filas, en silencio y sin error** — y `deleteTimeBlock` solo comprueba
> `if (error) throw`, así que el terapeuta no vería nada y el bloqueo seguiría en su agenda. Aislado
> en tres casos, incluido el contraste de que **sin `WHERE` sí borra**. Mi propuesta inicial era de 2
> políticas y estaba mal; lo destapó haber etiquetado «PASA» un `0 borradas`.

> 🧩 **Asimetría trigger/RLS que conviene retener:** en **INSERT gana el trigger** —el `BEFORE` corre
> antes del `WITH CHECK`, así que en `therapist_time_blocks` deriva `therapist_id := auth.uid()` y la
> política siempre ve una fila ya propia—; en **UPDATE y DELETE gana RLS**, porque su `USING` decide
> qué filas son alcanzables antes de que ningún trigger de fila se dispare. Por eso **la política de
> INSERT de `therapist_time_blocks` es redundante con el trigger**, aprobada así a propósito.

> 🧹 **Defecto preexistente descubierto de paso — H-TB-001, sin corregir:** `service_role` **no puede
> borrar** de `therapist_time_blocks`. La rama `IF rol = 'service_role' THEN RETURN NEW` va primero
> en el trigger, y en un `BEFORE DELETE` `NEW` es `NULL`: devolver `NULL` **cancela la operación sin
> error**. Medido: 2 filas antes, `ROW_COUNT=0`, 2 filas después. Es de agosto y RLS no lo toca.

> ✅ **RLS está en 33 de 37 tablas, con 98 políticas. El plan de RLS queda técnicamente cerrado.**
> Las 4 restantes tienen todas un modelo de autorización explícito y justificado:
> - **`cie11_directory`** y **`public_tests`** — catálogos públicos por diseño. Excepción legítima:
>   una política sería `USING (true)`, inerte por construcción.
> - **`guides`** — tabla muerta (0 filas, 0 consumidores). **Pendiente de eliminación**, no de RLS.
> - **`test_scores`** — cerrada por `REVOKE ALL`, con el **DROP aplazado** hasta que existan copias.
>
> No se persigue 37/37 a propósito: forzar RLS sobre dos catálogos públicos subiría el contador sin
> subir la seguridad.
>
> Anotado y sin corregir: `license_number` sigue siendo **público para `anon`** por ACL, decisión
> futura de producto; `listTherapists()` **filtra solo `active`**, con el filtro de `verified`
> viviendo en JS; y **`anon` conserva `REFERENCES` y `TRIGGER` sobre 10 objetos**, más
> `authenticated` sobre las dos vistas — resto de `H-TRIGGER-001`, que el sprint 4N cerró solo para
> `authenticated` sobre tablas.

> ⚠️ **RLS está en 11 de 37 tablas.** Los Grupos 3–4 seguirán activando, tabla a tabla.
> Una política que existe no está activa, y **no debe leerse como protección**.

> 🔎 **Lección de método:** el informe de 4Q clasificó `clinical_prescriptions` como peligrosa y
> recomendó borrar su política. Al ir a aplicarlo se comprobó que la tabla es un **catálogo de 14
> plantillas sin datos de pacientes**, y que borrarla habría roto la pantalla donde el paciente ve lo
> que le asignaron. Un informe correcto en lo general puede equivocarse en un caso concreto: **la
> verificación antes de aplicar no es opcional.**

### Metodología de trabajo en la base — se mantiene para cualquier cambio futuro

Nació de errores reales cometidos en este proyecto y es de aplicación obligatoria:

1. **Baseline** — demostrar el problema ejecutando, antes de tocar nada.
2. **Backup** — archivo de reversión escrito *antes* de la migración.
3. **Migración** — un solo archivo, idempotente, **aplicado dos veces** para probarlo.
4. **Verificación funcional** + **evidencia del catálogo** (`pg_catalog`, independiente de las pruebas).
5. **Dependencias** — inventario de todo lo que depende del objeto modificado.
6. **Regresiones** — se revalidan los sprints anteriores en cada sprint nuevo.

Reglas de fondo: nunca mezclar dos cambios en un sprint · prohibido escribir *"esto no rompe nada"* sin
evidencia · **preferir "no pude reproducirlo" a un falso positivo** · si aparece un problema distinto se
documenta pero **no** se corrige.

> **La regla del rollback obligatorio tiene una cicatriz detrás:** un bloque `DO` de diagnóstico sin
> `RAISE EXCEPTION` final **destruyó 358 filas de `journey_events`**. Desde entonces, toda prueba
> destructiva va dentro de una transacción revertida, y **nunca se ejecuta `TRUNCATE` sobre datos
> reales** — se mide el privilegio, no se ejerce.

---

## Cómo está organizada

- **`vision-producto/`** — **La filosofía oficial del producto, sus decisiones irreversibles y su
  sistema de experiencia y lenguaje.** Es la carpeta de mayor jerarquía del proyecto: manda sobre el
  roadmap y sobre las specs. Ver el bloque de arriba.
- **`diagnostico-vivo/`** — `diagnostico_sitio.html`, el documento de trazabilidad que se actualiza cada
  vez que se avanza en el proyecto. Es la fuente de verdad más reciente sobre qué módulo está en qué
  estado (backend vs. frontend, % de avance, pendientes). **Si solo vas a leer un archivo de esta
  carpeta, que sea este.**
- **`investigacion-clinica/`** — CIE-11, DSM-5-TR, metodologías terapéuticas basadas en evidencia,
  neurología/comorbilidades/deterioro cognitivo, escalas de evaluación y estructura de informes
  clínicos, y recomendaciones de implementación técnica. Investigación original hecha para este
  proyecto (no genérica).
- **`investigacion-competencia/`** — Perfil de Selia, Terapify y BetterHelp: onboarding, matching,
  pricing, diferenciadores. Se actualiza cada vez que se investiga algo nuevo de la competencia.
- **`analisis-estrategico/`** — Análisis del rol de "consultor estratégico": comparación de features
  propias contra la competencia y propuestas de expansión, con límites éticos explícitos (nunca
  explotar vulnerabilidad clínica real para conversión comercial).
- **`auditorias-tecnicas/`** — Auditorías del estado real de la base y del producto, hechas leyendo el
  esquema y ejecutando pruebas contra Supabase, no a partir de documentación previa.
  **`Blindaje_Seguridad_Contenido_2026-08-07.md` es el documento vigente sobre seguridad** — reemplaza
  cualquier afirmación anterior sobre privilegios, RLS o autorización editorial.
- **`especificaciones-producto/`** — Specs técnicas detalladas de features pendientes de construir
  (qué tabla, qué componente, qué UX), escritas para que Claude Code las ejecute con precisión.
  *Ojo:* algunas describen lo que se planeó, no lo que se construyó. La `10_` (sistema de contenido)
  lleva ya la corrección: su sección de RLS quedó obsoleta porque el modelo se implementó con trigger y
  `GRANT` por columna.
- **`prompts-claude-code/`** — Todos los prompts de handoff a Claude Code, en orden cronológico. Cada
  uno documenta qué se le pidió hacer y por qué.
- **`guias-bienestar/`** — Plantilla maestra de estructura de guías, taxonomía de categorías y el prompt
  reutilizable para generar guías nuevas (base de la futura automatización de 1 guía cada 2 días). Es el
  único contenido de esta carpeta pensado para vivir en Obsidian desde el principio — el resto del
  trabajo diario se queda local hasta que el usuario indique migrar todo a Obsidian.
- **`contenido-plataforma/`** — El contenido editorial real de la plataforma (artículos, resúmenes de
  audio) y la guía de estilo de redacción (`00_guia_estilo_redaccion.md`, extraída de Selia). El artículo
  modelo aprueba el tono antes de producir en volumen. El schema y el flujo de publicación
  (terapeuta→admin) están en `especificaciones-producto/10_...md`.
- **`auditorias-historicas/`** — Auditorías y documentos de contexto más antiguos (mayo-julio 2026),
  conservados como referencia histórica aunque ya no reflejen el estado actual del proyecto — para eso
  está `diagnostico-vivo/`.
- **`_revisar_no_pertenece_a_este_proyecto/`** — Un archivo (`Bocaditos_Estrategia_Instagram.docx`) que
  apareció guardado por error en la carpeta de Mente en Foco en una sesión anterior — es de otra marca
  (Bocaditos, no salud mental). Queda aquí visible en vez de borrado, a la espera de que confirmes si
  lo mueves a la carpeta correcta o lo eliminas.

## Regla de mantenimiento

Cuando se genere un documento nuevo de cualquiera de estos tipos, debe guardarse directamente en la
subcarpeta correspondiente — no en la raíz del proyecto. Así esta carpeta se mantiene como el único
lugar donde buscar contexto, sin volver a acumular archivos sueltos.

**Excepción para `vision-producto/`:** esos documentos no se editan al ritmo del trabajo diario.
La filosofía y los ADR solo cambian por decisión explícita del responsable del producto, y derogar
un ADR exige un ADR nuevo que explique qué cambió en la realidad para invalidarlo. El sistema de
lenguaje sí admite añadir ejemplos y patrones nuevos, siempre sumando y sin contradecir un ADR.
