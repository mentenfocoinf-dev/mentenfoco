# Diagnóstico de Seguridad Post-RLS

**Fecha:** 14 de agosto de 2026 · **Alcance:** solo lectura. No se aplicó ningún cambio, no se activó
PITR, no se crearon copias, no se rotó ningún secreto, no se tocó ACL, RLS, triggers, funciones ni
frontend, y no se hizo ningún commit. Toda prueba destructiva se ejecutó dentro de transacciones con
`ROLLBACK` forzado; los **12 invariantes finales** confirman que ninguna medición dejó rastro.

**Regla de este informe:** ningún hash se hereda de sprints anteriores. Las huellas de la §Anexo B se
midieron en vivo al empezar este diagnóstico y se re-midieron al terminar. Donde algo no pudo
demostrarse, dice **INCONCLUYENTE** — sin rellenar con suposiciones.

---

## 1. Resumen ejecutivo

El plan de RLS está cerrado y verificado (33/37, 98 políticas, 0 FORCE). **Pero la seguridad efectiva
del proyecto no está limitada hoy por RLS, sino por una cosa que RLS nunca podía resolver: no existe
capacidad de recuperación.** PITR está desactivado y hay **cero copias de seguridad** — confirmado
contra la Management API, no supuesto. Para una plataforma clínica con historias clínicas,
evaluaciones psicométricas y mensajería real, esto es el riesgo dominante: cualquier operación
irreversible —un `TRUNCATE`, un `DROP`, una corrupción— es **pérdida permanente**.

En segundo plano, dos riesgos operativos reales:

1. **La clave de Resend sigue sin rotar**, y la evidencia es objetiva: el secret se actualizó por
   última vez el **2026-07-19**, *antes* de que se marcara comprometida (7, 11 y 14 de agosto).
2. **`public-signup` no tiene rate-limit ni captcha** y usa `service_role` para crear cuentas y enviar
   correos vía Resend, sin autenticación (`verify_jwt: false`, por diseño). Es una superficie de
   abuso de creación masiva de cuentas y agotamiento de la cuota de correo.

Lo que **no** es un problema, y conviene decirlo porque se sospechaba: **las funciones `admin_*` que
saltan RLS están correctamente protegidas** — medido, no leído del código: un paciente o `anon` que
las llame recibe `ADMIN_REQUIRED`. Y **ningún secreto está hardcodeado** en el repositorio.

Los dos defectos preexistentes (H-JE-001, H-TB-001) se reconfirmaron. Ninguno es una fuga de datos;
son fallos de integridad de trigger, y su gravedad real depende enteramente de que **no haya
backups** — que es, otra vez, el nudo de todo.

---

## 2. Estado final del plan RLS

Medido en vivo al iniciar este diagnóstico:

```
tablas public (relkind=r) ...... 37
con RLS activo ................. 33
con FORCE ...................... 0
políticas en public ............ 98

sin RLS (las 4 esperadas, sin cambios):
  cie11_directory   163 filas   catálogo público — excepción justificada
  public_tests        3 filas   catálogo público — excepción justificada
  guides              0 filas   tabla muerta — pendiente de DROP
  test_scores         0 filas   REVOKE aplicado, DROP aplazado por falta de backups
```

Roles con `bypassrls` (los que RLS no gobierna nunca): `supabase_admin` (superuser),
`postgres`, `service_role`, `supabase_read_only_user`. Ningún rol de cliente (`anon`,
`authenticated`) tiene `bypassrls`, `superuser`, `createrole` ni `createdb`. **Correcto.**

Este apartado no re-diagnostica las tablas ya cerradas: se limita a confirmar el estado global.

---

## 3. Estado de recuperación / backups

**Fuente: Management API de Supabase** (`GET /v1/projects/{ref}/database/backups`), autenticada con
`SUPABASE_ACCESS_TOKEN`. No es una inferencia del catálogo SQL — es la configuración real del
proyecto.

```
pitr_enabled ........... false
walg_enabled ........... true
backups ................ []            (lista vacía)
physical_backup_data ... {}            (vacío)
region ................. us-west-2
selected_addons ........ []            (sin add-on de PITR ni de cómputo)
Postgres ............... 17.6.1.104
proyecto ............... ACTIVE_HEALTHY, creado 2026-04-19
```

**La separación que pediste, medida:**

| Categoría | Estado | Evidencia |
|---|---|---|
| **backup existente** | **NO** | `backups: []`, `physical_backup_data: {}` |
| **backup automatizado** | **NO** | `pitr_enabled: false`, sin add-on seleccionado |
| **backup verificable** | **NO** | no hay ninguno que verificar |
| **restore probado** | **NO — y hoy imposible** | no hay nada que restaurar |

**`walg_enabled: true` es engañoso y lo aíslo:** es un flag de infraestructura de Supabase que indica
que la maquinaria WAL-G *existe*, no que haya copias retenidas. Con `backups: []` y
`physical_backup_data: {}`, **no hay ni una copia física recuperable**. El contraste
`walg_enabled=true` / `backups=[]` es exactamente el patrón del plan Free, donde la infraestructura
está pero la retención no se aplica.

**Plan de suscripción:** `selected_addons: []` y 0 backups **indican fuertemente plan Free**, pero no
obtuve un campo explícito de tier, así que lo marco **fuertemente indicado, no confirmado por campo
explícito**. En cualquier caso, la conclusión operativa no cambia: **cero recuperación.**

**Aclaración necesaria sobre los "backups" de este proyecto.** Durante el plan de RLS generé archivos
en `supabase/backups/*.sql`. **Esos NO son copias de la base.** Solo restauran el *estado de ACL y
políticas* de objetos concretos —sirven para revertir una migración—, y ninguno contiene datos. Que
existan no debe leerse como que hay capacidad de recuperación de datos. **No la hay.**

**Quién puede administrar/restaurar:** el `SUPABASE_ACCESS_TOKEN` de la cuenta propietaria
(`mentenfocoinf@gmail.com`) tiene acceso a la Management API. Pero sin copias, el privilegio es
inaplicable: no hay operación de restore disponible.

---

## 4. Estado de secretos

**Fuente: `GET /v1/projects/{ref}/secrets`** (devuelve nombres y `updated_at`, nunca valores) +
búsqueda en el repositorio. **Ningún valor de secreto se leyó ni se imprime.**

**Los 11 secretos del proyecto (solo nombres):**

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL,
SUPABASE_PUBLISHABLE_KEYS, SUPABASE_SECRET_KEYS, SUPABASE_JWKS        (infra Supabase)
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET                             (pagos)
RESEND_API_KEY                                                       (correo)
DEV_MAIL_REDIRECT                                                    (artefacto de desarrollo)
```

### La clave de Resend

| Pregunta | Respuesta medida |
|---|---|
| Dónde se configura | **Solo** como secret de Edge Function de Supabase (`RESEND_API_KEY`) |
| Qué la consume | `supabase/functions/public-signup/index.ts` y `send-session-reminders/index.ts` |
| Cómo se lee | `Deno.env.get("RESEND_API_KEY")` en ambas — **nunca hardcodeada** |
| ¿En `.env` local? | **NO** — 0 líneas `RESEND_API_KEY` en `.env` |
| ¿En el repositorio / git? | **NO** — 0 coincidencias `re_...` en los 388 archivos versionados |
| ¿En `.env.example`, docs, backups? | **NO** — solo placeholders en `.env.example`; ningún valor real |
| ¿Configurada como secret del proveedor? | **SÍ**, como secret de Supabase |
| ¿Evidencia de rotación? | **NO** — ver abajo |
| Alcance | Envío de correo transaccional (onboarding, recordatorios de sesión) por la API de Resend |

**La evidencia de no-rotación es objetiva y temporal:** el secret `RESEND_API_KEY` tiene
`updated_at: 2026-07-19T15:29:05Z`. La clave se documentó como **comprometida** en tres informes:
`Blindaje_Seguridad_Contenido_2026-08-07.md`, `Auditoria_y_Plan_RLS_2026-08-11.md` y
`Diagnostico_RLS_8_restantes_2026-08-14.md`. **El `updated_at` (19-jul) es anterior a la primera nota
de compromiso (7-ago): el secret no se ha tocado desde antes de saberse comprometido.** Si se hubiera
rotado, `updated_at` sería posterior al 7 de agosto.

**Lo que NO puedo demostrar (INCONCLUYENTE):** si la clave sigue *activa y comprometida en el
proveedor* Resend. Comprobarlo exigiría usar la clave, lo que está prohibido. Lo demostrado es que
**no se ha rotado desde que se marcó comprometida**, que es lo accionable.

### Otros secretos

- **Stripe** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`): presentes como secretos, **no
  hardcodeados**. `stripe-webhook` valida la firma (`constructEventAsync(body, signature,
  webhookSecret)`) — correcto.
- **`DEV_MAIL_REDIRECT`**: artefacto de desarrollo. Un informe previo ya recomendó eliminarlo. Su
  presencia en producción no es una fuga, pero es residuo que debería retirarse.
- **Búsqueda de secretos hardcodeados en los 388 archivos versionados:** 0 coincidencias de claves
  Resend (`re_`), Stripe (`sk_live/sk_test`) o JWT (`eyJ...`). **Limpio.** Los únicos `.env` en git
  son `.env.example` y `mobile/.env.example`, ambos con placeholders. `.env` real está gitignorado y
  **nunca estuvo versionado** (`git log --all` sobre `.env` → vacío).

---

## 5. Inventario de `service_role` y superficies administrativas

### 5.1 Funciones `SECURITY DEFINER` en la base

```
total SECURITY DEFINER en public ............ 70
  todas con owner = postgres .............. 70   (ninguna de un rol inferior)
  sin search_path fijado .................. 0    (todas endurecidas)
  con EXECUTE restringido a service_role/postgres ... p.ej. push_notification
```

**Punto clave: las funciones `admin_*` saltan RLS y son ejecutables por `anon`/`authenticated`.** Eso
sería una escalada de privilegios **si no se auto-protegieran**. Se verificó que sí, y **medido, no
leído del código**:

```
precondición: plan del paciente = free
paciente  admin_set_plan(self, esencial) ... P0001 ADMIN_REQUIRED   [guarda del cuerpo, no RLS]
anon      admin_set_plan ................... P0001 ADMIN_REQUIRED
admin     admin_set_plan ................... PASA la guarda
estado posterior: plan = free   (sin cambio)
```

Las 5 (`admin_assign_patient`, `admin_get_directory`, `admin_set_plan`, `admin_set_status`,
`admin_unassign_patient`) empiezan con
`IF auth.uid() IS NULL OR get_my_role() IS DISTINCT FROM 'admin' THEN RAISE`. La guarda es
**efectiva**. `push_notification` está además correctamente restringida a `postgres`/`service_role`.

### 5.2 Edge Functions (usan la `SERVICE_ROLE_KEY` en el servidor)

| Función | `verify_jwt` | Usa service_role | Guarda | Clasificación |
|---|---|---|---|---|
| `admin-create-user` | true | sí | **verifica `role='admin'`** → 403 si no | **necesario** |
| `stripe-webhook` | true | sí | **valida firma de Stripe** | **necesario** |
| `send-session-reminders` | true | sí | JWT + lógica interna | **necesario** |
| `public-signup` | **false** | sí (crea/borra usuarios) | valida email/nombre/términos, dedup — **sin rate-limit ni captcha** | **excesivo/peligroso** |

La `SERVICE_ROLE_KEY` **nunca sale al frontend**: las cuatro funciones la leen de `Deno.env` en el
servidor. Correcto.

### 5.3 Clasificación de cada uso de bypass

| Uso | Clasificación | Motivo |
|---|---|---|
| 70 funciones DEFINER de `postgres` con `search_path` fijado | **necesario** | patrón deliberado del proyecto; RLS protege el acceso directo, la RPC autoriza dentro |
| `admin_*` ejecutables por `anon`/`authenticated` | **justificable** | grant amplio, pero guarda interna medida como efectiva |
| `push_notification` restringida a service_role | **necesario** | escritura de notificaciones solo del sistema |
| `admin-create-user`, `stripe-webhook`, `send-session-reminders` | **necesario** | verifican identidad/firma antes de usar service_role |
| **`public-signup` sin rate-limit** | **peligroso** | crea cuentas y envía correo sin autenticación ni límite |
| `service_role` conserva `DELETE`/`TRUNCATE` sobre todas las tablas | **justificable, con reserva** | inherente a service_role; el riesgo real lo materializa la ausencia de backups (§3) y H-JE-001 (§6) |
| `supabase_read_only_user` con `bypassrls` | **desconocido** | no se identificó consumidor; probablemente infra de dashboard. **INCONCLUYENTE** |

---

## 6. H-JE-001 — `journey_events` append-only vs TRUNCATE

**Confirmado. Medido limpio, revertido.**

```
precondición: journey_events = 58 filas reales
service_role DELETE 1 fila ... P0001 JOURNEY_EVENT_APPEND_ONLY   [el trigger SÍ actúa fila a fila]
service_role TRUNCATE ........ EJECUTADO   filas después: 0      <<< vació la tabla
capa: NINGUNA lo impide
```

El trigger `enforce_journey_event_append_only` es `FOR EACH ROW`. `TRUNCATE` **no dispara triggers de
fila**, y `service_role` conserva `D` (TRUNCATE) en la ACL. Resultado: **el append-only es real para
`DELETE`/`UPDATE` fila a fila, pero `service_role` puede vaciar la tabla entera de un golpe** saltando
la garantía. Revertido: la tabla vuelve a 58 filas al hacer `ROLLBACK`.

- **¿Es real?** Sí, medido dos veces (este informe y el sprint de `journey_events`).
- **Consecuencia:** la garantía de inmutabilidad del registro de recorrido es incompleta frente a
  `service_role`. El dato es telemetría (bajo valor clínico), pero la *promesa* de append-only no se
  cumple.
- **Capa que debería corregirlo:** un trigger `BEFORE TRUNCATE ... FOR EACH STATEMENT`, o un
  `REVOKE TRUNCATE ON journey_events FROM service_role`. No es RLS.

---

## 7. H-TB-001 — `therapist_time_blocks` DELETE como `service_role`

**Confirmado. Medido limpio, revertido.**

```
precondición: 2 filas sembradas (ambas del terapeuta)
service_role DELETE ........... ROW_COUNT = 0   filas después: 2   <<< NO borró nada, SIN error
capa: el trigger BEFORE DELETE entra por la rama `service_role -> RETURN NEW`;
      en un DELETE NEW es NULL -> devolver NULL cancela la fila, sin error
contraste (dueño autenticado, por id): 1 fila borrada   [rama RETURN OLD]
```

`enforce_time_block_ownership` empieza con
`IF (rol='service_role') OR (quien IS NULL AND rol='') THEN RETURN NEW`. En un `BEFORE DELETE`, `NEW`
es `NULL`; devolver `NULL` **cancela la operación silenciosamente**. Efecto: `service_role` **no puede
borrar** bloqueos, y no recibe error.

- **¿Es real?** Sí. Es un defecto de *corrección*, no una fuga: falla cerrado (bloquea el borrado),
  no abierto.
- **Consecuencia:** cualquier proceso de sistema/administrativo que intente limpiar bloqueos vía
  `service_role` fallará en silencio con `ROW_COUNT=0`. Bajo impacto de seguridad; sí impacto
  operativo si alguna vez se automatiza esa limpieza.
- **Capa que debería corregirlo:** la rama del trigger debería ser
  `IF TG_OP='DELETE' THEN RETURN OLD` también para `service_role`. Es un cambio de trigger, no de RLS.

> **Nota de aislamiento (regla cumplida):** durante la medición, un `DELETE ... WHERE reason=...` del
> dueño devolvió `42501`. **No es un defecto ni un cambio de capa: fue un error de mi guion** — `reason`
> no tiene grant de SELECT por columna (solo `id`, `therapist_id`), y un `WHERE` sobre una columna no
> legible da `42501`. Repetido con `WHERE id=...` (el patrón real de `deleteTimeBlock`): **1 fila
> borrada**. Documentado como ERROR DE SCRIPT.

---

## 8. Otros hallazgos descubiertos

1. **`public-signup` sin rate-limit ni captcha (ALTO).** `verify_jwt: false` (público por diseño),
   usa `service_role` para `createUser`/`deleteUser` y dispara un correo Resend por alta. Sin límite,
   un atacante puede crear cuentas en masa y **agotar la cuota de Resend** —dejando sin correo a los
   registros legítimos— además del ruido en `auth.users`/`profiles`. No pude ver si hay rate-limit a
   nivel de gateway/Cloudflare: a nivel de función **no hay ninguno**. Gateway: **INCONCLUYENTE**.
2. **`DEV_MAIL_REDIRECT` en producción (BAJO).** Secret de desarrollo que sigue presente; debería
   retirarse.
3. **Los `supabase/backups/*.sql` no son copias de datos (informativo, pero importante).** Restauran
   ACL/políticas, no filas. Nadie debe leerlos como capacidad de recuperación.
4. **`service_role` conserva `TRUNCATE`/`DELETE` sobre todas las tablas (contexto de H-JE-001).** No
   es un hallazgo nuevo en sí, pero combinado con "cero backups" convierte cualquier error operativo
   con la service key en pérdida permanente.

---

## 9. Matriz de riesgo

| Nivel | Riesgo | Consecuencia si se materializa | Demostrado |
|---|---|---|---|
| **CRÍTICO** | **Cero recuperación**: PITR off, 0 backups | Un `TRUNCATE`/`DROP`/corrupción = **pérdida permanente** de historias clínicas, evaluaciones, mensajería | Sí (Management API) |
| **ALTO** | **Clave de Resend comprometida y sin rotar** | Envío de correo suplantando el dominio, phishing a pacientes, agotamiento de cuota | Sí (no-rotación); provider INCONCLUYENTE |
| **ALTO** | **`public-signup` sin rate-limit/captcha** | Creación masiva de cuentas + inundación de correo Resend; onboarding legítimo bloqueado | Sí a nivel de función; gateway INCONCLUYENTE |
| **MEDIO** | **H-JE-001** (TRUNCATE salta append-only) | Registro de recorrido borrable por service_role, irrecuperable sin backups | Sí (medido, revertido) |
| **BAJO-MEDIO** | **H-TB-001** (service_role no borra time_blocks) | Limpieza administrativa de bloqueos falla en silencio | Sí (medido, revertido) |
| **BAJO** | `DEV_MAIL_REDIRECT` residual | Comportamiento de correo inesperado en desarrollo | Sí (existe el secret) |
| **INFO** | `service_role` con `TRUNCATE` global | Amplifica el CRÍTICO; sin backups no hay red de seguridad | Sí |

---

## 10. Qué está demostrado

- **PITR desactivado y 0 copias** (Management API, no inferencia).
- **La clave de Resend no se ha rotado** desde antes de marcarse comprometida (`updated_at` 19-jul <
  primera nota 7-ago). Vive solo como secret de Supabase; **no está hardcodeada** en ningún archivo
  versionado.
- **Ningún secreto hardcodeado** en los 388 archivos versionados; `.env` nunca estuvo en git.
- **Las guardas admin son efectivas**, medidas: `anon`/paciente → `ADMIN_REQUIRED`; admin pasa; el
  plan del paciente **no cambió**.
- **`admin-create-user` exige rol admin**; **`stripe-webhook` valida firma**.
- **H-JE-001 confirmado**: `TRUNCATE` como service_role vació 58→0 saltando el append-only.
- **H-TB-001 confirmado**: `DELETE` como service_role → `ROW_COUNT=0`, sin error, filas intactas.
- **Nada cambió**: 12 invariantes idénticos al baseline vivo del informe.

## 11. Qué NO está demostrado (INCONCLUYENTE)

- **Si la clave de Resend sigue activa/comprometida en el proveedor.** Requeriría usarla. Lo
  demostrado es la no-rotación.
- **El tier exacto del plan** (Free vs Pro). `selected_addons: []` + 0 backups lo indican fuertemente,
  pero no hubo campo explícito de tier.
- **Si existe rate-limit de `public-signup` a nivel de gateway/CDN.** A nivel de función no hay
  ninguno; el borde no es inspeccionable desde aquí.
- **El consumidor de `supabase_read_only_user` (bypassrls).** No se identificó; probablemente infra de
  dashboard.
- **Si alguna vez hubo un restore exitoso.** Con 0 backups es discutible: **hoy no hay nada que
  restaurar.**

---

## 12. Propuestas de remediación

Cada una responde el cuestionario de la regla de decisión. **Ninguna se aplica en esta fase.**

### R1 — Habilitar copias de seguridad y PITR (aborda el CRÍTICO)

- **¿Es real?** Sí. **¿Consecuencia de no hacerlo?** Pérdida permanente ante cualquier error
  irreversible. **¿Capa?** Infraestructura Supabase (probablemente requiere plan Pro + add-on PITR).
- **¿Reversible?** Activar backups es aditivo y reversible. **¿Backup previo?** No aplica (es el
  backup). **¿Decisión de producto?** **SÍ** — implica coste (plan Pro/add-on). **¿Rompe
  consumidores?** No. **¿Probable antes de aplicar?** No hay "prueba en transacción" para esto; se
  valida haciendo un restore de verificación *después*.
- **Precede a todo lo demás**, incluido el DROP de `test_scores` y de `guides`, que están aplazados
  precisamente por esto.

### R2 — Rotar la clave de Resend (aborda un ALTO)

- **¿Es real?** Sí. **¿Consecuencia?** Correo suplantado / cuota abusada mientras siga válida.
  **¿Capa?** Proveedor (Resend) + secret de Supabase. **¿Reversible?** Sí (se puede volver a rotar).
  **¿Backup previo?** No de base; sí anotar la fecha. **¿Decisión de producto?** Operativa, del
  responsable. **¿Rompe consumidores?** Solo si no se actualiza el secret a la vez; hay que rotar en
  Resend y actualizar `RESEND_API_KEY` en el mismo paso. **La debe ejecutar el responsable — no la
  toca este agente.**

### R3 — Rate-limit + captcha en `public-signup` (aborda un ALTO)

- **¿Es real?** Sí. **¿Consecuencia?** Abuso de altas y cuota de correo. **¿Capa?** Edge Function
  (código) + posible Turnstile/hCaptcha. **¿Reversible?** Sí. **¿Backup previo?** No. **¿Decisión de
  producto?** Menor (elegir proveedor de captcha). **¿Rompe consumidores?** El formulario de signup
  del frontend tendría que enviar el token de captcha — **sí toca frontend**. **¿Probable antes?** Sí,
  en un entorno de staging.

### R4 — Cerrar H-JE-001 (aborda un MEDIO)

- **¿Capa?** `REVOKE TRUNCATE ON journey_events FROM service_role` **o** trigger `BEFORE TRUNCATE`.
  **¿Reversible?** Sí (REVOKE se revierte con GRANT). **¿Backup previo?** El de ACL, como en los
  sprints. **¿Rompe consumidores?** No — ningún consumidor legítimo hace TRUNCATE. **¿Probable
  antes?** Sí, en transacción revertida. **Es el más barato y seguro de los cuatro.**

### R5 — Cerrar H-TB-001 (aborda un BAJO-MEDIO)

- **¿Capa?** Trigger `enforce_time_block_ownership` (corregir la rama service_role para `RETURN OLD`
  en DELETE). **¿Reversible?** Sí. **¿Backup previo?** El de la función. **¿Rompe consumidores?** No —
  hoy service_role no borra nada; el cambio solo *habilita* lo que debería. **¿Decisión de producto?**
  No. **¿Probable antes?** Sí. Bajo riesgo, pero **modifica un trigger** — fuera del patrón "solo
  ACL/RLS" de los sprints anteriores.

### R6 — Retirar `DEV_MAIL_REDIRECT` (BAJO)

- Trivial, del panel de secretos. Decisión operativa.

---

## 13. Orden recomendado de los próximos sprints

1. **R1 — Backups/PITR. Primero, y bloquea a los demás.** Sin capacidad de recuperación, ninguna
   operación irreversible (incluidos los DROP aplazados) es prudente. Requiere decisión de producto
   (coste). **La ejecuta el responsable en el panel de Supabase; este agente solo puede verificar
   después.**
2. **R2 — Rotar Resend.** Independiente de todo lo demás, alto impacto, bajo esfuerzo. **La ejecuta el
   responsable.**
3. **R4 — Cerrar H-JE-001** vía `REVOKE TRUNCATE` (con backup de ACL, idempotente, en transacción
   probada). Es el sprint técnico más limpio y encaja con la disciplina de los anteriores.
4. **R3 — Rate-limit/captcha en `public-signup`.** Toca frontend y backend; necesita staging.
5. **R5 — Cerrar H-TB-001** (trigger). Bajo riesgo pero modifica un trigger; hacerlo con el mismo
   rigor de backup/rollback.
6. **R6 — Retirar `DEV_MAIL_REDIRECT`.** Limpieza.

Y **solo después de R1**, retomar los DROP aplazados de `test_scores` y `guides`.

---

## 14. Criterios de parada

Se cumplieron; por eso este informe se detiene aquí:

1. **La remediación principal (R1) es una decisión de producto con coste** → requiere tu aprobación,
   no una migración automática.
2. **R2 y R1 solo puede ejecutarlas el responsable** (rotación de secreto en el proveedor; activación
   de plan/PITR) → prohibido a este agente por las reglas permanentes.
3. **Dos INCONCLUYENTE relevantes** (validez actual de la clave en el proveedor; rate-limit de
   gateway) → no se rellenan con suposiciones.
4. **Ningún hallazgo se convirtió en migración** — como pediste.

---

## 15. Anexo de mediciones

```
[Management API]
  pitr_enabled=false · walg_enabled=true · backups=[] · physical_backup_data={} · selected_addons=[]
  secretos=11 (nombres listados en §4) · RESEND_API_KEY updated_at=2026-07-19T15:29:05Z
  edge functions=4 (public-signup verify_jwt=false; resto true)

[Guarda admin — transacción revertida]
  paciente admin_set_plan(self,esencial) → P0001 ADMIN_REQUIRED · plan sigue 'free'
  anon     admin_set_plan                → P0001 ADMIN_REQUIRED
  admin    admin_set_plan                → pasa la guarda

[H-JE-001 — transacción revertida]
  precond 58 filas · DELETE 1 fila → P0001 JOURNEY_EVENT_APPEND_ONLY
  TRUNCATE → EJECUTADO · después 0 filas · ROLLBACK → 58

[H-TB-001 — transacción revertida]
  precond 2 filas · service_role DELETE → ROW_COUNT=0 · después 2 filas · sin error
  contraste dueño por id → 1 borrada

[Aislamiento del 42501 del dueño]
  WHERE reason=... → 42501 (columna sin grant SELECT) · WHERE id=... → 1 borrada
  veredicto: ERROR DE SCRIPT, no defecto

[Repositorio]
  388 archivos versionados · 0 secretos hardcodeados (re_ / sk_live|test / eyJ)
  .env nunca en git · solo .env.example (placeholders)
```

## 16. Anexo de invariantes

Huellas medidas **en vivo al iniciar** este diagnóstico (no heredadas) y **re-medidas al terminar**;
los 12 criterios idénticos:

```
RLS global ..................... 33
políticas global ............... 98
FORCE global ................... 0
journey_events filas ........... 58
therapist_time_blocks filas .... 0
user_preferences filas ......... 0
plan de paciente muestra ....... free   (sin cambio tras la prueba de guarda admin)
huella RLS ..................... 23020137a8a49271bcf1507452bb18b2
huella POL ..................... 0370cedbdbb62efb153e950a5f166d20
huella ACL ..................... d3ca583b100fbe4a3af7dfa65297b607
huella TRIGGERS ................ 3ca1288a327c51ad66d698009c86eb79
huella FUNCTIONS ............... e5e288e79a4b6f5b9364d7ffe902b7e1

>>> LOS 12 CRITERIOS OK — ninguna medición dejó rastro.
```

---

## Estado del diagnóstico

**Completado, sin aplicar ningún cambio. Esperando aprobación explícita.**

```
RLS 33/37 · FORCE 0/37 · políticas 98 · commits 0
PITR: false · backups: 0 · restore: imposible hoy
Resend: comprometida, sin rotar (updated_at 19-jul < nota 7-ago)
service_role: 70 DEFINER de postgres, guardas admin medidas efectivas, public-signup sin rate-limit
H-JE-001: confirmado (TRUNCATE) · H-TB-001: confirmado (DELETE=0 sin error)
ACL: 0 · triggers: 0 · funciones: 0 · datos: 0 · secretos: 0 tocados · PITR: 0 tocado · frontend: 0
```
