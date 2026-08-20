# Diagnóstico RLS — `public.therapist_contact_requests`

**Fecha:** 2026-08-14
**Alcance:** solo lectura. **Sin migración, sin RLS, sin políticas.** No se modificó ACL, triggers,
funciones, RPC, vistas, frontend, Realtime ni datos. Toda la siembra en transacciones revertidas.

Baseline al abrir y al cerrar — **idéntico**: 0 filas, ACL `c9a0182c…`, FK `cfb70692…`,
índices `6da61f8c…`, triggers `3ca1288a…`, funciones `e5e288e7…`, vistas `b23db2e2…`.
RLS 27/37, 88 políticas, FORCE 0.

---

## 1. Baseline

```
relrowsecurity = false · relforcerowsecurity = false · reloptions = (NULL) · owner = postgres
políticas = 0 · filas = 0 (TABLA VACÍA) · triggers = 5
FK salientes = 2 · FK entrantes = 1 · índices = 4
vistas dependientes = 0 · Realtime/Broadcast = 0 · funciones de public que la citan = 3
ACL: postgres=arwdDxtm · service_role=arwdDxtm · authenticated=aw   -> anon: NADA
```

**La tabla está vacía.** Todo lo medido en §5 y §6 exigió sembrar dentro de transacción revertida;
queda declarado como artefacto.

**CHECKs:** `message <= 1000` y **`patient_id <> therapist_profile_id`** (no hay autosolicitud).
**Enum `contact_request_status`:** `pending, accepted, rejected, cancelled`.
**Índices:** por paciente, por terapeuta, y **un único parcial
`idx_contact_requests_una_pendiente`** que impide dos solicitudes pendientes del mismo par.

**FK salientes:** `patient_id → profiles(id) CASCADE` y
`therapist_profile_id → therapist_profiles(profile_id) CASCADE`.

**FK entrante (1):** `patient_therapist.contact_request_id → therapist_contact_requests(id) SET NULL`.
**`patient_therapist` ya tiene RLS y 4 políticas** — el criterio de parada 11 no se activa.

> **Discrepancia con mi propio guion, aclarada:** mi valor esperado decía `FK entrantes = 0`; el
> catálogo dice **1**. La huella global de FK no cambió (`cfb70692…`), así que **no hubo cambio de
> estado: el valor equivocado era mío**, copiado mal del inventario de las 15 tablas.

---

## 2. Modelo de datos

| Columna | Papel |
|---|---|
| `patient_id` | **el solicitante** |
| `therapist_profile_id` | **el terapeuta destinatario** |
| `status` | `pending` → `accepted` \| `rejected` \| `cancelled` |
| `message` | texto opcional del paciente, ≤ 1000 |
| `created_at` / `updated_at` | timestamps |

**El flujo es paciente → terapeuta**, y está confirmado por medición, no por el nombre: el trigger
exige `NEW.patient_id = auth.uid()` en el alta, y la transición de estado distingue explícitamente
`quien = OLD.patient_id` (solo cancelar) de `quien = OLD.therapist_profile_id` (solo aceptar o
rechazar).

**No hay columna «creado por» ni «modificado por»:** el ownership es `patient_id`, y la legitimidad
del destinatario es `therapist_profile_id`. **Las dos partes son actores legítimos de la fila**, con
verbos distintos.

Aceptar tiene un efecto lateral: `create_relationship_on_accept` [DEFINER] crea —o reactiva— la fila
de `patient_therapist` dentro de la misma transacción. Verificado: al aceptar, la relación aparece.

---

## 3. Consumidores

**Cuatro, todos en `src/lib/api/therapistContactService.ts`. Ninguna Edge Function, ningún cron.**

| Archivo:línea | Operación | Columnas | Filtros | `.select()` | Actor |
|---|---|---|---|---|---|
| `:116` `createContactRequest` | **INSERT directo** | `patient_id` (de la sesión), `therapist_profile_id`, `message` | — | **no** | paciente |
| `:95` `cambiarEstado` | **UPDATE directo** | `status` | `id = X` | **no** | paciente (cancelar) y terapeuta (aceptar/rechazar) |
| `:148` `listPatientRequests` | **RPC** `list_my_contact_requests()` | 7 | `patient_id = auth.uid()` | — | paciente |
| `:163` `listTherapistRequests` | **RPC** `list_received_contact_requests()` | 7 | dentro de la función | — | terapeuta |

`cambiarEstado` es el único punto de cambio de estado; lo usan `cancelContactRequest`,
`acceptContactRequest` y `rejectContactRequest`.

Pantallas: `MisSolicitudes.tsx` (el paciente cancela) y `MatchingPreview.tsx` (el paciente crea).

**Ningún consumidor usa `.select()` ni `RETURNING`.** Hay una cuarta RPC, `get_contact_request(p_id)`,
que existe en la base pero **ningún consumidor de `src/` la llama** — queda anotada.

---

## 4. Triggers y autorización existente

Cinco. Medidos **con RLS apagado**, así que nada es atribuible a RLS.

`enforce_contact_request_rules` [`DEFINER`, `BEFORE INSERT OR UPDATE`] es un modelo de autorización
completo:

**En el alta:**

```
paciente crea la SUYA ............ OK
paciente crea a NOMBRE AJENO ..... P0001 CONTACT_REQUEST_FORBIDDEN
paciente crea ya ACEPTADA ........ P0001 CONTACT_REQUEST_INVALID_INITIAL_STATUS
ADMIN crea por un paciente ....... P0001 CONTACT_REQUEST_FORBIDDEN
```

**En la edición** — con el actor emparejado con su solicitud:

```
1) el SOLICITANTE cancela la SUYA ....... 1 fila   PASA
2) el SOLICITANTE se auto-acepta ........ P0001 CONTACT_REQUEST_PATIENT_CAN_ONLY_CANCEL
3) un PACIENTE AJENO cancela la de otro . P0001 CONTACT_REQUEST_FORBIDDEN
4) un TERAPEUTA AJENO acepta ............ P0001 CONTACT_REQUEST_FORBIDDEN
5) el ADMIN acepta ...................... P0001 CONTACT_REQUEST_FORBIDDEN
6) el TERAPEUTA DESTINATARIO acepta ..... 1 fila   PASA  (+ crea la relación)
7) el TERAPEUTA cancela (no le toca) .... P0001 CONTACT_REQUEST_THERAPIST_CAN_ONLY_RESOLVE
```

**Campos inmutables:** `patient_id`, `therapist_profile_id`, `created_at` y `message` →
`CONTACT_REQUEST_IMMUTABLE`. Verificado.

**Hallazgo: el trigger frena también al sistema.** `CONTACT_REQUEST_CLOSED` y
`CONTACT_REQUEST_APPEND_ONLY` están **fuera** de la rama `es_sistema`:

```
service_role reabre una CERRADA ... P0001 CONTACT_REQUEST_CLOSED
service_role BORRA ................ P0001 CONTACT_REQUEST_APPEND_ONLY
```

La tabla es **append-only y de una sola transición, para todos**, incluido `service_role`. No es un
defecto: es coherente con que una solicitud resuelta sea un hecho histórico.

*(Aislado: en una primera pasada el «reabre» salió de un `UPDATE` que afectó a 0 filas porque la
solicitud seguía en `pending`. Repetido con la fila ya `cancelled`, el trigger frena.)*

---

## 5. Actores y operaciones actuales

**Lectura, columna a columna, con una solicitud sembrada:**

```
actor            id       patient_id  status   message
solicitante      1 f      42501       42501    42501
paciente ajeno   1 f      42501       42501    42501
terap. destino   1 f      42501       42501    42501
terap. ajeno     1 f      42501       42501    42501
admin            1 f      42501       42501    42501
anon             42501 permission denied — ACL, sin ningún grant
service_role     1 f con message — bypassrls
```

**Solo `id` es legible, y por nadie más que `authenticated`.** Todo lo demás —quién solicita, a
quién, en qué estado y qué dice— está cerrado por **ACL de columna**.

**Las 3 RPC, pasada limpia:**

```
solicitante   list_my_contact_requests ....... 1   OK
solicitante   list_received_contact_requests . 0   OK: no es terapeuta
solicitante   get_contact_request(la suya) ... 1   OK
terap.destino list_received_contact_requests . 1   OK
terap.destino get_contact_request ............ 1   OK
paciente ajeno list_my_contact_requests ...... 0   OK
paciente ajeno get_contact_request(ajena) .... 0   OK: no la ve
admin          get_contact_request ........... 0   el admin tampoco la ve
```

Las tres son `SECURITY DEFINER` de `postgres` con `bypassrls` y filtran por `auth.uid()` en su
cuerpo. **RLS ni las rompe ni las protege.**

---

## 6. Riesgos reales

Respondiendo una por una a las preguntas de la Fase 6:

| Pregunta | Respuesta medida |
|---|---|
| ¿Un paciente lee solicitudes de otros? | **Solo su `id`.** No el paciente, ni el estado, ni el mensaje |
| ¿Un terapeuta lee las dirigidas a otro? | ídem: solo el `id` |
| ¿Un tercero inserta solicitudes? | **No a nombre ajeno**: `CONTACT_REQUEST_FORBIDDEN` |
| ¿Un paciente se hace pasar por otro? | **No.** El trigger exige `patient_id = auth.uid()` |
| ¿Un terapeuta modifica solicitudes ajenas? | **No.** `CONTACT_REQUEST_FORBIDDEN` |
| ¿Alguien no autorizado cambia el estado? | **No.** Ni el admin |
| ¿Se puede borrar? | **No.** ACL para `authenticated`, y `CONTACT_REQUEST_APPEND_ONLY` incluso para `service_role` |

**La exposición real, dicha sin inflarla: cualquier `authenticated` puede leer el `id` —un UUID
opaco— de todas las solicitudes, y por tanto contar cuántas hay.** Nada más. No revela quién, a
quién, en qué estado ni el texto.

Es **la exposición más estrecha de todo el plan de RLS**, más aún que la de `notifications` —que al
menos filtraba `user_id`, es decir, *quién*—. Y conocer un `id` no habilita nada: `get_contact_request`
lo filtra por `auth.uid()` y el `UPDATE` lo corta el trigger. Ambos verificados.

---

## 7. ACL por tabla y por columna

| Columna | `anon` | `authenticated` |
|---|---|---|
| `id` | — | **SELECT** + INSERT + UPDATE |
| `patient_id`, `therapist_profile_id`, `status`, `message`, `created_at`, `updated_at` | — | INSERT + UPDATE |

- **`anon` no tiene absolutamente nada** (0 grants).
- `authenticated` tiene **15 grants**: INSERT y UPDATE sobre las 7 columnas, y **SELECT sobre una
  sola**.
- **No tiene DELETE en ninguna columna.**

**Sí, es la misma asimetría de `notifications`, y más extrema:** allí se leían 3 columnas de 10; aquí
1 de 7. En ambos casos la ACL de tabla (`-aw-`) no explica nada por sí sola.

---

## 8. Consumidores y riesgos de regresión

| Flujo | Consumidor | Riesgo con las políticas propuestas |
|---|---|---|
| Crear solicitud | `createContactRequest:116` (INSERT) | cubierto por la política de INSERT |
| Cancelar | `cambiarEstado:95` como paciente | cubierto por la de UPDATE |
| Aceptar / rechazar | `cambiarEstado:95` como terapeuta | cubierto por la de UPDATE |
| Listar propias | RPC | **ninguno**: DEFINER, `bypassrls` |
| Listar recibidas | RPC | ídem |

**Ningún consumidor usa `.select()` ni `RETURNING`** — es el segundo sprint seguido en que esa regla
no interviene.

Riesgo residual: si algún día se añadiera una pantalla que leyese la tabla directamente sin ser
parte, recibiría **0 filas en silencio**. Hoy no existe.

---

## 9. Modelo RLS propuesto

| Acción | Quién | Cómo queda hoy | Qué añadiría RLS |
|---|---|---|---|
| SELECT | **solicitante y terapeuta destinatario** | cualquiera lee el `id` de todas | cierra ese `id` |
| INSERT | **solo el solicitante, a nombre propio** | ya cerrado por trigger | segunda capa |
| UPDATE | **las dos partes**, cada una con su verbo | ya cerrado por trigger | segunda capa |
| DELETE | **nadie** | ya cerrado por ACL **y** por trigger | nada |

`anon` no necesita política: no tiene privilegios. `service_role` tampoco: `bypassrls`.

**Sin decisión de producto pendiente.** El admin no tiene consumidor, y el trigger ya le niega crear
y resolver; no se le crea política, igual que en `notifications`.

---

## 10. Políticas mínimas propuestas

**Tres.**

```sql
-- 1. Lectura: las dos partes de la solicitud.  <-- LO ÚNICO QUE RLS APORTA
CREATE POLICY "Parties read their contact requests"
  ON public.therapist_contact_requests FOR SELECT TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_profile_id);

-- 2. Alta: solo el solicitante, a nombre propio.
--    Duplica lo que ya hace enforce_contact_request_rules
--    (CONTACT_REQUEST_FORBIDDEN). Defensa en profundidad.
CREATE POLICY "Patients create their own contact request"
  ON public.therapist_contact_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id);

-- 3. Resolución: las dos partes.
--    QUÉ transición puede hacer cada una lo sigue decidiendo el trigger:
--    el paciente solo 'cancelled', el terapeuta solo 'accepted'/'rejected',
--    y solo desde 'pending'. Esta política decide SOBRE QUÉ FILA se escribe.
CREATE POLICY "Parties resolve their contact request"
  ON public.therapist_contact_requests FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_profile_id)
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_profile_id);
```

| Política | Actor | Consumidor | Trigger complementario | Riesgo cerrado |
|---|---|---|---|---|
| 1 SELECT | las dos partes | ninguno lee directo (van por RPC) | — | lectura del `id` ajeno |
| 2 INSERT | solicitante | `createContactRequest:116` | `CONTACT_REQUEST_FORBIDDEN`, `INVALID_INITIAL_STATUS` | ninguno nuevo |
| 3 UPDATE | las dos partes | `cambiarEstado:95` | `PATIENT_CAN_ONLY_CANCEL`, `THERAPIST_CAN_ONLY_RESOLVE`, `CLOSED`, `IMMUTABLE` | ninguno nuevo |

**Sin DELETE:** la ACL ya lo cierra y el trigger es la red para `service_role`.

---

## 11. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | ¿No está claro el propietario? | **Claro:** `patient_id` |
| 2 | ¿No está claro el destinatario? | **Claro:** `therapist_profile_id` |
| 3 | ¿No está claro quién cambia el estado? | **Claro y medido:** paciente solo cancela, terapeuta solo acepta/rechaza, nadie más |
| 4 | ¿Consumidor no documentado? | **No.** Los 4 localizados. Se anota que `get_contact_request` existe sin consumidor en `src/` |
| 5 | ¿Una vista esquiva RLS? | **No.** Cero vistas |
| 6 | ¿Realtime? | **No** |
| 7 | ¿Broadcast? | **No** |
| 8 | ¿Alguna RPC DEFINER contradice el modelo? | **No.** Las 3 filtran por `auth.uid()`, verificado. **Documentado que RLS no las gobierna** |
| 9 | ¿Alguna operación depende de ACL por columna no documentada? | **Sí depende, y queda documentada en §7.** Es lo que hoy limita la lectura a `id` |
| 10 | ¿Algún `0 filas` ambiguo? | **No.** El único —el «reabre» de `service_role`— se aisló: era un `UPDATE` de 0 filas |
| 11 | ¿Dependencia con tabla sin modelo RLS? | **No.** La FK entrante viene de `patient_therapist`, que ya tiene RLS y 4 políticas |
| 12 | ¿Requeriría cambiar frontend? | **No** |
| 13 | ¿Requeriría cambiar funciones o triggers? | **No** |
| 14 | ¿Decisión de producto sobre acceso? | **No.** El admin no tiene consumidor y el trigger ya le niega todo |

**Ninguno bloquea.**

---

## 12. Decisión requerida

- **¿Está preparada para RLS?** **Sí.** Caso limpio: sin vistas, sin Realtime, sin `RETURNING`, con
  la FK entrante apuntando a una tabla ya protegida.
- **¿Quién puede leer?** El solicitante y el terapeuta destinatario.
- **¿Quién puede crear?** Solo el solicitante, a nombre propio.
- **¿Quién puede modificar?** Las dos partes, cada una con su verbo — y eso lo sigue decidiendo el
  trigger, no RLS.
- **¿Quién puede eliminar?** Nadie, ni `service_role`.
- **¿Cuántas políticas?** **Tres**: SELECT, INSERT y UPDATE. Sin DELETE.
- **¿Decisión de producto pendiente?** **No.**

**Una salvedad de honestidad sobre el valor, para que decidas con la cifra delante:** de las tablas
del plan, esta es en la que **RLS aporta menos**. Lo único que cierra es la lectura de un UUID opaco
—el `id`— y, con él, el número de solicitudes existentes. Todo lo demás ya lo cubren la ACL por
columna y un trigger que, medido caso por caso, es el control de autorización más completo de la base.

No es razón para no hacerlo —el coste son 3 políticas, ningún consumidor afectado y coherencia con
las otras 27 tablas—, pero sí para no presentarlo como el cierre de una fuga grave. **No lo es.**

---

---

## Cierre — aplicado el 14 de agosto de 2026

Diseño aprobado sin cambios y aplicado en `20260814_therapist_contact_requests_rls.sql`, con backup
en `backups/20260814_pre_therapist_contact_requests_rls.sql`.
**RLS 27 → 28 de 37; políticas 88 → 91.** Las tres políticas de §10, sin DELETE.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Therapist Contact Requests — RLS»*.

**Todo lo que este diagnóstico anticipó se confirmó**, incluida la salvedad sobre el valor: lo único
que se cerró fue la lectura del `id` ajeno. Las otras cuatro columnas siguen en `42501` por ACL de
columna, y las diez comprobaciones de transición confirman que **el trigger sigue siendo la autoridad**
—los casos «el solicitante se auto-acepta» y «el terapeuta intenta cancelar» prueban que RLS deja
llegar a la fila y es el trigger el que rechaza—.

La integración con `patient_therapist` quedó verificada: al aceptar, el trigger DEFINER creó la
relación dentro de la misma transacción y **la RLS ya existente de `patient_therapist` no la rompe**.

**Corrección de nomenclatura respecto al prompt de aplicación:** pedía
`auth.uid() = therapist_id`; la columna real es **`therapist_profile_id`**. Se aplicó con el nombre
real, que es el de este diagnóstico.

## Estado del diagnóstico

```
RLS activo: 27/37 · FORCE: 0/37 · políticas: 88
ACL: sin cambios · triggers: sin cambios · FK: sin cambios · funciones: sin cambios
índices: sin cambios · vistas: sin cambios · datos permanentes: sin cambios (la tabla sigue en 0 filas)
frontend: sin cambios · RPC: sin cambios · Realtime: sin cambios · commits: 0
```

**ARTEFACTOS DE PRUEBA, declarados:** la tabla está vacía, así que hubo que sembrar solicitudes para
medir; y como solo existe un terapeuta real, se ascendió temporalmente a `therapist` un paciente y se
le creó un `therapist_profiles`. Todo dentro de transacciones revertidas; la tabla vuelve a 0 filas y
`therapist_profiles` a 1.

**ERRORES DE GUION, declarados, ninguno con efecto sobre la base:**
1. Mi valor esperado de `FK entrantes` decía 0; el real es 1. Aclarado en §1.
2. Un `SELECT ... WHERE patient_id` ejecutado aún como `authenticated` dio `42501`: esa columna no es
   legible **ni siquiera en un `WHERE`**. Corregido, y de paso confirma §7.
3. La primera batería de transiciones sembró cada solicitud con un paciente **que no era el actor**,
   así que los seis casos dieron `FORBIDDEN` por la razón equivocada. **Se rehízo emparejando actor y
   solicitud**, y los resultados de §4 son los de esa segunda pasada.

**RESULTADOS INCONCLUYENTES:** ninguno tras los aislamientos.
