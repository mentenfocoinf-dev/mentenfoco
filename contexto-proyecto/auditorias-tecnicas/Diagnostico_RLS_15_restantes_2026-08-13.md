# Diagnóstico RLS — siguiente tabla prioritaria

**Fecha:** 2026-08-13
**Alcance:** diagnóstico. **Sin migración, sin backup, sin políticas, sin RLS.** No se modificó ACL,
triggers, funciones, FK, índices, vistas, frontend, RPC ni datos. Todo dentro de transacciones
revertidas con `RAISE EXCEPTION`.

Huellas al abrir y al cerrar — **idénticas**: ACL `c9a0182c…` · políticas `0639bea2…` ·
FK `cfb70692…` · índices `6da61f8c…` · triggers `3ca1288a…` · funciones `e5e288e7…` ·
estado RLS `486dbb58…` · vistas `61114ef9…`.

---

## 1. Inventario de las 15 tablas restantes

Confirmado contra el catálogo: 37 tablas, 22 con RLS, **15 sin RLS**, ninguna de ellas en los grupos
cerrados. Letras de ACL: `r`=SELECT `a`=INSERT `w`=UPDATE `d`=DELETE.

| Tabla | RLS | Pol | Filas | anon | auth | Trg | Vistas | Tipo de dato | Riesgo | Prioridad |
|---|---|---|---|---|---|---|---|---|---|---|
| `messages` | no | 0 | 4 | `----` | `raw-` | 6 | 0 | **clínico — texto libre de terapia** | **CRÍTICO** | **1 (bloqueada)** |
| `psychometric_evaluations` | no | **4** | 40 | `----` | `raw-` | 1 | 0 | **clínico — PHQ-9/GAD-7, severidad, respuestas** | **CRÍTICO** | **2 (recomendada)** |
| `therapist_profiles` | no | 0 | 1 | `r---` | `raw-` | 1 | 0 | profesional — matrícula, verificación | **ALTO (integridad)** | **3** |
| `notifications` | no | 0 | 4 | `----` | `--w-` | 1 | 0 | personal — avisos | MEDIO | 4 |
| `therapist_contact_requests` | no | 0 | 0 | `----` | `-aw-` | 5 | 0 | personal — mensaje de contacto | MEDIO | 5 |
| `journey_events` | no | 0 | 58 | `-a--` | `-a--` | 2 | 0 | telemetría — `ip_hash`, UA, UTM | MEDIO | 6 |
| `content_revisions` | no | 0 | 0 | `----` | `raw-` | 0 | 0 | editorial — cuerpos anteriores | MEDIO | 7 |
| `user_preferences` | no | 0 | 0 | `----` | `-aw-` | 1 | 0 | personal — preferencias | BAJO | 8 |
| `therapist_time_blocks` | no | 0 | 0 | `----` | `-a-d` | 1 | 0 | operativo — agenda | BAJO | 9 |
| `test_scores` | no | 0 | 0 | `raw-` | `raw-` | 0 | 0 | **muerta** — 0 filas, 0 referencias | BAJO | 10 |
| `clinical_guides` | no | 1 | 20 | `r---` | `r---` | 0 | **1** | contenido de pago | BAJO | 11 |
| `guides` | no | 0 | 0 | `r---` | `r---` | 0 | 0 | legado — 0 filas | BAJO | 12 |
| `clinical_prescriptions` | no | 1 | 14 | `----` | `raw-` | 0 | 0 | catálogo | BAJO | 13 |
| `public_tests` | no | 0 | 3 | `r---` | `r---` | 1 | 0 | catálogo público | BAJO | 14 |
| `cie11_directory` | no | 1 | 163 | `r---` | `r---` | 0 | 0 | catálogo público (CIE-11) | BAJO | 15 |

**Ninguna función de `public` menciona** `cie11_directory`, `clinical_guides`,
`clinical_prescriptions`, `guides`, `public_tests` ni `test_scores`: para esas, RLS sería la única
puerta, pero tampoco hay nada sensible que cerrar.

---

## 2. Tabla prioritaria

Hay **tres** tablas con riesgo serio y hay que decirlo en ese orden, no elegir una y callar las otras.

**`messages` es la de contenido más sensible**, pero **no puede ser el próximo sprint**: activa dos
criterios de parada (§12). Queda descrita aquí para que su sprint se planifique con lo que falta.

**La candidata recomendada es `psychometric_evaluations`**, por evidencia:

- **Dato clínico de máxima sensibilidad**: 40 evaluaciones PHQ-9 y GAD-7 con `severity_level`,
  `total_score` y `raw_answers`. El PHQ-9 incluye el ítem 9, de ideación suicida.
- **Fuga total medida**: un tercero sin ninguna relación lee las 40, con respuestas y severidad.
- **Ya tiene 4 políticas escritas desde el Grupo 0 — y están rotas contra los datos reales.** Es la
  razón de más peso: alguien podría activar RLS creyéndola preparada y provocar una regresión
  clínica silenciosa. Medido en §7.
- **Totalmente verificable desde SQL**: no está en la publicación de Realtime, ninguna vista la
  proyecta, y solo tiene un trigger.
- **Sin decisión de producto pendiente.**

`therapist_profiles` tiene un agujero de **integridad** (§4) de gravedad comparable, pero es un
problema distinto —suplantación, no confidencialidad— y merece su propio sprint.

---

## 3. Baseline de `psychometric_evaluations`

```
RLS = false · FORCE = false · reloptions = (NULL) · owner = postgres
filas = 40 · 4 pacientes · políticas = 4 (2 SELECT, 2 INSERT; 0 UPDATE, 0 DELETE)
ACL: anon ----   ·   authenticated raw-   ·   service_role arwd
triggers = 1 · FK salientes = 2 · FK entrantes = 1 · índices = 1 · vistas = 0
funciones que la mencionan = 1  (solo su propio trigger)
```

Columnas: `id, patient_id, therapist_id, scale_type, total_score, severity_level, raw_answers,
evaluated_at`.

FK: `patient_id → profiles(id) CASCADE`, `therapist_id → profiles(id) CASCADE`.
FK entrante: **`clinical_alerts.test_score_id → psychometric_evaluations(id) CASCADE`**, y
`clinical_alerts` **ya tiene RLS** — la dependencia va en la dirección segura.

Reparto de datos, y aquí está lo importante:

```
filas ................................... 40
therapist_id NULL ....................... 40      <<< TODAS
patient_id NULL .........................  0
con relación paciente-terapeuta .........  40
therapist_id = el terapeuta asignado ....   0      <<< NINGUNA
por escala: gad7 20 · phq9 20, las 40 con severity_level
```

---

## 4. Riesgo actual

### `psychometric_evaluations` — medido, sin RLS

```
tercero sin relaciones, todas ......... 40   <<< FUGA
  ... con raw_answers y severidad ..... 40   <<< incluye el ítem 9 del PHQ-9
paciente ajeno, las de otro paciente .. 10   <<< FUGA
terapeuta asignado, las de su paciente  10   legítimo
anon .................................. 42501 permission denied — ACL, no RLS
```

`UPDATE` está concedido por ACL (`w`) y no lo cubre ningún trigger de autorización; el único trigger
existente solo aplica un límite de plan al `INSERT`. **No hay ningún consumidor que actualice**, así
que el riesgo es teórico hoy, pero la puerta está abierta. `DELETE` lo corta la ACL.

### `messages` — medido, sin RLS

```
paciente de la conversación ... 4 mensajes, 4 cuerpos   legítimo
paciente AJENO ................ 4 mensajes, 4 cuerpos   <<< FUGA: lee la terapia de otro
tercero sin relaciones ........ 4 mensajes, 4 cuerpos   <<< FUGA
terapeuta de la conversación .. 4                        legítimo
ADMIN ......................... 4                        ¿debe? — decisión de producto
anon .......................... 42501 permission denied — ACL
```

**La escritura ya está completamente cubierta** por triggers `SECURITY DEFINER`:

```
tercero escribe en conversación ajena ... P0001 MESSAGE_FORBIDDEN     trigger
tercero marca leído lo ajeno ............ P0001 MESSAGE_FORBIDDEN     trigger
tercero edita el cuerpo ................. P0001 MESSAGE_IMMUTABLE     trigger
tercero borra ........................... 42501 permission denied     ACL
```

`enforce_message_insert` fuerza `sender_id := auth.uid()`, deriva `patient_id`/`therapist_id` de la
relación y exige que esté `active`. Lo único que falta es **la lectura**.

### `therapist_profiles` — un agujero de integridad, no de confidencialidad

```
tercero UPDATE verified + license_number ... P0001 THERAPIST_PROFILE_FORBIDDEN   trigger
tercero INSERT de su PROPIO perfil ........ se crea, con verified=false y active=true
```

El trigger `enforce_therapist_profile_ownership` está bien pensado: impide editar el perfil ajeno y
**bloquea explícitamente la auto-verificación**. Pero comprueba `NEW.profile_id = auth.uid()` **sin
comprobar que quien inserta tenga rol `therapist`**. Y el consumidor del directorio,
`therapistService.ts:141` `listTherapists()`, filtra **solo por `active = true`** — no por
`verified`.

**Consecuencia: un paciente puede darse de alta como perfil profesional y aparecer en el directorio
y en el matching**, sin verificar. En una plataforma de salud mental eso es suplantación de
profesional. Es un hallazgo **de este diagnóstico**, no estaba documentado.

Lo que **no** he comprobado y por tanto no afirmo: si la interfaz del directorio muestra o no un
distintivo de «verificado» que lo haga evidente al usuario. Lo que está medido es que la fila entra
en el resultado de `listTherapists()`.

---

## 5. Consumidores

### `psychometric_evaluations` — 5, ninguna RPC ni Edge Function

| Consumidor | Op | Columnas / filtro | `.select()` | Actor |
|---|---|---|---|---|
| `clinicalService.ts:120` `getPatientEvaluations` | SELECT | `scale_type, total_score, severity_level, evaluated_at` por `patient_id` | — | **terapeuta y admin** (`pacientes.$patientId`) |
| `clinicalService.ts:164` | SELECT | `evaluated_at`, `scale_type IN (…)`, `limit 1` | — | paciente (límite de plan) |
| `CognitiveScreeningForm.tsx:52` | INSERT | con `therapist_id: therapistId` | no | terapeuta |
| `CssrsModal.tsx:126` | INSERT | `therapist_id: assignment?.therapist_id ?? null` | **sí → RETURNING** | paciente |
| `PsychometricScaleModal.tsx:45` | INSERT | `therapist_id: assignment?.therapist_id ?? null` | **sí → RETURNING** | paciente |

Los dos modales necesitan el `id` devuelto para escribir `clinical_alerts.test_score_id`:
**el `INSERT ... RETURNING` exige política de SELECT**, la cuarta vez que aparece la regla.

**Ningún consumidor hace UPDATE ni DELETE.**

### `messages` — 12 puntos, en tres canales distintos

- **Lectura, por RPC `SECURITY DEFINER`** (ya endurecido; hay un test que lo vigila,
  `hardening.test.ts`): `list_pair_messages`, `list_relationship_messages`,
  `list_my_conversations`, `count_my_unread_messages` ×2.
- **Escritura, directa**: `messagesService.ts:182` `sendMessage` (INSERT sin `.select()`),
  `:217` `markAsRead` (UPDATE), `:72` `sendMessageByPair` (INSERT **con `.select("*").single()`**),
  `:92` `markConversationAsReadByPair` (UPDATE).
- **Realtime, `postgres_changes`**: `PatientDashboard.tsx:163`, `TherapistDashboard.tsx:155`,
  `ChatThread.tsx:73`, `TherapistMessages.tsx:56`. Y `messages` **está en la publicación
  `supabase_realtime`**.

### `therapist_profiles` — 3 directos + 5 funciones DEFINER

`therapistService.ts:90` (perfil propio), `:115` `updateTherapistProfile` (**upsert + `.select()`**),
`:141` `listTherapists` (directorio, `active = true`). Funciones: `available_hours`,
`enforce_appointment_rules`, `get_my_therapist`, `list_my_appointments`,
`list_my_contact_requests` — todas DEFINER, no afectadas por RLS.

---

## 6. Triggers y autorización existente

### `psychometric_evaluations` — 1 trigger, y **no es de autorización**

`free_plan_evaluation_limit` (`BEFORE INSERT`, **INVOKER**) → `enforce_free_plan_evaluation_limit`:

- **Deriva**: nada. **Sobrescribe**: nada.
- **Comprueba**: que `scale_type IN ('phq9','gad7')`, y el `plan_type` y el `role` del *paciente*
  (no del actor). Si es paciente `free` y hay una evaluación en los últimos 30 días,
  `FREE_PLAN_EVALUATION_LIMIT`.
- **No comprueba** propiedad, ni relación paciente-terapeuta, ni rol del actor. **No impide DELETE.**
  **No impide modificaciones.**

**Es una regla de negocio, no de acceso.** A diferencia de `clinical_consents` o `messages`, aquí
**no hay ninguna capa de autorización de escritura**: lo único que gobierna quién escribe son las
dos políticas de INSERT ya escritas —que hoy están inertes porque RLS está apagado—.

### `messages` — 6 triggers, autorización completa

`enforce_message_insert` [DEFINER] fuerza `sender_id`, deriva `patient_id`/`therapist_id`, exige
relación `active` y pertenencia (`MESSAGE_FORBIDDEN`). `enforce_message_update` [DEFINER] hace el
cuerpo inmutable y limita el marcado de leído a la propia conversación.
`enforce_message_no_delete` prohíbe borrar. Los otros tres son de notificación/broadcast.
**Cubren toda la escritura; no cubren nada de la lectura.**

### `therapist_profiles` — 1 trigger, con un hueco

`enforce_therapist_profile_ownership` protege propiedad y verificación. **Lo que NO cubre:** que
quien crea un perfil profesional tenga rol `therapist`.

---

## 7. Validación funcional previa

Además de lo de §4, la prueba decisiva: **qué pasaría si se activase RLS con las 4 políticas ya
escritas**, sin tocar nada más.

```
therapist_id es NULL en las 40 filas; la política dice auth.uid() = therapist_id

terapeuta asignado, las de su paciente ...  0   <<< REGRESIÓN: pierde las 10
terapeuta, total ........................  0
paciente, las suyas .....................  10  la política de paciente SÍ funciona
ADMIN ...................................  0   <<< no existe política de admin
UPDATE ..................................  0 filas   no hay política de UPDATE
DELETE .................................. 42501 permission denied — ACL
>> RLS devuelto a false
```

**La tabla NO está preparada pese a tener políticas.** Activarla tal cual dejaría al terapeuta y al
admin sin ver ninguna evaluación en la ficha del paciente, en silencio: la ficha mostraría el
historial psicométrico vacío. En una consulta clínica eso no es un fallo cosmético.

---

## 8. Ambigüedades y aislamientos

**1. `notifications` parecía tener una fuga y no la tiene.**
`SELECT count(*)` como tercero devolvió 4, pero `has_table_privilege(…,'SELECT')` daba `false`.

```
GRANTs por columna para authenticated: SELECT solo en id, read_at, user_id
tercero lee title, body, user_id ... 42501 permission denied
tercero lee solo read_at ........... 4 filas
```

Es el **falso positivo de `count(*)`** ya conocido: basta SELECT sobre *alguna* columna. La
exposición real es de metadatos —`user_id` y `read_at`, quién fue notificado y cuándo, no de qué—.
El `UPDATE` ajeno lo corta el trigger (`NOTIFICATION_FORBIDDEN`). **Bajada de MEDIO-ALTO a MEDIO.**

**2. El `INSERT` de `therapist_profiles`: ¿agujero real o irrelevante?**
Se aisló comprobando los *defaults* (`verified=false`, `active=true`), el cuerpo del trigger y el
filtro del consumidor (`listTherapists` solo filtra `active`). **Es real**, y se documenta separando
lo medido (entra en el resultado del directorio) de lo no medido (cómo lo presenta la interfaz).

**3. `messages`: los `P0001` son de trigger, no de RLS** — hoy no hay RLS en esa tabla, así que la
atribución es inequívoca. El `42501` del `DELETE` es de ACL.

**4. Contaminación evitada por diseño:** todas las lecturas base se ejecutaron antes de cualquier
escritura de prueba, tras la lección del sprint de `clinical_notes`.

**Artefactos de prueba declarados, todos revertidos:** ascender temporalmente a `therapist` un
paciente sin relaciones; insertar un `therapist_profiles` de prueba (la tabla vuelve a 1 fila);
activar y desactivar RLS sobre `psychometric_evaluations` dentro de la transacción para medir el
efecto de las políticas existentes.

**Sin resultados inconcluyentes.**

---

## 9. Modelo recomendado para `psychometric_evaluations`

| Acción | Quién | Por qué |
|---|---|---|
| Leer | el **paciente titular**, su **terapeuta asignado**, el **admin** | los tres son consumidores reales hoy |
| Crear | el **paciente para sí mismo** (autoadministradas) y el **terapeuta asignado a su nombre** | los dos flujos existentes: modales del paciente y `CognitiveScreeningForm` |
| Modificar | **nadie** | ningún consumidor actualiza; una evaluación es un registro puntual |
| Borrar | **nadie** | ya lo impide la ACL |
| Excluidos | `anon`, pacientes ajenos, terapeutas no asignados | |

El cambio de fondo respecto a lo escrito en el Grupo 0: la lectura del terapeuta debe apoyarse en
**`is_therapist_of(patient_id)`**, no en `auth.uid() = therapist_id`. Es la misma corrección que ya
se aplicó en `clinical_notes`, y aquí está demostrada por los datos: 40 de 40 con `therapist_id` nulo.

---

## 10. Políticas mínimas propuestas

Dos políticas **se conservan tal cual**, una **se corrige** y una **se añade**. Total: 5.

```sql
-- CONSERVAR (ya existe, funciona: medido, el paciente lee sus 10)
-- "Patients can view their own evaluations"
--   FOR SELECT TO authenticated USING (auth.uid() = patient_id)

-- CORREGIR: hoy USING (auth.uid() = therapist_id) -> 0 filas con therapist_id NULL
DROP POLICY IF EXISTS "Therapists can view evaluations of assigned patients"
  ON public.psychometric_evaluations;
CREATE POLICY "Therapists can view evaluations of assigned patients"
  ON public.psychometric_evaluations FOR SELECT TO authenticated
  USING (public.is_therapist_of(patient_id));

-- AÑADIR: paridad con la ficha del paciente, que admite therapist|admin
CREATE POLICY "Admins read all evaluations"
  ON public.psychometric_evaluations FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- CONSERVAR (ya existen)
-- "Patients can insert their own evaluations"
--   FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id)
-- "Therapists can insert evaluations for assigned patients"
--   FOR INSERT TO authenticated
--   WITH CHECK (auth.uid() = therapist_id AND is_therapist_of(patient_id))
```

Detalle por política:

| Política | Op | Cubre | Habilita | Sigue bloqueado | Trigger que complementa | Riesgo que elimina | Regresión posible |
|---|---|---|---|---|---|---|---|
| Patients view own | SELECT | `clinicalService:164`, el `RETURNING` de los 2 modales | paciente titular | pacientes ajenos | — | lectura cruzada entre pacientes | ninguna: medido, sigue leyendo 10 |
| Therapists view assigned **(corregida)** | SELECT | `getPatientEvaluations:120` | terapeuta asignado | terapeuta no asignado | — | lectura por terapeutas ajenos | **si se deja sin corregir: 0 filas silenciosas** |
| Admins read all **(nueva)** | SELECT | `getPatientEvaluations:120` como admin | admin | — | — | — | **sin ella la ficha se ve vacía, sin error** |
| Patients insert own | INSERT | `CssrsModal:126`, `PsychometricScaleModal:45` | paciente a su nombre | crear a nombre ajeno | `free_plan_evaluation_limit` sigue aplicando el límite de plan | evaluaciones fabricadas para otro | ninguna |
| Therapists insert assigned | INSERT | `CognitiveScreeningForm:52` | terapeuta asignado | terapeuta ajeno | ídem | ídem | ninguna |

**Sin política de UPDATE**: no hay consumidor, y dejarla fuera cierra la escritura que hoy permite la
ACL sin que ningún trigger la vigile. **Sin política de DELETE**: ya lo corta la ACL — conviene no
apuntárselo a RLS.

**No se duplica en RLS ninguna regla del trigger**: `free_plan_evaluation_limit` es de negocio, no de
acceso, y sigue siendo la autoridad sobre el límite de 30 días.

---

## 11. Riesgos de regresión y cómo se comprobarán

| Riesgo | Comprobación en la migración |
|---|---|
| El terapeuta deja de ver las evaluaciones (`therapist_id` NULL) | contar como terapeuta asignado: debe dar **10** por paciente y **40** en total |
| El admin ve la ficha vacía | contar como admin: **40** |
| El `INSERT ... RETURNING` de los 2 modales falla con `42501` | insertar como paciente con `RETURNING` y comprobar que devuelve `id` |
| El `INSERT` del terapeuta falla | insertar como terapeuta asignado con `therapist_id = auth.uid()` |
| El límite de plan deja de aplicarse | provocar `FREE_PLAN_EVALUATION_LIMIT` con RLS activo |
| `clinical_alerts` (FK entrante, ya con RLS) deja de resolver el `test_score_id` | comprobar el JOIN alerta→evaluación como terapeuta |
| `UPDATE`/`DELETE` | confirmar y **distinguir la capa**: 0 filas por RLS vs `42501` por ACL |

---

## 12. Criterios de parada

**Para `psychometric_evaluations`: ninguno se activa.** No hay vista que la esquive, no depende de
ninguna tabla sin modelo (`clinical_alerts` ya tiene RLS), ningún RPC depende de `bypassrls` sobre
ella, no hay columna derivada por trigger que necesite el `WITH CHECK`, y todas las pruebas se
pueden hacer en transacción revertida.

**Para `messages` sí se activan dos, y por eso no es el próximo sprint:**

- **Criterio 4 — decisión de producto.** Hoy el admin lee los 4 cuerpos de la conversación
  terapéutica. ¿Debe? En `clinical_notes` se decidió que el admin lee; una conversación de terapia
  no es lo mismo que una nota profesional. No lo doy por resuelto por analogía.
- **Criterio 7 — 0 filas silenciosas en un consumidor existente.** `messages` está en la publicación
  `supabase_realtime` y tiene **cuatro suscripciones `postgres_changes`**. Con RLS activo, Realtime
  exige política de SELECT para entregar eventos al suscriptor: sin ella, **el chat dejaría de
  actualizarse en vivo sin ningún error**. No puedo verificarlo desde SQL; su sprint necesita una
  comprobación en navegador con sesión real.

**Hallazgo adicional, sin sprint asignado:** la vista `clinical_guides_meta` es de `postgres` y
tiene `reloptions = (NULL)` — **sin `security_invoker`**, el mismo patrón que obligó a tratar
`content_items_meta` y su tabla en la misma migración. Cuando le toque a `clinical_guides`, hay que
resolverlas juntas.

---

## 13. Decisión requerida

**Diagnóstico completo. No hay bloqueo de diseño** para `psychometric_evaluations`. Queda pendiente
aprobación explícita antes de backup y migración.

Dos cosas que sí requieren tu criterio, y que **no bloquean** ese sprint:

1. **El orden.** Recomiendo `psychometric_evaluations` primero. Si prefieres atacar antes la
   suplantación de `therapist_profiles`, dímelo: el diagnóstico de esa tabla está hecho salvo la
   parte de interfaz.
2. **`messages` necesita tu decisión sobre el admin** y una verificación de Realtime en navegador
   antes de poder planificarse.

---

---

## Cierre — `psychometric_evaluations` aplicada el 13 de agosto de 2026

Sprint hecho: `20260813_psychometric_evaluations_rls.sql`, backup en
`backups/20260813_pre_psychometric_evaluations_rls.sql`. **RLS 22 → 23 de 37; políticas 79 → 80.**
Se aplicó el diseño de §10 sin cambios: 3 conservadas, 1 corregida, 1 añadida, sin UPDATE ni DELETE.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Psychometric Evaluations — RLS»*.

**Lo que este diagnóstico anticipó y se confirmó al aplicar:** la política del terapeuta escrita en el
Grupo 0 daba 0 filas por el `therapist_id` NULL, y sin política de admin la ficha quedaba vacía. Con
la corrección a `is_therapist_of(patient_id)` y la de admin, terapeuta y admin leen las 40.

**Sigue pendiente de este documento:** `messages` (§12, dos criterios de parada) y
`therapist_profiles` (§4, suplantación). Las 12 restantes conservan la clasificación de §1.

## Estado final del diagnóstico

```
RLS activo: 22/37
FORCE: 0/37
políticas: 79
ACL: sin cambios          triggers: sin cambios     FK: sin cambios
funciones: sin cambios    índices: sin cambios      vistas: sin cambios
datos permanentes: sin cambios
frontend: sin cambios     RPC: sin cambios          commits: 0
```
