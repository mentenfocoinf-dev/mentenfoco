# Blindaje de seguridad — perímetro de contenido y autorización editorial

**Del 5 al 8 de agosto de 2026 · 19 migraciones aplicadas · 17 backups de reversión**

Este documento reemplaza cualquier afirmación anterior sobre el estado de seguridad del contenido.
Lo que dice está medido contra la base real, no estimado. Lo que no está medido, se dice que no lo está.

---

## Por qué existe esta campaña

El 5 de agosto se detuvo el trabajo de la Agenda por decisión explícita del responsable del producto:

> *"A partir de este momento el objetivo principal deja de ser Agenda y pasa a ser blindar completamente
> la seguridad del proyecto."*

El detonante fue una auditoría que demostró —ejecutando, no razonando— que un paciente cualquiera podía
reescribir el contenido público de la plataforma. No era una hipótesis: se midió.

## Metodología impuesta (y por qué conviene conservarla)

Cada sprint tuvo que cumplir, sin excepciones:

1. **Baseline** — evidencia ejecutada del problema *antes* de tocar nada.
2. **Backup** — archivo de reversión de los objetos afectados, escrito antes de la migración.
3. **Migración** — un solo archivo SQL, idempotente, **aplicado dos veces** para probarlo.
4. **Verificación funcional** — el flujo real, no solo el privilegio.
5. **Evidencia del catálogo** — consulta a `pg_catalog` que prueba el estado final, independiente de las
   pruebas funcionales.
6. **Dependencias** — inventario automatizado de todo lo que depende del objeto modificado.
7. **Regresiones** — los sprints anteriores se vuelven a verificar en cada sprint nuevo.
8. **Resultado final** — conteos que demuestran que no quedó rastro.

Reglas de fondo, todas nacidas de errores reales cometidos en este proyecto:

- **Nunca aplicar un cambio sin demostrar antes el problema que corrige.**
- **Nunca mezclar dos cambios en un mismo sprint.**
- **Prohibido escribir "esto no rompe nada"** sin evidencia del catálogo o de una ejecución.
- **Prefiere "no pude reproducirlo" a un falso positivo.**
- Toda prueba destructiva dentro de una transacción con `RAISE EXCEPTION` final. **Nunca `TRUNCATE`
  sobre datos reales** — se mide el privilegio, no se ejerce.
- Si durante un sprint aparece un problema distinto, **se documenta pero NO se corrige**.

> **De dónde sale la regla del rollback obligatorio:** en una sesión anterior, un bloque `DO` de
> diagnóstico sin `RAISE EXCEPTION` final **destruyó 358 filas de `journey_events`**. La regla no es
> ceremonia; es la cicatriz de esa pérdida.

---

## Qué se cerró, sprint a sprint

| Sprint | Qué cerró | Migración |
| :--- | :--- | :--- |
| **0** | Bypass de las guardias `admin_*`: `IF get_my_role() <> 'admin'` no dispara cuando la función devuelve `NULL` (`NULL <> 'admin'` es `NULL`, y `IF NULL THEN` no entra). Sustituido por `auth.uid() IS NULL OR ... IS DISTINCT FROM 'admin'`. | `20260805b_sprint0_guardias_admin.sql` |
| **1** | `anon` tenía acceso completo a 8 tablas clínicas y de identidad. | `20260805c_sprint1_cerrar_anon.sql` |
| **2** | `DELETE`/`TRUNCATE` sobre tablas clínicas, incluido el borrado en cascada vía `profiles` (45 FK, 38 en `CASCADE`). | `20260805d_sprint2_sin_destruccion.sql` |
| **3** | `profiles`: `GRANT` por columna + trigger de propiedad. Un paciente ya no cambia su `role` ni su `plan_type`. | `20260805e_sprint3_profiles.sql` |
| **—** | `push_notification` era invocable sin sesión. 6 llamadores internos, 0 desde el frontend → `REVOKE` sin riesgo. | `20260805f_cerrar_push_notification.sql` |
| **—** | `anon` podía escribir en 7 objetos de contenido (209 filas destruibles). | `20260805g_anon_solo_lectura_contenido.sql` |
| **—** | `authenticated` podía borrar y vaciar esos mismos 7 objetos. | `20260806a_auth_sin_borrado_contenido.sql` |
| **4B** | **Autorización editorial**: trigger `trg_content_authorization` sobre `content_items`. | `20260806b_autorizacion_editorial.sql` |
| **4B.1** | **H-TRIGGER-001** (ver abajo). | `20260807_content_items_remove_trigger_references.sql` |
| **4C** | `UPDATE` de `authenticated` sobre los 6 objetos de contenido que nadie edita. | `20260807_remove_update_no_editables.sql` |
| **4C.1** | `INSERT` sobre esos mismos 6. | `20260807_remove_insert_no_editables.sql` |
| **4D** | `UPDATE` de tabla sobre `content_items` → `UPDATE` por columna (17 de 32). | `20260807_content_items_update_por_columna.sql` |
| **4E** | Auditoría independiente. Sin cambios. Encontró la asimetría del alta. | — |
| **4F** | `INSERT` de tabla → `INSERT` por columna (9 de 32) + comprobación de rol en el alta. Cierra la asimetría que dejó el 4D. | `20260807b_content_items_insert_por_columna.sql` |
| **4G** | Estudio de arquitectura. Sin cambios. Conclusión: no simplificar el trigger; limpiar dos residuos. | — |
| **4H** | Limpieza: se elimina la función huérfana `enforce_content_publish_is_admin` y la rama muerta de `translateWriteError`. Sin cambios de modelo. | `20260807c_limpieza_residuos_editoriales.sql` |
| **4I** | **Fuera del módulo editorial, por ADR-013:** se cierra el acceso anónimo a 11 tablas clínicas y de contacto. Un visitante sin sesión fabricaba tareas clínicas a nombre de terapeutas reales y podía vaciar 10 de las 11. | `20260807d_cierre_anon_11_tablas.sql` |
| **4J** | Se retira `DELETE` y `TRUNCATE` a `anon` en las tres tablas que solo protegía un trigger de fila. **`anon` ya no puede destruir datos en ninguna tabla de `public`.** | `20260807e_cierre_destruccion_anon.sql` |
| **4K** | Auditoría de solo lectura del `DELETE` de `authenticated` en 15 tablas. Sin cambios. Encontró un único consumidor real. | — |
| **4L** | Se retira `DELETE` y `TRUNCATE` a `authenticated` en 14 de esas 15. **Solo queda `therapist_time_blocks`**, el único borrado que la aplicación usa, ya protegido por propiedad. | `20260808_cierre_delete_authenticated.sql` |
| **4M** | Auditoría de solo lectura de `REFERENCES` y `TRIGGER`. Sin cambios. Reprodujo **escalada de `patient` a `admin`** vía H-TRIGGER-001 sobre `profiles`, y descubrió los *default privileges*. | — |
| **4N** | Se retira `REFERENCES` y `TRIGGER` a `authenticated` en las 30 tablas restantes. **H-TRIGGER-001 cerrado en todo el esquema.** | `20260808_revoke_references_trigger_authenticated.sql` |
| **4O** | Auditoría de solo lectura de los *default privileges*. Sin cambios. | — |
| **4P** | Se cierra el default de TABLAS de `postgres` en `public`. **Toda tabla nueva nace sin privilegios para `anon` y `authenticated`.** | `20260808b_default_privileges_tables.sql` |
| **4Q** | Auditoría y plan de RLS. Sin cambios. Midió que **RLS no alcanza a las 31 RPC** ni a `service_role`, y encontró **8 políticas que fallarían con `42501`**. Informe: `Auditoria_y_Plan_RLS_2026-08-11.md`. | — |
| **Grupo 0** | **Preparación de políticas para RLS, sin activarlo** (ver abajo). 8 políticas reescritas, 1 corregida, 2 eliminadas, 43 acotadas a `authenticated`. | `20260812_grupo0_preparacion_politicas.sql` |
| **Grupo 1** | **Primera activación real de RLS: 2 de 37 tablas.** `mood_entries` y `service_requests` quedan acotadas por `patient_id`. Fuga de datos entre pacientes cerrada. | `20260812_grupo1_rls.sql` |
| **Grupo 2** | **RLS pasa a 11 de 37.** Nueve tablas más, **sin crear ni una política**: las 18 que las gobiernan ya estaban listas desde el Grupo 0. | `20260812_grupo2_rls.sql` |
| **Clinical Alerts** | Se crea la política de `UPDATE` que faltaba. **RLS sigue apagado en esa tabla**: la política queda inerte hasta su propio sprint. | `20260812_clinical_alerts_update_policy.sql` |
| **Clinical Alerts · RLS** | **RLS activado: 12 de 37.** Las alertas de crisis quedan acotadas por paciente y por terapeuta asignado. | `20260812_clinical_alerts_enable_rls.sql` |
| **PHQ-9** | Se retira el trigger muerto `tr_evaluate_phq9_risk` y su función. Vestigio del modelo anterior; **la alerta la crea el frontend y funciona**. | `20260812_drop_evaluate_phq9_risk.sql` |
| **Grupo 3A** | **RLS 15 de 37.** `profiles`, `patient_therapist` y `therapy_sessions`. Cierra la fuga de lectura de perfiles y el alta de sesiones a pacientes ajenos. | `20260812_grupo3a_rls.sql` |
| **Grupo 3B** | **RLS 16 de 37.** `appointments`, con 3 políticas. Cierra el Grupo 3. Demostró que el `WITH CHECK` ve las columnas derivadas por los triggers `BEFORE`. | `20260812_grupo3b_rls.sql` |
| **Grupo 4** | **RLS 19 de 37.** `crm_leads`, `public_test_submissions` y `blog_comments`, con 9 políticas. `content_items` **aplazada**: la vista `content_items_meta` esquiva RLS. | `20260813_grupo4_rls.sql` |
| **Content Items** | **RLS 20 de 37.** `content_items` con 5 políticas **y** `security_invoker` en la vista, en la misma migración. Cierra la lectura anónima del `body_md` de las 8 piezas premium. | `20260813_content_items_rls.sql` |
| **Clinical Notes** | **RLS 21 de 37.** `clinical_notes` con 4 políticas. Cierra la lectura de las 24 historias clínicas por cualquier usuario con sesión **y** la falsificación de notas firmadas. | `20260813_clinical_notes_rls.sql` |
| **Clinical Consents** | **RLS 22 de 37.** `clinical_consents` con 5 políticas. Cierra la lectura de quién está en proceso clínico. La escritura ya la gobernaba el trigger. | `20260813_clinical_consents_rls.sql` |
| **Psychometric Evaluations** | **RLS 23 de 37.** Cierra la lectura de las 40 evaluaciones PHQ-9/GAD-7. **Corrige una política del Grupo 0 que estaba rota** contra los datos reales. | `20260813_psychometric_evaluations_rls.sql` |
| **Therapist Profiles** | **RLS 24 de 37.** 3 políticas. Cierra que cualquier usuario pudiera **darse de alta como perfil profesional**. La lectura sigue pública: es un directorio. | `20260813_therapist_profiles_rls.sql` |
| **Clinical Guides** | **RLS 25 de 37 con CERO políticas nuevas.** La del Grupo 0 ya era correcta: solo faltaba encenderla y que la vista dejara de esquivarla. | `20260813_clinical_guides_rls.sql` |
| **Messages** | **RLS 26 de 37.** 3 políticas de participante. Cierra la lectura de conversaciones terapéuticas ajenas, **también al admin**. | `20260813_messages_rls.sql` |
| **Notifications** | **RLS 27 de 37.** 2 políticas de destinatario. Cierra una fuga de **metadatos** —quién fue notificado y si lo leyó—; `title` y `body` nunca estuvieron expuestos. | `20260814_notifications_rls.sql` |
| **Preferencias y Bloqueos** *(cierre del plan)* | **RLS 33 de 37, 98 políticas.** 6 políticas de propiedad, ningún REVOKE. Las dos llevan SELECT porque sin ella el `RETURNING` de una y el `DELETE ... WHERE` de la otra fallarían en silencio. | `20260814_preferences_timeblocks_rls.sql` |
| **Catálogo y Auditoría** | **RLS 31 de 37, y 0 políticas nuevas.** `clinical_prescriptions`: REVOKE de escritura + RLS conservando su política del Grupo 0. `content_revisions`: REVOKE completo + RLS sin políticas. En las dos, quien cierra es el REVOKE. | `20260814_prescriptions_revisions.sql` |
| **Test Scores** *(cierre reversible, no RLS)* | **RLS sigue en 29 de 37.** Ninguna política. `REVOKE ALL` a `anon` y `authenticated`: los 8 privilegios y los 42 grants por columna a cero. La tabla NO se elimina: el DROP espera a que haya copias. | `20260814_test_scores_revoke.sql` |
| **Journey Events** | **RLS 29 de 37.** 1 política de INSERT. La primera del plan cuyo valor es de integridad y no de confidencialidad: no había fuga de lectura, había fabricación de eventos a nombre de terceros. | `20260814_journey_events_rls.sql` |
| **Therapist Contact Requests** | **RLS 28 de 37.** 3 políticas de participante. Aportación deliberadamente pequeña: solo cerraba la lectura de un UUID. El trigger ya cubría todo lo demás. | `20260814_therapist_contact_requests_rls.sql` |

Cada migración tiene su backup en `supabase/backups/` con el mismo prefijo de fecha.

---

## Grupo 0 — preparación de RLS (12 de agosto de 2026)

**RLS sigue apagado: 0 de 37 tablas.** Este grupo no lo activa; deja las políticas en
condiciones de que los Grupos 1–4 puedan activarlo tabla a tabla.

### El problema que cierra: 8 políticas que no filtraban, fallaban

Las expresiones de una política RLS **se evalúan con los privilegios del invocante**, no del
propietario de la tabla. Ocho políticas resolvían la relación terapeuta-paciente con
`EXISTS (SELECT 1 FROM patient_therapist …)`, y los sprints 4I–4N le habían retirado a
`authenticated` el `SELECT` sobre esa tabla. Medido ejecutando la expresión como `authenticated`:

```
EXISTS (SELECT 1 FROM patient_therapist ...)   ->  42501 permission denied
is_therapist_of(patient_id)                    ->  true
is_therapist_of(<paciente ajeno>)              ->  false
is_therapist_of(...) preguntado por el paciente->  false
```

No devolvían cero filas: devolvían **error**. Para el frontend eso no es "no ves nada", es una
pantalla rota. Se sustituyó la subconsulta por `is_therapist_of(uuid)`, que ya existía —
`SECURITY DEFINER`, owner `postgres`, `search_path=public`, con `EXECUTE` para `authenticated` —.
**No se creó ninguna función nueva.** Afectaba a `therapy_sessions` (4), `clinical_alerts` (2),
`patient_anamnesis` y `psychometric_evaluations`.

### Una corrección al informe del 4Q

El informe de 4Q clasificó la política de `clinical_prescriptions` como peligrosa —*"cualquier
paciente leería las prescripciones de todos"*— y recomendaba borrarla. **Era incorrecto.** La tabla
no tiene `patient_id` ni `therapist_id` ni FK saliente: sus columnas son
`id, titulo, objetivo_clinico, instruccion_paciente`, y son 14 plantillas de ejercicio terapéutico
que el frontend consume en `getPrescriptionsCatalog()`. La tabla que sí vincula personas es
`patient_prescriptions`.

Borrarla habría roto el *embed* `prescription:clinical_prescriptions (…)` de
`getPatientPrescriptions()`, con el que el paciente lee el título y la instrucción de lo que le
asignaron. **Se conservó**, reescrita a `TO authenticated USING (true)` en vez de comprobar
`auth.role() = 'authenticated'` dentro de la expresión.

### Las dos políticas de `guides`

Eliminadas. `guides` quedó sustituida por `clinical_guides` al construirse el modelo editorial:
tiene **0 filas** frente a las 20 de `clinical_guides`, y ni ella ni `user_guide_progress` aparecen
una sola vez en `src/` ni en las Edge Functions. La **tabla no se tocó** —sigue existiendo, con su
FK desde `user_guide_progress`—: se borraron políticas, no tablas.

### `roles = public` → `TO authenticated`

47 de las 48 políticas apuntaban a `public`, que incluye a `anon`. Se acotaron 43, con un criterio
explícito: **solo donde `anon` no tiene ningún privilegio sobre la tabla**, de modo que el cambio no
pueda alterar comportamiento. Quedan deliberadamente en `public` los dos flujos públicos legítimos:

- `clinical_guides` · *Guides readable by plan level* — `anon` tiene `SELECT` y la expresión está
  escrita para él: `plan_rank(min_plan) = 0` deja ver las guías gratuitas del hub público.
- `crm_leads` · *Anyone can create a lead* — `anon` tiene `INSERT`; es el formulario de contacto.

`cie11_directory` no se tocó: era la única política que ya estaba declarada `TO authenticated`.

### Verificación

| Invariante | Resultado |
| :--- | :--- |
| ACL de las 37 tablas | `64cdb69b1241ea34ac996556da08dc19` — **idéntica** al baseline |
| 42 triggers | `217dffa660659d3cf920f78d1ca5f344` — idénticos |
| 62 foreign keys | `b9087924187f648a75b1677f7e8cd3ea` — idénticas |
| 274 funciones | `a093e1446067405c4d51432b46e6f543` — idénticas |
| RLS | **0 / 37** |
| Políticas que fallarían con `42501` | **0** (antes 8) |
| Políticas con `auth.role()` en la expresión | 0 |
| Datos | todos los conteos coinciden |

Regresión ejecutada: `anon` conserva el hub público (20 guías), el blog (26 piezas), los 3 tests y el
`INSERT` de `crm_leads`, y sigue denegado en `profiles`; el paciente lee el catálogo de 14 plantillas
y sus 5 sesiones; el terapeuta obtiene sus 4 pacientes y sus 24 notas; `service_role` intacto.

**La migración se aplicó cuatro veces.** La primera versión no era idempotente: en la segunda pasada
el `DROP` del nombre antiguo de la política de `clinical_prescriptions` ya no encontraba nada y el
`CREATE` del nombre nuevo chocaba con `42710`. Se añadió un `DROP IF EXISTS` del nombre nuevo; tres
pasadas consecutivas devuelven `201`.

### Pendiente para los Grupos 1–4

Grupo 0 **prepara** las políticas; **los Grupos 1–4 activarán RLS** progresivamente, en el orden
propuesto en `Auditoria_y_Plan_RLS_2026-08-11.md`: primero las tablas de bajo riesgo, después las
clínicas de acceso directo, luego la relación, y al final lo público y lo editorial.

> **Hallazgo documentado y NO corregido**, según la regla del proyecto: `authenticated` tiene
> `INSERT` y `UPDATE` sobre `clinical_prescriptions`, que es un catálogo. Hoy cualquier paciente con
> sesión puede alterar las 14 plantillas. Es un problema de **ACL**, no de políticas, y queda fuera
> del alcance del Grupo 0.

---

## Grupo 1 — primera activación de RLS (12 de agosto de 2026)

**RLS pasa de 0 a 2 de 37 tablas.** `FORCE RLS` sigue en 0.

### Por qué estas dos y no otras

`mood_entries` y `service_requests` son las únicas del esquema que cumplen las cinco condiciones a la
vez: un solo dueño por fila (`patient_id`), **cero funciones de `public` las mencionan**, un único
consumidor en el frontend que siempre recibe `profile.id`, cero triggers y cero políticas previas, y
`anon` sin ningún privilegio DML.

Lo segundo es lo decisivo. El sprint 4Q midió que **RLS no alcanza a las 31 RPC `SECURITY DEFINER`**,
porque su owner `postgres` tiene `bypassrls`. Estas dos tablas no las consulta ninguna función: aquí
RLS es la única puerta, y funciona entera.

### La fuga que cierra, medida antes y después

Sondeado por un paciente real con **cero filas propias** en ambas tablas, de modo que cualquier fila
que viera fuese, por definición, ajena:

| Sonda del paciente B | Antes | Después |
| :--- | :--- | :--- |
| `SELECT * FROM mood_entries` | **leía 1 fila ajena** | 0 filas |
| `SELECT * FROM service_requests` | **leía 1 fila ajena** | 0 filas |
| `INSERT mood_entries` con `patient_id` de A | **insertaba** | `42501 new row violates row-level security policy` |
| `INSERT service_requests` a nombre de A | **insertaba** | `42501` |
| `UPDATE mood_entries` de A | **modificaba** | 0 filas afectadas |
| `UPDATE service_requests` de A | **modificaba 1** | 0 filas afectadas |
| `DELETE` en cualquiera de las dos | `42501` (ACL) | `42501` (ACL, sin cambios) |

El frontend filtraba con `.eq("patient_id", patientId)`, pero ese filtro vive en el cliente: nada
impedía enviar el id de otra persona.

**Que RLS filtra y no bloquea** se comprobó aparte: el mismo paciente B **sí** puede crear su propia
fila y, tras crearla, ve exactamente una — la suya.

### Las cinco políticas

```
mood_entries      SELECT  TO authenticated  USING (auth.uid() = patient_id)
mood_entries      INSERT  TO authenticated  WITH CHECK (auth.uid() = patient_id)
mood_entries      UPDATE  TO authenticated  USING + WITH CHECK (auth.uid() = patient_id)
service_requests  SELECT  TO authenticated  USING (auth.uid() = patient_id)
service_requests  INSERT  TO authenticated  WITH CHECK (auth.uid() = patient_id)
```

**`mood_entries` necesita INSERT y UPDATE por separado** porque `saveTodayMood` usa
`.upsert(..., { onConflict: "patient_id,entry_date" })`, que PostgREST traduce a
`INSERT ... ON CONFLICT DO UPDATE`: la rama de alta evalúa la política de INSERT y la de conflicto la
de UPDATE. Con una sola, el upsert fallaría la mitad de las veces. **Ambas ramas se probaron por
separado y las dos funcionan.**

**`service_requests` no lleva política de UPDATE** a propósito: nadie actualiza esa tabla desde la
aplicación, y sin política RLS la cierra por completo para `authenticated`. Medido: incluso el propio
dueño obtiene **0 filas afectadas** al intentar actualizar la suya. Es denegación por filtrado, no
error.

**Ninguna de las dos lleva política de DELETE**, porque la ACL ya lo niega (`authenticated=arwm`, sin
`d`) y una política sería letra muerta. Ninguna lleva política para `anon` —la ACL lo detiene antes de
que RLS entre en juego— ni para `service_role`, que tiene `bypassrls` y nunca las evaluaría.

### Verificación

| Invariante | Resultado |
| :--- | :--- |
| ACL de las 37 tablas | `64cdb69b1241ea34ac996556da08dc19` — **idéntica** |
| 42 triggers | `217dffa660659d3cf920f78d1ca5f344` — idénticos |
| 62 foreign keys | `b9087924187f648a75b1677f7e8cd3ea` — idénticas |
| 274 funciones | `a093e1446067405c4d51432b46e6f543` — idénticas |
| RLS | **2 / 37** · FORCE 0 / 37 |
| Políticas | 51 (46 + 5) |
| Datos | los 9 conteos coinciden; cero filas de prueba supervivientes |

`anon` sigue en `42501` por ACL, antes de que RLS intervenga. `service_role` conserva acceso completo
—medido, no supuesto—: lee todas las filas y actualiza `service_requests` pese a no haber política de
UPDATE, gracias a `bypassrls`.

Migración aplicada **tres veces** con `201` en todas. Reversión en
`supabase/backups/20260812_pre_grupo1_rls.sql`.

### Consecuencia aceptada

Ningún terapeuta ni administrador puede ver hoy el ánimo ni las solicitudes de servicio de sus
pacientes por acceso directo. No lo hacían antes tampoco —no existe código que lo intente—, pero
ahora está cerrado en la base. El día que se necesite, se añadirá su política en su propio sprint.

---

## Grupo 2 — nueve tablas más (12 de agosto de 2026)

**RLS pasa de 2 a 11 de 37.** `FORCE RLS` sigue en 0. **No se creó ni una política:** las 18 que
gobiernan estas tablas ya estaban correctas desde el Grupo 0. La migración son nueve `ALTER TABLE`.

`patient_anamnesis` · `patient_prescriptions` · `clinical_documents` · `clinical_recommendations` ·
`clinical_tasks` · `crm_notes` · `user_guide_progress` · `telemetry_events` · `family_genograms`

Se eligieron con el mismo criterio que funcionó en el Grupo 1: **ninguna función de `public` las
menciona**, así que el límite del sprint 4Q —RLS no alcanza a las 31 RPC `SECURITY DEFINER`— no las
afecta y RLS es su única puerta. Ocho no tienen ningún consumidor vivo; la novena,
`patient_anamnesis`, tiene dos y datos de cuatro pacientes.

### Lo que se demostró con datos reales

Sobre `patient_anamnesis`, con el terapeuta `104db81c` y sus 4 pacientes asignados:

| Actor | Ve |
| :--- | :--- |
| Paciente A | **1** — solo la suya; filtrando por otro paciente, 0 |
| Paciente no asignado | **0**, mientras A sí ve la suya → el 0 es RLS, no ausencia de datos |
| Terapeuta | **4**. Se sembró una quinta anamnesis de un paciente ajeno y **siguió viendo 4** |
| Admin | 5 — todas |
| `anon` | `42501` por ACL, antes de que RLS intervenga |
| `service_role` | todas, por `bypassrls` |

El `upsert` de `anamnesis.tsx` funciona en sus dos ramas —conflicto y alta— y **con un `patient_id`
ajeno devuelve `42501`**.

### Las ocho vacías: siembra temporal de dos dueños

Al no haber datos, se sembraron filas de dos dueños distintos dentro de una transacción revertida.
Hubo que sembrar además un `crm_lead` y una `guide`, porque `crm_notes.lead_id` y
`user_guide_progress.guide_id` son FK `NOT NULL` a tablas vacías.

```
tabla                     A   B   terapeuta  admin   anon       service_role
patient_prescriptions     1   1   2          0       42501 ACL  2
clinical_documents        1   1   1          1       42501 ACL  2
clinical_recommendations  1   1   1          1       42501 ACL  2
clinical_tasks            1   1   1          1       42501 ACL  2
crm_notes                 0   0   0          1       42501 ACL  1
user_guide_progress       1   1   0          0       42501 ACL  2
telemetry_events          0   0   0          2       42501 ACL  2
family_genograms          0   0   0          0       42501 ACL  2
```

Cada uno ve exactamente lo que su política dice y nada más. `telemetry_events` solo lo lee el admin
—los usuarios insertan pero no leen—. **`family_genograms` da 0 a todos**: entró sin políticas a
propósito, porque tiene 0 filas y 0 consumidores y hoy `authenticated` tenía `raw` sobre una tabla
clínica sin usar.

### Una duda semántica resuelta ejecutando

Seis de las 18 políticas son `FOR ALL` con solo `USING`, sin `WITH CHECK`. En vez de suponer qué hace
PostgreSQL, se replicó el patrón en una tabla de usar y tirar creada y destruida dentro de una
transacción revertida: **el `USING` sí actúa como `WITH CHECK`**. Confirmado después sobre la tabla
real — un terapeuta inserta en `clinical_tasks` con su `therapist_id` y recibe `42501` con uno ajeno.

### Qué quedó fuera, y por qué

**`clinical_alerts` — el hallazgo que hay que resolver aparte.** Su ACL permite `UPDATE`, pero sus 5
políticas cubren solo `INSERT` y `SELECT`, y `resolveCrisisAlert()` hace un `UPDATE`. Con RLS activo
devolvería **0 filas afectadas sin error**, y el código solo comprueba `if (error) throw`: **la
resolución de alertas de crisis fallaría en silencio.** Necesita su propia política de `UPDATE` antes
de entrar en ningún grupo. Se verificó que hoy, sin RLS, ese `UPDATE` sigue funcionando.

`clinical_notes` (24 filas, 8 consumidores) y `clinical_consents` (2 filas, 4 consumidores) no tienen
ninguna política: encenderlas las cerraría enteras. `test_scores`, `content_revisions` y `guides`,
igual pero sin consumidores. `psychometric_evaluations` la toca una función.
`crm_leads` tiene flujo público y una política `TO public` que merece análisis aparte.

### Verificación

Las seis huellas —ACL `64cdb69b…`, triggers `217dffa6…`, FK `b9087924…`, funciones `a093e144…`,
políticas `faa7706d…`, índices `77e58883…`— **idénticas antes y después**. La única que cambió es la
de estado RLS, y fue igual en las tres pasadas de la migración. Los 17 conteos coinciden; cero filas
de prueba supervivientes; cero tablas temporales.

`evaluate_phq9_risk()` sigue intacta: `SECURITY DEFINER`, owner `postgres` con `bypassrls`,
`search_path=public, pg_temp`, enganchada en `test_scores`. **RLS no protege esa ruta** — y no debe:
es por donde nace automáticamente la alerta de crisis cuando el ítem 9 del PHQ-9 es positivo.

### Limitación real de estas pruebas

Solo `patient_anamnesis` tiene datos de producción. En las otras ocho el aislamiento se demostró con
filas sembradas y revertidas: es una prueba válida del mecanismo, pero **no es lo mismo que medir
sobre tráfico real**. Conviene revisarlo cuando esas tablas empiecen a usarse.

---

## Clinical Alerts — la política de `UPDATE` que faltaba (12 de agosto de 2026)

> ⚠️ **RLS SIGUE APAGADO en `clinical_alerts`.** Este sprint solo crea la política; mientras
> `relrowsecurity = false`, PostgreSQL **no la evalúa**. La activación es un sprint aparte, separado
> a propósito para no mezclar dos cambios.

### El hueco

La ACL concede `UPDATE` a `authenticated` (`authenticated=arwm`), pero las cinco políticas de la
tabla cubrían solo `INSERT` y `SELECT`. El único consumidor que actualiza es `resolveCrisisAlert()`
([clinicalService.ts:296](../../src/lib/api/clinicalService.ts)), con el que un terapeuta registra
que atendió una alerta de crisis.

Medido replicando las cinco políticas sobre una tabla de usar y tirar con RLS activo:

```
terapeuta SELECT ............ 1 fila visible   (el SELECT sí funcionaba)
terapeuta UPDATE (resolver) . 0 filas afectadas   <- FALLO SILENCIOSO
```

No devolvía error: devolvía cero filas. Y el código solo comprueba `if (error) throw`. El terapeuta
habría visto el modal cerrarse con éxito y la alerta habría seguido abierta.

### Quién puede resolver — decisión de producto explícita

| Actor | ¿Resuelve? |
| :--- | :--- |
| Terapeuta asignado | **Sí**, y solo las alertas de sus pacientes |
| Terapeuta no asignado | No |
| Paciente | No, ni siquiera la suya. Conserva `SELECT` e `INSERT` |
| **Administrador** | **No.** Conserva su `SELECT` |
| `anon` | No: la ACL lo detiene antes que RLS |
| `service_role` | Sí, por `bypassrls`. Seeder y Edge Functions sin cambios |

**El admin queda fuera porque no existe ningún consumidor real.** `CrisisAlertResolutionModal` solo
se monta desde `TherapistDashboard` con `therapistId={profile.id}`, y `AdminDashboard` no toca esta
tabla. Se comprobó recorriendo el código: en todo el repositorio hay **un solo `UPDATE`** sobre
`clinical_alerts`.

### La política

```sql
CREATE POLICY "Therapists resolve alerts of assigned patients"
  ON public.clinical_alerts
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (public.is_therapist_of(patient_id))
  WITH CHECK (public.is_therapist_of(patient_id) AND resolved_by = auth.uid());
```

**`resolved_by = auth.uid()` liga la firma al actor.** `resolveCrisisAlert` recibe `therapistId`
desde el cliente; hoy le llega `profile.id`, así que el consumidor real no se rompe —probado—, pero
sin esa cláusula un terapeuta podría firmar la atención de una crisis a nombre de otro. En una
historia clínica eso importa.

Usa `is_therapist_of()` y no una subconsulta porque `authenticated` no tiene `SELECT` sobre
`patient_therapist` desde los sprints 4I–4N: una subconsulta directa daría `42501`. Es el mismo
fallo que el Grupo 0 corrigió en otras ocho políticas. **No se creó ninguna función nueva.**

### Verificación

Probada sobre una réplica creada con `LIKE ... INCLUDING ALL` y las **seis** políticas copiadas del
catálogo, con RLS activo y una alerta **pendiente** sembrada — las dos reales están resueltas desde
junio. Todo dentro de una transacción revertida:

```
A  terapeuta      UPDATE exacto de resolveCrisisAlert     1 fila   OK
A  (comprobación) resolved_by quedó ligado al actor       SÍ
B  terapeuta      UPDATE con resolved_by AJENO            42501
B  terapeuta      UPDATE cambiando patient_id a ajeno     42501
C  no relacionado SELECT / UPDATE                         0 filas / 0 filas
D  paciente dueño SELECT / UPDATE resolviendo la suya     1 fila / 0 filas
F  admin          SELECT / UPDATE resolviendo             1 fila / 0 filas
G  anon           SELECT / UPDATE                         42501 (ACL) / 42501 (ACL)
H  service_role   UPDATE                                  1 fila (bypassrls)
   ¿abrió SELECT/INSERT/DELETE sin querer?                no: 42501 en ambos
```

Invariantes: ACL `64cdb69b…`, triggers `217dffa6…`, FK `b9087924…`, funciones `a093e144…`, índices
`77e58883…` y las 2 alertas `bc7caec3…` — **las seis idénticas**. RLS sigue **11/37**, FORCE 0/37,
políticas 51 → 52. Migración aplicada tres veces con `201`.

La reversión se probó dentro de una transacción: tras el `DROP`, la huella global de políticas vuelve
exactamente a `faa7706dd5cad935072f5113cfca8300`, el baseline previo al sprint.

### Lo que queda

Encender RLS sobre `clinical_alerts`. Hasta entonces la tabla sigue como estaba: cualquier paciente
con sesión puede leer las alertas de otros, resolverlas y alterar su gravedad —medido—. **La política
existe pero no protege todavía.**

---

## Clinical Alerts — RLS activado (12 de agosto de 2026)

**RLS pasa de 11 a 12 de 37 tablas.** FORCE sigue en 0. La migración es una sola sentencia: la
política de `UPDATE` ya se había creado y probado en el sprint anterior.

### Lo que cierra, medido antes y después

Sondeado con un paciente **sin ninguna relación** con el terapeuta, sobre una alerta pendiente
sembrada en transacción revertida:

| Sonda del paciente ajeno | Antes | Después |
| :--- | :--- | :--- |
| `SELECT` de alertas de crisis | **leía las 2 ajenas** | **0 filas** |
| `UPDATE` resolviendo una alerta ajena | **la resolvía** | 0 filas |
| `UPDATE` cambiando el `status` (la gravedad) | **la cambiaba** | 0 filas |
| `UPDATE` firmando como el terapeuta | **lo conseguía** | 0 filas |

Y el reparto completo, con RLS ya activo sobre la tabla real:

```
A  terapeuta      SELECT la alerta pendiente          1 fila
A  terapeuta      UPDATE de resolveCrisisAlert        1 fila, resolved_by = su auth.uid()
B  terapeuta      UPDATE con resolved_by AJENO        42501
B  terapeuta      UPDATE moviendo patient_id          42501
C  paciente ajeno SELECT / UPDATE / cambiar gravedad  0 / 0 / 0
D  paciente dueño SELECT                              1 fila (sigue viendo la suya)
D  paciente dueño UPDATE resolviendo la suya          0 filas
D  paciente dueño INSERT su propia alerta             OK  (CssrsModal sigue funcionando)
D  paciente dueño INSERT con patient_id AJENO         42501
F  admin          SELECT / UPDATE resolviendo         4 filas / 0 filas
G  anon           SELECT / UPDATE                     42501 (ACL, antes que RLS)
H  service_role   SELECT / UPDATE / INSERT            todo OK (bypassrls)
   DELETE                                             42501 (ACL, sin privilegio `d`)
```

Que RLS **filtra y no bloquea** queda probado por la fila D: el paciente sigue viendo la suya y
sigue pudiendo crearla.

### Verificación

Las siete huellas —ACL `64cdb69b…`, triggers `217dffa6…`, FK `b9087924…`, funciones `a093e144…`,
políticas `dd8bfdfc…`, índices `77e58883…` y las 2 alertas `bc7caec3…`— **idénticas antes y después**.
La única que cambió es la de estado RLS, y fue igual en las tres pasadas de la migración, todas con
`201`. Cero residuos: 0 alertas pendientes, 2 filas, 0 filas en `test_scores`, 0 tablas temporales.

La reversión se probó dentro de una transacción: tras el `DISABLE`, la huella de estado RLS vuelve
exactamente a `729c6582bbe74a62c7e36bb839c57b7a` y el conteo global a 11 de 37.

### Hallazgo documentado y NO corregido

Al probar la vía automática apareció un defecto **preexistente y ajeno a este sprint**:
`evaluate_phq9_risk()` fallaba con `23503`. Se documentó aquí y se resolvió en el sprint siguiente.

---

## PHQ-9 — retirada del trigger muerto (12 de agosto de 2026)

### Antes

`evaluate_phq9_risk()` —trigger `AFTER INSERT` sobre `test_scores`— hacía
`INSERT INTO clinical_alerts (patient_id, test_score_id, ...) VALUES (NEW.patient_id, NEW.id, ...)`,
pero la FK de esa columna apunta a **`psychometric_evaluations(id)`**. Como ambas tablas generan su
clave con `gen_random_uuid()`, los ids no pueden coincidir jamás: todo `INSERT` en `test_scores` con
`item_9_score > 0` fallaba con `23503 violates foreign key constraint`.

> **Este defecto era preexistente al Sprint Clinical Alerts — ENABLE RLS. Se reprodujo con RLS
> activo y con RLS apagado, obteniendo el mismo `23503`.**

### La corrección de un diagnóstico anterior

El informe del sprint de RLS concluyó que *«la creación automática de alertas de crisis por PHQ-9
nunca ha funcionado»* y recomendó priorizar su reparación sobre el Grupo 3. **Esa lectura era
demasiado fuerte y la recomendación se apoyaba en ella.**

La alerta de crisis **sí se crea, y funciona**. La crean explícitamente
[CssrsModal.tsx:125](../../src/components/CssrsModal.tsx) y
[PsychometricScaleModal.tsx:44](../../src/components/PsychometricScaleModal.tsx): insertan en
`psychometric_evaluations`, recogen el `id` y, si hay riesgo, insertan la alerta con
`test_score_id` = ese id — justo lo que la FK exige. Lo roto era un trigger sobre una tabla que
ningún código toca.

### Por qué existía el desacople

Lo explica [20260701_fix_clinical_alerts_fk.sql](../../supabase/20260701_fix_clinical_alerts_fk.sql):
`test_scores` era la tabla previa y más simple; el roadmap especificó construir sobre
`psychometric_evaluations` y la FK se corrigió para apuntar ahí, dejando `test_scores` sin usar.
**El trigger no se actualizó.** Hoy `test_scores` tiene 0 filas, **cero referencias** en `src/`, Edge
Functions y scripts, y ninguna migración del repositorio la crea siquiera.

### Después

Se retiran el trigger y su función. **No se reescribe sobre `psychometric_evaluations`**, porque el
frontend ya inserta la alerta y un trigger equivalente crearía una **segunda alerta duplicada** por
cada evaluación de riesgo. Duplicar alertas en el módulo de crisis es peor que retirar código muerto.
La tabla `test_scores` **no se borra**: es una decisión de limpieza aparte.

Medido con el esquema corregido:

```
INSERT en test_scores con item 9 POSITIVO ..... OK  (antes: 23503), sin crear alerta
ruta real, PHQ-9 CON riesgo .................. exactamente 1 alerta,
    test_score_id existe en psychometric_evaluations, resolved_* en NULL
ruta real, PHQ-9 SIN riesgo .................. 0 alertas
```

Las garantías de RLS del sprint anterior siguen intactas: paciente dueño 1 fila y no resuelve;
paciente ajeno 0 y 0; terapeuta asignado 3 filas y **resuelve**; terapeuta ante un paciente que no es
suyo, 0; admin lee 3 y **no resuelve**; `anon` `42501` por ACL; `service_role` intacto.

### Verificación

Cinco huellas **idénticas**: ACL `64cdb69b…`, políticas `dd8bfdfc…`, FK `b9087924…`, índices
`77e58883…`, estado RLS `db474297…`. Cambiaron solo las dos autorizadas: triggers 42 → 41
(`3d2e64ad…`) y funciones 274 → 273 (`6d9ef54e…`). Datos idénticos, incluida la huella de las 2
alertas `bc7caec3…`. Migración aplicada tres veces con `201`.

**Round-trip de reversión ejecutado de verdad**, no solo en transacción: aplicar el backup restaura
la función con md5 `fe63206cf719b6256430ce732d448460` —idéntico al original— y la huella de funciones
vuelve a `a093e144…`. La de triggers difiere solo en el `tgfoid`, porque la función recreada tiene
OID nuevo aunque su cuerpo sea byte a byte el mismo. Después se reaplicó la corrección.

### Dos hallazgos documentados sin corregir

**`test_scores` concede `arwxtm` a `anon`.** Un visitante sin sesión puede escribir en una tabla
obsoleta que nadie lee. Hasta ahora el trigger roto bloqueaba por accidente el caso de riesgo; al
retirarlo, ese bloqueo desaparece. Es ACL sobre una tabla muerta, y va con su limpieza.

**El frontend se traga el error de la alerta:** `if (alertError) console.error(...)`. Si la inserción
fallara, el paciente vería su resultado con normalidad y nadie se enteraría. **Esa es la fragilidad
real del camino de crisis**, y está en React, no en la base.

---

## Grupo 3A — RLS en las tres tablas de relación (12 de agosto de 2026)

**RLS pasa de 12 a 15 de 37.** FORCE sigue en 0. Políticas 52 → 53: una sola política nueva.

`profiles` · `patient_therapist` · `therapy_sessions`. **`appointments` queda fuera** — necesita 4
políticas nuevas y una medición previa del orden entre los triggers `BEFORE` y el `WITH CHECK`. Es el
**Grupo 3B**, con su propio backup y su propia batería.

### La fuga de `profiles`, cerrada

Era la única de las tres con una fuga de **lectura** viva. Medido antes y después con un paciente sin
relación con nadie:

| Sonda | Antes | Después |
| :--- | :--- | :--- |
| `SELECT id, email, session_token, role FROM profiles` | **los 8 perfiles** | **1** — solo el suyo |
| `session_token` ajenos visibles | **6** | 0 |
| leer el perfil de otro paciente | sí | 0 filas |

Y lo que debe seguir funcionando, funciona: el paciente lee su perfil completo (`useAuth.tsx:62`) y
sus `role`/`plan_type` (`guidesService.ts:102`), y actualiza el suyo —los cuatro `UPDATE` del
cliente—. El terapeuta ve **5** perfiles (sus 4 pacientes y el propio) y **0** de un paciente que no
es suyo. El admin ve los 8. `anon` sigue en `42501` por ACL, antes de que RLS intervenga.
`service_role` lee los 8 por `bypassrls`.

### El `INSERT` de `profiles`, cerrado a propósito

Decisión aprobada. `authenticated` tenía `INSERT` de tabla y `profiles` no tiene política de
`INSERT`: al activar RLS queda denegado. Comprobado antes de proponerlo: **cero `INSERT` o `upsert`
sobre `profiles` en todo `src/`**. Los perfiles los crean `public-signup`, `stripe-webhook` y
`admin-create-user`, las tres con `SERVICE_ROLE`.

### El fallo silencioso de `patient_therapist`, evitado

Sus 3 políticas cubrían `SELECT` y `ALL` para admin, pero **ninguna cubría `UPDATE`** para las
partes. Y `patientTherapistService.ts:75` hace exactamente eso: es como una de las partes cierra la
relación terapéutica. Sin política, habría devuelto **0 filas sin error** — el mismo patrón mudo que
apareció en `clinical_alerts`.

```sql
CREATE POLICY "Parties close their own relationship"
  ON public.patient_therapist FOR UPDATE TO authenticated
  USING      (auth.uid() = patient_id OR auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_id);
```

Medido: una de las partes cierra su relación (**1 fila**); un tercero obtiene **0 filas** y ni
siquiera la alcanza. El trigger `enforce_patient_therapist_rules` sigue siendo quien impide cambiar
las partes; la política no lo duplica.

### El hueco de `therapy_sessions`, cerrado

Sus 6 políticas ya estaban completas y **no hizo falta ninguna nueva**. Lo que aporta activarlas es
cerrar un hueco medido: **un terapeuta podía crear una sesión de terapia para un paciente que no es
suyo** — ni la ACL ni ningún trigger lo impedían.

```
terapeuta INSERT sesión para SU paciente ...... OK   (sessionsService:106)
terapeuta INSERT con paciente AJENO ........... 42501   (antes: CREABA)
terapeuta UPDATE de esa sesión ................ 1 fila (sessionsService:119/127/170)
```

Su política de `DELETE` queda como letra muerta: la ACL no concede `DELETE` a `authenticated` desde
el sprint 4L. No se tocó.

### Las RPC no cambian

26 funciones tocan `profiles`, 15 `patient_therapist` y 5 `therapy_sessions`, todas `SECURITY
DEFINER` con owner `postgres` (`bypassrls`). Comprobado con RLS activo: `get_my_patients()` 4,
`list_my_patients_detail()` 4, `list_my_sessions()` 22 para el terapeuta y 6 para el paciente,
`get_my_therapist()` 1, `list_therapist_appointments()` 1, `admin_get_directory()` idéntica.
**RLS no protege esas rutas ni las rompe.**

### Verificación

Cinco huellas **idénticas**: ACL `64cdb69b…`, triggers `3d2e64ad…`, FK `b9087924…`, funciones
`6d9ef54e…`, índices `77e58883…`. Cambiaron solo las dos esperadas: estado RLS
(`db474297…` → `e13bb373…`) y políticas (`dd8bfdfc…` → `5fb975ed…`), **idénticas en las tres pasadas**
de la migración, todas con `201`. Datos intactos: 8 perfiles con huella `8ae9dbde…`, 4 relaciones,
21 sesiones. `appointments` sin tocar: RLS `false`, 0 políticas.

**Round-trip de reversión ejecutado de verdad:** aplicar el backup devuelve las huellas exactamente a
`db474297…` y `dd8bfdfc…`, con RLS en 12/37 y las políticas en 52. Después se reaplicó la corrección.

---

## Grupo 3B — RLS en `appointments` (12 de agosto de 2026)

**RLS pasa de 15 a 16 de 37.** Políticas 53 → 56. Cierra el Grupo 3.

### La pregunta que bloqueaba el sprint, respondida

`appointments` tiene **6 triggers** y el `INSERT` real **no envía `patient_id` ni `therapist_id`**, que
son `NOT NULL`: los deriva `enforce_appointment_rules` (BEFORE INSERT, `SECURITY DEFINER`) desde
`relationship_id`.

```
NEW.patient_id   := rel.patient_id;
NEW.therapist_id := rel.therapist_id;
NEW.created_by   := auth.uid();     -- se sobreescribe lo que mande el cliente
NEW.status       := coalesce(NEW.status, 'requested');
```

¿Llega el `WITH CHECK` de una política a ver esas columnas derivadas? **Sí.** Medido sobre la tabla
real dentro de una transacción revertida: el `INSERT` con `WITH CHECK (auth.uid() = patient_id …)`
pasa, y la fila resultante trae las tres columnas ya pobladas. **El `WITH CHECK` se evalúa después de
los triggers `BEFORE`.**

### Un hallazgo que decidió la tercera política

La política de `SELECT` **no abre ninguna lectura hoy**: `authenticated` solo tiene `SELECT` sobre la
columna `id`, así que leer columnas reales sigue dando `42501` **por ACL**, con política o sin ella.
La lectura va por `list_my_appointments()` y `list_therapist_appointments()`.

Pero un `INSERT ... RETURNING` sí la exige. Aislado:

```
INSERT SIN returning (lo que hace hoy el frontend) ... OK con 2 políticas
INSERT CON returning ................................ 42501 sin la de SELECT
INSERT CON returning + política de SELECT ........... OK
```

`appointmentService.ts:120` hace `.insert({...})` sin `.select()`, así que hoy bastarían dos. Entra
la tercera **como protección preventiva**: el día que alguien añada `.select()` para recuperar el id
de la cita creada —una línea, y lo natural—, el alta se rompería con `42501`.

### Los 20 casos, todos medidos

| | Resultado | Quién decide |
| :--- | :--- | :--- |
| paciente propio · INSERT sin/con `RETURNING` | **OK / OK** | política |
| paciente propio · UPDATE de su cita | **1 fila** | política |
| paciente propio · SELECT `id` | **2 citas** (las suyas) | RLS filtra |
| terapeuta asignado · INSERT y UPDATE | **OK / 1 fila** | política |
| terapeuta asignado · SELECT `id` | **4 citas** | RLS filtra |
| paciente A con `relationship_id` de B | `APPOINTMENT_FORBIDDEN` | trigger |
| tercero sin relación · INSERT | `APPOINTMENT_FORBIDDEN` | trigger |
| tercero · UPDATE de una cita ajena | **0 filas** | RLS |
| tercero · SELECT `id` | **0** | RLS |
| admin · INSERT / UPDATE / SELECT | `FORBIDDEN` / **0 filas** / **0** | trigger y RLS |
| `anon` · SELECT, INSERT, UPDATE | `42501` | ACL, antes que RLS |
| DELETE (paciente y `service_role`) | `42501` (ACL) y `APPOINTMENT_APPEND_ONLY` | ACL y trigger |
| `service_role` · SELECT | **4 citas** | `bypassrls` |

Sin políticas, el `UPDATE` devolvía **0 filas sin error** — el mismo fallo mudo de `clinical_alerts` y
`patient_therapist`.

### Lo que las políticas NO duplican

`enforce_appointment_rules` sigue siendo quien decide las transiciones de estado —el paciente solo
cancela o acepta una contraoferta; el terapeuta confirma, cancela, completa o marca `no_show`—, quien
impide mover la hora (`APPOINTMENT_IMMUTABLE`) y quien cierra lo terminado (`APPOINTMENT_CLOSED`).
Las políticas solo deciden **qué filas alcanza cada actor**.

### Verificación

Cinco huellas **idénticas**: ACL `64cdb69b…`, triggers `3d2e64ad…`, FK `b9087924…`, funciones
`6d9ef54e…`, índices `77e58883…`. Cambiaron solo las dos esperadas: estado RLS
(`e13bb373…` → `e799fcf8…`) y políticas (`5fb975ed…` → `6fc3bfef…`), idénticas en las tres pasadas.
La fila existente intacta (`dff2e6ec…`); `appointments` conserva sus 6 triggers y sus 6 índices, y su
ACL sin tocar. **Única tabla modificada.**

`available_hours()` devuelve **19 franjas idénticas con RLS activo y con RLS apagado**, mismo actor:
la RPC no se ve afectada. `list_my_appointments()` 2 y `list_therapist_appointments()` 4.

**Round-trip de reversión ejecutado de verdad:** el backup devuelve las huellas exactamente a
`e13bb373…` y `5fb975ed…`, con RLS en 15/37 y las políticas en 53. Después se reaplicó.

---

## Grupo 4 — las tablas públicas (13 de agosto de 2026)

**RLS pasa de 16 a 19 de 37.** Políticas 56 → 65. Entran `crm_leads`,
`public_test_submissions` y `blog_comments`. **`content_items` queda aplazada** — ver el final.

### Dos fugas cerradas, medidas antes y después

**`crm_leads` estaba abierta a cualquier usuario con sesión.** No a `anon` —la ACL ya le niega
`SELECT`— sino a cualquier paciente autenticado:

| Sonda de un paciente cualquiera | Antes | Después |
| :--- | :--- | :--- |
| `SELECT` de leads con nombre, correo y teléfono | **los leía** | **0 filas** |
| `UPDATE` de un lead | **modificaba 1** | **0 filas** |

**No hizo falta ninguna política nueva**: sus dos existentes —`Anyone can create a lead` para los
formularios y `Admins manage leads` para el panel— ya eran las correctas. Solo faltaba encender RLS.

**`blog_comments` exponía los comentarios no aprobados a visitantes sin sesión.** Con 1 aprobado y 1
pendiente, `anon` veía los 2; ahora ve 1.

### Las 9 políticas

**`public_test_submissions` (4).** Los tres flujos que había que conservar intactos:

```
anon INSERT .select("id")  (recordSubmission:171) ..... OK
anon UPDATE del correo     (attachEmail:202) .......... 1 fila
anon INSERT con email      (attachEmail:210) .......... OK
admin SELECT completo      (listTestSubmissions:235) .. 7 filas
```

`recordSubmission` usa `.select("id")`, es decir un `INSERT ... RETURNING`, **y eso exige política de
`SELECT`** — medido: `42501` sin ella, `OK` con ella. Es la misma lección del Grupo 3B.

> ⚠️ **`USING (true)` para `anon` en `SELECT` y `UPDATE` es paridad con el comportamiento actual, no
> una mejora de aislamiento.** La tabla no tiene ninguna columna de pertenencia con la que acotar a
> un visitante sin sesión, y no se inventó una que el modelo no soporta. Lo que sí acota el daño
> sigue en pie y se comprobó: la **ACL de columna** (`anon` solo lee `id`; pedir `email` o `score`
> da `42501`) y el **trigger `enforce_submission_append_only`** (no deja cambiar el resultado ni
> pisar un correo ya registrado).
>
> Lo que sí mejora: el `SELECT` completo —con `email`— queda reservado al admin. Un `authenticated`
> que no sea admin pasa de leer la tabla entera a **no ver nada**.

**`blog_comments` (5).** Cubren los seis consumidores de `blogCommentsService`. Lo aprobado sigue
siendo público, cada quien ve el suyo mientras espera revisión, y la moderación queda en el admin o
en el terapeuta autor del post.

Las dos de moderación hacen `EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = post_id AND
ci.author_id = auth.uid())`. **Es el mismo patrón que rompió 8 políticas en el Grupo 0** — una
política que consulta una tabla que el invocante no puede leer falla con `42501` en vez de filtrar—,
y por eso se comprobó ejecutando: sembrando un post de blog de un terapeuta, el autor ve su cola
(**1**), modera su conversación (**1 fila**) y en un post ajeno obtiene **0 filas**.

### Los 26 casos

```
A1  anon      aprobados del post ............. 1        listPostComments:78 sigue público
A2  anon      todos los comentarios .......... 1 de 2   ya no ve el pendiente (antes 2)
A3  anon      INSERT ......................... BLOG_COMMENT_ANONYMOUS_FORBIDDEN (trigger)
A4  admin     cola con el embed a content_items  1      listCommentQueue:136
A6  admin     UPDATE moderando ............... 1 fila   moderateComment:165
A7  paciente  INSERT su comentario ........... OK       submitComment:110
A8  paciente  sus propios no aprobados ....... 1        listPostComments:91
A9  paciente  INSERT con author_id ajeno ..... BLOG_COMMENT_AUTHOR_MISMATCH (trigger)
A10 paciente  UPDATE intentando moderar ...... 0 filas
A11 terapeuta cola de SU post ................ 1        el EXISTS funciona
A13 terapeuta UPDATE en un post AJENO ........ 0 filas
B5  anon      UPDATE cambiando el score ...... PUBLIC_SUBMISSION_APPEND_ONLY (trigger)
B6  anon      UPDATE pisando un correo ....... PUBLIC_SUBMISSION_APPEND_ONLY (trigger)
B8  paciente  SELECT (no admin) .............. 0
C1  anon      INSERT del formulario público .. OK       contactanos:64 · empresas:87
C3  admin     SELECT leads ................... 1        AdminDashboard:118
DELETE en las tres, incluso como admin ....... 42501 (ACL, sin privilegio `d`)
```

### Por qué `content_items` quedó fuera

Apareció una dependencia no contemplada en el plan del 4Q: **la vista `content_items_meta` es de
`postgres` y no tiene `security_invoker`**, así que se ejecuta con los privilegios de su propietario,
que tiene `bypassrls`. Medido:

```
anon, RLS ON en content_items, por la VISTA .... 26 filas
anon, RLS ON en content_items, por la TABLA .... 0 filas
```

Activar RLS ahí daría una **protección aparente**: cerraría el acceso directo y dejaría la vista
abierta, y esa vista expone `status`, así que el metadato de un borrador sería legible sin sesión.
Además, hacerlo sin diseñar a la vez las políticas de moderación **vacía la cola de comentarios**
—medido: 1 fila → 0—.

> 📌 **Criterio para el sprint específico de `content_items`**, que debe estudiar a la vez:
> RLS de `content_items` · `security_invoker` de `content_items_meta` · los consumidores públicos ·
> la moderación de `blog_comments` · la lógica de `min_plan`.

### Verificación

Seis huellas **idénticas**: ACL `64cdb69b…`, triggers `3d2e64ad…`, FK `b9087924…`, funciones
`6d9ef54e…`, índices `77e58883…` y **vistas** `0353a679…`. Cambiaron solo las dos esperadas: estado
RLS (`e799fcf8…` → `5da5bff4…`) y políticas (`6fc3bfef…` → `f3b436a3…`), idénticas en las tres
pasadas. Datos intactos. `content_items` sin tocar: RLS `false`, 0 políticas.

**Round-trip de reversión ejecutado de verdad:** el backup devuelve las huellas exactamente a
`e799fcf8…` y `6fc3bfef…`, con RLS en 16/37 y las políticas en 56. Después se reaplicó.

### Lo que un paciente conseguía antes del 4B, medido

```
A01 cambiar el titulo de contenido ajeno   : SI
A02 reescribir el body_md ajeno            : SI
A03 cambiar el slug ajeno                  : SI
A04 apropiarse de la autoria (author_id)   : SI
A06 falsear reviewed_by                    : SI
A07 despublicar TODO el sitio (status)     : 26 piezas
A09 liberar todo el contenido de pago      : 16 piezas
A10 cambiar la clave primaria (id)         : SI
```

Hoy, los ocho responden `CONTENT_NOT_AUTHOR`, `CONTENT_IMMUTABLE` o `permission denied`.

### H-TRIGGER-001 — el hallazgo que obligó a un sprint no planeado

La validación independiente del 4B encontró que el trigger, por sí solo, era evitable. `authenticated`
tenía el privilegio `TRIGGER` sobre `content_items`, y **los triggers `BEFORE` disparan en orden
alfabético**: un trigger llamado `zzz_bypass` corre *después* de `trg_content_authorization` y reescribe
`NEW` cuando la autorización ya lo aprobó. Medido, como paciente:

```
1) INSERT como borrador -> quedó en "publicado", min_plan=free, published_by=el ADMIN
```

Autopublicación en el sitio público con la firma del administrador falsificada.

**Lo que la validación NO demostró, y por tanto no se afirma:** que fuera alcanzable desde la aplicación.
`anon` y `authenticated` son **NOLOGIN**, PostgREST no ejecuta DDL y no hay ninguna función expuesta que
haga `EXECUTE` dinámico. Explotarlo exige una conexión directa a la base, que ya es un compromiso previo.
Se cerró igualmente: es la misma clase de recorte que el proyecto ya había aplicado a otras 6 tablas.

---

## Content Items — RLS y `security_invoker` (13 de agosto de 2026)

**Migración:** `20260813_content_items_rls.sql` · **Backup:** `backups/20260813_pre_content_items_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_content_items_2026-08-12.md`

**RLS pasa de 19 a 20 de 37 tablas.** Cinco políticas nuevas (3 SELECT, 1 INSERT, 1 UPDATE, **0 DELETE**),
total de `public`: 65 → 70. Es el sprint que el Grupo 4 dejó aplazado.

### La fuga que cierra, medida antes y después

Lo único que este sprint cierra de verdad es **lectura**, y es real:

```
                                     antes        después
anon   SELECT content_items ........  26 piezas    11  (10 free + 1 artefacto de prueba)
anon   ... de ellas premium ........   8 piezas     0
anon   body_md de las premium ......   8 cuerpos    0     <<< la fuga
paciente free  body_md premium .....   8 cuerpos    0
```

El muro de pago **no existía a nivel de datos**: lo aplicaba solo el frontend al construir la consulta.
Con la `anon key` —pública por diseño en una app de navegador— cualquiera leía íntegro el cuerpo de las
8 piezas de pago sin sesión y sin plan. Control de que filtra y no bloquea: `anon` sigue leyendo los
11 cuerpos `free`.

Alcance honesto del daño: es contenido editorial. **No había dato clínico ni personal expuesto.** El
perjuicio era comercial y de propiedad intelectual.

### Por qué las políticas y el `ALTER VIEW` tuvieron que ir juntos

`content_items_meta` pertenece a `postgres`, que tiene `bypassrls`, y **no tenía `security_invoker`**:
se ejecutaba con los permisos de su dueño y esquivaba RLS por completo. Medido en el diagnóstico:
con RLS activo y la vista intacta, `anon` leía **10 piezas por la tabla y 26 por la vista**. Eso es
protección aparente — cierra el canal que se audita y deja abierto el que no.

Es el primer sprint del plan de RLS que necesita tocar dos objetos en la misma migración, y la razón
está medida, no supuesta. Tras el `ALTER VIEW`, tabla y vista devuelven lo mismo a cada actor.

### La divergencia frontend/SQL que obligó a una rama extra

```
React getViewerPlan()   : si role IN (admin, therapist) -> "premium"
SQL   get_my_plan_rank(): solo plan_type, sin mirar el rol
  admin      fa4c4b96   plan_type = free  -> plan_rank 0
  therapist  104db81c   plan_type = free  -> plan_rank 0
```

Una política escrita solo sobre el plan habría dejado al equipo clínico viendo 10 piezas donde hoy ve
26: una **regresión funcional**, no un cierre de fuga. La política 1 lleva por eso una rama explícita
de rol clínico. **Es paridad con el comportamiento actual de React, no una decisión nueva de negocio:**
si algún día se decide que el equipo clínico no debe ver todo el catálogo, hay que cambiarlo en los dos
sitios a la vez. Verificado: el terapeuta lee los 8 cuerpos premium con `get_my_plan_rank() = 0`.

### Validación de los 17 consumidores

Los 13 de la tabla y los 4 de la vista, con seis actores (anon, paciente free, paciente premium,
terapeuta, admin, autor). Hizo falta sembrar dos artefactos —un borrador del terapeuta y un post
publicado de autoría terapéutica— porque **las 26 piezas reales son todas del admin y todas están
publicadas**: sin ellos no había forma de medir autoría ni borradores. Ambos revertidos.

```
anon      listBlogArticles:232 ........... 3   (2 reales + el artefacto)
anon      getContentBySlug:166 free ...... 1
anon      getContentBySlug:166 premium ... 0   no la sirve
terapeuta listMyContent:262 .............. 2   su borrador + su post
admin     listAllContent:367 ............ 28
admin     listReviewQueue:353 ............ 1   ve el borrador ajeno
admin     listCommentQueue:136 (JOIN) .... 2   el embed content_items!inner resuelve
paciente premium  body_md premium ........ 8   sí accede a lo que paga
paciente free     el borrador ajeno ...... 0

createContentDraft:324  INSERT+RETURNING .. OK
updateContentDraft:336 .................... 1 fila
submitForReview:343 ....................... 1 fila
requestContentChanges:396 ................. 1 fila
approveContent:379 ........................ 1 fila
publishContent:423 ........................ 1 fila
archiveContent:443 ........................ 1 fila
```

El `INSERT ... RETURNING` de `createContentDraft:324` **necesita la política de SELECT además de la de
INSERT**. Es la tercera vez que aparece la regla: `appointments` (3B), `public_test_submissions` (Grupo 4)
y aquí. Con RLS y solo políticas de `SELECT`, el `INSERT` daba `42501` y **los 6 `UPDATE` devolvían 0
filas en silencio**: aprobar, publicar, pedir cambios y archivar habrían dejado de funcionar sin avisar.

### Tres resultados que hubo que aislar antes de darlos por buenos

Aplicando la regla de no etiquetar cualquier denegación como mérito de RLS:

1. **El `0 filas` del `UPDATE` de un paciente sobre pieza ajena no lo produce RLS.** Con RLS apagado,
   la misma sentencia falla con `P0001 CONTENT_NOT_AUTHOR`: **ya lo cerraba el trigger**. Lo que RLS
   añade es una segunda capa y un cambio de modo de fallo (error → 0 filas silenciosas). No es honesto
   apuntárselo a este sprint.
2. **El `42501` del `DELETE` y de las escrituras de `anon` es de ACL, no de RLS.** El mensaje lo delata:
   `permission denied for table content_items` (ACL, RLS ni se consulta) frente a `new row violates
   row-level security policy` (RLS). `authenticated` no tiene `d` y `anon` no tiene `a` ni `w`.
   **No crear política de DELETE es coherencia, no la barrera real.**
3. **El `P0001 CONTENT_AUTHOR_ROLE` del paciente que intenta crear lo corta el trigger**, también con
   RLS apagado.

De ahí la conclusión que conviene conservar: **RLS y `enforce_content_authorization` son capas
distintas y ninguna sustituye a la otra.** El trigger decide *quién* puede crear y *qué escritura* es
válida; RLS decide *sobre qué fila*. El trigger no filtra lecturas —por eso existía la fuga— y RLS no
valida transiciones de estado —por eso la política de UPDATE lleva `WITH CHECK (true)`, para no crear
una segunda fuente de verdad que se desincronice—.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** de la migración, resultado idéntico: RLS `true`, 5 políticas, `de_delete = 0`,
`vista_reloptions = security_invoker=true`, 20/37.

Invariantes tras la validación: **26 filas** (ningún artefacto persistió), 8 premium, ACL de las 37
tablas en `c310d793…` **sin cambio**, 41 triggers, 273 funciones, 62 FK, 11 índices y 2 triggers en
`content_items`, definición de la vista intacta (15 columnas, sin `WHERE` — solo cambió una *reloption*).

**Round-trip ejecutado de verdad.** El backup devolvió el estado exacto: `relrowsecurity` false,
`relforcerowsecurity` false, **0 políticas** y `reloptions` de nuevo **`NULL`** —no `false`, que sería
un estado distinto; por eso el backup usa `RESET (security_invoker)` y no `SET … = false`—. Las cuatro
huellas del baseline coincidieron dígito a dígito: `b5ac7b23…`, `f927f651…`, `d8003754…`, `c310d793…`.
Después se reaplicó y la batería de lectura devolvió exactamente los mismos números.

### Artefacto de prueba documentado

El primer intento de sembrar el post publicado falló con `23514 content_items_published_needs_slug_check`.
Es una restricción legítima del esquema —una pieza publicada exige `slug`—, **no un fallo de RLS**. Se
añadió el `slug` y se repitió.

---

## Clinical Notes — RLS (13 de agosto de 2026)

**Migración:** `20260813_clinical_notes_rls.sql` · **Backup:** `backups/20260813_pre_clinical_notes_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_clinical_notes_consents_2026-08-13.md`

**RLS pasa de 20 a 21 de 37.** Cuatro políticas (2 SELECT, 1 INSERT, 1 UPDATE, **0 DELETE**);
total de `public`: 70 → 74. `clinical_consents` **no se tocó**: sigue en RLS `false` y 0 políticas,
con su propio sprint pendiente.

### Baseline confirmado antes de tocar nada

22 criterios comprobados uno a uno contra el catálogo —RLS, FORCE, políticas, filas, owner, ACL de
`authenticated` y `anon`, las dos partes, triggers, notas firmadas, trigger de inmutabilidad,
ausencia de trigger de autoría, funciones y vistas que la citan— más las **8 huellas**. Todos OK.

### Lo que cierra — dos cosas distintas

**1. Lectura.** Cualquier usuario con sesión leía las 24 notas de los 4 pacientes, con `soap_data` y
`treatment_plan` completos: la historia clínica entera.

```
                         antes    después
paciente PROPIETARIO ...  24        0     (0 jsonb clínico)
paciente AJENO .........  24        0
terapeuta AJENO ........  24        0
terapeuta ASIGNADO .....  24       24     sus 4 pacientes, sin cambio
ADMIN ..................  24       24     sin cambio
anon ...................  42501 permission denied — ACL, no RLS, antes y después
```

**2. Integridad — la falsificación de notas firmadas.** `clinical_notes` **no tiene trigger de
autoría** (`clinical_consents` sí). Antes, un paciente podía insertar una nota con `is_signed = true`
y `therapist_id` apuntando a su terapeuta: la medición del diagnóstico decía literalmente
*«NADA. Se crea.»*. Ahora:

```
paciente, nota FIRMADA a nombre de su terapeuta ... 42501 new row violates row-level security policy
terapeuta AJENO sobre paciente ajeno ............. 42501 new row violates row-level security policy
terapeuta con therapist_id AJENO ................. 42501 new row violates row-level security policy
terapeuta ASIGNADO, nota legítima ................ OK   (saveClinicalNote:68)
```

**Es la primera vez en todo el plan de RLS que una política cierra un agujero de integridad, no de
lectura.** En `content_items` la escritura ya la gobernaba un trigger; aquí no había nada.

### Decisión de producto aplicada: el paciente no lee `clinical_notes`

**No se creó política de SELECT para pacientes.** Ninguna pantalla se las muestra —los 7 consumidores
son de terapeuta/admin— y el acceso que existía era una capacidad no diseñada a un `jsonb` clínico
crudo. Si el producto quiere dar acceso a la historia, debe hacerse por una función o flujo explícito.

### Una contradicción entre el prompt del sprint y el diagnóstico, resuelta midiendo

El prompt pedía para el SELECT del terapeuta `auth.uid() = therapist_id AND is_therapist_of(patient_id)`;
el diagnóstico aprobado proponía solo `is_therapist_of(patient_id)`. No son equivalentes. Medido:

```
con los datos actuales (un solo terapeuta, autor de las 24) ... 24 = 24, no se distingue
con una nota del paciente escrita por OTRO autor:
  A (diagnóstico) getPatientDocuments:70 ... 7   expediente completo
  B (prompt)      getPatientDocuments:70 ... 6   la nota ajena desaparece, sin error
¿A deja pasar al terapeuta ajeno? ........... 0 filas — is_therapist_of ya lo excluye
```

**B no cerraba ninguna fuga adicional** y ocultaba al terapeuta parte del expediente de su propio
paciente, en silencio, porque `getPatientDocuments:70` filtra por `patient_id` y no por autor. Se
reportó antes de continuar y se confirmó la variante del diagnóstico.

El escenario **no pudo montarse con relaciones reales**: `idx_patient_therapist_una_activa` impide dos
relaciones activas por paciente, y `patient_therapist.therapist_id` referencia `therapist_profiles`,
no `profiles`. Se simuló con una nota de otro autor sobre el mismo paciente, revertida. **Demuestra el
mecanismo, no un caso presente en los datos.**

### `is_therapist_of()` — sin modificar, y por qué sirve tal cual

`SECURITY DEFINER = true`, consulta `patient_therapist`, y **no filtra por `status`**. Lo primero
evita el `42501` de la lección del Grupo 0; lo segundo hace que el terapeuta conserve el acceso a la
historia tras el alta. **No hay ninguna relación `finished` en los datos**, así que ese caso queda
cubierto **por la definición de la función, no por una medición**. No se concluye más que eso.

### UPDATE y DELETE — distinguiendo RLS, trigger y ACL

```
1) autor sobre nota propia SIN firmar .... 1 fila                    RLS deja pasar
5) autor sobre nota propia FIRMADA ....... P0001 INMUTABILIDAD_CLINICA  trigger, NO RLS
2) terapeuta AJENO sobre esa misma nota .. 0 filas                   RLS
3) PACIENTE sobre esa misma nota ......... 0 filas                   RLS
4) ADMIN sobre esa misma nota ............ 0 filas                   RLS: el admin lee, no edita
DELETE (paciente, terapeuta, admin) ...... 42501 permission denied   ACL
```

Los `0 filas` de 2, 3 y 4 quedan aislados por el 1: **la misma fila, sin firmar, sí acepta el UPDATE
del autor**, luego la diferencia la produce RLS y no el trigger de inmutabilidad. Y el `42501` del
DELETE es de **ACL** —`authenticated` no tiene `d`—: el trigger `BEFORE DELETE` existe pero **nunca
llega a ejecutarse**, la ACL corta antes. No crear política de DELETE es coherencia, no la barrera.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas**, resultado idéntico: RLS `true`, 4 políticas, `de_delete = 0`, 24 filas, 2 triggers,
`clinical_consents` intacta, 21/37.

Invariantes: **huella de datos `6abf5b4a…` sin cambio**, 24 filas, ACL `c9a0182c…`, FK `cfb70692…`,
índices `6da61f8c…`, triggers `3ca1288a…`, funciones `e5e288e7…`, vistas `61114ef9…`, `reloptions`
`(NULL)`, 1 solo perfil con rol `therapist` (el artefacto no persistió). Solo se movieron estado RLS
y políticas.

**Round-trip ejecutado de verdad.** El backup devolvió los 22 criterios y las 8 huellas exactamente al
baseline, dígito a dígito. Se reaplicó y las huellas volvieron a `64e08f70…` y `31c92dd8…`, con la
huella de datos intacta.

### Artefactos de prueba, declarados

- **Ascender temporalmente a `therapist` un paciente sin notas ni relaciones**, porque solo existe un
  terapeuta real y sin un segundo no hay forma de medir el actor «terapeuta ajeno». Revertido;
  comprobado que quedan 1 perfil `therapist`.
- **No se puede crear un perfil de prueba:** `profiles.id` referencia `auth.users` (`23503`).
- Un intento de siembra falló con `22P02` por dejar `request.jwt.claims` vacío, que
  `enforce_profile_ownership` parsea como JSON. Mismo artefacto que en el Grupo 3A.

---

## Clinical Consents — RLS (13 de agosto de 2026)

**Migración:** `20260813_clinical_consents_rls.sql` · **Backup:** `backups/20260813_pre_clinical_consents_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_clinical_notes_consents_2026-08-13.md`

**RLS pasa de 21 a 22 de 37.** Cinco políticas (3 SELECT, 1 INSERT, 1 UPDATE, **0 DELETE**);
total de `public`: 74 → 79. Cierra el Sprint B del diagnóstico conjunto.

Baseline confirmado antes de tocar nada: **29 criterios**, incluidas las 8 huellas globales, la
huella de datos de la propia tabla (`4a5d575f…`) y la de `clinical_notes` (`6abf5b4a…`), para
demostrar que el sprint anterior no se movía.

### Lo que cierra — y lo que NO, dicho con precisión

**Cierra lectura.** Medido antes y después:

```
                                antes    después
paciente propietario, todos ...   2         1     solo el suyo
paciente propietario ve el ajeno  1         0
paciente ajeno, el de otro ....   1         0
tercero sin relación, todos ...   2         0
terapeuta ajeno ...............   1         0
terapeuta asignado, su paciente   1         1     sin cambio
admin, todos ..................   2         2     sin cambio
anon ..........................   42501 permission denied — ACL, antes y después
service_role ..................   2         2     bypassrls, por diseño
```

La fuga era de **metadatos de salud**: revelaba qué personas están en proceso clínico y desde cuándo.
El registro no contiene contenido clínico, pero el hecho de estar en tratamiento sí es información
de salud. Volumen pequeño —2 filas—, naturaleza no trivial.

**No cierra la escritura, porque ya estaba cerrada.** Medido *sin* RLS, antes de migrar:

```
paciente ajeno revoca el de otro .. P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH   trigger
paciente ajeno consiente por otro . P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH   trigger
terapeuta asignado revoca ......... P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH   trigger
admin revoca ...................... 1 fila   (soporte, permitido a propósito)
```

`enforce_clinical_consent_authorship` ya expresaba la regla: *consentir es un acto personal e
indelegable*; el admin corrige pero no otorga. **Las políticas 4 y 5 son defensa en profundidad
deliberada**, para que la barrera no desaparezca si el trigger se modifica o se retira.

### Un cambio de capa que hubo que aislar antes de concluir

Tras activar RLS, dos denegaciones **cambiaron de mensaje**:

```
                              RLS ON      RLS OFF
paciente AJENO, UPDATE ...... 0 filas     P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH
terapeuta ASIGNADO, UPDATE .. 0 filas     P0001 CLINICAL_CONSENT_AUTHOR_MISMATCH
control: ADMIN sobre la misma fila ...... 1 fila  -> la fila existe y acepta UPDATE
control: paciente ajeno INSERT por otro . P0001   -> el trigger sigue vivo y disparando
```

**RLS evalúa antes que el trigger**, así que la fila ni siquiera le llega y el error explícito se
convierte en 0 filas silenciosas. **No es una regresión de seguridad —la protección sigue— sino un
cambio de modo de fallo.** El control con el admin descarta que el 0 sea «ausencia de fila», y el
INSERT confirma que el trigger no se ha alterado.

**Impacto real en el frontend: ninguno.** `revokeClinicalConsent:138` llama antes a
`getCurrentConsent`, que ahora devuelve `null` para una fila ajena, así que el servicio lanza
*«No hay un consentimiento vigente que revocar»* y nunca llega al `UPDATE`. El usuario no ve el
0 filas mudo.

### DELETE — la barrera es la ACL, no RLS

```
paciente / terapeuta / admin ... 42501 permission denied for table clinical_consents
ACL authenticated DELETE = NO   ·   políticas DELETE = 0
```

`enforce_clinical_consent_no_delete` **sigue sin ejecutarse para `authenticated`**: la ACL corta
antes. Es la red de seguridad para `service_role` y `postgres`, no la barrera del cliente.

### Los 6 consumidores reales

**Ninguno usa `.select()`** —los tres de escritura solo desestructuran `{ error }`, así que aquí no
interviene la regla del `RETURNING`—, pero `acceptClinicalConsent` y `revokeClinicalConsent`
**leen antes** con `getCurrentConsent` para decidir si insertan o actualizan: dependen de la política
de SELECT aunque su escritura no la necesite.

```
1) getCurrentConsent:59 (titular) ....... devuelve fila
2) acceptClinicalConsent:115 reactivar .. 1 fila
3) revokeClinicalConsent:138 ............ 1 fila
4) acceptClinicalConsent:123 alta ....... OK
5) getClinicalConsentState (titular) .... 1   gate de useAuth.tsx:124 y ClinicalConsentCard
6) getClinicalConsentStateById (terap.) . 1   pacientes.$patientId:109 — lectura cruzada OK
6b) el mismo, siendo admin .............. 1
```

El 6 es el que impedía copiar el modelo de `clinical_notes`: sin la política del terapeuta, la ficha
del paciente mostraría *«pendiente»* a alguien que sí consintió — un fallo silencioso y clínicamente
grave.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas**, resultado idéntico: RLS `true`, 5 políticas, `de_delete = 0`, `reloptions`
`(NULL)`, 2 filas, 3 triggers, `clinical_notes` con sus 4 políticas, 22/37.

Invariantes: huella de datos de `clinical_consents` `4a5d575f…` y de `clinical_notes` `6abf5b4a…`
**sin cambio**, ACL `c9a0182c…`, FK `cfb70692…`, índices `6da61f8c…`, triggers `3ca1288a…`,
funciones `e5e288e7…`, vistas `61114ef9…`, 1 solo perfil `therapist`. Solo se movieron estado RLS
(`64e08f70…` → `486dbb58…`) y políticas (`31c92dd8…` → `0639bea2…`).

**Round-trip ejecutado de verdad.** El backup devolvió los 29 criterios al baseline dígito a dígito,
con `reloptions` de nuevo **`(NULL)`** y RLS en 21/37 con 74 políticas. Se reaplicó y las huellas y
la batería funcional completa dieron exactamente lo mismo.

### Discrepancias

- **Fallos reales introducidos por el sprint:** ninguno.
- **Defectos preexistentes:** ninguno nuevo. Se confirma el ya conocido: el DELETE lo cubre la ACL y
  el trigger `no_delete` es inalcanzable para `authenticated`.
- **Artefactos de prueba:** ascender temporalmente a `therapist` un paciente sin consentimiento ni
  relaciones, para poder medir el «terapeuta ajeno» —solo existe un terapeuta real—. Revertido;
  comprobado que queda 1 perfil `therapist`.
- **Defecto de mi propio script de validación**, no del sistema: dos etiquetas mostraban
  `<<< MODIFICA` cuando el conteo era `0 filas` (el `CASE` estaba mal escrito). Se detectó, se aisló
  con una prueba dedicada y el resultado correcto es el de la tabla de arriba. No se ocultó.
- **Resultados inconcluyentes:** ninguno tras el aislamiento.

---

## Psychometric Evaluations — RLS (13 de agosto de 2026)

**Migración:** `20260813_psychometric_evaluations_rls.sql` ·
**Backup:** `backups/20260813_pre_psychometric_evaluations_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_15_restantes_2026-08-13.md`

**RLS pasa de 22 a 23 de 37.** Políticas de `public`: 79 → 80. La tabla queda con **5**: se
conservan 3, **se corrige 1** y **se añade 1**. Sin UPDATE ni DELETE.

Baseline confirmado antes de tocar nada: **33 criterios**, las 8 huellas globales, la huella de datos
de la propia tabla (`49af9f24…`) y el estado de `messages`, `therapist_profiles` y `clinical_alerts`,
para demostrar que no se movían.

### La fuga que cierra

40 evaluaciones PHQ-9 y GAD-7 de 4 pacientes, con `total_score`, `severity_level` y `raw_answers`.
El PHQ-9 incluye el ítem 9, de ideación suicida.

```
                                 antes    después
tercero sin ninguna relación ...  40         0
  con raw_answers y severidad ..  40         0
paciente ajeno, las de otro ....  10         0
paciente propietario ...........  40        10   solo las suyas
terapeuta asignado .............  40        40   sus 4 pacientes, sin cambio
admin ..........................  40        40   sin cambio
anon ...........................  42501 permission denied — ACL, antes y después
service_role ...................  40        40   bypassrls, por diseño
```

### Lo específico de este sprint: la tabla tenía políticas y estaban rotas

`psychometric_evaluations` ya traía 4 políticas del Grupo 0. **Encender RLS sin más habría sido una
regresión clínica**, medido activándolo dentro de una transacción revertida:

```
therapist_id es NULL en las 40 filas; la política decía auth.uid() = therapist_id
  terapeuta asignado ....  0 filas   <<< perdía las 10 de su paciente
  admin .................  0 filas   <<< no existía política de admin
  paciente, las suyas ... 10 filas   esa sí funcionaba
```

La ficha del paciente habría mostrado el historial psicométrico **vacío y sin error**. Por eso la
corrección va en la misma migración: separarla habría abierto una ventana con la ficha rota.

- **Corregida:** la lectura del terapeuta pasa de `auth.uid() = therapist_id` a
  **`is_therapist_of(patient_id)`** — la relación, no la autoría. Es la misma corrección que en
  `clinical_notes`, aquí forzada por los datos. `is_therapist_of()` **no se modificó**.
- **Añadida:** `Admins read all evaluations`, paridad con `pacientes.$patientId`, que se guarda a
  `therapist|admin` en el frontend.
- **Conservadas sin tocar:** la lectura del paciente y las dos de alta. La de alta del terapeuta sí
  puede usar `auth.uid() = therapist_id`, porque **en el alta el terapeuta sí se pone a sí mismo**;
  el problema del NULL afecta a la lectura de las filas históricas.

> ⚠️ **Este es el primer backup del plan que tiene que RESTAURAR una política, no solo borrarla.**
> En los sprints anteriores la tabla no tenía ninguna. Aquí la migración modifica una existente, así
> que el backup transcribe su expresión original del catálogo. Sin ese paso, un rollback habría
> dejado la tabla en un estado que nunca existió.

### Escritura y consumidores

```
paciente, la SUYA + RETURNING ...... OK    CssrsModal:126 / PsychometricScaleModal:45
paciente, a nombre AJENO ........... 42501 violates row-level security policy
terapeuta ASIGNADO, a su paciente .. OK    CognitiveScreeningForm:52
terapeuta con therapist_id AJENO ... 42501 violates row-level security policy
terapeuta AJENO, a un pac ajeno .... 42501 violates row-level security policy
```

El `RETURNING` importa: los dos modales necesitan el `id` devuelto para escribir
`clinical_alerts.test_score_id`. Es la **cuarta** vez que aparece la regla del
`INSERT ... RETURNING` que exige política de SELECT, tras `appointments`,
`public_test_submissions` y `content_items`.

`UPDATE` y `DELETE`, distinguiendo la capa:

```
paciente / terapeuta / admin   UPDATE 0 filas   ·   DELETE 42501 permission denied
políticas UPDATE/DELETE = 0 · ACL DELETE = NO · ACL UPDATE = SÍ
```

**El `UPDATE` lo corta RLS** —la ACL sí lo concede, y ningún trigger lo vigilaba: es cierre real—.
**El `DELETE` lo corta la ACL**, no RLS.

### Dos resultados que hubo que aislar

**1. El trigger de límite de plan no disparó.** Parecía roto. Aislado:

```
última evaluación phq9/gad7 del paciente: 2026-06-22 · ahora: 2026-08-13
¿dentro de la ventana de 30 días? false   -> el trigger hizo lo correcto al dejar pasar
prueba forzada: 1ª inserción de hoy se crea · 2ª -> P0001 FREE_PLAN_EVALUATION_LIMIT
```

**Sigue vivo con RLS activo.** Era dato, no fallo.

**2. El JOIN con `clinical_alerts` daba 0.** Aislado: hay 2 alertas y **ninguna con `test_score_id`**;
el mismo JOIN como `postgres`, sin RLS, también da 0 → **ausencia de dato, no bloqueo**. Forzando
una alerta ligada a una evaluación, con ambas tablas bajo RLS:

```
terapeuta asignado ... 1   ·   admin ... 1   ·   tercero sin relaciones ... 0
```

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true`, 5 políticas, `de_update_delete = 0`,
`terapeuta_corregida = is_therapist_of(patient_id)`, 40 filas, 23/37.

Invariantes: huella de datos `49af9f24…` **sin cambio**, `reloptions` `(NULL)`, ACL `c9a0182c…`,
FK `cfb70692…`, índices `6da61f8c…`, triggers `3ca1288a…`, funciones `e5e288e7…`, vistas
`61114ef9…`, `messages` y `therapist_profiles` sin RLS, 1 perfil `therapist`.

**Round-trip ejecutado de verdad.** El backup devolvió los 33 criterios al baseline, **incluida la
política del terapeuta con su expresión original** y la huella de políticas en `0639bea2…`. Se
reaplicó y la batería completa dio exactamente lo mismo.

### Discrepancias

- **Fallos reales del sprint:** ninguno.
- **Defectos preexistentes:** la política del terapeuta escrita en el Grupo 0 estaba mal contra los
  datos reales. Se corrige aquí porque activarla habría causado la regresión; queda anotado que el
  defecto venía de antes.
- **Artefactos de prueba:** ascender temporalmente a `therapist` un paciente sin relaciones;
  sembrar una evaluación y una alerta para poder medir el JOIN. Todo revertido.
- **Errores míos de guion, no del sistema:** dos intentos de sembrar la alerta fallaron con `42703`
  por inventar columnas (`alert_type`, `severity_level`) que no existen en `clinical_alerts`; y un
  tercero falló porque la subconsulta del `set_config` corría ya como `authenticated`. Se corrigió y
  se repitió hasta obtener el resultado, que es el que se documenta.
- **Resultados inconcluyentes:** ninguno tras el aislamiento.

---

## Therapist Profiles — RLS (13 de agosto de 2026)

**Migración:** `20260813_therapist_profiles_rls.sql` ·
**Backup:** `backups/20260813_pre_therapist_profiles_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_therapist_profiles_2026-08-13.md`

**RLS pasa de 23 a 24 de 37.** Políticas de `public`: 80 → 83. Tres políticas: 1 SELECT, 1 INSERT,
1 UPDATE. **Sin DELETE. Sin FORCE.**

Baseline confirmado antes de tocar nada: **30 criterios**, las 6 huellas globales, la huella de datos
de la tabla (`5f6308f0…`) y el estado de `messages`, `psychometric_evaluations`, `clinical_notes`,
`clinical_consents` y `content_items`, para demostrar que no se movían.

### El único hueco que cierra

`enforce_therapist_profile_ownership` comprueba `NEW.profile_id = auth.uid()` **pero no el rol del
actor**. Medido con RLS apagado, así que no es atribuible a RLS:

```
paciente crea el SUYO ............ SE CREA (verified=false, active=true)   NINGUNA capa
paciente pone su license_number .. 1 fila                                  NINGUNA capa
```

Cualquier `authenticated` podía darse de alta como perfil profesional con el número de matrícula que
quisiera. Con RLS:

```
paciente crea el SUYO ............ 42501 new row violates row-level security policy
TERAPEUTA crea el SUYO ........... OK   el alta legítima no se rompe
```

**Alcance honesto, y corrige lo que yo mismo había escrito.** En
`Diagnostico_RLS_15_restantes_2026-08-13.md` afirmé que esa fila «entra en el directorio **y en el
matching**». **La segunda mitad era falsa:** `matchingService.ts:224` hace
`.filter((t) => t.verified)`, y `listTherapists()` tiene un único consumidor, ese mismo
`cargarPerfiles()`. La fila entra en el **resultado SQL** de `listTherapists()` —medido: 2 filas
donde había 1— pero **no alcanza al paciente por la aplicación**. No se afirma nada sobre el render:
no se midió.

### Lo que ya estaba cerrado y RLS no debe apuntarse

Con RLS apagado, el trigger ya cortaba: modificar el perfil ajeno, auto-verificarse, cambiar
`profile_id`, crear a nombre ajeno e insertar con `verified=true`. Y la ACL ya cortaba el `DELETE`.

**La lectura es pública por diseño de ACL** (`anon = r`): es un directorio profesional. La política 1
es **paridad, no barrera** — existe para que la tabla siga funcionando con RLS y porque el upsert la
necesita.

### El upsert, que es lo que obligó a una política de UPDATE

`updateTherapistProfile:115` hace `.upsert(…, { onConflict: "profile_id" }).select(CAMPOS)`, que en
PostgREST es `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. Demostrado por eliminación en el
diagnóstico:

```
solo INSERT ....... upsert 42501
+ UPDATE .......... upsert 42501
+ SELECT .......... upsert OK
```

`ON CONFLICT DO UPDATE` necesita **ver** la fila en conflicto. Es la quinta aparición de la regla del
`RETURNING` y la primera sobre un upsert. Con las tres políticas:

```
propietario, fila EXISTENTE ....... OK   conflicto resuelto por UPDATE
TERAPEUTA sin fila, alta inicial .. OK
actor AJENO sobre fila ajena ...... P0001 THERAPIST_PROFILE_FORBIDDEN
```

### Dos resultados aislados antes de concluir

**1. El `0 filas` del usuario ajeno en `UPDATE` es un cambio de capa, no un cierre.**

```
control: el admin sobre esa misma fila ... 1 fila -> la fila existe y acepta UPDATE
RLS ON .................................. 0 filas
RLS OFF ................................. P0001 THERAPIST_PROFILE_FORBIDDEN
```

La protección **ya existía** en el trigger; ahora RLS filtra primero y la fila ni le llega. No es un
agujero que RLS cierre.

**2. El `42501` del upsert del admin sobre fila ajena — límite medido del diseño aprobado.**

```
admin UPSERT sobre fila ajena ..... 42501 new row violates row-level security policy
admin UPDATE plano ................ 1 fila   OK
```

Es RLS, y concretamente el `WITH CHECK` de la política de INSERT: en un `ON CONFLICT DO UPDATE`
Postgres evalúa **primero** el `WITH CHECK` del INSERT, y el admin no es el titular ni es terapeuta.
**No rompe ningún consumidor:** `updateTherapistProfile:115` construye siempre
`{ ...input, profile_id: session.user.id }`, así que nadie hace upsert sobre fila ajena, y la vía del
admin para verificar es un `UPDATE` plano, que funciona. Se registra como **límite medido**, no como
fallo.

### La rama de admin

Aprobada explícitamente. Preserva una capacidad que el trigger ya concede —el admin es el único que
puede poner `verified`—; sin ella el admin pasaba a 0 filas. Queda dicho que **ninguna pantalla la
usa**: `adminService.ts` no toca `verified` y `AdminDashboard` no tiene UI de verificación. Se
preserva el backend, no una funcionalidad visible.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true`, FORCE `false`, `reloptions` `(NULL)`, 3 políticas
(1/1/1/0), 1 fila, 1 trigger, 24/37, 83 políticas.

Invariantes: huella de datos `5f6308f0…` **sin cambio**, ACL `c9a0182c…`, FK `cfb70692…`, índices
`6da61f8c…`, triggers `3ca1288a…`, funciones `e5e288e7…`, vistas `61114ef9…`, Realtime 0,
`messages` sin RLS, y las políticas de las otras cuatro tablas intactas.

**Round-trip ejecutado de verdad.** El backup devolvió los 30 criterios y las 8 huellas al baseline
dígito a dígito. Se reaplicó y la batería completa dio exactamente lo mismo.

### Discrepancias

- **FALLO REAL del sprint:** ninguno.
- **DEFECTO PREEXISTENTE:** `listTherapists()` filtra solo `active` pese a que el índice del
  directorio es `(active, verified)`; el filtro de `verified` vive en JS. **No se corrige aquí**
  —sería tocar frontend—. Queda registrado.
- **ARTEFACTO DE PRUEBA:** ascender temporalmente a `therapist` un paciente sin perfil, para medir el
  alta legítima de un terapeuta nuevo. Revertido; la tabla vuelve a 1 fila.
- **ERROR DE SCRIPT:** en el diagnóstico, la primera medición del directorio salió contaminada porque
  una prueba anterior había puesto `active=false` en la misma fila. Se repitió aislada.
- **RESULTADO INCONCLUYENTE:** ninguno tras el aislamiento.

### Pendientes que este sprint NO toca

1. **`messages`** sigue bloqueada: decisión de producto sobre el acceso del admin a los cuerpos de
   conversación terapéutica, y cuatro suscripciones Realtime `postgres_changes` cuya regresión no se
   puede verificar desde SQL.
2. **`license_number` sigue siendo público** para `anon`, por ACL. Si el producto decidiera que no
   debe serlo, se resuelve con GRANT por columna, no con RLS. Decisión futura.
3. **`listTherapists()` filtra solo `active`.** No se corrigió aquí.

---

## Clinical Guides — RLS + `security_invoker` (13 de agosto de 2026)

**Migración:** `20260813_clinical_guides_rls.sql` ·
**Backup:** `backups/20260813_pre_clinical_guides_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_clinical_guides_2026-08-13.md`

**RLS pasa de 24 a 25 de 37 — y las políticas se quedan en 83.** Es el único sprint del plan que
**no crea ni modifica ninguna política**: dos sentencias, nada más.

```sql
ALTER TABLE public.clinical_guides ENABLE ROW LEVEL SECURITY;
ALTER VIEW  public.clinical_guides_meta SET (security_invoker = true);
```

Baseline confirmado dos veces —antes del backup y antes de migrar—: **29 criterios**, las 6 huellas
globales y la huella de datos `676fd831…`.

### Lo que cierra

```
                              antes    después
anon, tabla ................   20        15
  ... con contenidoCompleto    20        15
  ... de las 5 de pago .....    5         0
paciente free ..............   20        15
paciente esencial ..........   20        20   sin cambio
terapeuta / admin ..........   20        20   sin cambio
service_role ...............   20        20   bypassrls, por diseño
```

Cualquiera, sin sesión, leía las 5 guías de pago con su `contenidoCompleto` entero —4.523 caracteres
de media—. El muro de pago lo aplicaba solo el filtro `.in("min_plan", allowedPlans(plan))` del
cliente.

### La política ya estaba escrita, y era correcta

`"Guides readable by plan level"`, del Grupo 0, rol `{public}`:

```sql
USING ( plan_rank(min_plan) = 0
        OR get_my_plan_rank() >= plan_rank(min_plan)
        OR get_my_role() = ANY (ARRAY['admin'::user_role,'therapist'::user_role]) )
```

Cubre los tres casos sin ayuda: guías gratuitas públicas, corte por plan, y **la rama de rol clínico
ya incluida** —la que en `content_items` hubo que añadir a mano para evitar la regresión—. Verificado
tras encender RLS: el terapeuta, con `get_my_plan_rank() = 0`, ve las 20.

**No hay divergencia React/SQL en esta tabla**, a diferencia de `content_items`: `getViewerPlan()`
devuelve `"premium"` para admin y terapeuta, y la política tiene la rama equivalente.

### La vista, otra vez

`clinical_guides_meta` es de `postgres` (bypassrls) y no tenía `security_invoker`. Medido en el
diagnóstico con RLS activo y la vista intacta —**Escenario A**—:

```
Escenario A:  tabla anon 15  ·  vista anon 20     protección aparente
Escenario B:  tabla anon 15  ·  vista anon 15     <- el estado actual
```

**El `security_invoker` es parte esencial del cierre, no un extra.** Confirmado tras la migración.

Matiz que la diferencia de `content_items`: esta vista **no proyecta las columnas de contenido**, así
que la fuga por ese canal habría sido de metadatos. Verificado que sigue ocultándolas: pedir
`contenidoCompleto`, `fundamentoClinico` o `ejercicioPractico` a la vista da `42703 column does not
exist`.

### Los 4 consumidores

```
1) listGuides:120  anon (portada y /guia) ..... 15   OK
2) getGuide:142    anon, guía FREE ............  1   OK: la sirve entera
2b) getGuide:142   anon, guía ESENCIAL ........  0   OK: no la sirve
3) recommendationsService:357  anon .......... 15   OK
4) contentService:210  alcanzabilidad ........  1   OK: la free sí, la esencial no
1b) listGuides:120  paciente esencial ........ 20   OK
2c) getGuide:142   esencial, guía de pago ....  1   OK: accede a lo que paga
2d) getGuide:142   paciente FREE, guía de pago  0   OK: no la obtiene
```

Ningún consumidor escribe: **no aplica la regla del `INSERT ... RETURNING`** que apareció en los
cinco sprints anteriores.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true`, FORCE `false`, **1 política con huella `1bf147c4…` sin
cambio**, `security_invoker=true`, definición de la vista `8d355b71…` sin cambio, 20 filas, 25/37,
83 políticas.

Invariantes: huella de datos `676fd831…`, ACL `c9a0182c…`, FK `cfb70692…`, índices `6da61f8c…`,
triggers `3ca1288a…`, funciones `e5e288e7…` y **la huella global de políticas `8757768b…` — sin
cambio, porque no se creó ninguna**. Las dos únicas diferencias autorizadas: el estado RLS y la
*reloption* de la vista.

**Round-trip ejecutado de verdad.** El backup devolvió los 29 criterios al baseline, con
`reloptions` de nuevo **`(NULL)`** —por eso usa `RESET (security_invoker)` y no `SET … = false`— y la
política intacta. Se reaplicó y la batería completa dio exactamente lo mismo.

### Discrepancias

- **FALLO REAL del sprint:** ninguno.
- **DEFECTO PREEXISTENTE:** `visible_en_plan_gratis` tiene **11 discrepancias** con `min_plan = 'free'`
  —columna vestigial, el propio código dice que «ya no participa del control de acceso»—, y
  `es_premium` es redundante (coincide con `min_plan <> 'free'` en las 20 filas). No se tocan.
- **DEFECTO PREEXISTENTE, hallazgo del diagnóstico:** `anon` conserva `REFERENCES` y `TRIGGER` sobre
  10 objetos y `authenticated` sobre las dos vistas — resto de `H-TRIGGER-001`, que el sprint 4N
  cerró solo para `authenticated` sobre tablas. **Modificar ACL estaba fuera de alcance.**
- **ARTEFACTO DE PRUEBA:** ninguno. La batería es de solo lectura; no se sembró ni una fila.
- **ERROR DE SCRIPT:** cuatro fallos míos, todos antes de tocar la base — alias `r` chocando con la
  variable del bloque (`55000`), `"contenidoCompleto"` sin comillas (`42703`), un `GROUP BY`
  incompleto (`42803`) y un `count(*) … ORDER BY` inválido (`42803`). Corregidos y repetidos.
- **RESULTADO INCONCLUYENTE:** ninguno.

---

## Messages — RLS (13 de agosto de 2026)

**Migración:** `20260813_messages_rls.sql` · **Backup:** `backups/20260813_pre_messages_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_messages_2026-08-13.md`

**RLS pasa de 25 a 26 de 37.** Políticas de `public`: 83 → 86. Tres políticas de participante:
1 SELECT, 1 INSERT, 1 UPDATE. **Sin DELETE.** Era la última tabla de riesgo alto sin RLS, y la que
llevaba dos sprints bloqueada.

Baseline confirmado: **26 criterios**, huella de datos `1f87312b…` y las 6 huellas globales.

### La fuga que cierra

```
                              antes    después
paciente de la conversación ..  4        4     legítimo
terapeuta de la conversación .  4        4     legítimo
paciente AJENO ...............  4        0     <<< FUGA CERRADA
tercero sin relaciones .......  4        0     <<< FUGA CERRADA
admin ........................  4        0     <<< decisión de producto
anon .........................  42501 permission denied — ACL, antes y después
service_role .................  4        4     bypassrls, por diseño
```

Cualquier usuario con sesión leía el texto íntegro de una conversación terapéutica ajena.

### La decisión de producto: el admin deja de leer

Aprobada con evidencia, no por analogía: **0 referencias a `messages` en `AdminDashboard.tsx` y en
`adminService.ts`**, y las 4 RPC vivas filtran por `auth.uid()`. No existía consumidor; la capacidad
era implícita. **No se creó política de admin.**

La diferencia con `clinical_notes` —donde el admin sí lee— es de fondo: una nota clínica es un
documento profesional *sobre* el paciente; una conversación es un intercambio *entre* dos personas.

### El modelo de participantes

`auth.uid() = patient_id OR auth.uid() = therapist_id`, en las tres políticas. **`sender_id` no
define quién puede leer**: en una conversación de dos, quien escribe y quien recibe ven lo mismo. El
esquema ya lo respaldaba con `CHECK messages_sender_is_participant`.

### Lo que ya estaba cerrado — no atribuirle mérito a RLS

Medido con RLS apagado: los tres intrusos recibían `MESSAGE_FORBIDDEN` en el INSERT y en el UPDATE,
el participante recibía `MESSAGE_IMMUTABLE` al editar el cuerpo, y el DELETE lo cortaba la **ACL**.
`enforce_message_insert` además **fuerza `NEW.sender_id := auth.uid()`**. **La escritura estaba
completamente cubierta; lo que faltaba era la lectura.**

Verificado con RLS activo: la suplantación sigue siendo imposible —el terapeuta intentando firmar
como el paciente produce una fila con `sender_id` = el terapeuta— y `MESSAGE_IMMUTABLE` sigue vivo.

### Realtime — el criterio que bloqueaba, resuelto leyendo el código

`realtime.apply_rls`, leído del catálogo:

```
if not is_rls_enabled or action = 'DELETE' then
    visible_role_sub_ids = ... || subscription_id;      -- todos reciben
else
    perform set_config('role', working_role, true),
            set_config('request.jwt.claims', claims::text, true);
    execute 'execute walrus_rls_stmt' into subscription_has_access;
    if subscription_has_access then ...                 -- solo si RLS le deja leer
```

Con RLS activo, Realtime **asume el rol y los claims del suscriptor** y prueba la fila contra las
políticas. **Sin política de SELECT, las 4 suscripciones `postgres_changes` se habrían quedado sin
eventos en silencio.** Con ella siguen funcionando, porque las 4 filtran por `patient_id` o
`therapist_id` — exactamente lo que la política deja ver.

Precedente en el propio proyecto: `clinical_alerts` está en la misma publicación, con RLS y 3
políticas de SELECT desde el 12-ago.

Las **2 publicaciones** de `messages` quedan intactas, verificado en los invariantes. El canal de
**Broadcast** (`broadcast_message_event` → `realtime.send` sobre `'user:'||uuid`) es independiente y
no se tocó.

> ⚠️ **PENDIENTE EXPLÍCITO: la prueba de navegador no se ejecutó.** Desde SQL se validó el
> *mecanismo*; **no** la entrega extremo a extremo por WebSocket. `realtime.subscription` tenía 0
> filas al medir —nadie conectado—, así que no hubo suscripción viva que observar. **No se afirma que
> el chat en vivo esté verificado.** Conviene abrir la app con dos sesiones y comprobar que el
> mensaje entrante aparece sin recargar.

### Los consumidores, con RLS activo

```
sendMessage:182 INSERT ................. OK
sendMessageByPair:72 INSERT+RETURNING .. OK, devuelve la fila; sender_id forzado a auth.uid()
markAsRead:217 UPDATE .................. 5 filas
markConversationAsReadByPair:92 ........ 4 filas
RPC list_relationship_messages ......... OK   ·   count_my_unread_messages ... OK
RPC list_pair_messages ................. OK   ·   list_my_conversations ...... 1 fila
RPC como tercero ....................... 0 filas — la RPC filtra por auth.uid()
```

Las 4 RPC son `SECURITY DEFINER` de `postgres` con `bypassrls`: **RLS ni las rompe ni las protege.**
Lo que las acota es su propio filtro por `auth.uid()`. Lo que RLS cierra es el acceso directo
`.from("messages")`, que es por donde estaba la fuga.

El `RETURNING` de `sendMessageByPair:72` **exige la política de SELECT** — sexta aparición de la
regla en el plan.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true`, FORCE `false`, `reloptions` `(NULL)`, 3 políticas
(1/1/1/0), 4 filas, 6 triggers, **2 publicaciones**, 26/37, 86 políticas.

Invariantes: huella de datos `1f87312b…`, ACL `c9a0182c…`, FK, índices, triggers `3ca1288a…`,
funciones `e5e288e7…`, vistas `b23db2e2…`, `realtime.messages` con su RLS intacta, y las tablas de
los sprints anteriores sin tocar.

**Round-trip ejecutado de verdad.** El backup devolvió los 26 criterios al baseline dígito a dígito.
Se reaplicó y la batería completa dio exactamente lo mismo.

### Discrepancias

- **FALLO REAL del sprint:** ninguno.
- **DEFECTO PREEXISTENTE:** ninguno nuevo.
- **CAMBIO DE CAPA, documentado:** los `0 filas` del `UPDATE` de ajenos, terceros y admin **antes
  daban `MESSAGE_FORBIDDEN`** (trigger); ahora RLS filtra primero y la fila no le llega. La
  protección existía ya; cambia el modo de fallo. Control: el participante actualizó 5 filas del
  mismo conjunto, así que las filas existían.
- **ARTEFACTOS DE PRUEBA:** mensajes de prueba y `read_at` puesto a NULL para poder ejercitar
  `markAsRead` —las 4 filas reales están todas leídas—. Todo revertido; la huella de datos vuelve a
  `1f87312b…`.
- **ERROR DE SCRIPT:** el baseline marcaba «4 funciones, esperado 6». La cifra 6 venía de una
  consulta mía anterior **sin filtro de esquema**: las dos extra eran `realtime.send` y
  `realtime.send_binary`, que mencionan `realtime.messages` —la tabla de Broadcast—, no
  `public.messages`. Corregido el valor esperado a 4.
- **INCONCLUYENTE:** la entrega Realtime extremo a extremo, por imposibilidad técnica desde SQL. Ver
  el aviso de arriba.

---

## Notifications — RLS (14 de agosto de 2026)

**Migración:** `20260814_notifications_rls.sql` ·
**Backup:** `backups/20260814_pre_notifications_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_notifications_2026-08-13.md`

**RLS pasa de 26 a 27 de 37.** Políticas de `public`: 86 → 88. Dos políticas de destinatario:
1 SELECT, 1 UPDATE. **Sin INSERT, sin DELETE.**

Baseline confirmado: **26 criterios**, huella de datos `a3b79398…` y las 6 huellas globales.

### Lo que cierra, dicho con precisión: era una fuga de METADATOS

Medido con RLS apagado, **leyendo columna a columna y nunca solo `count(*)`**:

```
actor          id      user_id  read_at   title    body
propietario    4 f     4 f      4 f       42501    42501
terapeuta      4 f     4 f      4 f       42501    42501
tercero        4 f     4 f      4 f       42501    42501
admin          4 f     4 f      4 f       42501    42501
anon           42501 permission denied — ACL, sin ningún grant
```

Cualquier usuario con sesión leía `id`, `user_id` y `read_at` de **todas** las filas: **quién fue
notificado, cuántas veces y si lo ha leído.** El conjunto de `user_id` con `MESSAGE_SENT` es, en la
práctica, la lista de personas con conversación terapéutica activa.

**`title` y `body` NUNCA estuvieron expuestos.** Los cierran los grants por columna, que este sprint
**no toca**. Después de RLS siguen dando `42501` para los cuatro actores: **RLS no concede acceso
adicional a ninguna columna.**

Con RLS activo: propietario 2, terapeuta 2 (las suyas), **tercero 0, admin 0**.

### La ACL por columna, que es lo que explica el `--w-`

`authenticated` tiene **UPDATE sobre las 10 columnas** pero **SELECT sobre solo 3**
(`id`, `user_id`, `read_at`), y **ni INSERT ni DELETE en ninguna**. `anon` no tiene absolutamente
nada. Esa asimetría parece peligrosa y no lo es: `enforce_notification_rules` la neutraliza.

*(Nota: el prompt de aplicación describía la ACL de tabla como `raw-`; el catálogo dice `--w-`, que
es lo que se confirmó y aplicó. Era una errata del enunciado, no una discrepancia del estado.)*

### Lo que ya estaba cerrado — no atribuirle mérito a RLS

Medido sin RLS:

```
INSERT (cualquier actor) ...... 42501 permission denied        ACL
DELETE (cualquier actor) ...... 42501 permission denied        ACL
UPDATE de title / user_id ..... P0001 NOTIFICATION_IMMUTABLE   trigger
UPDATE de una fila ajena ...... P0001 NOTIFICATION_FORBIDDEN   trigger
```

**La creación sigue siendo exclusivamente del sistema:** `push_notification` tiene `EXECUTE` **solo
para `service_role`** —medido: `anon=false`, `authenticated=false`— y la disparan **6 triggers** de
`appointments`, `journey_events`, `messages`, `patient_therapist` y `therapist_contact_requests` (×2).
No se tocó ninguno.

### Validación con RLS activo

```
markAsRead:58 (propietario) ....... 1 fila     OK
markAllAsRead:79 (propietario) .... 1 fila     OK
propietario sobre AJENA ........... 0 filas    RLS
terapeuta / admin sobre AJENA ..... 0 filas    RLS (antes: trigger)
anon UPDATE ....................... 42501      ACL
propietario cambia el TITLE ....... P0001 NOTIFICATION_IMMUTABLE — el trigger sigue vivo
INSERT / DELETE ................... 42501      ACL
```

**Las 2 RPC intactas:** `list_my_notifications` devuelve 2 al propietario —con `title` y `body`— y
**0 a un tercero**; `count_my_unread_notifications` igual. Son `SECURITY DEFINER` de `postgres` con
`bypassrls`: **RLS no sustituye sus reglas internas.** Lo que RLS protege es el acceso **directo** a
la tabla, que es justo por donde estaba la fuga y que ningún consumidor usa para leer.

**Ningún consumidor usa `RETURNING`**: es el primer sprint desde `clinical_guides` en que esa regla
no interviene.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true`, FORCE `false`, `reloptions` `(NULL)`, 2 políticas,
`de_insert_delete = 0`, 4 filas, 1 trigger, **13 grants de columna**, 0 publicaciones, 27/37.

Invariantes: huella de datos `a3b79398…`, **ACL literal de tabla y los 13 grants por columna
(3 SELECT + 10 UPDATE + 0 INSERT/DELETE)**, ACL global `c9a0182c…`, FK, índices, triggers,
funciones, vistas, Realtime en 0, y `messages`, `therapist_profiles` y `clinical_guides` sin tocar.

**Round-trip ejecutado de verdad.** El backup devolvió los 26 criterios y los grants por columna al
baseline dígito a dígito. Se reaplicó y la batería completa dio exactamente lo mismo.

### Discrepancias

- **FALLO REAL del sprint:** ninguno.
- **DEFECTO PREEXISTENTE:** ninguno nuevo.
- **CAMBIO DE CAPA, documentado:** los `0 filas` del `UPDATE` de terapeuta y admin sobre fila ajena
  **antes daban `NOTIFICATION_FORBIDDEN`** (trigger); ahora RLS filtra primero. La protección existía
  ya; cambia el modo de fallo. No es regresión.
- **ARTEFACTO DE PRUEBA:** los `UPDATE` de `read_at` de la batería, revertidos. Por eso
  `count_my_unread` sale 0 tras la Fase 8 en el mismo lote: es mi propia escritura, no un fallo.
- **ERROR DE SCRIPT:** en el diagnóstico, la primera medición de `count_my_unread_notifications` dio
  1 en vez de 2 por contaminación de mi propio `markAsRead`. Se repitió midiendo las RPC antes de
  escribir.
- **INCONCLUYENTE:** ninguno.

---

## Preferencias y Bloqueos — el cierre del plan (14 de agosto de 2026)

**Migración:** `20260814_preferences_timeblocks_rls.sql` ·
**Backup:** `backups/20260814_pre_preferences_timeblocks_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_preferences_timeblocks_2026-08-14.md`

**El último sprint del plan.** Dos tablas, **6 políticas**, **ningún REVOKE**. RLS pasa de 31 a
**33 de 37** y las políticas de 92 a **98**. Baseline reconfirmado con **47 criterios**.

### Este sprint no cierra ninguna fuga, y conviene decirlo

A diferencia de `content_items`, `clinical_notes`, `messages`, `journey_events`, `test_scores` o
`clinical_prescriptions`, **aquí no había nada abierto**. Medido antes:

```
user_preferences        ajeno INSERT/UPDATE ..... P0001 trigger USER_PREFERENCES_FORBIDDEN
                        DELETE .................. 42501 ACL
                        themes/goal/availability  42501 ACL de columna
therapist_time_blocks   ajeno DELETE ............ P0001 trigger BLOCK_FORBIDDEN
                        UPDATE .................. 42501 ACL
                        starts_at/reason ........ 42501 ACL de columna
                        anon .................... sin ningún privilegio
```

El trigger y la ACL ya cubrían todo. Lo único legible por un tercero era `profile_id` en una y
`id` + `therapist_id` en la otra: **identificadores opacos**, la misma exposición que se cerró en
`notifications` y en `therapist_contact_requests`.

**Lo que RLS sí aporta:** cierra esa lectura, deja el modelo de propiedad explícito y declarativo, y
hace que la protección no dependa de que un trigger siga existiendo. **No es una corrección urgente:
es el cierre ordenado del plan.**

**No hay ningún REVOKE**, y es deliberado: las dos ACL ya eran mínimas —`-aw-----` y `-a-d----`, sin
SELECT de tabla, y `anon` sin nada—. Es la diferencia con el sprint anterior, donde el REVOKE era la
corrección de fondo.

### Por qué las dos llevan política de SELECT, y no era opcional

En las dos hay un consumidor real que **rompería en silencio** sin ella, y por caminos distintos:

**1) `user_preferences`** — `preferencesService.ts:111` hace `UPDATE ... .select("profile_id")`, y
**la lógica del servicio depende de cuántas filas devuelve**: si vuelven 0, intenta un INSERT. Sin
política de SELECT el RETURNING quedaría vacío y el servicio insertaría contra su propia PK.

**2) `therapist_time_blocks`** — `timeBlocksService.ts:89` hace `.delete().eq("id", id)`. Postgres
necesita **leer** esa fila para resolver el `WHERE`, y con RLS esa lectura la gobiernan las políticas
de SELECT. Aislado en tres casos durante el diagnóstico:

```
RLS + SOLO política de DELETE ................. 0 borradas   <<< NO BORRA
RLS + política de DELETE + política de SELECT . 1 borrada
RLS + SOLO DELETE, y SIN cláusula WHERE ....... 1 borrada
```

El tercer caso lo confirma por contraste: sin `WHERE` no hace falta leer. Y el fallo sería
**invisible** — `deleteTimeBlock` solo comprueba `if (error) throw`: el terapeuta pulsaría
«eliminar», no vería error, y el bloqueo seguiría en su agenda.

> **Mi propuesta inicial era de 2 políticas para `therapist_time_blocks` y estaba mal.** Lo detecté
> porque etiqueté «PASA» un resultado que decía `0 borradas`. Esa contradicción es lo que obligó a
> aislar, y de ahí salió la tercera política.

### El caso crítico, demostrado

Cada actor con su fila **recién sembrada**, verificando antes de cada intento que la fila existe, de
quién es, y qué `sub` lleva el JWT:

```
actor        fila? dueño    JWT sub   resultado             capa
terapeuta    1     104db81c 104db81c  1 fila borrada        RLS deja pasar + trigger permite
paciente     1     104db81c 141e54fe  0 filas               RLS: no alcanza la fila
admin        1     104db81c fa4c4b96  0 filas               RLS: no alcanza la fila
anon         1     104db81c (sin sub) 42501                 ACL
```

**El DELETE del propietario afecta exactamente 1 fila.** Era la condición que el sprint exigía
demostrar.

### user_preferences, validada

```
SELECT   titular 1 fila · ajeno 0 · admin 0 · anon 42501 ACL
         themes/goal/availability: 42501 ACL de columna para todos, sin cambio
UPDATE   titular 1 fila por RETURNING · ajeno 0 · admin 0 · anon 42501 ACL
INSERT   propio PASA · profile_id ajeno P0001 trigger · admin P0001 trigger · anon 42501 ACL
DELETE   los cuatro actores: 42501 permission denied — ACL, sin política
```

Los `0` del ajeno y del admin **están aislados**: la fila existe —el titular la ve— y la ACL les
concede SELECT sobre `profile_id`. Luego el 0 es de RLS, no ausencia de fila ni ACL.

> **Corrección a una etiqueta mía durante la validación.** Escribí que el INSERT ajeno «cae por RLS»;
> el resultado medido es `P0001 USER_PREFERENCES_FORBIDDEN`. **Lo para el trigger, no RLS.** Hay una
> asimetría real que conviene retener: **en INSERT gana el trigger** —el `BEFORE` corre antes del
> `WITH CHECK`— **y en UPDATE gana RLS**, porque su `USING` decide qué filas son siquiera alcanzables
> antes de que ningún trigger de fila se dispare. **Cambio de capa solo en UPDATE.**

### El orden trigger → WITH CHECK, y la redundancia asumida

```
1. terapeuta crea el suyo ............... PASA    therapist_id = auth.uid()
2. terapeuta ENVÍA therapist_id ajeno ... PASA    therapist_id = el SUYO, derivado por el trigger
3. paciente inserta a nombre del terap. . SE CREA therapist_id = el SUYO, no el del terapeuta
4. anon ................................. 42501 ACL
```

**El `BEFORE` trigger deriva `therapist_id := auth.uid()` antes de que el `WITH CHECK` lo evalúe**,
así que la política siempre ve una fila que ya es del actor y la deja pasar. **La política de INSERT
es, hoy, redundante con el trigger** — aprobado así y documentado: deja el ownership explícito en RLS
y sobreviviría a un cambio del trigger, pero **no cierra nada que el trigger no cierre**. No se le
atribuye mérito que no tiene.

### El trigger, intacto

```
bloqueo en el PASADO ....... P0001 trigger BLOCK_IN_THE_PAST
bloqueo de 190 días ........ 23514 CHECK blocks_duracion_razonable
UPDATE del propio dueño .... 42501 ACL, no RLS
```

La rama de UPDATE del trigger **sigue siendo inalcanzable**: `authenticated` no tiene `w` en la ACL
(es `ad`). Es un control muerto desde antes, y no se le atribuye protección.

### RPC — RLS no las alcanza

```
actor        list_my_time_blocks  agenda_bloqueo_manual(terapeuta)  get_my_preferences
terapeuta    sus bloqueos         true                              0 (no tiene fila)
paciente     los suyos            true                              1
admin        0                    true                              0
```

Las tres son `SECURITY DEFINER` de `postgres`, que tiene `bypassrls`. **`agenda_bloqueo_manual` sigue
devolviendo `true` a un paciente sobre el bloqueo de un terapeuta**: es una lectura cruzada legítima,
la que necesita el sistema para saber que ese hueco no está libre al agendar.

### Regresión de los consumidores — SQL, no interfaz

```
preferencesService.ts:111  UPDATE+RETURNING (sin fila) . 0 filas  -> pasa al INSERT
preferencesService.ts:117  INSERT ....................... PASA
preferencesService.ts:111  UPDATE+RETURNING (con fila) .. 1 fila  -> NO inserta
preferencesService.ts:59   getMyPreferences [RPC] ....... 1 fila
timeBlocksService.ts:77    createTimeBlock .............. PASA
timeBlocksService.ts:51    listMyTimeBlocks [RPC] ....... devuelve los propios
timeBlocksService.ts:89    deleteTimeBlock .............. 1 fila borrada
```

**Esto valida el SQL.** `AgendaClinica`, `onboarding`, `MiCaminoSection` y `ContinuaDondeLoDejaste`
**no se han ejercitado en navegador**, y no se afirma que funcionen por haber pasado estas pruebas.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true` en ambas, FORCE `false`, `reloptions` `(NULL)`, 3 y 3
políticas con la **definición literal idéntica** —nombre, comando, rol y expresiones—, 0 filas en las
dos, 28 grants por columna, 2 triggers, **33/37 y 98 políticas**.

**46 invariantes** OK. Sin mover: las dos ACL literales, los 19 y 9 grants por columna, los 0 de
`anon`, propietarios, columnas, CHECK, triggers, FK, índices, vistas (0), Realtime (0), y
`patient_therapist`, `appointments`, `clinical_prescriptions` y `content_revisions` sin tocar.
Huellas de triggers, funciones, FK, índices y vistas idénticas.

**Round-trip ejecutado, y esta vez sin ningún matiz.** El backup devolvió los **47 criterios** al
baseline, y **la `relacl` de las dos tablas volvió idéntica dígito a dígito** — sin la reordenación
que apareció en `test_scores` y en `content_revisions`. La razón es simple y estaba anticipada en la
cabecera del backup: **aquel rollback tenía `GRANT`; este no toca la ACL en absoluto.** Reaplicado
después: los 46 invariantes y la batería completa, idénticos.

### Discrepancias

- **FALLO REAL:** ninguno.
- **DEFECTO PREEXISTENTE — H-TB-001:** **`service_role` no puede borrar de `therapist_time_blocks`.**
  La rama `IF rol = 'service_role' THEN RETURN NEW` del trigger va primero, y en un `BEFORE DELETE`
  `NEW` es `NULL`: devolver `NULL` **cancela la operación en silencio**. Medido: 2 filas antes,
  `ROW_COUNT=0` **sin error**, 2 filas después; el dueño autenticado sí borra, porque entra por la
  rama `RETURN OLD`. **Es de agosto, RLS no lo toca ni lo empeora, y queda fuera de alcance.**
- **CAMBIO DE CAPA:** solo en el **UPDATE** de `user_preferences` y en el **DELETE** de
  `therapist_time_blocks`: antes los paraba el trigger con `P0001`, ahora RLS filtra la fila antes y
  devuelve 0. En **INSERT no hay cambio de capa**: sigue ganando el trigger.
- **ARTEFACTOS DE PRUEBA:** filas sembradas en las dos tablas, todas en transacciones revertidas.
  Ambas vuelven a 0. **Y un artefacto de mis propios guiones:** mis limpiezas `DELETE FROM
  therapist_time_blocks` como `service_role` eran no-ops por H-TB-001, y por eso algunos conteos
  intermedios subían. Detectado, aislado y explicado; no afecta a ninguna conclusión.
- **ERRORES DE SCRIPT — tres:**
  1. Etiqueté «PASA» un `0 borradas` en la simulación del diagnóstico. Fue lo que destapó la falta de
     la política de SELECT.
  2. Etiqueté «caen por RLS» un `P0001` de trigger en la Fase 7. Corregido arriba.
  3. En los invariantes usé el hash ACL global **anterior al sprint de prescriptions/revisions**.
     Valor obsoleto mío, no estado: el real es `d3ca583b…`, el mismo que dejó aquel sprint. Las dos
     ACL literales por tabla, que son la prueba directa, salían OK desde el principio.
- **INCONCLUYENTE:** ninguno.

---

## Catálogo y Auditoría — REVOKE + RLS (14 de agosto de 2026)

**Migración:** `20260814_prescriptions_revisions.sql` ·
**Backup conjunto:** `backups/20260814_pre_prescriptions_revisions.sql`
**Diagnóstico previo:** `Diagnostico_RLS_prescriptions_revisions_2026-08-14.md`

**Dos tablas, un sprint, dos mecanismos distintos.** `clinical_prescriptions` y `content_revisions`
comparten diagnóstico y ACL —las dos eran `authenticated=arwm`— pero no comparten solución.

**RLS pasa de 29 a 31 de 37. Políticas: 92, sin cambio — se crearon 0.** Baseline reconfirmado con
**49 criterios**.

> **Corrección al plan aprobado.** El estado final esperado decía `políticas: 93`. **El real es 92**:
> este sprint no crea ninguna política, y la única de `clinical_prescriptions` ya estaba contada en
> las 92. Se avisó antes de aplicar.

### La tesis del sprint: aquí cierra el REVOKE, no RLS

En ninguna de las dos tablas el problema era la falta de row level security, sino que **la ACL
concede escritura a `authenticated` desde el día que se crearon** — 2024 en una, julio de 2026 en la
otra. Una política **filtra** los privilegios que ya existen; no los quita.

La prueba está en el SQLSTATE. Las **nueve** denegaciones de escritura sobre `clinical_prescriptions`
y las **ocho** de `content_revisions` dieron:

```
42501  permission denied for table …     ->  ACL  (REVOKE)
```

**Ninguna** dio `new row violates row-level security policy`. RLS se activó como segunda capa, y así
queda registrado.

### clinical_prescriptions — se cierra la escritura, se conserva la lectura

Medido **antes**, sobre una plantilla real y revirtiendo:

```
instrucción ACTUAL de "Activación Conductual Matutina":
  "Mañana, independientemente de cómo te sientas, levántate a las 8:00 AM…"
un PACIENTE la reescribe ......... 1 fila MODIFICADA
instrucción AHORA:
  "ZZ: deja de tomar tu medicacion y no vayas a la consulta."

ACL ......... authenticated tiene UPDATE sobre las 4 columnas   NO lo impide
RLS ......... apagado, y su única política es de SELECT         NO lo impide
trigger ..... no hay ninguno                                    NO lo impide
constraint .. 0 CHECK                                           NO lo impide
>>> NINGUNA CAPA
```

Ese texto es **lo que el paciente lee en su `PatientDashboard` como la indicación de su terapeuta**,
y afecta a todos los pacientes con esa plantilla asignada.

**Después:**

```
actor          UPDATE instruccion_paciente   INSERT           DELETE
paciente       42501  ACL (REVOKE)           42501  ACL       42501  ACL
terapeuta      42501  ACL (REVOKE)           42501  ACL       42501  ACL
admin          42501  ACL (REVOKE)           42501  ACL       42501  ACL

SELECT:  paciente 14 filas · terapeuta 14 · admin 14 · anon 42501 ACL (igual que el baseline)
```

**`REVOKE INSERT, UPDATE` — y nada más.** El `SELECT` se conserva porque lo necesitan
`getPrescriptionsCatalog()` y el embed del paciente; `DELETE` ya estaba cerrado por ACL desde antes,
y eso **no se le atribuye a este sprint**.

`authenticated` pasa de `raw----m` a **`r------m`**. `anon` no se toca. Los grants por columna caen
de 12 a **4** (los cuatro SELECT).

### El embed, ejecutado

```
paciente consulta sus prescripciones ...... 1 fila devuelta
título del embed .......................... "Activación Conductual Matutina"
instrucción del embed ..................... "Mañana, independientemente de cómo te sientas…"
¿denegación disfrazada de NULL? ........... NO: el título llega con valor real
```

**La política del Grupo 0 no se tocó, y era imprescindible.** Medido en el diagnóstico: con RLS
activo y sin ninguna política, el embed devuelve **0 filas y sin error** —el `LEFT JOIN` deja el
título en `NULL`—. El `PatientDashboard` habría dejado de mostrar la indicación en silencio.

### content_revisions — se cierra entera, y se conserva

```
actor          SELECT              INSERT              UPDATE              DELETE
anon           42501  ACL          42501  ACL          42501  ACL          42501  ACL
authenticated  42501  ACL          42501  ACL          42501  ACL          42501  ACL

service_role:  SELECT OK · INSERT PASA · DELETE OK      (acceso previo intacto)
```

`REVOKE ALL` a los dos roles: `authenticated` de `raw----m` a `--------`, `anon` de `-------m` a
`--------`. Los 21 grants por columna a **0**. RLS activo con **0 políticas**.

**Precisión, para no atribuir de más:** de `anon` solo cambió el bit `MAINTAIN` — SELECT, INSERT,
UPDATE y DELETE **ya estaban denegados** antes. Y el DELETE de `authenticated` también. Lo que este
sprint cierra de verdad es el **SELECT, INSERT y UPDATE de `authenticated`**, que era por donde
cualquiera podía **fabricar una entrada de auditoría a nombre de otro y después reescribirla**.

**La tabla se conserva, por decisión explícita.** A diferencia de `guides` y `test_scores`, tiene una
promesa de producto escrita en la migración que la creó —*«para que el autor pueda ver qué se le
cambió»*— y un modelo de RLS ya redactado en comentario. **Este sprint no implementa la auditoría ni
crea ninguna capacidad nueva:** deja la tabla cerrada y lista.

Reconfirmado después de aplicar: **0 consumidores ejecutables** en `src/`, las 4 Edge Functions,
`scripts/`, cron, RPC y funciones SQL. `enforce_content_authorization()` la cita **solo en un
comentario**; su trigger vive en `content_items`. `content_revisions` tiene 0 triggers.

> **Sobre su RLS, con franqueza:** revocado todo, RLS aquí **no tiene nada que filtrar**. Se activó
> por homogeneidad y para dejar el acceso explícitamente cerrado, no porque añada protección que el
> REVOKE no dé ya. Está aprobado sabiéndolo, igual que se dijo en `test_scores`.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: `cp_rls=true`, `cp_politicas=1` con la misma definición literal,
`cp_auth=r------m`, 14 filas, huella `61a83e35…`; `cr_rls=true`, `cr_politicas=0`, `cr_auth=----`,
`cr_anon=-`, 0 filas; `grants_columna=4`, `triggers=0`, `cp_fk_entrantes=1`, **31/37, 92 políticas**.

**44 invariantes** OK. Sin mover: la política del Grupo 0 —comprobada literal, campo a campo—, FORCE,
`reloptions`, propietarios, columnas, triggers (0 en ambas), FK —incluida la entrante desde
`patient_prescriptions`—, índices, el `anon` de `clinical_prescriptions`, `service_role` en `rawd`
en ambas, y `patient_prescriptions` (0 filas, 4 políticas), `content_items` (26 filas, 5 políticas)
y `test_scores` sin tocar. Huellas de políticas, triggers, funciones, FK, índices y vistas idénticas.

**Round-trip ejecutado, con un matiz que se repite y que ahora tiene contraste.** El backup restauró
**los privilegios exactamente** en las dos tablas —`raw----m` para `authenticated`, `-------m` para
`anon`, 12 y 21 grants por columna, RLS 29/37—. Pero la comparación literal de `relacl` dio dos
resultados distintos, y la diferencia es instructiva:

```
clinical_prescriptions — REVOKE PARCIAL (solo INSERT, UPDATE)
  baseline .. postgres=arwdDxtm, anon=m, authenticated=arwm, service_role=arwdDxtm
  ahora ..... postgres=arwdDxtm, anon=m, authenticated=arwm, service_role=arwdDxtm
  -> IDÉNTICA, dígito a dígito. Un REVOKE parcial MODIFICA la entrada EN SITIO.

content_revisions — REVOKE ALL (borra la entrada entera)
  baseline .. postgres=arwdDxtm, anon=m, authenticated=arwm, service_role=arwdDxtm
  ahora ..... postgres=arwdDxtm, service_role=arwdDxtm, authenticated=arwm, anon=m
  -> MISMAS CUATRO ENTRADAS, distinto orden. Ordenadas, md5 idéntico: 8b7aac97…
```

**`REVOKE ALL` borra la entrada del array y el `GRANT` la reañade al final; un `REVOKE` parcial la
deja donde estaba.** Es el mismo artefacto que apareció en `test_scores`, ahora con el contraste que
lo explica. No es un rollback incompleto: los 8 privilegios × 4 roles × 2 tablas volvieron a coincidir
uno a uno, y la huella ACL de las otras 35 tablas no se movió (`c7c1f946…`).

Reaplicado después: los 44 invariantes y la batería completa, idénticos.

### Discrepancias

- **FALLO REAL:** ninguno.
- **DEFECTO PREEXISTENTE:** ninguno nuevo.
- **CAMBIO DE CAPA:** ninguno. Todo lo que se cerró lo cerró el **REVOKE**, y lo que ya estaba
  cerrado por ACL —el `DELETE` en ambas, y SELECT/INSERT/UPDATE de `anon` en `content_revisions`—
  sigue igual y **no se le atribuye a este sprint**.
- **ARTEFACTOS DE PRUEBA:** 1 asignación sembrada en `patient_prescriptions` para poder ejecutar el
  embed, y filas de prueba en `content_revisions`. Todo en transacciones revertidas:
  `patient_prescriptions` vuelve a 0, `content_revisions` a 0, `clinical_prescriptions` a 14 con la
  misma huella.
- **ERROR DE SCRIPT:** uno. En el guion de invariantes predije el orden de la `relacl` de
  `clinical_prescriptions` como `postgres, anon, service_role, authenticated`, y el real conserva
  `postgres, anon, authenticated, service_role`. **Invención mía, no estado.** Corregido y
  reejecutado: 44 de 44.
- **INCONCLUYENTE:** ninguno.

---

## Test Scores — cierre reversible (14 de agosto de 2026)

**Migración:** `20260814_test_scores_revoke.sql` ·
**Backup:** `backups/20260814_pre_test_scores_revoke.sql`
**Diagnóstico previo:** `Diagnostico_test_scores_2026-08-14.md`

**Este sprint no activa RLS y no crea ninguna política.** RLS sigue en **29 de 37** y las políticas
en **92**. Una sola sentencia:

```sql
REVOKE ALL PRIVILEGES ON TABLE public.test_scores FROM anon, authenticated;
```

Baseline reconfirmado con **36 criterios** antes de tocar nada.

### Por qué REVOKE y no RLS

Lo que estaba abierto en `test_scores` no era la lectura —la tabla tiene 0 filas y no hay nada que
leer— sino la **escritura**. Medido sin sesión ninguna:

```
anon  INSERT patient_id ajeno, test_name='PHQ-9', item_9_score=3 ... SE CREA   ninguna capa
anon  INSERT sin paciente, item_9_score=999, total_score=-999 ...... SE CREA   ninguna capa (0 CHECK)
anon  UPDATE de todas las filas ..................................... MODIFICA  ninguna capa
anon  DELETE / TRUNCATE ............................................. 42501     ACL
```

Un visitante sin cuenta podía **fabricar un registro de ideación suicida a nombre de un paciente
real**. Y aquí RLS no era la herramienta: **una política filtra los privilegios que ya existen, no
los quita.** Revocados INSERT y UPDATE, a RLS no le quedaría nada que filtrar — sería una política
sobre privilegios inexistentes, y además convertiría en permanente una tabla que está pendiente de
eliminación. El REVOKE cierra de raíz lo que RLS solo taparía.

### Después

```
ACL literal ANTES:  postgres=arwdDxtm, anon=arwxtm, authenticated=arwm, service_role=arwdDxtm
ACL literal AHORA:  postgres=arwdDxtm, service_role=arwdDxtm

rol             SELECT INSERT UPDATE DELETE TRUNC  REFER  TRIGG  MAINT
anon            false  false  false  false  false  false  false  false
authenticated   false  false  false  false  false  false  false  false
service_role    SI     SI     SI     SI     SI     SI     SI     SI
postgres        SI     SI     SI     SI     SI     SI     SI     SI

grants por columna anon+authenticated:  42  ->  0     (eran 24 + 18)
```

`anon` y `authenticated` **desaparecen de la ACL**: no quedan con letras vacías, quedan sin entrada.
Funcionalmente, los dos roles dan `42501 permission denied for table test_scores` en SELECT, INSERT,
UPDATE, DELETE, TRUNCATE, TRIGGER y REINDEX. `service_role` conserva las cinco operaciones,
verificado una a una.

> **Nota de nomenclatura que corrige informes anteriores.** La ACL de `authenticated` era `arwm`, es
> decir **`raw----m`, con MAINTAIN**. La notación de siete letras que veníamos usando no mostraba ese
> bit. El estado nunca fue distinto; la notación era incompleta. `REVOKE ALL` lo quitó igualmente.

### Tres resultados que no di por buenos

**1) `REFERENCES`: no pude probarlo funcionalmente, y lo digo así.**
Primera prueba: `CREATE TEMP TABLE ... REFERENCES public.test_scores` → `42P16 constraints on
temporary tables may reference only temporary tables`. **Error de mi guion**: choca con una regla de
tablas temporales *antes* de evaluar el privilegio. Segunda prueba: crear una tabla real y ponerla a
nombre de `anon` → `42501 permission denied for schema public`, porque añadir una FK exige ser dueño
de la tabla que la lleva y `anon` no puede poseer ninguna. Conceder ese CREATE queda fuera de
alcance. **`REFERENCES` queda verificado solo por catálogo** — y de forma concluyente: `aclexplode`
sobre `relacl` devuelve únicamente `postgres` y `service_role`; `anon` y `authenticated` no aparecen,
luego no tienen ningún bit.

**2) `MAINTAIN`: `ANALYZE` "funcionó" y eso era engañoso.**
`ANALYZE public.test_scores` como `anon` no daba error pese a que `has_table_privilege` decía
`false`. Aislado: **`ANALYZE` sin privilegio no falla — salta la tabla con un WARNING.** Comprobado
midiendo `pg_stat_all_tables.last_analyze`, que **no cambió**. Repetido con `REINDEX TABLE`, que sí
lo comprueba: `42501 permission denied` para `anon` y para `authenticated`. **El éxito era del
comando, no del acceso.**

**3) El default ACL que apareció, y una corrección a mi primera lectura.**
Al medir aparecía «1 privilegio de DEFAULT» que podría reponer los grants. Inspeccionado
`pg_default_acl`: el default de **`postgres`** para tablas de `public` es
`postgres=arwdDxtm, service_role=arwdDxtm` — **no incluye `anon`**. El que sí lo incluye es el de
**`supabase_admin`**: `anon=arwdDxtm, authenticated=arwdDxtm`. Mi primera lectura —«toda tabla nueva
de `public` nacerá con esos grants»— **era demasiado amplia**: solo ocurre con las tablas que crea
`supabase_admin`, no con las que crean las migraciones, que corren como `postgres`. En cualquier
caso **no repone nada en `test_scores`**: los default privileges solo aplican a objetos creados
después, y la ACL sigue vacía tras las cuatro pasadas.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: `anon` y `authenticated` en `--------`, 0 grants por columna,
`service_role` y `postgres` en `rawdDxtm`, RLS `false`, 0 políticas, 0 filas, owner `postgres`,
0 triggers, 1 FK saliente, 29/37, 92 políticas.

**35 invariantes** OK. Sin tocar: RLS, políticas, propietario, las 6 columnas, los 4 defaults, la FK
a `profiles`, el índice, `pg_depend` (8, todas internas), los datos, y `clinical_alerts` (2 filas, FK
a `psychometric_evaluations`, ACL literal idéntica) y `psychometric_evaluations` (40 filas, 5
políticas). Huellas de RLS, políticas, triggers, funciones, FK, índices y vistas sin mover.

**Round-trip ejecutado, con un matiz que hay que decir.** El backup devolvió los privilegios
**exactamente**: `anon` a `raw--xtm`, `authenticated` a `raw----m`, los 24 y 18 grants por columna, y
la huella ACL de las otras 36 tablas idéntica. Pero **la comparación dígito a dígito de la cadena
`relacl` NO coincidió**, y no lo disimulo:

```
baseline .. postgres=arwdDxtm, anon=arwxtm, authenticated=arwm, service_role=arwdDxtm
tras rollback ... postgres=arwdDxtm, service_role=arwdDxtm, anon=arwxtm, authenticated=arwm
```

**Son las mismas cuatro entradas en distinto orden**: el REVOKE las quitó del array y el GRANT las
volvió a añadir al final. Ordenadas alfabéticamente, los dos md5 son `c57283fe71f0bb1062c2ec91e642b884`
— **idénticos**. Es un artefacto de almacenamiento de Postgres, no una diferencia de permisos, y
queda dicho para que nadie lo lea como un rollback incompleto.

Reaplicado después: resultados idénticos a la primera pasada.

### Lo que sigue pendiente, y por qué

- **El `DROP` de la tabla.** Sigue siendo la conclusión correcta —0 filas, 0 consumidores, 0
  dependencias externas, sustituida por `psychometric_evaluations`— pero sería **la primera operación
  irreversible del plan**, y PITR está desactivado con cero copias. Espera a que existan.
- **Cuando llegue, su backup tendrá que reconstruir el DDL completo desde el catálogo**, porque la
  tabla **no está en ninguna migración del repositorio**: no hay `CREATE TABLE`, ni `ALTER`, ni
  `COMMENT`. Se creó fuera del control de migraciones.
- **`clinical_alerts.test_score_id` no se toca.** Su FK apunta a `psychometric_evaluations(id)` desde
  el 1 de julio y sus 2 filas la tienen a `NULL`. **El renombrado a `evaluation_id` queda fuera de
  alcance**, por decisión explícita.

### Discrepancias

- **FALLO REAL:** ninguno.
- **DEFECTO PREEXISTENTE:** el default ACL de `supabase_admin` concede `arwdDxtm` a `anon` en las
  tablas nuevas de `public` que él cree. Documentado, no corregido.
- **ARTEFACTO DE PRUEBA:** filas sembradas para medir `service_role`, todas en transacciones
  revertidas. La tabla vuelve a 0.
- **ERRORES DE SCRIPT — tres, y ninguno se oculta:**
  1. La prueba de `REFERENCES` con tabla TEMP (`42P16`), inválida y no reemplazable.
  2. La etiqueta «ANALYZE EJECUTADO» como si fuera privilegio conservado; era el comando saltándose
     la tabla.
  3. En el guion de invariantes puse un hash esperado para «las otras 36 tablas» que **nunca había
     medido en el baseline**. Dio FALLO por invención mía, no por estado. Sustituido por el valor
     medido y por la prueba válida: que la huella ACL global vuelva a `c9a0182c…` tras el rollback.
- **INCONCLUYENTE:** `REFERENCES` a nivel funcional. Concluyente a nivel de catálogo.

---

## Journey Events — RLS (14 de agosto de 2026)

**Migración:** `20260814_journey_events_rls.sql` ·
**Backup:** `backups/20260814_pre_journey_events_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_journey_events_2026-08-14.md`

**RLS pasa de 28 a 29 de 37.** Políticas de `public`: 91 → 92. **Una sola política, de INSERT.**
Sin SELECT, sin UPDATE, sin DELETE. Baseline reconfirmado con **33 criterios** antes de tocar nada.

```sql
CREATE POLICY "Everyone records their own journey"
  ON public.journey_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
```

### Aquí no había nada que dejar de ver

Es el primer sprint del plan en el que **la lectura ya estaba cerrada del todo antes de empezar**.
Medido columna a columna, con RLS apagado:

```
    actor         id      user_id  event_name  page    metadata  session_id
    paciente A    42501   42501    42501       42501   42501     42501
    paciente B    42501   42501    42501       42501   42501     42501
    terapeuta     42501   42501    42501       42501   42501     42501
    admin         42501   42501    42501       42501   42501     42501
    anon          42501  permission denied for table journey_events
```

Ese `42501` es **de ACL** —`permission denied for table`—, no de RLS: `20260730g` revocó SELECT a
`anon` y a `authenticated` y nunca se lo devolvió nadie. **Esta migración no cambia una coma de eso**
y sigue dando `42501` por ACL después.

**El valor de esta política es de integridad, no de confidencialidad.** Es la segunda vez que ocurre
en el plan —la primera fue el INSERT de `clinical_notes`—, pero es la única en que es el motivo
entero.

### Lo que sí estaba abierto: escribir a nombre de otro

Medido antes:

```
paciente A escribe como paciente B ..... SE CREA
anon SIN SESIÓN escribe como terapeuta . SE CREA
anon retrodata created_at 400 días ..... SE CREA
```

Y **llegaba a otra tabla**. `notify_from_journey_event` [DEFINER] convierte un `NEXT_STEP_SHOWN` en
una fila de `notifications` usando `NEW.user_id` sin comprobarlo:

```
anon inserta NEXT_STEP_SHOWN a nombre del terapeuta -> INSERT aceptado
notifications de ese usuario:  antes 2  ->  después 3
"NEXT_STEP_SHOWN | Tienes un paso pendiente | Continúa por donde lo dejaste. | guia:ZZ-FALSO"
```

Un visitante **sin sesión** hacía aparecer una notificación real en la bandeja de un profesional, y
contaminaba su «siguiente paso» y sus marcas de progreso a través de las dos RPC.

### La política de julio no habría servido

`20260730g_journey_events.sql:139` dejó comentada una `journey_events_insert_todos ... WITH CHECK
(true)`. **Se midió en simulación revertida y no cierra nada**: `anon` sigue escribiendo como el
terapeuta. La diferencia entre `(true)` y `(user_id IS NULL OR auth.uid() = user_id)` es todo el
valor del sprint.

### Después: los 8 casos aprobados

```
#  actor         user_id enviado       resultado
1  anon          NULL                  PASA
2  anon          de un usuario real    DENEGADO  42501  RLS
3  paciente A    propio (=auth.uid)    PASA
4  paciente A    de otro usuario       DENEGADO  42501  RLS
5  terapeuta     propio (=auth.uid)    PASA
6  terapeuta     ajeno                 DENEGADO  42501  RLS
7  admin         propio (=auth.uid)    PASA
8  admin         ajeno                 DENEGADO  42501  RLS
```

Para `anon`, `auth.uid()` es NULL: la segunda rama nunca se cumple, así que solo puede escribir
eventos sin dueño. Que es exactamente lo que hace el consumidor legítimo.

### La telemetría anónima sigue entera

Es lo que había que demostrar, porque `trackEvent()` **se traga cualquier error en silencio**
(`journeyService.ts:295`): si RLS rompiera el INSERT, nadie se enteraría — solo dejarían de existir
eventos.

```
HOME_VIEW en / ....................... PASA
TEST_COMPLETED con score y band ...... PASA
SERVICES_VIEW con resource_id ........ PASA
BLOG_VIEW con utm_* .................. PASA
```

**Esto prueba el SQL, no la interfaz.** La UI no se ejercitó en este sprint y no se afirma que lo esté.

### El trigger sigue vivo — y el cambio de capa

```
1) EVENTO LEGÍTIMO: el titular inserta su NEXT_STEP_SHOWN ... INSERT PASA
   notifications: 2 -> 3   "NEXT_STEP_SHOWN | Tienes un paso pendiente | guia:zz-legitimo"
2) EVENTO FALSIFICADO: anon a nombre del terapeuta .......... 42501 RLS
   notifications: 3 -> 3   el trigger NO llega a ejecutarse
```

**Cambio de capa**, no regresión: RLS filtra antes de que el `AFTER INSERT` se evalúe. La
notificación legítima se sigue creando; la fabricada ya no existe porque el evento que la originaba
no llega a escribirse. **No se creó ninguna política sobre `notifications` ni se tocó el trigger.**

### Lo que sigue abierto, dicho sin disimular

- **`created_at` es retrodatable.** La política ata la **identidad**, no la fecha. Medido después de
  aplicarla: `anon` con `user_id` NULL y el paciente con su propio uid consiguen una fila fechada el
  **2025-07-10**; con `user_id` ajeno, `42501` por RLS. Es decir, **solo se puede retrodatar lo
  propio**. Límite conocido y aceptado de este sprint, no un fallo.
- **H-JE-001** — el trigger append-only es `FOR EACH ROW` y **TRUNCATE no dispara triggers de fila**.
  `service_role` conserva `D` y sigue vaciando la tabla. Medido antes y después: **sin cambio**. RLS
  no protege contra TRUNCATE. Fuera de alcance.
- **Retención y contenido clínico de `metadata`** — la purga a 24 meses sigue pendiente desde julio,
  y lo que retendría incluye 6 filas con `score` y `band` de PHQ-9/GAD-7. Fuera de alcance.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true`, FORCE `false`, `reloptions` `(NULL)`, 1 política INSERT, 0
de SELECT/UPDATE/DELETE, roles `anon,authenticated`, `WITH CHECK ((user_id IS NULL) OR (auth.uid() =
user_id))`, 58 filas, 2 triggers, 51 grants de columna, 6 índices, 29/37, 92 políticas.

**33 invariantes** OK: la huella de datos `b665413…` intacta, ACL literal y los 51 grants por
columna, los 4 CHECK, la FK saliente, 0 FK entrantes, 0 vistas, 0 Realtime, las huellas globales de
ACL/triggers/funciones/FK/índices/vistas, y `notifications` (4 filas, 2 políticas),
`patient_therapist` (4 políticas) y `clinical_guides` sin tocar.

**Round-trip ejecutado de verdad.** El backup devolvió los 33 criterios al baseline dígito a dígito
—RLS 28/37, 91 políticas, huella POL `85e46556…`— y la reaplicación reprodujo la batería completa
sin una sola diferencia.

### Discrepancias

- **FALLO REAL:** ninguno.
- **DEFECTO PREEXISTENTE:** H-JE-001 (TRUNCATE), ya documentado en el diagnóstico y sin cambio.
- **CAMBIO DE CAPA:** la notificación fabricada. Antes la creaba el trigger; ahora RLS para el
  INSERT antes de llegar a él.
- **ARTEFACTOS DE PRUEBA:** eventos sembrados con `anonymous_id='zz-val'` y notificaciones derivadas.
  Todo dentro de transacciones revertidas: la tabla vuelve a 58 filas con la misma huella, y
  `notifications` a 4.
- **ERROR DE SCRIPT:** ninguno en este sprint.
- **INCONCLUYENTE:** ninguno.

---

## Therapist Contact Requests — RLS (14 de agosto de 2026)

**Migración:** `20260814_therapist_contact_requests_rls.sql` ·
**Backup:** `backups/20260814_pre_therapist_contact_requests_rls.sql`
**Diagnóstico previo:** `Diagnostico_RLS_therapist_contact_requests_2026-08-14.md`

**RLS pasa de 27 a 28 de 37.** Políticas de `public`: 88 → 91. Tres políticas de participante:
1 SELECT, 1 INSERT, 1 UPDATE. **Sin DELETE.** La tabla queda en **0 filas permanentes**.

Baseline confirmado: **28 criterios**, incluidos los **15 grants por columna** y la **FK entrante
desde `patient_therapist`** —válida y documentada, no una discrepancia—.

> **Nota de nomenclatura.** El prompt de aplicación escribía `auth.uid() = therapist_id`; la columna
> real es **`therapist_profile_id`** (referencia a `therapist_profiles(profile_id)`). No existe
> `therapist_id` en esta tabla. Las políticas usan el nombre real, que es el del diagnóstico aprobado.

### Lo que cierra, dicho sin inflarlo

```
                 antes            después
p1 (solicitante) id: 5 filas      id: 2 filas   (las suyas)
terap. destino   id: 5 filas      id: 4 filas   (las recibidas)
p2               id: 5 filas      id: 1 fila
terap. ajeno     id: 5 filas      id: 1 fila    (la dirigida a él)
admin            id: 5 filas      id: 0 filas
patient_id / therapist_profile_id / status / message:  42501 antes y después
anon                              42501 permission denied — ACL, no RLS
```

Lo único que era legible por cualquiera era **`id`: un UUID opaco**, y con él el número de
solicitudes. Las otras cuatro columnas las cierra la **ACL por columna**, que no se tocó y que sigue
dando `42501` después de RLS.

**Es la aportación más pequeña de todo el plan de RLS, y así quedó dicho en el diagnóstico.** Se aplicó
por coherencia con las otras 27 tablas y como defensa en profundidad, no porque hubiera una fuga grave.

### Lo que ya estaba cerrado — el control más completo de la base

`enforce_contact_request_rules` [DEFINER]. Verificado **con RLS activo**, con el actor emparejado con
su solicitud:

```
INSERT  paciente crea la SUYA .............. OK, llega al trigger y pasa
        con patient_id AJENO ............... CONTACT_REQUEST_FORBIDDEN
        con status 'accepted' .............. CONTACT_REQUEST_INVALID_INITIAL_STATUS
        terapeuta / tercero / admin ........ CONTACT_REQUEST_FORBIDDEN
        anon ............................... 42501 — ACL

UPDATE  1) solicitante CANCELA la suya ..... 1 fila   RLS deja llegar, trigger permite
        2) solicitante se AUTO-ACEPTA ...... CONTACT_REQUEST_PATIENT_CAN_ONLY_CANCEL
        3) paciente AJENO cancela .......... 0 filas — RLS filtra
        4) terapeuta DESTINO acepta ........ 1 fila   + crea la relación
        5) terapeuta DESTINO rechaza ....... 1 fila
        6) terapeuta AJENO ................. 0 filas — RLS filtra
        7) terapeuta DESTINO cancela ....... CONTACT_REQUEST_THERAPIST_CAN_ONLY_RESOLVE
        8) ADMIN acepta .................... 0 filas — RLS filtra (antes: trigger)
        9) TERCERO acepta .................. 0 filas — RLS filtra

DELETE  paciente / terapeuta / admin ....... 42501 — ACL (sin 'd')
        service_role ....................... CONTACT_REQUEST_APPEND_ONLY — trigger
```

Los casos 2 y 7 son la prueba de que **el trigger sigue vivo**: RLS deja llegar a la fila y es el
trigger el que rechaza la transición. **Las políticas no duplican la máquina de estados.**

### Integración con `patient_therapist`

Al aceptar, `create_relationship_on_accept` [DEFINER] creó **1 fila** en `patient_therapist` dentro
de la misma transacción. `patient_therapist` **ya tiene RLS y 4 políticas, y no las rompe**: el
trigger es DEFINER, así que no le afecta. La FK entrante sigue intacta, verificado en invariantes.

### Las 3 RPC

```
p1        list_my_contact_requests ....... 2 filas   ·  get_contact_request(suya) .. 1
terapeuta list_received_contact_requests . 4 filas
tercero   list_my_contact_requests ....... 1 fila    ·  get_contact_request(ajena) . 0
admin     get_contact_request ............ 0
```

Las tres son `SECURITY DEFINER` de `postgres` con `bypassrls`: **RLS protege el acceso directo, no
sustituye la autorización interna de la RPC.** Ningún consumidor usa `.select()` ni `RETURNING`.

### Idempotencia, invariantes y round-trip

**Cuatro pasadas** idénticas: RLS `true`, FORCE `false`, `reloptions` `(NULL)`, 3 políticas
(1/1/1/0), 0 filas, 5 triggers, **15 grants de columna**, **1 FK entrante**, 28/37, 91 políticas.

Invariantes: la tabla **vuelve a 0 filas**, ACL literal y los 15 grants por columna, ACL global
`c9a0182c…`, FK `cfb70692…`, índices, triggers, funciones, vistas, Realtime 0, y
`patient_therapist` (4 filas, 4 políticas), `therapist_profiles` (1 fila) y `notifications` (4 filas)
sin tocar.

**Round-trip ejecutado de verdad.** El backup devolvió los 28 criterios al baseline dígito a dígito.
Se reaplicó y la batería completa dio exactamente lo mismo.

### Discrepancias

- **FALLO REAL del sprint:** ninguno.
- **DEFECTO PREEXISTENTE:** ninguno nuevo.
- **CAMBIO DE CAPA:** el `UPDATE` del admin y del tercero pasa de `CONTACT_REQUEST_FORBIDDEN`
  (trigger) a **0 filas** (RLS). La protección existía ya.
- **ARTEFACTOS DE PRUEBA:** la tabla está vacía, así que se sembraron 5 solicitudes; y como solo
  existe un terapeuta real, se ascendió temporalmente a `therapist` un paciente y se le creó un
  `therapist_profiles`. Todo revertido: la tabla vuelve a 0 filas, `therapist_profiles` a 1 y
  `profiles` a 1 terapeuta.
- **ERROR DE SCRIPT:** el valor esperado de `FK entrantes` en mi guion decía 0; el real es 1. Se
  corrigió a 1 tras confirmarlo, como el propio prompt indicaba.
- **INCONCLUYENTE:** ninguno.

---

## Estado actual del perímetro de contenido

Medido el 7 de agosto de 2026. Letras: `r`=SELECT `a`=INSERT `w`=UPDATE `d`=DELETE `D`=TRUNCATE.

```
content_items         anon[r----]  auth[ra---]  service_role[rawdD]
clinical_guides       anon[r----]  auth[r----]  service_role[rawdD]
clinical_guides_meta  anon[r----]  auth[r---D]  service_role[rawdD]
guides                anon[r----]  auth[r----]  service_role[rawdD]
cie11_directory       anon[r----]  auth[r----]  service_role[rawdD]
public_tests          anon[r----]  auth[r----]  service_role[rawdD]
content_items_meta    anon[r----]  auth[r---D]  service_role[rawdD]
```

El bit `D` de las dos vistas es **inerte**: `TRUNCATE` no aplica a vistas (`"is not a table"`).

**`content_items`** es el único con escritura, y acotada **por columna en las dos operaciones**: los
permisos de tabla `INSERT` y `UPDATE` están ambos retirados (`authenticated=rm`).

| | Concedidas | Cuáles |
| :--- | :--- | :--- |
| **`INSERT`** (alta) | **9 de 32** | `content_type · audio_kind · categoria · titulo · resumen_breve · tiempo_lectura · body_md · author_id · status` |
| **`UPDATE`** (edición) | **17 de 32** | las 7 del editor + `slug · min_plan · status · reviewed_by · reviewed_at · review_notes · published_by · published_at · meta_title · meta_description` |

Las 9 del alta son exactamente las que nombra `createContentDraft` (`contentService.ts:328`). Las 23
restantes se agrupan así: **automáticas** (`id`, `created_at`, `updated_at`, `admite_comentarios` — todas
`NOT NULL` con default, por eso omitirlas es seguro), **exclusivas del flujo editorial** (`slug`,
`min_plan`, `reviewed_*`, `review_notes`, `published_*`, `meta_*` — las fija la administración al revisar
o publicar) y **exclusivas de enriquecimiento** (`cover_image`, `en_resumen`, `faq`, `key_takeaway`,
`clinical_refs`, `audio_url`, `external_embed_url`, `program_steps`, `tags`, `theme_key` — hoy las
siembra `service_role`).

**El rol es lo único que la ACL no puede expresar.** Un `GRANT` distingue columnas, no personas: que un
paciente no cree contenido se comprueba dentro del trigger, con `role IN ('therapist','admin')`. Un
perfil sin rol reconocido también falla — cerrado por defecto.

### Las dos capas, y qué corta cada una

Sobre contenido ajeno, ningún ataque prospera. Lo interesante es **quién** lo detiene:

| Intento | Lo corta |
| :--- | :--- |
| apropiación (`author_id`), cambio de PK, `created_at`, `updated_at`, columnas no concedidas, vía la vista, borrar | **el privilegio de columna** (antes de ejecutar el trigger) |
| falsificar `reviewed_by`/`published_by`, despublicar, publicar, cambiar `slug`, liberar contenido de pago, editar `titulo`/`body_md` | **el trigger** (`CONTENT_NOT_AUTHOR`) |

### Máquina de estados real (36 transiciones × 5 actores)

- **`anon`** — las 36 rechazadas **por privilegio**. Ni siquiera llega al trigger.
- **paciente** — las 36 rechazadas por `CONTENT_NOT_AUTHOR`.
- **autor (terapeuta)** — solo `borrador→en_revision` y `cambios_solicitados→en_revision`, más la
  autoedición dentro de esos dos estados. El resto: `CONTENT_INVALID_TRANSITION` o `CONTENT_LOCKED`.
- **admin** y **`service_role`** — las 36 permitidas.

> **Desviación respecto al ADR editorial, deliberada y justificada por el código:** el ADR fijaba
> `aprobado → publicado` como única vía y `archivado` como estado terminal. **No se implementó así**,
> porque el panel ofrece "Publicar" desde tres sitios con estados distintos (`AdminDashboard:514`, `:568`
> y `:833`, este último incluso sobre piezas archivadas). Exigir el origen `aprobado` habría roto los
> tres. La ventana de edición (`borrador`/`cambios_solicitados`) aplica solo a quien **no** es admin,
> porque `AdminDashboard:564` ofrece "Editar" sin condición de estado.

---

## Riesgos residuales — medidos, no corregidos

### Dentro del módulo editorial

**El alta quedó cerrada en el sprint 4F** (7-ago). La auditoría 4E había demostrado que el `INSERT` era
permiso de tabla sin restricción de columna, y que la rama de alta del trigger solo validaba autoría,
estado inicial y trazabilidad. Medido entonces, como **paciente**:

```
paciente crea un borrador     LOGRADO — un PACIENTE crea contenido, no solo un terapeuta
fija min_plan en el INSERT    LOGRADO
columnas sin GRANT, al crear  LOGRADO — cover_image, tags, theme_key, admite_comentarios
falsear created_at al crear   LOGRADO — created_at=2001-01-01
elegir el id al crear         LOGRADO
reservar un slug libre        LOGRADO — bloquea por indice unico una URL futura
creacion masiva               LOGRADO — 500 piezas en UNA sola sentencia
```

Hoy, los siete están cerrados: el alta de un paciente responde **`CONTENT_AUTHOR_ROLE`** (rol, en el
trigger) y cada intento de fijar una columna administrativa responde **`permission denied`** (privilegio
de columna, antes de ejecutar el trigger). Ver la sección de simetría más abajo.

### H-TRIGGER-001 — cerrado en todo el esquema (sprint 4N)

El 4M lo llevó más lejos de lo documentado en 4B.1: sobre `profiles`, un paciente colgaba un trigger
`zzz_*` —que corre después del de autorización—, hacía un `UPDATE` legítimo de `full_name`, y su propio
trigger fijaba `NEW.role := 'admin'`. **El privilegio de columna no lo detiene**, porque PostgreSQL lo
comprueba contra las columnas nombradas en la sentencia, no contra las que asigna un trigger. Resultado
medido: `role FINAL: admin`. Atravesaba el endurecimiento por columna del sprint 3.

El 4N retiró `REFERENCES` y `TRIGGER` a `authenticated` en las 30 tablas que aún los tenían. Hoy
`CREATE TRIGGER` sobre `profiles` responde `42501 permission denied` y el rol no cambia. **Ninguna de
las 37 tablas concede ya esos privilegios a `authenticated`**; los 42 triggers y las 62 claves ajenas
siguen intactos: se retiró el privilegio de crearlos, no los objetos.

### Los *default privileges* — cerrado para tablas (sprint 4P)

El 4M descubrió que `public` concedía `arwdDxtm` a `anon` y `authenticated` sobre **toda tabla nueva**:
cada migración que creara una tabla deshacía en ella lo conseguido en 4I, 4J, 4L y 4N. El 4P lo cerró
para tablas. Comprobado creando una en una transacción revertida:

```
relacl de la tabla nueva: {postgres=arwdDxtm, service_role=arwdDxtm}
  anon          [--------]      SELECT -> denegado 42501
  authenticated [--------]      SELECT e INSERT -> denegado 42501
```

**Consecuencia para el método:** desde ahora, **toda migración que cree una tabla en `public` debe
incluir sus `GRANT` explícitos** para los consumidores legítimos. Si se olvidan, la aplicación falla con
`permission denied` — visible, nunca en silencio. Es la disciplina que ya seguían las 7 migraciones más
recientes que crean tablas; las 13 anteriores se apoyaban en el default.

> **Lo que sigue abierto aquí, a propósito:** los defaults de FUNCIONES y SECUENCIAS no se tocaron.
> El de funciones tiene consumidor real —273 de 274 funciones necesitan `EXECUTE` para que PostgREST
> invoque las RPC—; el de secuencias no tiene consumidor pero tampoco aporta seguridad. Y las tres
> entradas equivalentes de `supabase_admin` son inalcanzables: `postgres` no es superusuario ni miembro
> suyo. No hace falta: la entrada que se aplica es la del rol que crea el objeto, y todo lo de este
> proyecto lo crea `postgres`.

**Superficie que todavía depende exclusivamente del trigger:** las 17 columnas concedidas cuando el
objetivo es contenido de **otra persona**. La ACL no distingue filas; solo el trigger lo hace. Es
inherente al modelo: sin RLS, ninguna capa de privilegios puede expresar "solo tus filas".

**Ruido de catálogo: eliminado en el 4H.** `enforce_content_publish_is_admin` quedó huérfana desde el 4B
—se conservó para poder revertirlo— y se retiró el 7 de agosto tras demostrar que no la invocaba ningún
trigger, ninguna función, ningún cron ni ningún `pg_depend`, y que no era invocable directamente por
devolver `trigger`. Con ella desapareció de la base el código `CONTENT_PUBLISH_FORBIDDEN`, que ya no
podía emitirse desde el 4B.

### Fuera del módulo editorial — el perímetro que esta campaña NO tocó

Esto es lo más importante que debe leer quien retome el proyecto:

- **RLS está desactivado en las 37 tablas de `public`.** Ningún sprint lo activó; estuvo fuera de alcance
  por decisión explícita en todos.
- **`anon` escribe hoy en 5 tablas**, no en 15: el **sprint 4I** (7-ago) cerró once —
  `clinical_documents`, `clinical_prescriptions`, `clinical_recommendations`, `clinical_tasks`,
  `family_genograms`, `content_revisions`, `crm_leads`, `crm_notes`, `service_requests`,
  `telemetry_events`, `user_guide_progress`— retirándole `SELECT`, `INSERT`, `UPDATE`, `DELETE`,
  `TRUNCATE`, `REFERENCES` y `TRIGGER`, y devolviéndole únicamente `INSERT` sobre `crm_leads`, que es
  lo que necesitan los dos formularios públicos. El **sprint 4J** cerró después `DELETE` y `TRUNCATE`
  en `blog_comments`, `public_test_submissions` y `test_scores` — las tres que solo protegía un trigger
  `FOR EACH ROW`, y un trigger de fila no se dispara con `TRUNCATE`. **`anon` ya no puede destruir datos
  en ninguna tabla de `public`: 0 tablas con `DELETE` o `TRUNCATE`.** Conserva escritura acotada donde
  la aplicación la necesita: `blog_comments` (`SELECT/INSERT/UPDATE`, para el hilo del blog público),
  `public_test_submissions` (`INSERT/UPDATE`, para registrar un test y adjuntar el correo),
  `test_scores`, `journey_events` (`INSERT`) y `crm_leads` (`INSERT`).
- **`authenticated` puede `DELETE` en 1 tabla**, no en 15: el **sprint 4L** cerró las otras catorce. La que queda es `therapist_time_blocks`, donde el terapeuta elimina sus propios bloqueos de agenda (`deleteTimeBlock()`), y su trigger `trg_time_block_ownership` responde `BLOCK_FORBIDDEN` a quien no es el dueño.
- **El privilegio `TRIGGER`** sigue concedido en la mayoría del esquema (se retiró solo de
  `content_items` y de las 6 tablas que ya lo tenían recortado). Donde la protección dependa de un
  trigger `BEFORE`, H-TRIGGER-001 sigue siendo aplicable con las mismas condiciones de acceso.
- **PITR deshabilitado y cero copias de seguridad** (`pitr_enabled: false`, `backups: 0`). Condiciona
  todo lo demás: hoy un borrado accidental no tiene vuelta atrás.

### Documentados en su momento y todavía sin corregir

- Un paciente puede resolver alertas de crisis ajenas, reescribir anamnesis de terceros y fabricar
  evaluaciones severas.
- `clinical_notes`: las notas sin firmar son reescribibles entre pacientes.
- `franja_de()` evalúa en UTC — 5 horas de desfase para Colombia.
- El requisito del enlace de videollamada vive en React, no en PostgreSQL.
- `admin_assign_patient` quedó roto al añadirse `trg_patient_therapist_no_delete`.
- Realtime desconectado (requiere ticket de soporte de Supabase).
- La API key de Resend está comprometida y debe rotarla el responsable del producto.

---

## Qué quedaría pendiente antes de abandonar el módulo editorial

1. ~~Acotar el `INSERT`~~ — **hecho en el 4F**: 9 columnas y comprobación de rol.
2. ~~Decidir si `slug`, `min_plan` y los `meta_*` se fijan en el alta~~ — **decidido en el 4F**: no. Son
   exclusivos de la administración en las dos operaciones, así que el alta ya no los admite.
3. **Un límite de creación por usuario.** Sigue pendiente: un terapeuta legítimo puede crear borradores
   sin tope. Ya no es un problema de autorización —solo el equipo clínico crea— sino de abuso interno.
4. ~~Retirar `enforce_content_publish_is_admin`~~ — **hecho en el 4H**, junto con la rama muerta de
   `translateWriteError` que traducía su código de error.
5. **Repetir la matriz de actores con dos terapeutas.** Hoy solo hay uno en la base, así que lo
   verificado es la regla de *autoría*, no la de *rol entre pares*.
6. Habilitar PITR y copias de seguridad — precede a cualquier lanzamiento real.

---

## Nota sobre la independencia de esta auditoría

Las validaciones "independientes" (4B, 4E) las ejecutó el mismo agente que escribió las migraciones. Se
mitigó derivando cada conclusión de ejecutar contra la base y no de releer los archivos, pero **no
sustituye a una revisión por un tercero**. Conviene tenerlo presente antes de tratar este documento como
una certificación.
