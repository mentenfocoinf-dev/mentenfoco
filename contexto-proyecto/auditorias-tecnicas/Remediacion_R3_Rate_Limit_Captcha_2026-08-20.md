# Remediación R3 — rate-limit + captcha en `public-signup`

**Fecha:** 20 de agosto de 2026 · **Continúa:** `Remediacion_Seguridad_2026-08-18.md` (R4/R5) y
`Diagnostico_Seguridad_Post_RLS_2026-08-14.md`.

Cierra la mitad de infraestructura de **R3**. El backend de rate-limit queda **aplicado y validado**
en la base; el captcha (Turnstile) y el cableado del rate-limit quedan **escritos en código, pendientes
de las claves reales y del despliegue del Edge Function**. **R6 sigue bloqueado por R2** (ver al final).

**Disciplina aplicada al cambio de base:** baseline vivo → backup → prueba en transacción revertida →
aplicación → 4 pasadas de idempotencia → validación funcional sobre la función viva → invariantes →
rollback real → comparación con baseline → reaplicación → documentación. Ningún hash heredado.

---

## El problema, demostrado (solo lectura, 20-ago)

`public-signup` es una Edge Function pública (`--no-verify-jwt`). Sus únicas validaciones eran formato
de email, longitud de nombre y `terms_accepted`. **Sin rate-limit ni captcha:** un anónimo podía POSTear
sin tope, y cada request creaba un usuario Auth + fila en `profiles` + un correo Resend. Impacto real:
abuso automatizable, coste de Resend y daño a la reputación del dominio de envío (justo lo que R2
protege). `git grep turnstile|captcha|rate_limit` sobre `supabase/` y `src/` → **0 referencias**; no
existía tabla de throttle.

---

## Parte 1 — Backend de rate-limit (APLICADO)

**Migración:** `supabase/20260820_signup_rate_limit.sql` ·
**Backup:** `supabase/backups/20260820_pre_signup_rate_limit.sql`

### Qué crea (aditivo puro; no toca ningún objeto existente)

- **Tabla `public.signup_rate_limit(ip_hash, window_start, count)`** — contadores por IP hasheada y
  ventana horaria. PK `(ip_hash, window_start)`. **RLS activo SIN políticas** (deny-all): `anon` y
  `authenticated` no pueden leer ni escribir (las IPs son dato sensible); solo `service_role` (que salta
  RLS) y el owner `postgres` operan la tabla. `REVOKE ALL … FROM anon, authenticated`.
- **Función `public.enforce_signup_rate_limit(p_ip_hash text)`** — `SECURITY DEFINER`,
  `search_path=public`, **atómica**: poda oportunista de buckets >48h, incremento del bucket de la hora
  actual (`INSERT … ON CONFLICT DO UPDATE`), suma de las últimas 24h, y devuelve
  `(allowed, hourly, daily)`. **Límites aprobados: 5/hora y 20/día por IP** (`allowed = hourly ≤ 5 AND
  daily ≤ 20`; el intento actual ya está contado, así que el 5.º de la hora pasa y el 6.º se bloquea; el
  20.º del día pasa y el 21.º se bloquea).

### DEFECTO DE SCRIPT aislado y corregido antes de dar por buena la migración

> Tras la primera aplicación, `has_function_privilege('anon', …, 'EXECUTE')` seguía dando **true**.
> Aislado: **`ALTER DEFAULT PRIVILEGES` (de `postgres`/`supabase_admin`) concede EXECUTE en toda función
> nueva a los roles NOMBRADOS `anon`/`authenticated`/`service_role`**. Mi `REVOKE … FROM PUBLIC` no los
> quitaba (el grant no es a PUBLIC, sino a roles nombrados). Corregido a
> `REVOKE ALL … FROM PUBLIC, anon, authenticated`. Reaplicado (idempotente): `proacl` queda
> `service_role=X/postgres`; execute **false/false/true** (anon/authenticated/service_role). La tabla ya
> estaba bien porque revoqué de `anon, authenticated` por nombre desde el inicio.

### Prueba en transacción revertida (antes de aplicar)

```
horario (5/hora), IP=hourA:  intentos 1..5 allowed=true · intento 6 allowed=false   ✔ BLOQUEADO
diario  (20/día), IP=dayB con 19 previos en otra hora:
  intento 20 -> allowed=true  (daily=20)                                            ✔
  intento 21 -> allowed=false (daily=21, hourly solo 2)   → bloquea el diario, no el horario  ✔
aislamiento IP=freshC -> allowed=true, hourly=1                                      ✔
poda >48h: bucket de 50h eliminado en la siguiente llamada                          ✔
RLS=true · políticas=0 (deny-all)
```

### Aplicación, idempotencia, validación

**4 pasadas idénticas** sin error. **Validación funcional sobre la función ya desplegada** (en tx
revertida, sin ensuciar la tabla): horario 5/6 y diario 20/21 idénticos a la prueba; la tabla quedó en
**0 filas** tras revertir.

### Invariantes (post-aplicación)

```
tablas base 37 → 38 · con RLS 33 → 34 · FORCE 0 · políticas 98 (sin cambio) · funciones 273 → 274
signup_rate_limit: RLS true, 0 políticas, ACL = postgres + service_role (anon SELECT=false)
función execute anon/auth/service = false/false/true
R4 activo (journey_events service_role TRUNCATE=false) · R5 activo (enforce_time_block_ownership md5 059881b0)
huella FUNCTIONS  56046fff → c01ec3f0   (cambia por +1 función)
huella ACL global 2cde6e70 → 74141c34   (cambia por +1 tabla)
```

### Round-trip

- **Rollback real** (backup: `DROP FUNCTION` + `DROP TABLE`): vuelve **EXACTO** al baseline — tablas 37,
  RLS 33, funciones 273, huella FUNCTIONS `56046fff`, huella ACL `2cde6e70`.
- **Reaplicación:** vuelve a 38/34, funciones 274, huellas `c01ec3f0` / `74141c34`, execute false/false/true.

**Estado parte 1:** aplicado. El rate-limit por IP está activo en la base y es invocable por
`service_role`.

---

## Parte 2 — Edge Function + frontend (ESCRITO, pendiente de claves y despliegue)

### `supabase/functions/public-signup/index.ts`

- **Captcha Turnstile:** `verifyTurnstile(token, ip)` verifica contra
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` con `TURNSTILE_SECRET_KEY`. **Si el secret
  no está configurado, el captcha se OMITE** (fase previa a aprovisionar; fail-safe para no romper el
  signup en producción). Con secret configurado, un token ausente/ inválido corta con **403**; un fallo
  de red con el captcha activo es **fail-closed**.
- **Rate-limit:** obtiene la IP de `x-forwarded-for`, la hashea (SHA-256) e invoca por RPC
  `enforce_signup_rate_limit` como `service_role` **antes de crear nada**; si `allowed=false` responde
  **429**. **Siempre activo** (no depende de Turnstile).
- **Orden:** validación básica → captcha → rate-limit → dedup → createUser. **No se tocó
  `DEV_MAIL_REDIRECT`** (R6 bloqueado por R2).

### `src/components/SignupModal.tsx`

- Componente `TurnstileWidget` que carga el script de Cloudflare y renderiza el widget con
  `VITE_TURNSTILE_SITE_KEY`. **Si el site key no está, el widget no se renderiza y el submit no lo
  exige** (simétrico al backend). Con site key, el submit se bloquea hasta tener token; el token viaja
  como `captcha_token` en el `invoke`. Tras un intento fallido se remonta el widget (tokens de un solo
  uso). Copy en español neutro, sin urgencia artificial.

### Nombres de env (a documentar y cargar)

| Env | Dónde | Quién la carga | Estado |
|---|---|---|---|
| `TURNSTILE_SECRET_KEY` | secret del Edge Function | el responsable (no en chat) | **pendiente** |
| `VITE_TURNSTILE_SITE_KEY` | build del frontend (público) | el responsable | **pendiente** |

### Verificación

- **build ✓** (6.36s) · **tests 220/220** con los cambios de frontend.
- **Pendiente de verificación end-to-end:** el Edge Function **no se ha desplegado** desde aquí, y el
  captcha **no se ha probado de punta a punta** por no disponer de las claves reales. En cuanto el
  responsable cargue `TURNSTILE_SECRET_KEY` (Edge Function) y `VITE_TURNSTILE_SITE_KEY` (frontend) y se
  despliegue `public-signup`, la verificación se activa automáticamente. **El rate-limit ya está
  operativo en la base**, así que el signup no queda sin protección en el intervalo.

---

## Discrepancias

- **FALLO REAL:** ninguno.
- **DEFECTO DE SCRIPT:** el `REVOKE … FROM PUBLIC` que no quitaba el EXECUTE de `anon`/`authenticated`
  (por default privileges a roles nombrados). Aislado, corregido y reaplicado.
- **DEFECTO PREEXISTENTE cerrado (parcial):** falta de rate-limit en `public-signup` (backend cerrado;
  captcha a falta de claves).
- **CAMBIO DE CAPA:** ninguno.
- **INCONCLUYENTE / pendiente de verificación:** el captcha end-to-end, por no tener claves ni despliegue.

---

## Estado y bloqueos

- **R3 backend:** aplicado (tabla + función, RLS 34/38, funciones 274).
- **R3 captcha + cableado:** escrito; **falta cargar 2 claves y desplegar el Edge Function**.
- **R6 — retirar `DEV_MAIL_REDIRECT`:** **BLOQUEADO por R2.** El responsable confirmó que el dominio
  propio de Resend **sigue sin verificar** (modo prueba). Quitar `DEV_MAIL_REDIRECT` antes de verificar
  el dominio rompería la entrega real de credenciales. No se tocó el código de R6; queda a la espera de
  que R2 (rotación + dominio verificado) esté cerrado.
- **R1 (PITR/backups) y R2 (rotar Resend):** siguen pendientes del responsable.
- **Git:** los archivos de R3 (migración, backup, código de Edge Function y frontend, este informe,
  roadmap) quedan **sin commitear**, a la espera de aprobación explícita.
