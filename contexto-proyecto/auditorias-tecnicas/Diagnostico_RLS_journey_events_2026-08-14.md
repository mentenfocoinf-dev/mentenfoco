# Diagnóstico RLS — journey_events

**Fecha:** 14 de agosto de 2026 · **Alcance:** solo lectura. No se activó RLS, no se creó ninguna
política permanente, no se tocó ACL, triggers, funciones, vistas, RPC, Realtime, frontend ni datos.
Toda prueba destructiva se hizo dentro de una transacción con `ROLLBACK` forzado, y los 16
invariantes se comprobaron **dos veces**: después de la batería de medición y después de la
simulación. Los dos pases dieron los 16 en OK.

**Estado global al terminar:** RLS 28/37 · FORCE 0/37 · 91 políticas · huellas ACL/FK/triggers/
funciones/índices/vistas idénticas al inicio.

---

## 1. Baseline

```
relrowsecurity ...... false          owner ............... postgres
relforcerowsecurity . false          filas ............... 58
reloptions .......... (NULL)         políticas ........... 0
```

**ACL de tabla** — `postgres=arwdDxtm/postgres, anon=axtm/postgres, authenticated=am/postgres,
service_role=arwdDxtm/postgres`

```
anon            -a---xt      INSERT + REFERENCES + TRIGGER
authenticated   -a-----      INSERT y nada más
service_role    rawdDxt      bypassrls=true
postgres        rawdDxt      bypassrls=true
```

**Ni `anon` ni `authenticated` tienen SELECT, UPDATE, DELETE ni TRUNCATE.** Es deliberado: lo hizo
`20260730g_journey_events.sql` (`REVOKE SELECT`) y lo remató
`20260804d_journey_events_solo_insert.sql` (`REVOKE DELETE, UPDATE, TRUNCATE`).

**Grants por columna:** 17 columnas con INSERT para `anon` y para `authenticated`; 17 con REFERENCES
para `anon`. No hay ni un grant de SELECT por columna. A diferencia de `notifications` y
`therapist_contact_requests`, aquí los grants de columna **no abren nada**: son el mismo INSERT
desglosado.

**Columnas (17):** `id`, `created_at`, `user_id`, `anonymous_id`, `session_id`, `event_name`, `page`,
`source`, `metadata` (jsonb), `ip_hash`, `user_agent`, `referrer`, `utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `utm_term`.

**CHECK:**

```
metadata_acotada .... pg_column_size(metadata) <= 2048
nombre_formato ...... event_name ~ '^[A-Z][A-Z0-9_]{2,63}$'
source .............. source IN ('web','mobile','edge')
tiene_sujeto ........ user_id IS NOT NULL OR anonymous_id IS NOT NULL
```

**FK saliente:** `user_id → profiles(id) ON DELETE SET NULL`. **FK entrantes: 0.**
**Triggers: 2.** **Índices: 6.** **Vistas dependientes: 0.** **Realtime: 0 publicaciones**
(existen `supabase_realtime` y `supabase_realtime_messages_publication`; ninguna la incluye).
**Broadcast: 0.** **Funciones de `public` que la citan: 2**, ambas `SECURITY DEFINER` de `postgres`.

---

## 2. Modelo de datos

**No es solo telemetría.** El nombre engaña y el prompt hacía bien en advertirlo.

Las 58 filas, por evento:

```
HOME_VIEW             16      RECOMMENDATION_SHOWN   4
SERVICES_VIEW         11      TEST_COMPLETED         3
GUIDE_VIEW            10      TEST_RESULT_VIEWED     3
PLAN_VIEWED            5      TEST_STARTED           3
                              CONTENT_VIEW           2
                              BLOG_VIEW              1
```

Claves que aparecen dentro de `metadata`:

```
resource_id    19    resource_type  13    test_id  9
score           6    band            6    count    4    rule  4    completed  3
```

**Seis filas llevan `score` y `band`.** Ejemplo literal de una fila real:

```
TEST_COMPLETED   page=/tests/test-de-depresion
metadata={"band": "Síntomas leves", "score": 8, "test_id": "test-de-depresion", "completed": true}
```

Eso es **el resultado de un PHQ-9 asociado a un `user_id`**. Nueve filas más tienen un `page` que
delata qué test se abrió. No es historia clínica, pero tampoco es «qué página visitó»: es una banda
de severidad con nombre y apellido.

**A quién pertenece un evento.** A la vez a un sujeto y a un dispositivo. Las tres columnas de
identidad conviven en las 58 filas: `user_id` (1 distinto), `anonymous_id` (1 distinto), `session_id`
(1 distinto). El `CHECK tiene_sujeto` obliga a que haya al menos uno de los dos primeros. El diseño
es explícito en `journeyService.ts:282`: el `anonymous_id` se conserva **aunque haya sesión**, para
poder unir el recorrido previo al registro con el posterior.

**Las 58 filas son de un solo usuario, con rol `therapist`, en una sola sesión del 4 de agosto.**
Son datos de desarrollo, no tráfico real. Ninguna cita un correo o un teléfono. Ningún `user_id`
apunta a un perfil borrado. **Cero filas con `NEXT_STEP_SHOWN`/`NEXT_STEP_OPENED`** — el camino que
dispara notificaciones nunca se ha recorrido en datos reales.

`ip_hash`, `referrer` y las cinco `utm_*` están **vacías en las 58**. `user_agent` no guarda la
cadena del navegador sino una categoría (`desktop`). **No hay huella de identificación de navegador
ni de IP en los datos actuales**, aunque las columnas existen.

---

## 3. Consumidores

**Un solo acceso SQL directo en todo el proyecto:**

| Archivo | Línea | Operación | Actor | `.select()` / RETURNING |
|---|---|---|---|---|
| `src/lib/api/journeyService.ts` | 280 | `INSERT` | `anon` y `authenticated` | **ninguno** |

Ese INSERT es el cuerpo de `enviar()`, que solo llama `trackEvent()`
([journeyService.ts:251](src/lib/api/journeyService.ts:251)). **39 puntos de llamada** en `src/`:
rutas públicas (`index`, `blog`, `contenido`, `servicios.$slug`, `tests.$slug`, `contactanos`,
`membresia`, `asesoramiento`), rutas con sesión (`onboarding`, `guias.$guiaId`, `consentimiento*`) y
servicios (`authService`, `messagesService`, `therapistContactService`, `patientTherapistService`).

Cuatro rasgos del consumidor que importan para el diseño:

1. **`user_id: session?.user?.id ?? null`** (línea 281). Nunca envía un identificador que no sea el
   suyo o `null`.
2. **No hay `.select()` ni RETURNING.** Una política de INSERT no arrastra necesidad de SELECT —a
   diferencia de `appointments`, `content_items`, `messages` y las otras cinco veces que sí pasó.
3. `trackEvent` devuelve `void` y se traga cualquier error (línea 295). **Si RLS rompiera el INSERT,
   nadie se enteraría**: no hay error visible, solo eventos que dejan de existir.
4. Se llama **sin sesión** en al menos ocho rutas públicas. La escritura anónima no es un descuido:
   es el caso principal.

**Lectura: ninguna consulta directa.** Las dos únicas lecturas van por RPC:

| Archivo | Línea | RPC | Naturaleza |
|---|---|---|---|
| `journeyService.ts` | 345 | `journey_seen_resources(text[])` | `SECURITY DEFINER`, owner `postgres` |
| `journeyService.ts` | 374 | `journey_recent_resources(int)` | `SECURITY DEFINER`, owner `postgres` |

Envueltas en `getSeenResources()` y `getRecentResources()`, consumidas por
`recentResources.ts` y `PacientesActivos.tsx`. Los comentarios del código ya dicen por qué van por
RPC: *«el cliente NO tiene SELECT sobre journey_events, y no debe tenerlo»* (línea 336).

**Edge Functions: 0.** Ninguna de las cuatro (`admin-create-user`, `public-signup`,
`send-session-reminders`, `stripe-webhook`) menciona la tabla. **Cron: 0. Scripts: 0.**

---

## 4. Escritura actual

Medido con RLS apagado:

```
anon,  user_id NULL ............ OK   visitante sin sesión registra su propio evento
authenticated, user_id propio .. OK   con sesión registra su propio evento
```

**Categoría (Fase 4): F, combinación.** Concretamente A + B + C + E, y con un pie en D:

- **A) telemetría anónima deliberada** — el caso principal, 8 rutas públicas.
- **B) telemetría autenticada** — el mismo INSERT con `user_id`.
- **C) auditoría** — el trigger `append_only` y el comentario de la migración original
  (*«Reescribir un evento sería falsificar el recorrido; borrarlo de a uno, ocultarlo»*) dicen que
  esta tabla se piensa como registro inmutable de hechos.
- **E) navegación** — `page`, `session_id`, `HOME_VIEW`.
- **D) eventos clínicos** — no por diseño, pero **de hecho sí**: `TEST_COMPLETED` con `score` y
  `band` entra por `/tests/$slug`, que es una ruta pública.

Los CHECK sí acotan la forma del evento:

```
event_name en minúsculas ....... 23514  CHECK
source fuera del catálogo ...... 23514  CHECK
metadata de 3 KB ............... 23514  CHECK
sin user_id NI anonymous_id .... 23514  CHECK
user_id inexistente ............ 23503  FK
metadata con texto libre ....... SE CREA  <<< jsonb libre: ningún CHECK mira su contenido
```

---

## 5. Lectura actual

Medido con RLS apagado, **columna a columna** y no con `count(*)` —la lección de `notifications`—:

```
    actor            id        user_id   event_name  page      metadata  session_id
    paciente A       42501     42501     42501       42501     42501     42501
    paciente B       42501     42501     42501       42501     42501     42501
    terapeuta        42501     42501     42501       42501     42501     42501
    admin            42501     42501     42501       42501     42501     42501
    anon             42501  permission denied for table journey_events
    service_role     58 filas con metadata   (bypassrls)
```

**No hay ni una fuga de lectura.** Ningún rol de cliente puede leer ninguna columna, y el `42501`
está aislado: es `permission denied for table journey_events` —ACL— y no
`new row violates row-level security policy`. Es el primer caso del plan en que la lectura ya está
completamente cerrada **antes** de RLS.

Las RPC, que sí leen, filtran bien:

```
                                   recent_resources    seen_resources
    terapeuta (dueño de las 58)    4 recursos          2 de 3
    paciente A                     0 recursos          0 de 3
    admin                          0 recursos          0 de 3
    anon                           0 recursos          (auth.uid() IS NULL corta dentro)
```

---

## 6. Triggers y funciones

### `enforce_journey_event_append_only()` — `BEFORE UPDATE OR DELETE`, INVOKER

```sql
BEGIN
  RAISE EXCEPTION 'JOURNEY_EVENT_APPEND_ONLY: un evento del recorrido no se modifica ni se borra.';
END;
```

Incondicional. **No comprueba ownership, no valida actor, no normaliza nada.** Solo prohíbe. Medido:

```
                UPDATE                          DELETE                          TRUNCATE
anon            42501 permission denied (ACL)   42501 permission denied (ACL)   42501 permission denied
authenticated   42501 permission denied (ACL)   42501 permission denied (ACL)   42501 permission denied
service_role    P0001 JOURNEY_EVENT_APPEND_ONLY P0001 JOURNEY_EVENT_APPEND_ONLY TRUNCATE EJECUTADO  <<<
```

> **DEFECTO PREEXISTENTE — H-JE-001.** El trigger es `FOR EACH ROW`, y **TRUNCATE no dispara
> triggers de fila**. `service_role` conserva `D` en la ACL, así que **puede vaciar la tabla entera
> de un golpe sin que el append-only se entere**. Está medido: `TRUNCATE EJECUTADO`, revertido por el
> rollback. `20260804d` revocó TRUNCATE a `anon` y a `authenticated` pero no a `service_role`.
> **RLS no corrige esto** —tampoco protege contra TRUNCATE— y **no se toca en este sprint**: la
> corrección sería un trigger `BEFORE TRUNCATE FOR EACH STATEMENT` o un `REVOKE TRUNCATE`, y ninguna
> de las dos es RLS. Queda documentado, no corregido.

### `notify_from_journey_event()` — `AFTER INSERT`, **SECURITY DEFINER**, `search_path=public`

```sql
IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
IF NEW.event_name = 'NEXT_STEP_SHOWN' THEN
  PERFORM push_notification(NEW.user_id, 'NEXT_STEP_SHOWN', 'Tienes un paso pendiente', ...);
ELSIF NEW.event_name = 'NEXT_STEP_OPENED' THEN
  PERFORM push_notification(NEW.user_id, 'NEXT_STEP_OPENED', 'Retomaste tu programa', ...);
END IF;
```

**Este trigger convierte una fila de telemetría en una fila de `notifications`.** Confía en
`NEW.user_id` sin comprobarlo contra `auth.uid()`. Es la pieza que convierte «falsificar un evento»
en «escribir en la bandeja de otra persona».

### Las dos RPC

Ambas `SECURITY DEFINER`, owner `postgres` (`bypassrls=true`), `search_path=public`,
`GRANT EXECUTE` a `anon` y `authenticated`. Filtran con
`WHERE auth.uid() IS NOT NULL AND e.user_id = auth.uid()`.

**Su lógica no contradice el modelo de acceso: lo confirma.** Cada quien lee solo lo suyo. Y por ser
DEFINER de un dueño con `bypassrls`, **RLS sobre la tabla no las afecta** —lo mismo que en
`notifications` y `therapist_contact_requests`—. Confirmado por medición, no por deducción: con RLS
simulado siguen devolviendo `4 recursos` y `2 de 3`.

**Efecto secundario del apartado 5 sobre la falsificación:** un evento fabricado con el `user_id` de
otra persona **aparece en el resultado de sus RPC**. `journey_recent_resources` alimenta «lo último
que abriste»; `journey_seen_resources`, las marcas de progreso. Un tercero puede escribir en la
interfaz de otro usuario sin tocar su cuenta.

---

## 7. Riesgos reales

| Tipo | ¿Existe? | Evidencia |
|---|---|---|
| **Fuga de información** | **NO** | 42501 por ACL para los 5 actores, columna a columna |
| **Fabricación de eventos** | **SÍ, y sin sesión** | medido abajo |
| **Manipulación de auditoría** | parcial | no se edita ni se borra fila a fila; **sí se retrodata al crear** |
| **Spam / abuso** | **SÍ** | notificación real creada por `anon` |
| **Impacto clínico** | indirecto | el falsificador escribe en «tu siguiente paso» de otra persona |
| **Impacto analítico** | **SÍ** | métricas de recorrido contaminables por cualquiera |
| **Impacto de privacidad** | bajo | no se puede leer nada; sí **inyectar** texto libre en `metadata` |
| **Destrucción** | vía `service_role` | H-JE-001, TRUNCATE. No es materia de RLS |

### La fuga que sí existe, medida

```
paciente A escribe como paciente B ..... SE CREA   <<< suplanta a otro usuario
anon SIN SESIÓN escribe como terapeuta . SE CREA   <<< sin credencial ninguna
anon retrodata created_at 400 días ..... SE CREA   <<< con fecha inventada
```

Y llega a otra tabla:

```
anon inserta NEXT_STEP_SHOWN a nombre del terapeuta:  INSERT aceptado
notifications de ese usuario:  antes 2  ->  después 3
la notificación creada: NEXT_STEP_SHOWN | Tienes un paso pendiente |
                        Continúa por donde lo dejaste. | guia:ZZ-FALSO
```

**Un visitante sin sesión hace aparecer una notificación en la bandeja de un profesional**, con
título y cuerpo del producto, apuntando a un recurso que él eligió. Todo revertido por el rollback:
`notifications` volvió a 4 filas.

### Respuesta directa a las cinco preguntas de la Fase 8

| ¿Un usuario puede…? | Hoy |
|---|---|
| leer eventos de otro | **No.** Ni los suyos: no hay SELECT para nadie |
| crear eventos a nombre de otro | **Sí**, incluso sin sesión |
| modificar eventos existentes | **No.** ACL para el cliente, trigger para `service_role` |
| borrar evidencia | **No** fila a fila. **Sí** en bloque, solo `service_role`, vía TRUNCATE |
| insertar payloads arbitrarios | **Sí**, dentro de 2 KB y con `event_name` bien formado |

### Lo que no voy a exagerar

- Las 58 filas no contienen nada que un tercero pueda leer. **El riesgo es de escritura, no de
  lectura.**
- La falsificación exige conocer un `user_id` (un UUID). No es adivinable, y esta misma auditoría ha
  confirmado que ninguna tabla con RLS lo expone ya. **Es un riesgo real con una barrera práctica
  seria.**
- El evento que dispara la notificación (`NEXT_STEP_SHOWN`) **nunca ha ocurrido en datos reales**.
  El camino existe; nadie lo ha recorrido.
- La retrodatación de `created_at` no reescribe nada: añade una fila con fecha falsa. Ensucia una
  serie temporal; no borra un hecho.

---

## 8. Modelo de acceso recomendado

| Operación | anon | paciente | terapeuta | admin | service_role |
|---|---|---|---|---|---|
| **SELECT** | denegado — ACL | denegado — ACL | denegado — ACL | denegado — ACL | permitido, bypassrls |
| **INSERT** | **permitido, solo con `user_id` NULL** | **permitido, solo el propio** | ídem | ídem | permitido |
| **UPDATE** | denegado — ACL | denegado — ACL | denegado — ACL | denegado — ACL | denegado — trigger |
| **DELETE** | denegado — ACL | denegado — ACL | denegado — ACL | denegado — ACL | denegado — trigger |

**La telemetría anónima se conserva íntegra.** El prompt lo pedía explícitamente y es lo correcto: no
se impone un ownership inexistente, se impone **la coherencia entre el `user_id` declarado y la
sesión que lo declara**. Con `user_id` NULL, un visitante sigue escribiendo lo que quiera sobre sí
mismo.

**No se propone política de SELECT, ni siquiera para admin.** El diseño original
(`20260730g_journey_events.sql:144`) dejaba comentada una `journey_events_select_admin`. **Sería
inerte**: `authenticated` no tiene SELECT en la ACL, y una política no concede privilegios, solo
filtra los que ya existen. Habilitarla obligaría a un `GRANT SELECT ON journey_events TO
authenticated`, es decir, **abrir la tabla a todo el rol** y confiar la protección solo a la
política. Sería cambiar una defensa de dos capas por una de una. Si el admin necesita leer el
recorrido, la vía correcta es una RPC `SECURITY DEFINER` —el patrón que esta tabla ya usa dos
veces—, no una política.

---

## 9. Políticas mínimas propuestas

**Una sola política. Ninguna más.**

```sql
CREATE POLICY "Everyone records their own journey"
  ON public.journey_events
  AS PERMISSIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
```

| | |
|---|---|
| **Operación** | INSERT |
| **Actor** | `anon` y `authenticated` |
| **USING** | no aplica |
| **WITH CHECK** | `user_id IS NULL OR auth.uid() = user_id` |
| **Consumidor que cubre** | `journeyService.ts:280`, único acceso directo, y sus 39 puntos de llamada |
| **Riesgo que cierra** | fabricación de eventos a nombre ajeno, y con ella la notificación fabricada |
| **Protección complementaria** | ACL sin SELECT/UPDATE/DELETE · trigger append-only · 4 CHECK · FK a `profiles` |

**Sin política de SELECT** — la ACL ya lo cierra; una política sería inerte y abrirla exigiría un
GRANT (§8). **Sin política de UPDATE ni DELETE** — la ACL las niega al cliente y el trigger las niega
a `service_role`; una política no añadiría nada. **Sin política para `service_role`** — tiene
`bypassrls`.

### Verificación de la propuesta, ya ejecutada

Simulada dentro de una transacción revertida —creada, medida y deshecha—:

```
A) EL CONSUMIDOR LEGÍTIMO SIGUE FUNCIONANDO
   anon, user_id NULL  (/, /blog, /tests sin sesión) ...... PASA
   anon, TEST_COMPLETED con score y band .................. PASA
   authenticated, user_id = auth.uid() .................... PASA
   authenticated, user_id NULL ............................ PASA

B) LA FALSIFICACIÓN QUEDA CERRADA
   paciente A escribe como paciente B ..................... 42501 new row violates RLS policy
   anon SIN SESIÓN escribe como el terapeuta .............. 42501 new row violates RLS policy

C) LA NOTIFICACIÓN FABRICADA TAMBIÉN
   anon inserta NEXT_STEP_SHOWN a nombre ajeno ............ 42501 new row violates RLS policy
   notifications de ese usuario: antes 2 -> después 2      el trigger ya no llega a dispararse
   el titular inserta el suyo ............................. PASA, notificaciones 3

D) LO QUE NO CAMBIA
   SELECT del terapeuta .................................. 42501 permission denied — ACL, igual
   journey_recent_resources .............................. 4 recursos   (DEFINER: intacta)
   journey_seen_resources ................................ 2 de 3       (DEFINER: intacta)
   UPDATE / DELETE ....................................... 42501 permission denied — ACL, igual

E) CONTRASTE CON EL DISEÑO ORIGINAL: WITH CHECK (true)
   anon escribe como el terapeuta ........................ SE CREA  <<< no cierra nada
```

El apartado E importa. **La política que el proyecto tenía escrita en 2026-07-30
(`WITH CHECK (true)`) no habría cerrado la fuga**: se midió y la falsificación pasa igual. La
diferencia entre las dos variantes es todo el valor de este sprint.

---

## 10. Criterios de parada

| # | Criterio | Estado |
|---|---|---|
| 1 | No está claro qué tipo de datos contiene | **Resuelto por medición.** Recorrido + 6 filas con banda de test |
| 2 | Diferencia entre telemetría y datos clínicos que requiere decisión | **TOCADO — ver abajo** |
| 3 | Consumidor anónimo legítimo no documentado | **No.** Documentado en la migración original y en 8 rutas |
| 4 | RPC `SECURITY DEFINER` que contradice el modelo | **No.** Las dos filtran por `auth.uid()`; lo confirman |
| 5 | La tabla se usa para auditoría | **Parcialmente sí** — ver abajo |
| 6 | Necesita escritura anónima | **Sí, y se respeta.** La política la conserva |
| 7 | Realtime | **No.** 0 publicaciones |
| 8 | Broadcast | **No** |
| 9 | Vista que esquiva RLS | **No.** 0 vistas |
| 10 | Un `0 filas` ambiguo | **No.** Todo lo medido fue `42501` explícito o `SE CREA` |
| 11 | Un `42501` ambiguo | **No.** Aislado: `permission denied for table` (ACL) vs `new row violates row-level security policy` (RLS) |
| 12 | RLS requiere modificar frontend | **No.** Medido en la simulación, apartado A |
| 13 | RLS requiere modificar funciones o triggers | **No.** Medido, apartado D |
| 14 | El modelo correcto depende de una decisión de producto | **No para esta política** — ver abajo |

### Criterio 2 — datos clínicos en una tabla de telemetría

**No bloquea esta política, pero hay que decirlo.** Seis de 58 filas guardan `{"band": "Síntomas
leves", "score": 8, "test_id": "test-de-depresion"}` contra un `user_id`. Eso llega desde
`tests.$slug.tsx:93`, una **ruta pública**: un visitante sin cuenta también genera esas filas, con
`user_id` NULL.

No bloquea porque **nadie puede leerlo**: la ACL no concede SELECT a ningún rol de cliente, ni antes
ni después. Y la política propuesta no cambia una coma de eso.

Sí abre dos preguntas que **no son de RLS** y quedan documentadas sin corregir:

- ¿debe una banda de severidad vivir en la tabla de recorrido, o basta `test_id` + `completed`?
- la política de retención de 24 meses que la migración original dejó **PENDIENTE** sigue pendiente,
  y ahora se sabe que lo que retendría incluye puntuaciones de test.

### Criterio 5 — auditoría

La tabla **es** un registro de hechos inmutable: así lo dice el comentario de la migración y así lo
impone el trigger. Eso no es un motivo para dejarla fuera de RLS; es un motivo **para cerrar quién
puede escribir en ella**, que es exactamente lo que la política hace. Un registro de auditoría en el
que cualquiera puede insertar a nombre de otro no es un registro de auditoría.

### Criterio 14

La política de INSERT no depende de ninguna decisión de producto: el consumidor ya envía
`session?.user?.id ?? null` y la política solo exige que eso sea verdad. **Donde sí habría decisión
de producto es en el SELECT del admin**, y por eso no se propone (§8).

---

## 11. Decisión requerida

**¿`journey_events` está preparada para RLS?** **Sí.** Es el caso más limpio del plan: un solo
acceso directo, sin `.select()`, sin RETURNING, sin vistas, sin Realtime, sin FK entrantes, y con las
dos únicas lecturas ya aisladas en RPC `SECURITY DEFINER`. La simulación revertida lo confirma
extremo a extremo.

**¿Qué riesgo real corrige?** **Fabricación de eventos a nombre ajeno.** Hoy un visitante **sin
sesión** puede escribir un evento atribuido a cualquier usuario cuyo UUID conozca, con la fecha que
quiera, y hacer que le aparezca **una notificación real en su bandeja** y que su «siguiente paso» y
sus marcas de progreso muestren lo que el falsificador eligió. Está medido, no supuesto:
`notifications` pasó de 2 a 3.

Y conviene decir también lo que **no** corrige: **no cierra ninguna fuga de lectura, porque no la
hay.** Al revés que en `content_items`, `clinical_notes` o `messages`, aquí no hay nada que dejar de
ver. Es la primera política del plan cuyo valor es **de integridad, no de confidencialidad** —igual
que la de INSERT de `clinical_notes`, pero esta vez es el único motivo.

**¿Cuántas políticas necesita?** **Una.** No hay motivo para una segunda.

**¿Hay una decisión de producto pendiente?** **No para aplicar esta política.** Sí quedan dos temas
abiertos, documentados y **no corregidos** en este sprint:

- **H-JE-001** — `service_role` puede `TRUNCATE` la tabla saltándose el trigger append-only. No es
  materia de RLS.
- **Retención y contenido clínico de `metadata`** — la purga a 24 meses sigue pendiente desde julio,
  y lo que retiene incluye puntuaciones de test.

**¿Debe quedarse fuera de RLS?** **No.** Debe entrar, con una sola política de INSERT.

---

## Cierre — aplicado el 14 de agosto de 2026

Diseño aprobado sin cambios y aplicado en `20260814_journey_events_rls.sql`, con backup en
`backups/20260814_pre_journey_events_rls.sql`. **RLS 28 → 29 de 37; políticas 91 → 92.** La política
única de §9, tal cual.

Crónica completa en `Blindaje_Seguridad_Contenido_2026-08-07.md`, sección
*«Journey Events — RLS»*.

**Se confirmó todo lo que este diagnóstico anticipó**, incluido lo que decía que NO se ganaba:

- Los **8 casos de INSERT** dieron exactamente lo previsto: pasan `anon` con `user_id` NULL y los tres
  roles con su propio uid; los cuatro intentos a nombre ajeno dan `42501 new row violates
  row-level security policy`.
- La **telemetría anónima sigue intacta**: `HOME_VIEW`, `TEST_COMPLETED` con `score` y `band`,
  `SERVICES_VIEW` con `resource_id` y `BLOG_VIEW` con `utm_*`, los cuatro pasan.
- El **trigger sigue vivo**: el titular inserta su `NEXT_STEP_SHOWN` y `notifications` va de 2 a 3;
  la misma inserción falsificada por `anon` la para RLS y `notifications` se queda en 3. **Cambio de
  capa**: RLS filtra antes, el `AFTER INSERT` ni se evalúa.
- **SELECT, UPDATE y DELETE siguen cerrados por ACL** —`permission denied for table`, no
  `row-level security`— para `anon`, paciente y terapeuta; `service_role` sigue chocando con el
  trigger en UPDATE/DELETE.
- **`created_at` sigue retrodatable** y así se documenta: se consiguió una fila fechada el
  2025-07-10. La política ata la identidad, no la fecha, y solo se puede retrodatar lo propio.
- **H-JE-001 sin cambio**: `service_role` sigue ejecutando `TRUNCATE`. RLS no protege contra TRUNCATE.

**Round-trip ejecutado de verdad:** el backup devolvió los 33 criterios al baseline dígito a dígito
(RLS 28/37, 91 políticas, huella POL `85e46556…`), y la reaplicación reprodujo la batería completa
sin una sola diferencia.

## Estado del diagnóstico

**Aplicado.**

```
RLS activo: 29/37 · FORCE: 0/37 · políticas: 92
journey_events: RLS=true · FORCE=false · 1 política INSERT · 0 SELECT/UPDATE/DELETE · 58 filas
ACL: 0 · grants por columna: 0 · triggers: 0 · FK: 0 · funciones: 0 · índices: 0 · vistas: 0
datos permanentes: 0 · frontend: 0 · RPC: 0 · Realtime: 0 · Broadcast: 0 · commits: 0
```
