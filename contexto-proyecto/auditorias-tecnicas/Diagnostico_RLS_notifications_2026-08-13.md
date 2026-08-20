# Diagnóstico RLS — `public.notifications`

**Fecha:** 2026-08-13
**Alcance:** solo lectura. **Sin migración, sin RLS, sin políticas.** No se modificó ACL, triggers,
funciones, RPC, vistas, frontend, Realtime ni datos. Todas las pruebas en transacción revertida.

Baseline al abrir y al cerrar — **idéntico**: huella de datos `a3b79398…`, ACL `c9a0182c…`,
FK `cfb70692…`, índices `6da61f8c…`, triggers `3ca1288a…`, funciones `e5e288e7…`,
vistas `b23db2e2…`. RLS 26/37, 86 políticas, FORCE 0.

---

## 1. Baseline

```
relrowsecurity = false · relforcerowsecurity = false · reloptions = (NULL) · owner = postgres
políticas = 0 · filas = 4 · triggers = 1 · FK salientes = 2 · FK entrantes = 0 · índices = 4
vistas dependientes = 0 · Realtime/Broadcast = 0 · funciones de public que la citan = 3
ACL: postgres=arwdDxtm · service_role=arwdDxtm · authenticated=w   -> anon: NADA
huella de datos = a3b7939863508234c0a41b424e355168
```

**CHECKs:** `body <= 300`, `title` no vacío y `event_type ~ '^[A-Z][A-Z0-9_]{2,63}$'`.
**FK:** `user_id → profiles(id) CASCADE` y `relationship_id → patient_therapist(id) SET NULL`.
**Índices:** `(user_id, created_at DESC)`, parcial sobre no leídas, y un **único
`(user_id, event_type, …)`** que evita duplicados.

**Datos:** 4 notificaciones, **2 destinatarios** (el terapeuta y un paciente), las 4 sin leer.
Tipos: `MESSAGE_SENT` ×2, `APPOINTMENT_REQUESTED`, `APPOINTMENT_CONFIRMED`.

---

## 2. Consumidores

**Cuatro, todos en `src/lib/api/notificationService.ts`. Ninguna Edge Function, ningún cron.**

| Archivo:línea | Operación | Columnas | Filtros | `.select()` | Actor |
|---|---|---|---|---|---|
| `:39` `listNotifications` | **RPC** `list_my_notifications(p_limit)` | las 9 útiles, incl. `title` y `body` | dentro de la función: `user_id = auth.uid()` | — | cualquiera con sesión |
| `:58` `markAsRead` | **UPDATE directo** `read_at` | `read_at` | `id = X AND read_at IS NULL` | no | el titular |
| `:79` `markAllAsRead` | **UPDATE directo** `read_at` | `read_at` | `user_id = <sesión> AND read_at IS NULL` | no | el titular |
| `:88` `getUnreadCount` | **RPC** `count_my_unread_notifications()` | — | `user_id = auth.uid()` | — | cualquiera con sesión |

Los consume el hook `useNovedades`, y a través de él `PatientDashboard` y `TherapistDashboard`.

**No hay ningún SELECT directo, ningún INSERT y ningún DELETE desde el cliente.**
**Ningún consumidor usa `RETURNING`.**

---

## 3. Modelo de datos

| Columna | Significado |
|---|---|
| `user_id` | **el destinatario. Es el propietario de la fila** |
| `event_type` | código del suceso (`MESSAGE_SENT`, `APPOINTMENT_CONFIRMED`, …) |
| `title` / `body` | el texto que se muestra; `body` opcional, máx. 300 |
| `resource_type` / `resource_id` | a qué apunta la notificación |
| `relationship_id` | el hilo terapéutico, si aplica |
| `read_at` | **la única columna que la vida de la fila permite cambiar** |
| `created_at` | inmutable |

| Acción | Quién debería |
|---|---|
| Leer | **solo el destinatario** |
| Crear | **solo el sistema.** Ningún usuario, ni siquiera el admin |
| Marcar como leída | **solo el destinatario** |
| Modificar cualquier otra columna | **nadie** |
| Borrar | **nadie** |

**No hay que asumir que `authenticated` deba poder crear notificaciones porque la ACL lo permita:**
medido, **la ACL NO se lo permite** — no tiene `INSERT` ni de tabla ni de columna.

---

## 4. Actores y acceso actual (RLS apagado)

```
actor         id+user_id+read_at    title/body        solo count(*)
dueño          4 filas              42501 denegado    4 filas
terapeuta      4 filas              42501 denegado    4 filas
tercero        4 filas              42501 denegado    4 filas
admin          4 filas              42501 denegado    4 filas
anon           42501 permission denied  — ACL: sin ningún grant
service_role   —                    4 filas           bypassrls
```

**El `count(*) = 4` es el falso positivo ya conocido** —basta `SELECT` sobre *alguna* columna—.
Lo que de verdad se lee son `id`, `user_id` y `read_at`.

**Qué revela esa lectura de 3 columnas, medido:** un tercero ve **2 notificaciones de una persona
ajena** y puede **enumerar los destinatarios distintos**. Es decir: **quién fue notificado, cuántas
veces y si lo ha leído.** No revela el asunto ni el cuerpo.

Las 2 RPC de lectura, medidas limpias (antes de escribir nada): el titular obtiene sus 2, el
terapeuta las suyas 2, **un tercero obtiene 0**. Filtran por `auth.uid()`.

---

## 5. ACL por tabla y por columna

**Esto es lo que explica el `--w-` y por qué no basta con mirar la ACL de tabla.**

| Columna | `anon` | `authenticated` |
|---|---|---|
| `id` | — | **SELECT** + UPDATE |
| `user_id` | — | **SELECT** + UPDATE |
| `read_at` | — | **SELECT** + UPDATE |
| `event_type`, `title`, `body`, `resource_type`, `resource_id`, `relationship_id`, `created_at` | — | UPDATE |

- **`anon` no tiene absolutamente nada.**
- `authenticated` tiene `UPDATE` sobre **las 10 columnas**, pero `SELECT` sobre **solo 3**.
- **No tiene `INSERT` ni `DELETE` en ninguna columna.** El `--w-` de la ACL de tabla es el `UPDATE`;
  la lectura viene enteramente de los tres grants de columna.

La asimetría —escribir 10, leer 3— parece peligrosa y no lo es: **el trigger la neutraliza**, §6.

---

## 6. Escritura actual

Medido con RLS apagado, así que ningún resultado es atribuible a RLS:

```
dueño / tercero / admin  INSERT ........ 42501 permission denied     ACL (sin grant)
dueño   marca leída la SUYA ............ 1 fila                      pasa
dueño   cambia el TITLE ................ P0001 NOTIFICATION_IMMUTABLE  trigger
dueño   cambia el USER_ID .............. P0001 NOTIFICATION_IMMUTABLE  trigger
dueño   DELETE de la suya .............. 42501 permission denied     ACL
tercero / admin / terapeuta  marcan la AJENA  P0001 NOTIFICATION_FORBIDDEN  trigger
```

`enforce_notification_rules` [`SECURITY DEFINER`, `BEFORE UPDATE`] hace dos cosas: **congela las 9
columnas salvo `read_at`** (`NOTIFICATION_IMMUTABLE`) y **exige `OLD.user_id = auth.uid()`**
(`NOTIFICATION_FORBIDDEN`), salvo para el sistema.

**El alta es exclusivamente del sistema.** `push_notification()` es `SECURITY DEFINER` y su
`EXECUTE` está concedido **solo a `service_role`** —medido: `anon=false`, `authenticated=false`—.
La disparan **6 triggers de otras tablas**:

```
appointments · journey_events · messages · patient_therapist
therapist_contact_requests (×2)
```

**Respuesta a la Fase 5: las notificaciones se crean por la opción D — trigger** (que a su vez usa
una función DEFINER). Nunca desde React, nunca por un usuario autenticado.

---

## 7. Riesgos reales

**Fuga de metadatos, real y medida:** cualquier usuario con sesión —incluido uno sin ninguna
notificación propia— puede leer `id`, `user_id` y `read_at` de **todas** las filas. Eso permite saber
**quién está recibiendo notificaciones, cuántas y si las ha leído**.

En una plataforma de salud mental eso no es inocuo: el conjunto de `user_id` con notificaciones
`MESSAGE_SENT` es, en la práctica, **la lista de personas con conversación terapéutica activa**. No
revela contenido, pero sí participación.

Volumen actual: 4 filas, 2 destinatarios. La fuga es estructural, no depende del tamaño.

**Fuga de contenido: ninguna.** `title` y `body` están fuera del alcance de `authenticated` por
grants de columna. Confirmado leyendo las columnas, no contando filas.

**Escritura no autorizada: ninguna.** ACL + trigger la cubren por completo.

---

## 8. Modelo RLS recomendado

| Acción | Quién | Cómo queda hoy | Qué añadiría RLS |
|---|---|---|---|
| SELECT | **solo el destinatario** | cualquiera lee 3 columnas de todas las filas | **cierra la fuga de metadatos** |
| INSERT | **nadie salvo el sistema** | ya cerrado por ACL | nada |
| UPDATE | **solo el destinatario, solo `read_at`** | ya cerrado por trigger | segunda capa |
| DELETE | **nadie** | ya cerrado por ACL | nada |

`anon` no necesita política: no tiene ningún privilegio. `service_role` tampoco: tiene `bypassrls`.

**Sobre el admin: no hay decisión de producto pendiente.** No existe ningún consumidor
administrativo de `notifications` —el servicio solo expone las propias— y el trigger ya le impide
tocar las ajenas. El modelo «solo el destinatario» **no le quita nada que hoy use**: hoy lee 3
columnas de filas ajenas, igual que cualquier otro usuario, y eso es precisamente lo que se quiere
cerrar. No lo trato como caso especial.

---

## 9. Políticas mínimas propuestas

**Dos.** Y conviene decir de entrada que **una de las dos es la única que aporta algo.**

```sql
-- 1. Lectura: solo el destinatario.  <-- LO ÚNICO QUE RLS APORTA
CREATE POLICY "Recipients read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. Marcado de leída: solo el destinatario.
--    Duplica lo que ya hace enforce_notification_rules. Es defensa en
--    profundidad deliberada: si el trigger se retirase, la barrera no
--    desaparecería con él. Qué columnas pueden cambiar lo sigue decidiendo
--    el trigger (solo read_at).
CREATE POLICY "Recipients update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Sin INSERT:** `authenticated` no tiene el privilegio en ninguna columna; crear la política sería
inventar una necesidad inexistente.
**Sin DELETE:** ídem.
**Sin política de admin ni de `anon`.**

**¿Puede RLS expresarlo todo sin tocar nada más? Sí.** No hace falta modificar triggers, funciones,
ACL ni frontend: `user_id` está en la propia fila y `auth.uid()` basta.

---

## 10. Riesgos de regresión

| Consumidor | Riesgo | Comprobación en la migración |
|---|---|---|
| `listNotifications:39` (RPC) | **ninguno**: `SECURITY DEFINER` de `postgres`, `bypassrls` | el titular sigue obteniendo sus 2 |
| `getUnreadCount:88` (RPC) | ídem | 2 para el titular, 0 para un tercero |
| `markAsRead:58` (UPDATE directo) | **sí lo gobierna la política 2**: sin ella, 0 filas en silencio | 1 fila para el titular |
| `markAllAsRead:79` (UPDATE directo) | ídem | n filas para el titular |
| Ninguno usa `RETURNING` | **no aplica** la regla que apareció seis veces en el plan | — |
| `anon` | no tiene privilegios; RLS no le cambia nada | `42501` de ACL, antes y después |

Riesgo residual asumido: si algún día un consumidor necesitara leer notificaciones ajenas
—una pantalla de soporte, por ejemplo— recibiría **0 filas en silencio**, que es el modo de fallo de
RLS en lectura. Hoy no existe ese consumidor.

---

## 11. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | ¿No está claro quién recibe una notificación? | **Claro:** `user_id`, y es NOT NULL |
| 2 | ¿No está claro quién puede crearla? | **Claro:** solo el sistema, vía `push_notification` (EXECUTE solo `service_role`) disparada por 6 triggers |
| 3 | ¿Algún consumidor necesita acceso distinto? | **No.** Los 4 encajan |
| 4 | ¿Alguna RPC con `bypassrls` cambia la autoridad? | **Sí, y se documenta:** las 3 son DEFINER de `postgres`. RLS **ni las rompe ni las protege**; lo que las acota es su filtro por `auth.uid()`. No invalida el diseño: RLS cierra el acceso **directo**, que es donde está la fuga |
| 5 | ¿Los grants por columna requieren decisión especial? | **No para RLS.** Explican el `--w-` y ya limitan la lectura a 3 columnas. **Se documentan sin tocarlos** |
| 6 | ¿Alguna vista esquiva RLS? | **No.** Cero vistas dependientes |
| 7 | ¿Realtime o Broadcast sobre `notifications`? | **No.** Cero publicaciones. A diferencia de `messages`, aquí no hay nada que verificar en navegador |
| 8 | ¿Consumidor no documentado? | **No.** Los 4 localizados |
| 9 | ¿Algún `0 filas` ambiguo? | **No.** El único caso —`count_my_unread` = 1— se aisló: era contaminación de mi propia escritura; limpio da 2 |
| 10 | ¿Algún `42501` que no distinga ACL de RLS? | **No.** Todos son de ACL, y no hay RLS que confundir |
| 11 | ¿Dependencia con una tabla sin modelo RLS? | **No.** Sus 2 FK apuntan a `profiles` y `patient_therapist`, **ambas ya con RLS** |
| 12 | ¿Requeriría modificar frontend o funciones? | **No** |
| 13 | ¿Más información sensible de la diagnosticada? | **No más, pero sí mejor delimitada:** la fuga es de metadatos de participación, no de contenido. Se describe en §7 sin exagerarla |

**Ninguno bloquea.**

---

## 12. Decisión requerida

- **¿`notifications` está preparada para RLS?** **Sí.** Es un caso limpio: sin vistas, sin Realtime,
  sin `RETURNING`, con las dos FK apuntando a tablas ya protegidas.
- **¿Necesita políticas?** **Dos**: SELECT y UPDATE, ambas `auth.uid() = user_id`. Sin INSERT ni
  DELETE, porque la ACL ya los cierra.
- **¿Qué actores deben acceder?** Solo el destinatario. `service_role` por `bypassrls`, y las 3 RPC
  por ser `SECURITY DEFINER`. `anon` y el admin, fuera.
- **¿Hay decisión de producto pendiente?** **No.** A diferencia de `messages`, aquí el admin no tiene
  ningún consumidor y el trigger ya le impide tocar lo ajeno; cerrarle la lectura de metadatos no le
  quita ninguna funcionalidad.

**Lo que RLS aporta es una sola cosa, y conviene no inflarla:** cerrar la lectura de `id`, `user_id`
y `read_at` de las filas ajenas. La escritura ya estaba cubierta por ACL y trigger.

---

---

## Cierre — aplicado el 14 de agosto de 2026

Diseño aprobado sin cambios y aplicado en `20260814_notifications_rls.sql`, con backup en
`backups/20260814_pre_notifications_rls.sql`. **RLS 26 → 27 de 37; políticas 86 → 88.**
Las dos políticas de destinatario, sin INSERT ni DELETE.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección *«Notifications — RLS»*.

**Todo lo que este diagnóstico anticipó se confirmó:** el propietario conserva sus 2, el tercero y el
admin pasan a 0, `title` y `body` siguen en `42501` para los cuatro actores —la ACL por columna no se
tocó—, `markAsRead` y `markAllAsRead` funcionan, las 2 RPC siguen intactas y el trigger sigue siendo
la autoridad sobre qué columnas pueden cambiar.

**Sin sorpresas ni límites nuevos.** El único matiz registrado es el ya previsto cambio de capa: el
`UPDATE` de una fila ajena pasa de `NOTIFICATION_FORBIDDEN` (trigger) a 0 filas (RLS).

## Estado del diagnóstico

```
RLS activo: 26/37 · FORCE: 0/37 · políticas: 86
ACL: sin cambios · triggers: sin cambios · FK: sin cambios · funciones: sin cambios
índices: sin cambios · vistas: sin cambios · datos permanentes: sin cambios
frontend: sin cambios · RPC: sin cambios · Realtime: sin cambios · commits: 0
```

**ARTEFACTO / ERROR DE GUION, declarado:** en la primera pasada, `count_my_unread_notifications`
devolvió 1 en lugar de 2 porque mi propio `markAsRead` de prueba había corrido antes en la misma
transacción. Se repitió midiendo las RPC **antes** de cualquier escritura: 2 para el titular, 0 para
un tercero. **Era contaminación de mi batería, no un fallo.**
