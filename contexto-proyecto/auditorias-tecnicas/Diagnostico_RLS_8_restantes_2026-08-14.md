# Diagnóstico final — 8 tablas restantes RLS

**Fecha:** 14 de agosto de 2026 · **Alcance:** solo lectura. No se activó RLS, no se creó ninguna
política, no se tocó ACL, grants por columna, triggers, funciones, FK, índices, vistas, frontend,
RPC, Realtime, Broadcast ni datos. Toda escritura se hizo dentro de transacciones con `ROLLBACK`
forzado, y los **21 invariantes** volvieron a OK al terminar.

**Estado global al terminar:** RLS 29/37 · FORCE 0/37 · 92 políticas · huellas ACL/POL/triggers/
funciones/FK/índices/vistas idénticas al inicio.

> ⚠️ **La clasificación preliminar del diagnóstico anterior era demasiado benévola.** Dije que las 8
> restantes eran «catálogos o tablas vacías, ninguna en riesgo alto ni medio». **Eso no se sostiene
> tras medirlo.** Tres de las ocho tienen escritura abierta con consecuencia real, y una de ellas
> —`test_scores`— acepta que **un visitante sin sesión escriba un puntaje clínico a nombre de un
> paciente**. Lo corrijo aquí de forma explícita.

---

## 1. Inventario

```
tabla                        filas   cols  owner      FORCE  reloptions  pol  trg  FKout FKin  idx
cie11_directory              163     5     postgres   false  (NULL)      1    0    0     0     4
clinical_prescriptions       14      4     postgres   false  (NULL)      1    0    0     1     1
content_revisions            0       7     postgres   false  (NULL)      0    0    2     0     2
guides                       0       5     postgres   false  (NULL)      0    0    0     1     1
public_tests                 3       12    postgres   false  (NULL)      0    1    0     1     3
test_scores                  0       6     postgres   false  (NULL)      0    0    1     0     1
therapist_time_blocks        0       7     postgres   false  (NULL)      0    1    1     0     2
user_preferences             0       9     postgres   false  (NULL)      0    1    1     0     1
```

**ACL de tabla:**

```
tabla                        anon      auth      service_role
cie11_directory              r----xt   r------   rawdDxt
clinical_prescriptions       -------   raw----   rawdDxt
content_revisions            -------   raw----   rawdDxt
guides                       r----xt   r------   rawdDxt
public_tests                 r----xt   r------   rawdDxt
test_scores                  raw--xt   raw----   rawdDxt      <<<
therapist_time_blocks        -------   -a-d---   rawdDxt
user_preferences             -------   -aw----   rawdDxt
```

**Grants por columna** (el detalle que la ACL de tabla no muestra):

```
cie11_directory          15   anon SELECT x5 · anon REFERENCES x5 · authenticated SELECT x5
clinical_prescriptions   12   authenticated SELECT/INSERT/UPDATE x4 cada uno
content_revisions        21   authenticated SELECT/INSERT/UPDATE x7 cada uno
guides                   15   anon SELECT x5 · anon REFERENCES x5 · authenticated SELECT x5
public_tests             36   anon SELECT x12 · anon REFERENCES x12 · authenticated SELECT x12
test_scores              42   anon SELECT/INSERT/UPDATE/REFERENCES x6 · authenticated SELECT/INSERT/UPDATE x6
therapist_time_blocks     9   authenticated INSERT x7 · authenticated SELECT x2
user_preferences         19   authenticated INSERT x9 · UPDATE x9 · SELECT x1  (solo profile_id)
```

**Vistas dependientes: 0 en las ocho. Publicaciones Realtime/Broadcast: 0 en las ocho.**
Funciones de `public` que las citan: `content_revisions` 1, `therapist_time_blocks` 2,
`user_preferences` 3, el resto 0.

**Huellas de datos:** `cie11_directory` `4fc06bf3…` · `clinical_prescriptions` `61a83e35…` ·
`public_tests` `b7d50644…` · las otras cinco, **VACÍAS**.

**Dos políticas huérfanas** —existen con RLS apagado, así que hoy no filtran nada—:

```
cie11_directory         "Permitir lectura de cie11_directory a usuarios autenticados"
                        SELECT · TO authenticated · USING (true)
clinical_prescriptions  "Authenticated users read the prescription catalog"
                        SELECT · TO authenticated · USING (true)
```

---

## 2. Clasificación

| Tabla | Categoría | Por qué |
|---|---|---|
| `cie11_directory` | **A) catálogo público** | CIE-11 de la OMS: un estándar internacional publicado |
| `public_tests` | **A) catálogo público** | los 3 tests del hub `/tests`, públicos por diseño de producto |
| `clinical_prescriptions` | **B) catálogo clínico** | plantillas de tarea terapéutica; **no tiene ninguna columna de identidad** |
| `content_revisions` | **G) dato histórico** (vacía) | auditoría de ediciones de `content_items` |
| `guides` | **D) tabla vacía sin consumidor** | tabla muerta, sustituida por `clinical_guides` |
| `test_scores` | **B) catálogo clínico → NO: dato clínico** (vacía) | tiene `patient_id`, `total_score` e **`item_9_score`** |
| `therapist_time_blocks` | **F) dato operativo** (vacía) | bloqueos y vacaciones del profesional |
| `user_preferences` | **E) configuración por usuario** (vacía) | temas, objetivo, modalidad y disponibilidad del onboarding |

---

## 3. Consumidores

Grep exhaustivo sobre `src/`, `supabase/functions/` y `scripts/`. Solo se cuentan accesos SQL reales.

| Tabla | Archivo:línea | Operación | Actor | `.select()`/RETURNING | ¿público? |
|---|---|---|---|---|---|
| `cie11_directory` | `clinicalService.ts:92` `searchCie11` | SELECT `code, description` | terapeuta | — | **no** |
| | `clinicalService.ts:100` `getCie11Catalog` | SELECT `*` | terapeuta | — | **no** |
| `clinical_prescriptions` | `clinicalService.ts:200` `getPrescriptionsCatalog` | SELECT `*` | terapeuta | — | no |
| | `clinicalService.ts:224` (embed en `patient_prescriptions`) | SELECT 3 cols | **paciente** | — | no |
| `public_tests` | `publicTestsService.ts:61` `listPublicTests` | SELECT 9 cols, `activo=true` | **anon** | — | **SÍ** |
| | `publicTestsService.ts:75` `getPublicTest` | SELECT `*`, `activo=true` | **anon** | — | **SÍ** |
| `therapist_time_blocks` | `timeBlocksService.ts:77` `createTimeBlock` | INSERT | terapeuta | **no** | no |
| | `timeBlocksService.ts:89` `deleteTimeBlock` | DELETE | terapeuta | **no** | no |
| | `timeBlocksService.ts:51` `listMyTimeBlocks` | **RPC** `list_my_time_blocks` [DEFINER] | terapeuta | — | no |
| `user_preferences` | `preferencesService.ts:111` | UPDATE **+ `.select("profile_id")`** | usuario | **SÍ** | no |
| | `preferencesService.ts:117` | INSERT | usuario | no | no |
| | (`getMyPreferences`) | **RPC** `get_my_preferences` [DEFINER] | usuario | — | no |
| `content_revisions` | — | — | — | — | — |
| `guides` | — | — | — | — | — |
| `test_scores` | — | — | — | — | — |

**Tres tablas tienen CERO consumidores en todo el proyecto: `content_revisions`, `guides` y
`test_scores`.**

Rutas de interfaz: `cie11_directory` solo en `ClinicalDocumentModal` y `ClinicalReportModal`
(terapeuta); `clinical_prescriptions` en `TherapistDashboard` (catálogo) y **`PatientDashboard`**
(embed); `public_tests` en `routes/tests.index.tsx` y `routes/tests.$slug.tsx`, **ambos con
`loader`, sin sesión**; `user_preferences` en `onboarding`, `MiCaminoSection` y
`ContinuaDondeLoDejaste`; `therapist_time_blocks` en `AgendaClinica`.

**Ninguna dependencia de plan. Ninguna dependencia de relación paciente/terapeuta** en estas ocho.

---

## 4. Datos reales

**`cie11_directory` (163).** CIE-11 puro: `6C40 Trastornos por consumo de alcohol`,
`6A60 Trastorno bipolar tipo I`, `6B00 Trastorno de ansiedad generalizada`… 3 calificadores.
**Cero filas citan a una persona** (probado con un `~*` sobre `paciente|patient|@`). Es literatura
médica publicada, no datos de nadie.

**`clinical_prescriptions` (14).** Plantillas: *Activación Conductual Matutina*, *Caja de
Herramientas de Tolerancia*, *Defusión Cognitiva*, *Economía de Fichas (Crianza)*, *Experimento
Conductual*… Cada una con `objetivo_clinico` e `instruccion_paciente`. **Columnas de identidad
(`patient_id`/`therapist_id`/`user_id`): 0.** Lo que sí es del paciente vive en
`patient_prescriptions`, que ya tiene **RLS y 4 políticas**.

**`public_tests` (3).** `test-de-ansiedad` (GAD-7, 7 ítems, 4 bandas), `test-de-autoestima`
(Rosenberg, 10 ítems, 3 bandas), `test-de-depresion` (PHQ-9, 9 ítems, 5 bandas). Los tres activos.
El trigger `enforce_no_public_risk_instrument` rechaza cualquier instrumento de riesgo suicida
(`c-ssrs|columbia|cssrs|suicid`) — la salvaguarda del sprint de tests públicos, viva.

**Las cinco vacías, y si alguien va a escribirlas:**

- **`content_revisions`** — 0 accesos en `src/`. La cita `enforce_content_authorization()`, pero
  **solo en un comentario**: el trigger que usa esa función está en `content_items`, no aquí.
  **Nada escribe esta tabla hoy.**
- **`guides`** — 0 accesos. Su hija `user_guide_progress` tiene **0 filas** (con RLS y 1 política).
  El par está muerto: lo sustituyó `clinical_guides`, que ya tiene RLS.
- **`test_scores`** — 0 accesos. `clinical_alerts` tiene una columna `test_score_id` **pero no hay
  FK real hacia `test_scores`** (0 constraints entrantes), y sus 2 filas no la usan. Tabla huérfana.
- **`therapist_time_blocks`** — vacía porque nadie ha bloqueado agenda todavía, pero **el consumidor
  existe y funciona** (`AgendaClinica`). Se llenará.
- **`user_preferences`** — vacía porque nadie ha completado el onboarding, pero **el consumidor
  existe** en tres pantallas. Se llenará.

---

## 5. ACL y protección actual

### Lectura, columnas reales, RLS apagado

```
tabla                        anon        paciente    terapeuta   columnas leídas
cie11_directory              163 f       163 f       163 f       code, description, category
clinical_prescriptions       42501 ACL   14 f        14 f        titulo, objetivo_clinico, instruccion_paciente
content_revisions            42501 ACL   0 f         0 f         content_item_id, edited_by, previous_body, note
guides                       0 f         0 f         0 f         title, content_json, allowed_plans
public_tests                 3 f         3 f         3 f         slug, nombre, items, bandas
test_scores                  0 f         0 f         0 f         patient_id, test_name, item_9_score, total_score
therapist_time_blocks        42501 ACL   42501 ACL   42501 ACL   therapist_id, starts_at, kind, reason
user_preferences             42501 ACL   42501 ACL   42501 ACL   profile_id, themes, goal, availability
```

Los `0 f` de `guides` y `test_scores` **no son ambiguos**: la tabla está vacía y la ACL sí concede
SELECT. Se distingue del `42501 ACL`, que es denegación de permiso.

### Escritura

```
operación                                  actor       resultado                       capa
cie11_directory INSERT/UPDATE/DELETE       paciente    42501                           ACL
clinical_prescriptions INSERT              paciente    SE CREA                         NINGUNA  <<<
clinical_prescriptions UPDATE              paciente    15 MODIFICADAS                  NINGUNA  <<<
clinical_prescriptions DELETE              paciente    42501                           ACL
content_revisions INSERT (edited_by ajeno) paciente    SE CREA                         NINGUNA  <<<
content_revisions DELETE                   paciente    42501                           ACL
guides INSERT                              paciente    42501                           ACL
public_tests INSERT                        anon        42501                           ACL
public_tests UPDATE (bandas)               paciente    42501                           ACL
test_scores INSERT (patient_id ajeno)      anon        SE CREA                         NINGUNA  <<<
test_scores UPDATE                         anon        1 MODIFICADAS                   NINGUNA  <<<
test_scores DELETE                         anon        42501                           ACL
therapist_time_blocks INSERT ajeno         paciente    se crea PERO reescrita          trigger
therapist_time_blocks DELETE ajeno         paciente    P0001 BLOCK_FORBIDDEN           trigger
user_preferences INSERT ajeno              paciente    P0001 USER_PREFERENCES_FORBIDDEN trigger
user_preferences UPDATE ajeno (fila real)  paciente    P0001 USER_PREFERENCES_FORBIDDEN trigger
user_preferences INSERT/UPDATE propio      paciente    PASA                            —
user_preferences SELECT themes             paciente    42501                           ACL de columna
user_preferences UPDATE RETURNING profile_id paciente  1 fila                          —
user_preferences UPDATE RETURNING themes   paciente    42501                           ACL de columna
```

### Dos resultados que aislé antes de darlos por buenos

**1) `therapist_time_blocks`: mi primera etiqueta era incorrecta.** Escribí «bloquea la agenda de
otro» porque el INSERT se aceptaba. **Falso.** `enforce_time_block_ownership` [DEFINER] hace
`NEW.therapist_id := auth.uid()`: **deriva el dueño, no lo rechaza**. Medido — el paciente envía
`therapist_id=104db81c` y la fila guardada queda con `141e54fe`, el suyo. El terapeuta real termina
con **0 bloqueos**. Lo único que consigue un paciente es crearse bloqueos a sí mismo, que nadie lee.

**2) `user_preferences ... RETURNING`: mi consulta tenía un error de sintaxis.** Escribí
`SELECT ... FROM (UPDATE ... RETURNING ...)`, que Postgres rechaza con `42601`. **Era mi guion, no
la base.** Repetido con un CTE: `UPDATE ... RETURNING profile_id` devuelve **1 fila**, que es
exactamente lo que `preferencesService.ts:111` necesita; y `RETURNING themes` da `42501` por ACL de
columna. La ACL cierra la lectura **también dentro del RETURNING**.

---

## 6. Riesgo por tabla

| Tabla | Lectura | Fabricación | Modificación | Borrado | **Nivel** |
|---|---|---|---|---|---|
| `cie11_directory` | pública (CIE-11 de la OMS) | ACL | ACL | ACL | **BAJO** |
| `public_tests` | pública **por diseño** | ACL | ACL | ACL | **BAJO** |
| `guides` | vacía | ACL | ACL | ACL | **BAJO** |
| `therapist_time_blocks` | cerrada, ACL | trigger la reescribe | trigger | trigger | **BAJO** |
| `user_preferences` | cerrada, ACL + columna | trigger | trigger | sin ACL | **BAJO** |
| `content_revisions` | cerrada a `anon`, abierta a cualquier autenticado | **abierta** | **abierta** | ACL | **MEDIO** |
| `clinical_prescriptions` | catálogo, sin identidad | **abierta** | **abierta** | ACL | **MEDIO** |
| `test_scores` | vacía, pero abierta a `anon` | **abierta a `anon`** | **abierta a `anon`** | ACL | **ALTO** |

### Justificación de los tres que no son BAJO

**`test_scores` — ALTO.** Es la ACL más permisiva de toda la base: `anon=arwxtm`. Medido, **sin
ninguna sesión**:

```
INSERT (patient_id de un terapeuta real, 'PHQ-9', item_9_score=3, total_score=27) .. SE CREA
UPDATE de todas las filas .......................................................... 1 MODIFICADA
```

`item_9_score` es **el ítem 9 del PHQ-9: ideación suicida**. El esquema de esta tabla dice que su
contenido es un puntaje clínico atribuido a una persona. Que hoy tenga 0 filas y 0 consumidores
**reduce el impacto actual a cero, pero no reduce el riesgo**: cualquiera puede empezar a llenarla
desde fuera, y si algún día alguien la lee —el nombre `clinical_alerts.test_score_id` sugiere que
esa era la intención— estaría leyendo datos fabricados. **No es un catálogo. Es una tabla clínica
que el diagnóstico anterior clasificó mal.**

**`clinical_prescriptions` — MEDIO.** Cualquier paciente autenticado puede **reescribir la
`instruccion_paciente` de las 14 plantillas**: 15 filas modificadas en la prueba. No es una fuga
—el contenido es un catálogo profesional sin identidad de nadie—, pero sí **manipulación de
contenido clínico que después se asigna a pacientes reales** vía `patient_prescriptions`. Un
paciente podría cambiar la instrucción que su terapeuta le prescribe a él y a los demás.

**`content_revisions` — MEDIO.** Cualquier paciente autenticado puede insertar una revisión con
`edited_by` = el uuid de un terapeuta. Es **falsificación de auditoría**: exactamente el mismo
patrón que se acaba de cerrar en `journey_events`. Hoy la tabla está vacía y nadie la lee, lo que
limita el impacto, pero una auditoría en la que cualquiera escribe a nombre de otro no sirve como
auditoría.

### Por qué los otros cinco sí son BAJO, sin adornos

- **`cie11_directory`**: la CIE-11 es un estándar de la OMS publicado. Que `anon` lea 163 códigos
  diagnósticos no revela nada de nadie: cero filas mencionan a una persona. La escritura está
  cerrada por ACL en las tres operaciones.
- **`public_tests`**: los 3 tests son **el producto público**. Si `anon` no pudiera leerlos, `/tests`
  dejaría de existir. La escritura está cerrada por ACL y el trigger de instrumentos de riesgo sigue
  activo.
- **`guides`**: 0 filas, 0 consumidores, hija con 0 filas. No hay nada que proteger.
- **`therapist_time_blocks`** y **`user_preferences`**: lectura cerrada por ACL —incluso por
  columna—, escritura gobernada por un trigger DEFINER que deriva o rechaza el dueño. **El control
  ya existe y está medido.**

---

## 7. Modelo de acceso

| Tabla | Lee | Escribe | Modifica | Borra | ¿RLS aporta? |
|---|---|---|---|---|---|
| `cie11_directory` | **todos** (es pública) | solo `service_role` | ídem | ídem | **No.** La ACL ya lo dice todo |
| `public_tests` | **todos** (es pública) | solo `service_role` | ídem | ídem | **No** |
| `guides` | nadie (vacía) | nadie | nadie | nadie | **No.** Nada que proteger |
| `clinical_prescriptions` | autenticados | **solo `service_role`/admin** | ídem | ídem | **Sí** — o mejor, un REVOKE |
| `content_revisions` | admin o autor | **solo el sistema** | nadie | nadie | **Sí** — o mejor, un REVOKE |
| `test_scores` | el titular y su terapeuta | **solo el sistema** | nadie | nadie | **Sí, y urgente** |
| `therapist_time_blocks` | el dueño (ya por RPC) | el dueño (ya por trigger) | ídem | ídem | **Marginal** |
| `user_preferences` | el titular (ya por RPC) | el titular (ya por trigger) | ídem | ídem | **Marginal** |

**Observación que cambia la forma del cierre.** En las tres tablas de riesgo, **el problema no es la
ausencia de RLS: es que la ACL concede INSERT y UPDATE a roles que no deberían tenerlos.** Un
`REVOKE INSERT, UPDATE ON clinical_prescriptions FROM authenticated` cierra el agujero de raíz;
una política de RLS lo taparía dejando el privilegio puesto. Aun así, el plan pactado es de RLS, y
RLS **también** lo cierra —y añade defensa en profundidad—. Lo señalo para que la decisión sea
consciente, no para cambiarla por mi cuenta.

**Aviso sobre las dos políticas huérfanas.** Si se activa RLS en `cie11_directory` **sin añadir una
política para `anon`**, `anon` pasaría de 163 filas a 0. Hoy ningún consumidor público la usa —solo
los dos modales del terapeuta—, así que no rompería nada visible, pero **sería un cambio de
comportamiento real y hay que decidirlo, no descubrirlo**. En `clinical_prescriptions` no ocurre:
`anon` ya da `42501` por ACL, y la política existente reproduce exactamente el estado actual.

---

## 8. Dependencias cruzadas

**Tres FK entrantes**, todas desde tablas que **ya tienen RLS**:

```
padre sin RLS              hija                       RLS hija  políticas  filas hija
clinical_prescriptions     patient_prescriptions      true      4          0
guides                     user_guide_progress        true      1          0
public_tests               public_test_submissions    true      4          5
```

**Activar RLS en un padre no rompe la FK de la hija:** la verificación de integridad referencial en
Postgres no pasa por RLS. Lo que **sí** pasa por RLS es el *embed* de PostgREST: `clinicalService.ts:224`
lee `patient_prescriptions` con `prescription:clinical_prescriptions (...)`, y ese embed se resuelve
como un SELECT sobre el padre **con el rol de quien llama**. Con la política huérfana ya escrita
(`TO authenticated USING (true)`) seguiría funcionando; sin política, el `PatientDashboard` dejaría
de mostrar la prescripción. **Es la única dependencia cruzada que puede romper algo, y está medida.**

Vistas: 0. Realtime/Broadcast: 0. Funciones `SECURITY DEFINER` implicadas
(`list_my_time_blocks`, `get_my_preferences`, `agenda_bloqueo_manual`, `available_hours`,
`enforce_appointment_rules`): todas de `postgres`, con `bypassrls`, **inmunes a RLS en estas tablas**.

**Ninguna de las 8 puede romper una tabla ya cerrada.** El riesgo va en la otra dirección: al
activar RLS en el padre, se puede romper la lectura del hijo.

---

## 9. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | Fuga de datos de riesgo MEDIO o superior | **No hay ninguna FUGA.** Sí hay **escritura** abierta de nivel MEDIO y ALTO — ver #2 |
| 2 | Tabla clínica no detectada | **SÍ — `test_scores`.** Detenido y reportado abajo |
| 3 | Consumidor real no documentado | **No.** Todos los accesos SQL quedan en §3 |
| 4 | Realtime | **No.** 0 en las ocho |
| 5 | Broadcast | **No.** 0 en las ocho |
| 6 | Vista que esquiva RLS | **No.** 0 vistas dependientes |
| 7 | RPC `SECURITY DEFINER` que contradice el modelo | **No.** `list_my_time_blocks` y `get_my_preferences` filtran por `auth.uid()` y lo confirman |
| 8 | Decisión de producto | **SÍ — dos.** Ver abajo |
| 9 | Tabla vacía con consumidor futuro de modelo poco claro | **SÍ — `test_scores`.** Ver abajo |
| 10 | `0 filas` no aislable | **No.** Los `0 f` de `guides` y `test_scores` son tabla vacía con ACL concedida, distinguidos del `42501` |
| 11 | `42501` no atribuible | **No.** Todos fueron `permission denied for table` (ACL) o de columna, ninguno de RLS |
| 12 | RLS exige modificar frontend/RPC/funciones/triggers | **No**, con una salvedad: `user_preferences` necesitaría política de SELECT para que el `.select("profile_id")` de `preferencesService.ts:111` siga devolviendo fila. Es política, no cambio de frontend |

### PARADA #2 y #9 — `test_scores`

**Lo reporto como parada, no como hallazgo menor.** El diagnóstico anterior la clasificó como
«catálogo o tabla vacía de bajo riesgo». Es **una tabla clínica** (`patient_id`, `test_name`,
`total_score`, `item_9_score`) con la ACL más abierta de la base (`anon=arwxtm`), y **cualquiera sin
sesión puede escribir en ella un puntaje a nombre de un paciente real**. Está medido.

Lo que no puedo resolver desde aquí es **para qué es**: 0 filas, 0 consumidores, y un
`clinical_alerts.test_score_id` que la referencia por nombre **pero sin FK**. O es un vestigio que
debería eliminarse, o es un modelo previsto que nunca se implementó. **Esa es una decisión de
producto y de arquitectura, no técnica**, y por eso me detengo.

### PARADA #8 — dos decisiones de producto

1. **¿RLS o REVOKE en `clinical_prescriptions` y `content_revisions`?** Ninguna de las dos debería
   ser escribible por `authenticated`. Un REVOKE cierra de raíz; RLS tapa dejando el privilegio.
   Recomiendo **las dos cosas**, pero la elección es tuya.
2. **¿`anon` debe seguir leyendo `cie11_directory`?** Hoy puede, por ACL, y ninguna ruta pública lo
   usa. Activar RLS con la política huérfana tal cual **se lo quitaría**. Hay que decidirlo, no
   descubrirlo.

---

## 10. Agrupación propuesta

**Resultado: B + C.** Tres sprints, y cinco tablas fuera de RLS con justificación.

### Sprint A — `test_scores` (una tabla, un sprint) · **PRIMERO**

Sola, porque es la de mayor riesgo y porque **antes hay que decidir qué es**. Si es un vestigio, el
sprint correcto no es RLS: es eliminarla. Si se conserva, necesita RLS **y** un REVOKE a `anon`.
Requiere un diagnóstico específico previo — es la opción **D** de la Fase 10 para esta tabla.

### Sprint B — `clinical_prescriptions` + `content_revisions` (mismo modelo, un sprint)

Comparten forma exacta: **catálogo/histórico que `authenticated` puede escribir y no debería**.
Ambas necesitan lectura para autenticados y escritura solo para el sistema. `clinical_prescriptions`
ya tiene la política de SELECT escrita; `content_revisions` no necesita ninguna (nadie la lee).
Un solo sprint, dos tablas, mismo razonamiento.

### Sprint C — `user_preferences` + `therapist_time_blocks` (mismo modelo, un sprint)

También comparten forma: **datos propios, lectura por RPC `SECURITY DEFINER`, escritura directa
gobernada por un trigger de propiedad**. RLS aporta poco —el trigger ya cierra— pero es defensa en
profundidad y homogeneidad. Cuidado documentado: `user_preferences` necesita **política de SELECT**
por el `.select("profile_id")` del consumidor.

### Fuera de RLS: `cie11_directory`, `public_tests`, `guides`

Ver §11.

---

## 11. Tablas que pueden quedar sin RLS

**Tres, con justificación explícita.**

**`cie11_directory` — catálogo público legítimo.** Es la CIE-11 de la OMS: un estándar publicado.
Cero filas citan a una persona. **Protegida por:** ACL de solo lectura para `anon` y
`authenticated`; escritura exclusiva de `service_role`, medida. RLS solo añadiría el riesgo de
quitarle la lectura a `anon` sin motivo. **Excepción legítima.**

**`public_tests` — catálogo público por diseño de producto.** Los 3 tests **son** la página
`/tests`, servida sin sesión desde dos `loader`. **Protegida por:** ACL de solo lectura; escritura
exclusiva de `service_role`, medida; y el trigger `enforce_no_public_risk_instrument`, que impide
publicar un instrumento de riesgo suicida. Una política de SELECT tendría que ser `USING (true)`
para `anon` y `authenticated`: sería **inerte por construcción**. **Excepción legítima.**

**`guides` — tabla muerta.** 0 filas, 0 consumidores, hija con 0 filas. Sustituida por
`clinical_guides`, que ya tiene RLS. **Protegida por:** no contener nada.
**Recomendación: no cerrarla con RLS, sino proponer su eliminación junto con `user_guide_progress`
en un sprint de limpieza aparte.** Poner RLS a una tabla muerta es maquillar el número de cobertura.

---

## 12. Cobertura final del plan

Si se ejecutan los tres sprints:

```
                    hoy      después de A+B+C
RLS activo          29/37    34/37
sin RLS             8        3   (cie11_directory, public_tests, guides)
```

**34 de 37 con RLS, y 3 con excepción documentada y medida.**

**No recomiendo perseguir 37/37.** El criterio que tú mismo fijaste —«cada tabla con un modelo de
autorización explícito y justificado»— se cumple con 34 + 3 excepciones. Forzar RLS sobre dos
catálogos públicos produciría políticas `USING (true)`, que **no filtran nada** y que además dan una
falsa sensación de cobertura: el número sube, la seguridad no. Y la tercera es una tabla muerta que
lo correcto es borrar, no blindar.

**Con esos tres sprints el plan de RLS puede considerarse técnicamente cerrado**, siempre que la
excepción de las tres tablas quede escrita en el índice maestro, no sobreentendida.

---

## 13. Riesgos residuales

Fuera del alcance de RLS, y ya documentados en sprints anteriores:

- **`test_scores` con `anon=arwxtm`.** Aunque se le ponga RLS, **el REVOKE es la corrección de
  fondo**. RLS no arregla una ACL mal puesta; la compensa.
- **H-JE-001** — `service_role` puede `TRUNCATE journey_events` saltándose el trigger append-only.
  El mismo patrón puede existir en otras tablas con trigger `FOR EACH ROW`: **no se ha auditado en
  las 37**.
- **`created_at` retrodatable en `journey_events`.**
- **Retención**: la purga a 24 meses sigue pendiente desde julio.
- **`anon` conserva `REFERENCES`/`TRIGGER`** en varios objetos, incluidos `cie11_directory`,
  `guides`, `public_tests` y `test_scores` — residuo de H-TRIGGER-001.
- **`license_number` público a `anon`** en `therapist_profiles`.
- **`listTherapists()` filtra solo `active`** mientras su índice es `(active, verified)`.
- **PITR desactivado con cero copias de seguridad**, y **la clave de Resend sin rotar**. Las dos son
  tuyas, no mías, y siguen siendo el mayor riesgo del proyecto — muy por encima de cualquier cosa de
  este informe.

---

## 14. Decisión requerida

**Qué sprints quedan: tres.**

| Orden | Sprint | Tablas | Por qué en ese orden |
|---|---|---|---|
| 1 | **`test_scores`** | 1 | Riesgo ALTO, y **necesita diagnóstico específico antes**: hay que decidir si se conserva o se elimina |
| 2 | **Catálogo y auditoría** | `clinical_prescriptions`, `content_revisions` | Mismo modelo: escritura abierta a `authenticated` que debería ser solo del sistema |
| 3 | **Datos propios** | `user_preferences`, `therapist_time_blocks` | Mismo modelo: trigger de propiedad + lectura por RPC. Defensa en profundidad |

**Qué tablas quedan fuera, y por qué:**

- **`cie11_directory`** — catálogo público (CIE-11 de la OMS), sin datos de personas, escritura
  cerrada por ACL.
- **`public_tests`** — catálogo público por diseño de producto; sin él no existe `/tests`.
- **`guides`** — tabla muerta; **propongo eliminarla, no blindarla**.

**Qué necesita aprobación tuya, ahora mismo:**

1. **`test_scores`: ¿se conserva o se elimina?** Es la decisión que bloquea el sprint 1. No la tomo
   yo.
2. **¿REVOKE además de RLS** en `clinical_prescriptions`, `content_revisions` y `test_scores`? Es la
   corrección de fondo; RLS sola compensa pero no arregla.
3. **¿`anon` conserva la lectura de `cie11_directory`?** Si se deja fuera de RLS, sí. Si algún día
   entra, hay que decidir explícitamente.
4. **¿Se acepta cerrar el plan en 34/37 con tres excepciones documentadas**, en lugar de perseguir
   37/37?

**¿Puede considerarse cerrado el plan después de esos sprints?** **Sí**, con dos condiciones: que
las tres excepciones queden escritas en `00_INDICE_MAESTRO.md` con su justificación, y que los
riesgos residuales de §13 —en especial PITR y la clave de Resend— no se den por cubiertos solo
porque la cobertura de RLS lo esté. **RLS cierra el acceso por fila. No cierra nada más.**

---

## Estado del diagnóstico

**Propuesto, sin aplicar. Esperando aprobación explícita.**

```
RLS activo: 29/37 · FORCE: 0/37 · políticas: 92
las 8 tablas: sin cambios · 21 invariantes OK
ACL: 0 · grants por columna: 0 · triggers: 0 · FK: 0 · funciones: 0 · índices: 0 · vistas: 0
datos permanentes: 0 · frontend: 0 · RPC: 0 · Realtime: 0 · Broadcast: 0 · commits: 0
```
