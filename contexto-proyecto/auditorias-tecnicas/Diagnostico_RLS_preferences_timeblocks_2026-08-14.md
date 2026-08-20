# Diagnóstico RLS — user_preferences + therapist_time_blocks

**Fecha:** 14 de agosto de 2026 · **Alcance:** solo lectura. No se activó RLS, no se creó ninguna
política permanente, no se revocó nada, no se tocó ACL, triggers, funciones, FK, índices, vistas,
frontend, RPC, Realtime ni datos. Toda escritura se hizo dentro de transacciones con `ROLLBACK`
forzado y los **47 criterios del baseline** volvieron a OK al terminar.

**Estado global al terminar:** RLS 31/37 · FORCE 0/37 · 92 políticas · huellas POL `345c6ca6…`,
triggers, funciones, FK, índices y vistas idénticas.

> **El hallazgo que cambia el diseño está en §10.** Mi propuesta inicial para
> `therapist_time_blocks` era 2 políticas (INSERT y DELETE). **Está mal:** medido, el
> `deleteTimeBlock()` del propio dueño borra **0 filas, en silencio y sin error**. Hace falta una
> tercera, de SELECT. Lo detecté porque etiqueté «PASA» un resultado que decía `0 borradas`, y esa
> contradicción no se puede dejar pasar.

---

## 1. Baseline

**Los 47 criterios OK.**

```
                              user_preferences        therapist_time_blocks
relrowsecurity ...........    false                   false
relforcerowsecurity ......    false                   false
reloptions ...............    (NULL)                  (NULL)
owner ....................    postgres                postgres
filas ....................    0                       0
columnas .................    9                       7
CHECK propios ............    1                       3
políticas ................    0                       0
triggers propios .........    1                       1
FK salientes .............    1                       1
FK entrantes .............    0                       0
índices ..................    1                       2
vistas dependientes ......    0                       0
Realtime / Broadcast .....    0                       0
funciones que la citan ...    3                       2
huella de datos ..........    (VACÍA)                 (VACÍA)
```

**ACL — y aquí ya empiezan a diferenciarse:**

```
user_preferences        postgres=arwdDxtm, service_role=arwdDxtm, authenticated=aw
  anon            --------
  authenticated   -aw-----     INSERT + UPDATE. SIN SELECT de tabla, SIN DELETE.

therapist_time_blocks   postgres=arwdDxtm, service_role=arwdDxtm, authenticated=ad
  anon            --------
  authenticated   -a-d----     INSERT + DELETE. SIN SELECT de tabla, SIN UPDATE.
```

**`anon` no tiene absolutamente nada en ninguna de las dos.** Ni siquiera `MAINTAIN`.

**Grants por columna — la asimetría real:**

```
user_preferences       authenticated  INSERT x9 · UPDATE x9 · SELECT x1   (solo profile_id)
therapist_time_blocks  authenticated  INSERT x7 ·             SELECT x2   (solo id, therapist_id)
```

**Columnas:**

```
user_preferences                        therapist_time_blocks
  profile_id    uuid   PK, FK profiles    id           uuid  PK
  themes        theme_key[]  ≤3           therapist_id uuid  FK profiles ON DELETE CASCADE
  goal          onboarding_goal           starts_at    timestamptz
  language      text                      ends_at      timestamptz
  modalities    therapy_modality[]        kind         agenda_block_kind  'bloqueo'
  availability  availability_slot[]       reason       text  ≤300
  completed_at  timestamptz               created_at   timestamptz
  created_at / updated_at
```

**CHECK:** `user_preferences_themes_check` (≤3 temas) · `blocks_duracion_razonable` (≤120 días),
`blocks_intervalo_valido` (`ends_at > starts_at`), `blocks_reason_check` (≤300 caracteres).

---

## 2. Modelo user_preferences

**Una fila por persona, y la clave primaria lo garantiza:** `PRIMARY KEY (profile_id)`, con FK a
`profiles(id) ON DELETE CASCADE`. No hay `id` propio: **el usuario es la fila**.

Qué guarda: lo que la persona declaró en el onboarding — `themes` (hasta 3), `goal`
(`entender` / `practicar` / `hablar_con_alguien`), `language`, `modalities`, `availability`,
y `completed_at` como marca de onboarding terminado.

**No es dato clínico**, y el propio servicio lo dice: *«Nada de esto es clínica: no hay severidad, ni
diagnóstico, ni puntaje»*. Pero tampoco es inocuo, y también lo dice: *«saber que alguien entró
pidiendo duelo y trauma dice tanto como una respuesta de un test»*. **Ninguna columna afecta a
seguridad ni a comportamiento del sistema**: no hay roles, planes ni flags de permisos.

**Quién la crea y la modifica:** solo el titular, y lo impone `enforce_user_preferences_ownership`.
**Quién la lee:** solo el titular, por RPC. **Admin: no tiene acceso, y no lo necesita** — ningún
consumidor se lo pide. **`service_role`: acceso completo**, es la rama explícita del trigger.

---

## 3. Consumidores user_preferences

| Archivo:línea | Operación | Actor | Columnas | Filtros | `.select()`/RETURNING |
|---|---|---|---|---|---|
| `preferencesService.ts:59` | **RPC** `get_my_preferences()` [DEFINER] | titular | 6 | interno `auth.uid()` | — |
| `preferencesService.ts:111` | **UPDATE** | titular | hasta 6 | `.eq("profile_id", id)` | **SÍ — `.select("profile_id")`** |
| `preferencesService.ts:117` | **INSERT** | titular | hasta 6 | — | no |

Consumidores de interfaz: `routes/onboarding.tsx:79`, `MiCaminoSection.tsx:285`,
`ContinuaDondeLoDejaste.tsx:208` — los tres vía `getMyPreferences()`.

**Edge Functions, scripts, cron: 0.** No hay `DELETE` en ninguna parte.

**Las 3 funciones SQL que la citan** —`get_my_preferences`, `available_hours`,
`enforce_appointment_rules`— son las tres `SECURITY DEFINER` de `postgres`. `get_my_preferences`
filtra `WHERE auth.uid() IS NOT NULL AND p.profile_id = auth.uid()`, medido:

```
get_my_preferences() por el titular ... 1 fila
                     por un ajeno ..... 0 filas
                     por el admin ..... 0 filas
```

---

## 4. Protección actual user_preferences

Con RLS apagado, leyendo columnas reales:

```
actor            profile_id  themes      goal        availability
propietario      0 f         42501 ACL   42501 ACL   42501 ACL
ajeno            0 f         42501 ACL   42501 ACL   42501 ACL
admin            0 f         42501 ACL   42501 ACL   42501 ACL
anon             42501  permission denied — ACL
```

**La ACL de columna solo concede `profile_id`.** Los temas, el objetivo y la disponibilidad están
cerrados **incluso para el propio titular** en acceso directo: los lee por RPC.

Escritura:

```
INSERT propio ......................... PASA
UPDATE propio ......................... PASA
ajeno INSERT a nombre del titular ..... P0001  trigger USER_PREFERENCES_FORBIDDEN
ajeno UPDATE de la fila del titular ... P0001  trigger USER_PREFERENCES_FORBIDDEN
ADMIN UPDATE de la fila ajena ......... P0001  trigger USER_PREFERENCES_FORBIDDEN
anon INSERT ........................... 42501  ACL
DELETE (titular y admin) .............. 42501  ACL
```

**El trigger ya cierra la propiedad, y el `DELETE` ya lo cierra la ACL. No hay ninguna fuga
medible.** Lo que RLS aportaría es defensa en profundidad, no una corrección.

---

## 5. Upsert user_preferences

**Fase obligatoria, y la respuesta es que NO hay upsert.** El consumidor hace **UPDATE y luego
INSERT**, dos sentencias separadas. El comentario del servicio explica por qué, y lo he verificado:

> *«Antes era un `upsert`, pero `ON CONFLICT DO UPDATE` exige privilegio SELECT sobre CADA columna
> que escribe, y aquí eso significaría abrir la lectura de los temas — justo el dato que esta tabla
> protege. Partirlo en dos sentencias hace el mismo trabajo leyendo solo `profile_id`.»*

Medido:

```
ON CONFLICT DO UPDATE ...... 42501 permission denied for table user_preferences
```

**Confirmado: el upsert real está bloqueado por la ACL de columna**, y el rediseño en dos sentencias
es deliberado. No es un detalle de estilo.

El flujo real, simulado paso a paso:

```
1) usuario SIN preferencias -> UPDATE ... RETURNING profile_id .... 0 filas -> pasa al INSERT
2) creación .................. INSERT propio ......................  PASA
3) usuario CON preferencias -> UPDATE ... RETURNING profile_id .... 1 fila  -> NO inserta, termina
5) actor ajeno ............... INSERT / UPDATE ..................... P0001 trigger
6) admin ..................... UPDATE ............................. P0001 trigger
7) anon ...................... INSERT ............................. 42501 ACL
```

**Qué políticas exige el flujo para no romperse:**

- **SELECT**, obligatoria. El `.select("profile_id")` del paso 1 y 3 es un `RETURNING`, y **la lógica
  del servicio depende de cuántas filas devuelve**: si RLS lo filtrase en silencio, el paso 3
  devolvería 0 y el servicio intentaría un `INSERT` que chocaría contra la clave primaria.
- **INSERT**, para el paso 2.
- **UPDATE**, para los pasos 1 y 3.
- **DELETE: ninguna.** La ACL ya lo niega.

Verificado con las 3 políticas simuladas: los cuatro pasos del flujo pasan, y el ajeno queda en 0
filas.

---

## 6. Modelo therapist_time_blocks

Un rango en el que un profesional no atiende. `kind` distingue `vacaciones` de `bloqueo`; la
migración lo justifica: *«Vacaciones y bloqueo puntual son la misma cosa —un rango en el que no se
atiende— con distinta etiqueta»*. No hay columna de estado.

**Ownership: `therapist_id`, FK a `profiles` ON DELETE CASCADE. Y no se acepta de fuera.**

### El trigger `trg_time_block_ownership` — `BEFORE INSERT OR UPDATE OR DELETE`, `SECURITY DEFINER`

```
si rol = 'service_role' (o no hay sesión ni rol) ....... RETURN NEW    [puerta del sistema]

DELETE:  si auth.uid() <> OLD.therapist_id -> BLOCK_FORBIDDEN
         si no, RETURN OLD

INSERT/UPDATE:
         NEW.therapist_id := auth.uid()          <- DERIVA, no valida
         si UPDATE y OLD.therapist_id <> auth.uid() -> BLOCK_FORBIDDEN
         si NEW.ends_at <= now() -> BLOCK_IN_THE_PAST
         si solapa therapy_sessions vivas o appointments requested/confirmed
                                  -> BLOCK_OVERLAPS_AGENDA
```

Verificado con el actor correcto:

```
bloqueo en el PASADO ............ P0001  trigger  BLOCK_IN_THE_PAST
bloqueo de 190 días ............. 23514  CHECK    blocks_duracion_razonable
fin ANTES del inicio ............ 22000  range lower bound must be ≤ upper bound
```

> Detalle menor: el caso «fin antes del inicio» **no llega al CHECK** `blocks_intervalo_valido`. El
> trigger corre primero y su `tstzrange(starts_at, ends_at)` revienta con `22000`. La capa
> responsable es el trigger, no el CHECK. No es un defecto, pero conviene no atribuirlo mal.

---

## 7. Consumidores therapist_time_blocks

| Archivo:línea | Operación | Actor | Columnas | Filtros | `.select()`/RETURNING |
|---|---|---|---|---|---|
| `timeBlocksService.ts:51` | **RPC** `list_my_time_blocks` [DEFINER] | terapeuta | 5 | interno `auth.uid()` | — |
| `timeBlocksService.ts:77` | **INSERT** | terapeuta | 5 | — | **no** |
| `timeBlocksService.ts:89` | **DELETE** | terapeuta | — | **`.eq("id", id)`** | **no** |

Interfaz: `AgendaClinica.tsx:176` (listar), `:475` (crear), `:479` (borrar).
**Edge Functions, scripts, cron: 0. UPDATE: no existe en ninguna parte.**

`createTimeBlock` envía `therapist_id: quien` con un comentario explícito: *«El trigger lo sobrescribe
con `auth.uid()`; va porque la columna es NOT NULL»*.

### Cuatro funciones DEFINER leen esta tabla, y una lo hace de forma cruzada

```
list_my_time_blocks(desde, hasta)     -> WHERE b.therapist_id = auth.uid()      [lo propio]
agenda_bloqueo_manual(therapist, ini, fin) -> WHERE b.therapist_id = p_therapist_id  [CRUZADA]
  └─ la llaman: hora_ocupada, enforce_appointment_agenda, enforce_session_agenda
```

Medido con la tabla sembrada:

```
actor          list_my_time_blocks   agenda_bloqueo_manual(terapeuta, +10d)
terapeuta      1 bloqueos            true
paciente       1 bloqueos            true      <- lo suyo, no lo del terapeuta
admin          0 bloqueos            true
```

**`agenda_bloqueo_manual` devuelve `true` a un paciente sobre el bloqueo de un terapeuta, y debe
seguir haciéndolo:** es como el sistema sabe que ese hueco no está disponible al agendar. **Es una
lectura cruzada legítima**, y no la rompe ninguna política: la función es DEFINER de `postgres`, que
tiene `bypassrls`.

---

## 8. Protección actual therapist_time_blocks

Con RLS apagado:

```
actor            id      therapist_id  starts_at    reason
terapeuta        0 f     0 f           42501 ACL    42501 ACL
paciente         0 f     0 f           42501 ACL    42501 ACL
admin            0 f     0 f           42501 ACL    42501 ACL
anon             42501  permission denied — ACL
```

**Solo `id` y `therapist_id` son legibles.** Las fechas y el motivo están cerrados **incluso para el
dueño**: la lectura real va por RPC.

Escritura, con siembra fresca en cada caso:

```
UPDATE (dueño y ajeno) ................ 42501  permission denied — ACL
paciente borra el del terapeuta ....... P0001  trigger  BLOCK_FORBIDDEN   la fila SIGUE
admin borra el del terapeuta .......... P0001  trigger  BLOCK_FORBIDDEN   la fila SIGUE
terapeuta borra el SUYO ............... 1 borrada       DELETE legítimo
anon SELECT ........................... 42501  ACL
```

> **Corrección a mi propia batería.** La primera pasada dio `0 borradas` en los DELETE ajenos y
> `0 bloqueos propios` en las RPC. **Era contaminación mía**: los DELETE previos habían vaciado la
> tabla dentro de la misma transacción. Repetido con siembra fresca en cada caso, los resultados son
> los de arriba. No se aceptó el primer número.

**`authenticated` NO tiene UPDATE en la ACL** (`ad`, no `aw`): **la rama de UPDATE del trigger es
inalcanzable desde el cliente**. Es un control muerto, y conviene no atribuirle protección.

---

## 9. Derivación de ownership

**Sí, deriva. Medido:**

```
1) el TERAPEUTA inserta a nombre propio ......... PASA
   therapist_id guardado: 104db81c  = el suyo

2) un PACIENTE inserta con therapist_id = el del terapeuta ... INSERT ACEPTADO
   therapist_id guardado: 141e54fe  <- el SUYO
   bloqueos del terapeuta real: 1 (el que ya tenía)
```

`NEW.therapist_id := auth.uid()` **reescribe** el valor recibido. Un paciente no puede bloquear la
agenda de otro: se crea un bloqueo suyo, que nadie lee y que no afecta a ninguna agenda porque él no
es terapeuta.

### ¿Puede RLS apoyarse en la columna derivada?

**Sí, y está medido.** En Postgres el **`BEFORE` trigger se ejecuta antes que el `WITH CHECK` de la
política**, así que la política evalúa el valor **ya derivado**. Simulado con
`WITH CHECK (auth.uid() = therapist_id)`:

```
paciente INSERT con therapist_id ajeno .... SE CREA, con therapist_id = el del paciente
```

El `WITH CHECK` lo deja pasar porque para cuando lo evalúa, la fila ya es del paciente.
**Consecuencia honesta: la política de INSERT es, en la práctica, redundante con el trigger.** No
hace daño y es defensa en profundidad —si algún día el trigger cambiara, la política seguiría—, pero
no cierra nada que el trigger no cierre hoy. Lo digo así y no le atribuyo mérito que no tiene.

---

## 10. DELETE legítimo — y el hallazgo que corrige el diseño

Reconfirmado:

```
terapeuta propietario borra el suyo ... 1 borrada        PASA
terapeuta ajeno / paciente ............ P0001  trigger  BLOCK_FORBIDDEN
admin ................................. P0001  trigger  BLOCK_FORBIDDEN
service_role .......................... rama explícita del trigger: pasa
```

`deleteTimeBlock()` hace `.delete().eq("id", id)` y **no envía `therapist_id`**: quien decide la
propiedad es el trigger, comparando con `OLD.therapist_id`.

### El problema

Mi propuesta inicial era **2 políticas: INSERT y DELETE**. Al simularla, el DELETE del propio dueño
devolvió **`0 borradas`** — y yo lo había etiquetado «PASA». Esa contradicción se aisló:

```
CASO 1: RLS + SOLO política de DELETE
  el dueño borra por WHERE id=… ......... 0 borradas   <<< NO BORRA
  la fila sigue ahí: 1

CASO 2: RLS + política de DELETE + política de SELECT
  el dueño borra por WHERE id=… ......... 1 borrada    <<< AHORA SÍ

CASO 3: RLS + SOLO política de DELETE, y SIN cláusula WHERE
  DELETE sin WHERE ...................... 1 borrada
```

**La causa:** `DELETE ... WHERE id = X` necesita **leer** la fila para resolver el `WHERE`, y con RLS
activo esa lectura la gobiernan las políticas de SELECT. Sin ninguna, la fila es invisible y el
DELETE no encuentra nada: **devuelve 0 filas, en silencio, sin error.** El caso 3 lo confirma por
contraste: sin `WHERE` no hace falta leer y el borrado sí ocurre.

Y el fallo sería **invisible**: `deleteTimeBlock` solo comprueba `if (error) throw`. El terapeuta
pulsaría «eliminar», no vería ningún error, y el bloqueo seguiría en su agenda.

**`therapist_time_blocks` necesita política de SELECT.** Es el mismo mecanismo que obliga a
`user_preferences` a llevarla por su `.select("profile_id")`, pero llegando por otro camino.

---

## 11. Modelo RLS propuesto

### `user_preferences` — 3 políticas

| # | Operación | Actor | USING | WITH CHECK | Consumidor | Riesgo que cierra |
|---|---|---|---|---|---|---|
| 1 | SELECT | `authenticated` | `auth.uid() = profile_id` | — | `preferencesService.ts:111` (`RETURNING`) | lectura del `profile_id` ajeno |
| 2 | INSERT | `authenticated` | — | `auth.uid() = profile_id` | `:117` | alta a nombre ajeno |
| 3 | UPDATE | `authenticated` | `auth.uid() = profile_id` | `auth.uid() = profile_id` | `:111` | edición de fila ajena |

**Sin DELETE:** la ACL no lo concede. **Sin admin:** ningún consumidor lo pide y el trigger ya se lo
niega. **Trigger complementario:** `enforce_user_preferences_ownership`, que sigue siendo la
autoridad; RLS filtra la fila **antes** de que llegue a él.

### `therapist_time_blocks` — 3 políticas

| # | Operación | Actor | USING | WITH CHECK | Consumidor | Riesgo que cierra |
|---|---|---|---|---|---|---|
| 1 | SELECT | `authenticated` | `auth.uid() = therapist_id` | — | **imprescindible para el DELETE** (§10) | lectura de `id`/`therapist_id` ajenos |
| 2 | INSERT | `authenticated` | — | `auth.uid() = therapist_id` | `timeBlocksService.ts:77` | redundante con el trigger (§9) |
| 3 | DELETE | `authenticated` | `auth.uid() = therapist_id` | — | `:89` `deleteTimeBlock` | borrado de bloqueo ajeno |

**Sin UPDATE:** la ACL no lo concede, y la rama de UPDATE del trigger ya es inalcanzable.
**Sin admin. Sin `anon`** —no tiene ningún privilegio—. **Sin política para `service_role`**: tiene
`bypassrls`, y además el trigger tiene su rama explícita.

**Trigger complementario:** `enforce_time_block_ownership`, que sigue imponiendo la derivación del
dueño, la prohibición del pasado y el no solapamiento con la agenda. **RLS no duplica nada de eso.**

Diseño corregido, verificado:

```
createTimeBlock ......................... PASA
listMyTimeBlocks [RPC DEFINER] .......... 1 bloqueos
SELECT directo del dueño ................ 1 fila   (solo las suyas)
deleteTimeBlock del suyo ................ 1 borrada   PASA

paciente ...... ve 0 filas · borra 0   RLS filtra antes del trigger
admin ......... ve 0 filas · borra 0   RLS filtra antes del trigger
anon .......... 42501 ACL, no RLS
```

---

## 12. ACL vs RLS

| Tabla | Operación | Cierre correcto hoy | ¿Qué aporta RLS? |
|---|---|---|---|
| `user_preferences` | SELECT | **ACL de columna** (solo `profile_id`) | acota el `profile_id` al titular |
| | INSERT | **trigger** | filtra antes; redundante |
| | UPDATE | **trigger** | filtra la fila antes del trigger |
| | DELETE | **ACL** — no concedido | nada. **No se propone política** |
| `therapist_time_blocks` | SELECT | **ACL de columna** (`id`, `therapist_id`) | acota al dueño **y habilita el DELETE** |
| | INSERT | **trigger** (deriva el dueño) | redundante, defensa en profundidad |
| | UPDATE | **ACL** — no concedido | nada. **No se propone política** |
| | DELETE | **trigger** `BLOCK_FORBIDDEN` | cambio de capa: filtra antes |

**Ninguna operación de estas dos tablas está hoy abierta.** A diferencia de `clinical_prescriptions`,
`content_revisions`, `journey_events` o `test_scores`, **aquí no hay ninguna fuga ni ningún agujero
de escritura que corregir**: el trigger y la ACL ya cubren todo. Lo digo con claridad para que el
sprint se apruebe sabiendo qué compra.

**Lo que RLS sí aporta, y no es poco:**

1. **Cierra la lectura del `profile_id` / `id` + `therapist_id` ajenos**, que hoy sí es visible a
   cualquier autenticado. Es metadato, no contenido — pero es lo mismo que se cerró en
   `notifications` y en `therapist_contact_requests`.
2. **Homogeneidad:** deja el esquema con un modelo de autorización explícito en todas las tablas con
   datos de persona.
3. **Independencia del trigger:** si algún día se modifica o se elimina un trigger, la política
   sigue. Los triggers son código; las políticas son declarativas.

**¿REVOKE?** **No hace falta en ninguna de las dos.** La ACL ya es mínima: `-aw-----` y `-a-d----`,
sin SELECT de tabla, sin DELETE en una y sin UPDATE en la otra, y `anon` sin nada. Esto las distingue
del sprint anterior, donde el REVOKE era la corrección de fondo.

---

## 13. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | `user_preferences` necesita acceso de admin no documentado | **No.** Ningún consumidor lo pide; el trigger ya se lo niega |
| 2 | El upsert requiere una política adicional inesperada | **No hay upsert** (§5). El flujo real necesita SELECT + INSERT + UPDATE, las tres propuestas |
| 3 | `therapist_time_blocks` depende de otra tabla sin modelo | **No.** `therapy_sessions` y `appointments` ya tienen RLS; el trigger las consulta como DEFINER |
| 4 | Trigger y RLS con interacciones ambiguas | **Resuelto por medición** (§9 y §10). Ninguna quedó ambigua |
| 5 | Realtime | **No.** 0 en ambas |
| 6 | Broadcast | **No.** 0 en ambas |
| 7 | Vista que esquiva RLS | **No.** 0 vistas dependientes en ambas |
| 8 | RPC `SECURITY DEFINER` que contradice el modelo | **No.** Las 4 son de `postgres` y filtran correctamente. `agenda_bloqueo_manual` es cruzada **por diseño** y RLS no la afecta |
| 9 | Consumidor no documentado | **No.** Los 6 accesos están en §3 y §7 |
| 10 | `0 filas` ambiguo | **Apareció dos veces y se aisló las dos** — ver abajo |
| 11 | `42501` ambiguo | **No.** Todos fueron `permission denied for table` (ACL de tabla o de columna) |
| 12 | RLS requiere modificar frontend, funciones o triggers | **No** — con las 3 políticas de cada tabla. **Sí lo habría requerido con mi diseño inicial de 2** |
| 13 | Decisión de producto | **No** |

### Los dos `0 filas` que se aislaron

1. **`0 borradas` y `0 bloqueos propios` en la primera batería de `therapist_time_blocks`** —
   contaminación de mi propio orden: los DELETE previos habían vaciado la tabla. Repetido con siembra
   fresca (§8).
2. **`0 borradas` del dueño en la simulación de RLS** — **no era contaminación: era el diseño**.
   Aislado en tres casos y explicado en §10. Es el hallazgo que corrige la propuesta.

**Ningún criterio bloquea el sprint.** El #12 lo habría bloqueado con mi propuesta inicial; con la
corregida, no.

---

## 14. Agrupación propuesta

**A) Las dos en un solo sprint.**

Comparten forma con exactitud poco común: **una fila por dueño, ownership impuesto por un trigger
`SECURITY DEFINER`, lectura real por RPC `DEFINER`, ACL mínima sin SELECT de tabla, y la misma
política en las tres operaciones —`auth.uid() = <columna de dueño>`—.** Ninguna tiene fuga que
corregir; en las dos RLS es defensa en profundidad.

**Y el riesgo de regresión es el mismo y ya está medido en las dos:** ambas necesitan política de
SELECT porque un consumidor real la exige —el `RETURNING` en una, el `WHERE` del DELETE en la otra—,
y en ambas el fallo sería **silencioso**. Separarlas obligaría a repetir la misma verificación dos
veces sin ganar nada.

**No lo decido por longitud del SQL:** 6 políticas es más que varios sprints anteriores. Lo decido
porque el modelo y el modo de fallo son idénticos.

---

## 15. Decisión requerida

**¿Están las dos preparadas?** **Sí, con el diseño corregido de §11.** Ningún criterio de parada
bloquea, ninguna necesita tocar frontend, funciones ni triggers.

**Qué políticas necesita cada una — 6 en total, y RLS pasaría de 31 a 33 de 37:**

- **`user_preferences`: 3** — SELECT, INSERT y UPDATE, todas `auth.uid() = profile_id`. Sin DELETE.
- **`therapist_time_blocks`: 3** — SELECT, INSERT y DELETE, todas `auth.uid() = therapist_id`. Sin
  UPDATE.

**Qué debe seguir funcionando** — y está verificado, no supuesto:

```
get_my_preferences() del titular .................. 1 fila
UPDATE ... RETURNING profile_id (con y sin fila) .. 1 y 0, la lógica del servicio intacta
INSERT de preferencias propias .................... PASA
createTimeBlock ................................... PASA
listMyTimeBlocks [RPC] ............................ devuelve los propios
deleteTimeBlock del suyo .......................... 1 borrada
agenda_bloqueo_manual desde un paciente ........... true   (lectura cruzada, intacta)
```

**Qué debe bloquearse:**

```
lectura del profile_id / id + therapist_id ajenos .. 0 filas
INSERT o UPDATE de preferencias ajenas ............. 0 filas por RLS, antes del trigger
borrado de un bloqueo ajeno ........................ 0 filas por RLS, antes del trigger
admin ............................................. sin acceso a ninguna de las dos
anon .............................................. 42501 por ACL, sin cambio
```

**¿Necesitan REVOKE?** **No.** Es la diferencia con el sprint anterior: aquí la ACL ya es mínima y
correcta. **No hay nada que revocar.**

**¿Un solo sprint?** **Sí.** Mismo modelo, mismo modo de fallo, misma verificación.

**¿Decisión de producto?** **Ninguna.**

**Lo que sí quiero que quede dicho antes de aprobar:** este sprint **no cierra ninguna fuga de
contenido**. Cierra la lectura de dos identificadores ajenos y añade una capa declarativa sobre unos
triggers que ya funcionan. Es el cierre ordenado del plan, no una corrección urgente — y con eso el
plan quedaría en **33 de 37, con 3 excepciones documentadas y 1 tabla pendiente de DROP**.

**Preguntas concretas:**

1. **¿Se aprueban las 6 políticas** tal como quedan en §11, con la de SELECT en las dos tablas?
2. **¿Un solo sprint conjunto**, como recomiendo?
3. **¿Se acepta que la política de INSERT de `therapist_time_blocks` sea redundante** con el trigger
   (§9), o se prefiere omitirla y quedarse en 5 políticas?

---

## Cierre — aplicado el 14 de agosto de 2026

Diseño aprobado **con la corrección de §10 incorporada** —las dos tablas llevan política de SELECT—
y aplicado en `20260814_preferences_timeblocks_rls.sql`, con backup en
`backups/20260814_pre_preferences_timeblocks_rls.sql`.

**RLS 31 → 33 de 37. Políticas 92 → 98.** Ningún REVOKE, ninguna ACL tocada.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Preferencias y Bloqueos — el cierre del plan»*.

**El caso crítico quedó demostrado:** el `deleteTimeBlock()` del propietario afecta **exactamente
1 fila**, con la fila verificada como existente, su dueño comprobado y el `sub` del JWT contrastado
antes de cada intento. Paciente y admin: 0 filas por RLS. `anon`: `42501` por ACL.

**Una corrección a mi propia etiqueta durante la validación.** Escribí que el INSERT ajeno de
`user_preferences` «cae por RLS»; el resultado medido es `P0001 USER_PREFERENCES_FORBIDDEN`. **Lo
para el trigger, no RLS**, porque el `BEFORE` corre antes del `WITH CHECK`. Hay una asimetría real
que conviene retener: **en INSERT gana el trigger; en UPDATE gana RLS**, porque su `USING` decide qué
filas son siquiera alcanzables antes de que ningún trigger de fila se dispare.

**Defecto preexistente descubierto de paso, y no corregido:** `service_role` **no puede borrar** de
`therapist_time_blocks`. La rama `IF rol = 'service_role' THEN RETURN NEW` del trigger va primero, y
en un `BEFORE DELETE` `NEW` es `NULL`: devolver `NULL` cancela la operación en silencio. Medido —
2 filas antes, `ROW_COUNT=0` sin error, 2 filas después—. **Es de agosto, RLS no lo toca y queda
fuera de alcance.**

## Estado del diagnóstico

**Aplicado. Con esto se cierra el plan de RLS.**

```
RLS activo: 33/37 · FORCE: 0/37 · políticas: 98
user_preferences:      RLS=true · 3 políticas (SELECT/INSERT/UPDATE) · DELETE cerrado por ACL
therapist_time_blocks: RLS=true · 3 políticas (SELECT/INSERT/DELETE) · UPDATE cerrado por ACL
                       DELETE del propietario funcional: 1 fila
ACL: 0 cambios · grants por columna: 0 · triggers: 0 · FK: 0 · funciones: 0 · índices: 0 · vistas: 0
datos permanentes: 0 · frontend: 0 · RPC: 0 · Realtime: 0 · Broadcast: 0 · commits: 0
```
