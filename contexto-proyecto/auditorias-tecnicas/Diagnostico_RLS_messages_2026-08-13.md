# Diagnóstico RLS — `public.messages`

**Fecha:** 2026-08-13
**Alcance:** solo lectura. **Sin migración, sin RLS permanente, sin políticas permanentes.** No se
modificó ACL, triggers, funciones, vistas, frontend, Realtime ni datos. Todas las simulaciones dentro
de transacciones revertidas.

Baseline al abrir y al cerrar — **idéntico**: huella de datos `1f87312b…`, ACL `c9a0182c…`,
FK `cfb70692…`, índices `6da61f8c…`, triggers `3ca1288a…`, funciones `e5e288e7…`,
políticas `8757768b…`. RLS 25/37, 83 políticas, FORCE 0.

---

## 1. Baseline

```
relrowsecurity = false · relforcerowsecurity = false · reloptions = (NULL) · owner = postgres
políticas = 0 · filas = 4 (una sola conversación) · triggers = 6
FK salientes = 4 · FK entrantes = 0 · índices = 5 · vistas que la proyectan = 0
publicaciones Realtime = 2 · funciones de public que la citan = 4
ACL: postgres=arwdDxtm · authenticated=arwm · service_role=arwdDxtm
     -> anon ---- (ningún privilegio) · authenticated raw- (SIN DELETE)
huella de datos = 1f87312bbde81f5ec1bf55ca0c07f3ba
```

**Columnas:** `id, patient_id, therapist_id, sender_id, body, read_at, created_at, relationship_id,
updated_at`.

**CHECKs, y son relevantes:**
- `messages_body_check`: el cuerpo no puede estar vacío.
- `messages_sender_is_participant`: **`sender_id = patient_id OR sender_id = therapist_id`**. La
  pertenencia ya está garantizada a nivel de esquema.

**Índices:** los cuatro no-pkey están construidos sobre `(patient_id, therapist_id)`,
`(relationship_id)` y los no leídos. El modelo de acceso por participante ya está indexado.

**Publicaciones:** `supabase_realtime` y `supabase_realtime_messages_publication`, ambas con
insert/update/delete/truncate.

---

## 2. Consumidores

**16 puntos. Ninguna Edge Function. Ninguna vista.**

### Lectura — **toda por RPC `SECURITY DEFINER`** (endurecimiento previo, vigilado por `hardening.test.ts`)

| Consumidor | RPC | Actor |
|---|---|---|
| `messagesService.ts:36` `getConversationByPair` | `list_pair_messages(p_patient_id, p_therapist_id)` | terapeuta (ChatThread) |
| `messagesService.ts:193` `listMessages` | `list_relationship_messages(p_relationship_id)` | paciente |
| `messagesService.ts:106` y `:113` | `count_my_unread_messages()` | ambos |
| `messagesService.ts:126` | `list_my_conversations()` | **terapeuta** (ver §7) |

**Las cuatro filtran por `auth.uid()` dentro del cuerpo** — medido. Son DEFINER de `postgres`, con
`bypassrls`: **RLS no las afecta ni las protege.** Es el límite del sprint 4Q.

### Escritura — **directa sobre la tabla**

| Consumidor | Op | `.select()` | Actor |
|---|---|---|---|
| `messagesService.ts:182` `sendMessage` | INSERT (`relationship_id`, `body`) | no | paciente |
| `messagesService.ts:72` `sendMessageByPair` | INSERT (`patient_id`, `therapist_id`, `sender_id`, `body`) | **`.select("*").single()` → RETURNING** | terapeuta |
| `messagesService.ts:217` `markAsRead` | UPDATE `read_at` | no | ambos |
| `messagesService.ts:92` `markConversationAsReadByPair` | UPDATE `read_at` | no | terapeuta |

### Realtime — 4 suscripciones `postgres_changes`, todas `event: INSERT`

| Archivo:línea | Filtro | UI que actualiza |
|---|---|---|
| `PatientDashboard.tsx:157` | `patient_id=eq.<yo>` | insignia de no leídos del paciente |
| `TherapistDashboard.tsx:149` | `therapist_id=eq.<yo>` | insignia de no leídos del terapeuta |
| `ChatThread.tsx:67` | `patient_id=eq.<paciente>` | mensajes entrantes en el hilo |
| `TherapistMessages.tsx:50` | `therapist_id=eq.<yo>` | bandeja del terapeuta |

**Los cuatro filtran por una de las dos partes de la conversación.** Ese detalle decide §6.

### Rutas vivas

- **Paciente:** `conversacion.$relationshipId.tsx` → `getConversation`, `markAsRead`, `sendMessage`.
- **Terapeuta:** `TherapistMessages.tsx` → `getTherapistConversations` + `ChatThread`, que usa las
  funciones heredadas `*ByPair`.

---

## 3. Modelo de participantes

Cada mensaje tiene **tres uuid de persona y uno de hilo**:

- `patient_id` y `therapist_id` — **las dos partes**;
- `sender_id` — quién escribió, **forzado por trigger a `auth.uid()`** y restringido por CHECK a ser
  una de las dos partes;
- `relationship_id` → `patient_therapist(id)` — el hilo.

**No hay «destinatario» explícito**: el destinatario es la otra parte. Y `sender_id` **no aporta
autorización de lectura**: en una conversación de dos, quien envía y quien recibe deben ver lo mismo.

| Acción | Quién debería |
|---|---|
| Leer un mensaje | **las dos partes de esa conversación** |
| Ver la conversación completa | ídem |
| Enviar | ídem, y solo a nombre propio |
| Editar el cuerpo | **nadie** — ya lo impide `MESSAGE_IMMUTABLE` |
| Marcar como leído | las dos partes, solo lo que no envió uno mismo |
| Borrar | **nadie** — `MESSAGE_APPEND_ONLY` + ACL |

---

## 4. Acceso del admin — la decisión de producto, medida

```
referencias a messages en AdminDashboard.tsx ... 0
referencias a messages en adminService.ts ...... 0
las 4 RPC de mensajería filtran por auth.uid() . las 4
```

**Ninguna pantalla, ningún servicio y ninguna RPC dan al admin acceso a los mensajes.** Su lectura
actual —4 cuerpos, medido— viene **exclusivamente del acceso directo a la tabla**, que existe porque
`authenticated` tiene `SELECT` y no hay RLS.

**La respuesta medida es la opción C: no hay consumidor real, y la capacidad es implícita.**

No lo decido por analogía con `clinical_notes` —donde el admin **sí** lee, porque la ficha del
paciente lo consume—. Aquí no hay nada que consuma. Y hay una diferencia de fondo que conviene
nombrar: una nota clínica es un documento profesional *sobre* el paciente; una conversación
terapéutica es un intercambio *entre* dos personas. Que el administrador de la plataforma pueda leer
lo que un paciente le escribe a su terapeuta no es lo mismo que leer el informe del terapeuta.

**Recomiendo cerrarlo** (equivale a la opción B en el modelo de políticas). Si en el futuro hiciera
falta un caso de soporte o moderación, debería construirse como una función explícita y auditada, no
como un efecto colateral de la ACL. **Es una decisión tuya; no la doy por tomada.**

---

## 5. Triggers

Seis. Medidos **con RLS apagado**, así que ningún resultado es atribuible a RLS:

| Intento | Resultado | Capa |
|---|---|---|
| tercero escribe en conversación ajena | `MESSAGE_FORBIDDEN` | trigger |
| tercero marca leído lo ajeno | `MESSAGE_FORBIDDEN` | trigger |
| tercero edita el cuerpo | `MESSAGE_IMMUTABLE` | trigger |
| tercero borra | `42501 permission denied` | **ACL** |
| paciente escribe en la suya | OK | — |

- `enforce_message_insert` [DEFINER]: **fuerza `NEW.sender_id := auth.uid()`**, deriva
  `patient_id`/`therapist_id` desde `relationship_id` (o al revés en el camino heredado), exige
  relación `active` y pertenencia.
- `enforce_message_update` [DEFINER]: hace inmutables `body`, `sender_id`, las dos partes,
  `relationship_id` y `created_at`; **solo `read_at` puede cambiar**, y solo dentro de la propia
  conversación.
- `enforce_message_no_delete` [INVOKER]: `MESSAGE_APPEND_ONLY`. **Nunca se ejecuta para
  `authenticated`**: la ACL corta antes.
- `notify_message_sent` y los dos de broadcast: notificación, no autorización.

**La escritura ya está completamente cubierta.** Lo único que falta es la lectura.

---

## 6. Realtime — el criterio de parada, resuelto

**Se resolvió leyendo el código que realmente se ejecuta, no asumiendo.** `realtime.apply_rls` existe
en este proyecto y es la función que Realtime usa para filtrar el WAL antes de repartir eventos de
`postgres_changes`. Sus líneas decisivas:

```
if not is_rls_enabled or action = 'DELETE' then
    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
else
    perform set_config('role', trim(both '"' from working_role::text), true),
            set_config('request.jwt.claims', claims::text, true);
    execute 'execute walrus_rls_stmt' into subscription_has_access;
    perform set_config('role', null, true);
    if subscription_has_access then
        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
```

Traducido:

- **Con RLS apagado** (`not is_rls_enabled`), toda suscripción que pase sus filtros recibe el evento.
- **Con RLS activo**, Realtime **asume el rol y los claims del suscriptor** y prueba la fila contra
  las políticas. Solo entrega el evento si RLS le permitiría hacer `SELECT` de esa fila.

Además comprueba `has_column_privilege(working_role, entity, columna, 'SELECT')` — `authenticated`
tiene `SELECT` de tabla, así que eso se cumple.

**Conclusión: activar RLS sin política de `SELECT` dejaría las cuatro suscripciones sin eventos, en
silencio.** Con una política de participantes, las cuatro siguen funcionando, porque **cada una
filtra por `patient_id` o `therapist_id`, que es exactamente lo que la política deja ver**.

**Precedente en este mismo proyecto:** `clinical_alerts` está en la misma publicación
`supabase_realtime`, tiene **RLS activo desde el 12-ago y 3 políticas de SELECT**, y alimenta dos
suscripciones `postgres_changes` (`PatientDashboard.tsx:137`, `TherapistDashboard.tsx:216`). La
combinación ya está en producción.

> ⚠️ **Lo que esto NO demuestra.** Leer `apply_rls` demuestra el mecanismo; **no** demuestra la
> entrega extremo a extremo por WebSocket. `realtime.subscription` tenía **0 filas** al medir —nadie
> conectado—, así que no pude observar una suscripción viva. Una comprobación en navegador sigue
> siendo aconsejable antes de dar el chat por validado, pero **el mecanismo ha dejado de ser una
> incógnita**: ya no es un criterio de parada.

**El segundo canal, independiente:** `trg_message_broadcast_insert` y `_read` llaman a
`broadcast_message_event` [DEFINER], que hace
`realtime.send(cuerpo, evento, 'user:'||uuid, private => true)`. Eso es **Broadcast**, no
`postgres_changes`: va por `realtime.messages` (tabla particionada, con su propia RLS) y **no depende
de la RLS de `public.messages`**. La función además envuelve el envío en un `EXCEPTION WHEN OTHERS →
NULL`: un aviso perdido no tumba el mensaje ya guardado.

---

## 7. Simulación

Todas en transacción revertida. **Lecturas antes que escrituras**, tras la lección de sprints
anteriores.

**A) RLS activo, sin ninguna política:**

```
paciente lee ........................ 0    <<< CHAT ROTO
RPC list_relationship_messages ...... 5 filas   sigue: DEFINER de postgres (bypassrls)
INSERT sendMessage:182 .............. 42501 violates row-level security policy
```

**B) RLS + las 3 políticas candidatas** (lecturas limpias, 4 mensajes reales):

```
paciente de la conversación ....  4 cuerpos   esperado 4   OK
terapeuta de la conversación ...  4 cuerpos   esperado 4   OK
paciente AJENO .................  0 cuerpos   esperado 0   OK
tercero ........................  0 cuerpos   esperado 0   OK
admin ..........................  0 cuerpos   esperado 0   OK  (ver §4)
```

**Consumidores con las 3 políticas:**

```
sendMessage:182 INSERT .............. OK
sendMessageByPair:72 INSERT+RETURN .. OK    <- el RETURNING exige la de SELECT
markAsRead:217 UPDATE ............... ver aislamiento 2
RPC list_relationship_messages ...... OK
RPC count_my_unread_messages ........ OK
RPC list_pair_messages .............. OK
RPC list_my_conversations (terap.) .. 1 fila
```

**Negativos — el trigger sigue siendo la autoridad de escritura:**

```
tercero escribe en conversación ajena .. P0001 MESSAGE_FORBIDDEN     trigger
participante edita el cuerpo ........... P0001 MESSAGE_IMMUTABLE     trigger
participante borra ..................... 42501 permission denied     ACL
tercero marca leído lo ajeno ........... 0 filas                     RLS (antes: trigger)
```

### Ambigüedades aisladas

**1. `list_my_conversations` devolvía 0 al paciente.** Aislado **con RLS apagado**: paciente 0,
terapeuta 1. **No es RLS**: es la bandeja del terapeuta, consumida por `getTherapistConversations` en
`TherapistMessages.tsx`. El 0 del paciente es correcto.

**2. `markAsRead` devolvía 0 filas.** Aislado: **los 4 mensajes reales ya están leídos**
(`read_at IS NULL` en 0 de ellos), así que el `UPDATE` no tenía a qué aplicarse. Prueba forzada
dejando 2 sin leer:

```
RLS OFF ............... 2 filas
RLS ON + políticas .... 2 filas      idénticos -> RLS no lo rompe
```

**3. Contaminación en la primera pasada:** mis propios `INSERT` de la Fase 5 inflaron los conteos de
la Fase 7 (5 en vez de 4). Se repitió la batería con las lecturas primero; las cifras de arriba son
las limpias.

---

## 8. Políticas mínimas propuestas

**Tres. Ninguna de escritura duplica al trigger: deciden *sobre qué fila*, no *qué escritura es
válida*.**

```sql
-- 1. Lectura: las dos partes de la conversación.
--    Es la que hace falta para el chat, para el RETURNING de sendMessageByPair
--    y para que Realtime siga entregando eventos a los 4 suscriptores.
CREATE POLICY "Participants read their conversation"
  ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_id);

-- 2. Envío: solo dentro de una conversación propia.
--    Quién es el remitente lo sigue forzando enforce_message_insert
--    (NEW.sender_id := auth.uid()); esta política decide en qué hilo se escribe.
CREATE POLICY "Participants send in their conversation"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_id);

-- 3. Marcado de leído: solo dentro de una conversación propia.
--    Qué se puede cambiar lo sigue decidiendo enforce_message_update:
--    solo read_at; el cuerpo es inmutable.
CREATE POLICY "Participants update their conversation"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = therapist_id)
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = therapist_id);
```

**Sin `DELETE`**, deliberadamente: `authenticated` no tiene `d` y el trigger `MESSAGE_APPEND_ONLY`
es la red para `service_role`. **Hoy lo corta la ACL, no RLS.**

**Sin política para el admin**, según §4 — pendiente de tu confirmación.

**Sin política para `anon`:** no tiene ningún privilegio sobre la tabla.

| Política | Cubre | Habilita | Bloquea | Qué sigue haciendo el trigger |
|---|---|---|---|---|
| SELECT | el chat, el `RETURNING` de `:72`, **y Realtime** | las dos partes | terceros, pacientes ajenos, admin | — |
| INSERT | `sendMessage:182`, `sendMessageByPair:72` | las dos partes | terceros (ya lo hacía el trigger) | fuerza `sender_id`, exige relación `active` |
| UPDATE | `markAsRead:217`, `markConversationAsReadByPair:92` | las dos partes | terceros | inmutabilidad del cuerpo |

---

## 9. Riesgos

| Riesgo | Evaluación |
|---|---|
| **Sin política de SELECT, Realtime se apaga en silencio** | demostrado por el código de `apply_rls`. Es el riesgo principal |
| El `RETURNING` de `sendMessageByPair:72` | cubierto por la de SELECT; medido |
| Las 4 RPC | no se ven afectadas: DEFINER de `postgres`, `bypassrls`. **Tampoco protegen** |
| El admin pierde lectura | es el objetivo de §4, pendiente de confirmación |
| `markAsRead` | verificado con prueba forzada: 2 = 2 |
| El canal de Broadcast | independiente de esta RLS; no se toca |
| Entrega real por WebSocket | **no verificable desde SQL.** Requiere navegador |

---

## 10. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | ¿No puede determinarse la regla del admin? | **Determinada por evidencia (opción C).** Falta tu confirmación, no más medición |
| 2 | ¿Realtime no puede validarse? | **Resuelto.** El mecanismo se leyó en `apply_rls`. Queda pendiente solo la comprobación en navegador |
| 3 | ¿RLS rompe el chat? | **No**, con las 3 políticas. Medido |
| 4 | ¿Requiere cambiar frontend? | **No** |
| 5 | ¿Requiere cambiar RPC? | **No** |
| 6 | ¿Requiere cambiar triggers? | **No** |
| 7 | ¿Requiere cambiar funciones? | **No** |
| 8 | ¿Alguna vista esquiva RLS? | **No.** Cero vistas proyectan `messages` |
| 9 | ¿El acceso por participante no es expresable? | **Es expresable**, y el CHECK del esquema ya lo respalda |
| 10 | ¿Algún `0 filas` ambiguo? | **No.** Los tres aislados |
| 11 | ¿Algún `42501` ambiguo? | **No.** Separados ACL / RLS / trigger en cada caso |
| 12 | ¿Dependencia no documentada? | **Sí, una, y queda documentada:** el canal de Broadcast por `realtime.send`, que no dependía de esta RLS |

**Ninguno bloquea. Queda una decisión de producto, no una incógnita técnica.**

---

## 11. Decisión requerida

- **¿`messages` está preparada para RLS?** **Sí.** Los dos criterios que la bloqueaban están
  resueltos: el mecanismo de Realtime se midió leyendo `apply_rls`, y el acceso del admin tiene
  respuesta con evidencia.
- **¿Qué políticas necesita?** **Tres**: SELECT, INSERT y UPDATE, todas
  `auth.uid() = patient_id OR auth.uid() = therapist_id`. Sin DELETE.
- **¿El admin conserva acceso?** **Recomiendo que no** — opción C: no hay consumidor y la capacidad
  es implícita. **Necesito tu confirmación explícita**, porque es una decisión de producto sobre
  confidencialidad terapéutica.
- **¿Realtime conserva funcionamiento?** **Sí, siempre que exista la política de SELECT**, porque los
  4 suscriptores filtran por una de las dos partes. El mecanismo está demostrado; **la entrega
  extremo a extremo no se puede verificar desde SQL** y conviene comprobarla en navegador durante el
  sprint de aplicación.
- **¿Requiere sprint previo o separado?** **No.** Un solo sprint, con un paso adicional de
  verificación en navegador que no existía en los anteriores.

---

---

## Cierre — aplicado el 13 de agosto de 2026

Diseño aprobado sin cambios y aplicado en `20260813_messages_rls.sql`, con backup en
`backups/20260813_pre_messages_rls.sql`. **RLS 25 → 26 de 37; políticas 83 → 86.**
Las tres políticas de participante, sin DELETE y sin política de admin.

**La decisión de producto se resolvió como C:** el admin no lee los cuerpos.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección *«Messages — RLS»*.

**Todo lo que este diagnóstico anticipó se confirmó:** los participantes conservan sus 4 mensajes,
ajenos y admin pasan a 0, el `RETURNING` de `sendMessageByPair:72` funciona, `markAsRead` funciona
con mensajes sin leer sembrados (5 y 4 filas), las 4 RPC siguen intactas y los triggers siguen
siendo la autoridad de escritura —incluida la imposibilidad de suplantar el remitente—.

> ⚠️ **Lo único que quedó sin verificar, y se declara:** la **entrega Realtime extremo a extremo por
> WebSocket**. El mecanismo está validado por lectura de `realtime.apply_rls` y las 2 publicaciones
> quedaron intactas, pero `realtime.subscription` tenía 0 filas al medir. **No se afirma que el chat
> en vivo esté verificado.**

## Estado del diagnóstico

```
RLS activo: 25/37 · FORCE: 0/37 · políticas: 83
ACL: sin cambios · triggers: sin cambios · funciones: sin cambios · FK: sin cambios
índices: sin cambios · vistas: sin cambios · datos permanentes: sin cambios
frontend: sin cambios · RPC: sin cambios · Realtime: sin cambios · commits: 0
```

**ERROR DE SCRIPT, declarado:** el baseline marcó «funciones que la citan: 4, esperado 6». La cifra 6
venía de una consulta mía anterior **sin filtro de esquema**: las dos extra son `realtime.send` y
`realtime.send_binary`, que mencionan `realtime.messages` —la tabla de Broadcast—, **no
`public.messages`**. La huella de funciones no cambió (`e5e288e7…`), así que no hubo cambio de
estado. **Era mi consulta, no la base.**

**ARTEFACTOS DE PRUEBA, todos revertidos:** mensajes de prueba insertados, `read_at` puesto a NULL
para forzar el caso de `markAsRead`, y RLS con políticas temporales activado y retirado dentro de la
transacción.
