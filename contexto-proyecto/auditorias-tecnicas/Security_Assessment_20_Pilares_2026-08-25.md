# Security Assessment Report — Mente en Foco vs. 20 pilares de seguridad

**Fecha:** 25 de agosto de 2026 · **Alcance:** evaluación de la postura real del proyecto contra los 20
pilares (OWASP-alineados) solicitados. Basado en el código y la base reales (no en un template genérico).

**Stack (conocido, no asumido):** React 19 + TanStack Start/Router + Vite 7 + Tailwind v4 (frontend) ·
Supabase Postgres + RLS + Edge Functions (Deno) (backend/DB) · Stripe (test) · Resend (correo) ·
Cloudflare/Wrangler (deploy).

**Leyenda:** ✅ Sólido · ⚠️ Parcial / mejorable · ❌ Brecha · N/A No aplica hoy.

> Contexto: la mayor parte del hardening de datos (pilares 3, 4, 6, 8, 17) se construyó y verificó en el
> sprint RLS + la cola de agosto (33/37 RLS, 98→108 políticas, triggers de propiedad, vistas curadas). Las
> brechas reales están en la **capa web/infra** (headers, SCA, secret-scanning) y en **configuraciones
> externas** ya en la fase P0–P7 del roadmap (PITR, Turnstile, Resend).

---

## Resumen ejecutivo

| # | Pilar | Estado |
|---|---|---|
| 1 | Secrets management | ✅ (modelo correcto; sin bóveda dedicada, aceptable a esta escala) |
| 2 | Secretos fuera de Git | ⚠️ `.gitignore` cubre `.env*`; **falta escaneo automatizado** (pre-commit/CI) |
| 3 | Mínimo privilegio DB | ✅ roles anon/authenticated/service_role + GRANT por columna |
| 4 | RLS | ✅ 33/37 + todas las tablas nuevas owner-only (excepciones documentadas) |
| 5 | Cifrado de datos sensibles | ⚠️ AES-256 en reposo + TLS (plataforma); **sin cifrado a nivel de campo** para PII clínica |
| 6 | Auth forzada en servidor | ✅ RLS + `get_my_role()` + Edge Functions admin validan JWT+rol |
| 7 | Seguridad de logs | ⚠️ no se loguean secretos; sin librería formal de saneo |
| 8 | Mass assignment | ✅ GRANT por columna + trigger `enforce_profile_ownership` (role/plan bloqueados) |
| 9 | Cookies de sesión | ⚠️ token en `localStorage` (default supabase-js), no cookie `HttpOnly` |
| 10 | Hash de contraseñas | ✅ Supabase Auth (bcrypt); contraseñas aleatorias (fix webhook) |
| 11 | Rate limiting / lockout | ⚠️ signup con rate-limit (R3); login = defaults de Supabase |
| 12 | WAF & CAPTCHA | ⚠️ Turnstile escrito (R3) **inerte pendiente de claves**; Cloudflare WAF disponible |
| 13 | Auditoría de queries / APM | ❌ sin APM ni alertas de slow-query configuradas |
| 14 | Validación de entradas | ⚠️ validación manual en Edge Functions; sin esquema (Zod) sistemático |
| 15 | Escapado / XSS | ✅ React auto-escapa; 1 solo `dangerouslySetInnerHTML` (CSS de chart, no user input) |
| 16 | Subida de archivos | N/A no hay uploads de usuario hoy (PDF clínico se genera, no se sube) |
| 17 | Minimización de respuestas | ✅ vista `public_therapist_directory` (allowlist); PostgREST por columnas; tests guardan solo puntaje+banda |
| 18 | Cabeceras de seguridad HTTP | ❌ **sin CSP / X-Frame-Options / nosniff / Referrer-Policy** a nivel app |
| 19 | HTTPS / HSTS | ⚠️ HTTPS forzado por plataforma; **cabecera HSTS no seteada por la app** |
| 20 | Escaneo de dependencias | ❌ `npm audit`: **20 vulns (1 crítica, 9 altas)**; sin Dependabot/CI |

**Fortalezas** (ya construidas y verificadas): 3, 4, 6, 8, 10, 15, 17. **Brechas accionables**: 2, 18, 20
(capa web/infra) + 5, 9, 13, 14 (mejoras). **Pendientes externas** ya en roadmap: 11/12 (Turnstile — P1),
más PITR (P0) y Resend (P1) que refuerzan 5/19.

---

## Detalle por pilar

### 1. Secrets management — ✅
**Estado real:** las claves no viven en el frontend salvo las que son públicas **por diseño** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — la anon key está pensada para ser pública y protegida por RLS). `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `TURNSTILE_SECRET_KEY` viven **solo** en env de Edge Functions / `.env` local. Los scripts de verificación (`verify-pitr/turnstile/resend.cjs`) leen **solo metadata**, nunca valores.
**Mejora opcional:** una bóveda (Vault/Doppler) daría rotación y auditoría; hoy no se justifica por escala.

### 2. Secretos fuera de Git — ⚠️
**Estado real:** `.gitignore` cubre `.env`, `.env.local`, `.env.production`. Control compensatorio manual: **cada commit de esta sesión se revisó con grep de patrones de secreto** antes de crearlo. **Brecha:** no hay escaneo automatizado.
**Recomendación (nuevo ítem):** `gitleaks` o `trufflehog` como **pre-commit hook** (husky) + job en CI. Config conceptual:
```yaml
# .github/workflows/secret-scan.yml
- uses: gitleaks/gitleaks-action@v2   # bloquea el push si detecta un secreto
```

### 3. Mínimo privilegio en DB — ✅
`anon` (público, solo lo abierto), `authenticated` (acotado por RLS a lo propio), `service_role` (backend, salta RLS). **GRANT por columna** en `profiles` (el mecanismo fuerte contra escrituras privilegiadas), default privileges endurecidos (`20260808b`). La app nunca usa el owner `postgres`.

### 4. RLS — ✅ (núcleo del trabajo de agosto)
33/37 tablas base + todas las nuevas (`journal_entries`, `signup_rate_limit`, B2B) con RLS owner-only. Excepciones **documentadas y justificadas** (catálogos públicos `cie11_directory`/`public_tests`; `test_scores` cerrado por REVOKE). Políticas por `auth.uid()`/`get_my_role()`. *Nota:* FORCE RLS 0/37 — aceptable porque el owner (`postgres`) no lo usa la app; `service_role` salta RLS por diseño.

### 5. Cifrado de datos sensibles — ⚠️
**Estado real:** cifrado **en reposo AES-256** (gestionado por Supabase) y **en tránsito TLS** (plataforma). **Brecha:** no hay **cifrado a nivel de campo** para la PII clínica más sensible (anamnesis, notas). Hoy esos datos se protegen por **RLS + inmutabilidad de documentos firmados**, no por cifrado aplicativo.
**Recomendación:** evaluar cifrado de campo (pgcrypto o cifrado en la app) para los campos de mayor sensibilidad, dado que son categoría especial (Ley 1581 art. 5). Decisión de arquitectura — su propio ítem.

### 6. Auth forzada en servidor (Zero Trust) — ✅
Ninguna decisión de acceso depende del frontend. Toda regla vive en la base (RLS + triggers) o en Edge Functions que **validan el JWT y el rol en el servidor** (`admin-create-user` verifica `role='admin'` con el service key antes de actuar; ADR-011: "las reglas de producto viven en la base"). `public-signup` es `--no-verify-jwt` **a propósito** (endpoint público) y compensa con rate-limit + (pendiente) captcha.

### 7. Seguridad de logs — ⚠️
Los `console.error` de las Edge Functions registran mensajes de error, **no** contraseñas ni tokens; `TURNSTILE_SECRET_KEY`/`RESEND_API_KEY` nunca se imprimen; los scripts de verificación solo emiten metadata.
**Mejora:** si se adopta un agregador (Datadog/Logflare), añadir saneo/enmascaramiento explícito y restringir acceso.

### 8. Mass assignment — ✅ (verificado)
`profiles` tiene **GRANT por columna** (mecanismo primario) + trigger `enforce_profile_ownership` (defensa en profundidad) que **bloquea** cambiar `role` (`PROFILE_ROLE_LOCKED`), `plan_type`/`subscription_status` (`PROFILE_BILLING_LOCKED`) y el `id` desde una sesión no-admin. Un `{"role":"admin"}` inyectado en un UPDATE de perfil se **rechaza en la base**. `enforce_time_block_ownership` deriva `therapist_id := auth.uid()` en vez de aceptarlo del cliente. Patrón correcto.

### 9. Cookies de sesión — ⚠️
**Estado real:** `createClient(url, anonKey)` con opciones por defecto → supabase-js guarda el token en **`localStorage`**, no en cookie `HttpOnly`. Es el patrón SPA estándar. **Riesgo:** un XSS podría leer el token; mitigado por (15) el escapado de React y la ausencia de `innerHTML` con input de usuario.
**Recomendación:** migrar a almacenamiento en **cookie `HttpOnly` + `Secure` + `SameSite`** vía `@supabase/ssr` (dado que ya hay SSR con TanStack Start). Mejora de defensa en profundidad.

### 10. Hash de contraseñas — ✅
Supabase Auth hashea con **bcrypt** (gestionado). Nunca texto plano. Tras el fix del webhook, las cuentas se crean con **contraseña aleatoria criptográfica** (nunca derivada del email) + enlace recovery.

### 11. Rate limiting & lockout — ⚠️
`signup_rate_limit` (R3): **5/hora, 20/día por IP** en `public-signup`, con k-tabla RLS deny-all y función atómica. **Login:** depende de los **rate limits nativos de Supabase Auth** (existen), sin lockout por cuenta propio.
**Mejora:** considerar lockout/backoff explícito en login si se observan credential-stuffing.

### 12. WAF & CAPTCHA — ⚠️ (pendiente de claves — P1)
Turnstile **escrito** (backend verifica el token contra Cloudflare; frontend renderiza el widget) pero **inerte**: `verify-turnstile.cjs` confirma `TURNSTILE_SECRET_KEY` **AUSENTE** → captcha omitido (fail-safe), el rate-limit protege mientras tanto. El deploy es Cloudflare → **WAF de Cloudflare disponible** (activar reglas gestionadas es config de panel).

### 13. Auditoría de queries / APM — ❌
Supabase da logs y observabilidad básica, pero **no hay APM ni alertas de slow-query** configuradas.
**Recomendación:** habilitar `pg_stat_statements` + alertas; integrar un APM ligero si crece el tráfico. Bajo a esta escala.

### 14. Validación de entradas — ⚠️
Las Edge Functions validan manualmente (regex de email, longitud de nombre, `terms_accepted`). PostgREST/supabase-js **parametriza** (no hay concatenación SQL → SQLi mitigada), y RLS acota. **Brecha:** no hay un esquema declarativo (Zod) uniforme sobre los bodies.
**Recomendación:** Zod en la frontera de cada Edge Function:
```ts
const Body = z.object({ email: z.string().email(), full_name: z.string().min(2), terms_accepted: z.literal(true) });
const parsed = Body.safeParse(await req.json()); if (!parsed.success) return fail("Datos inválidos", 400);
```

### 15. Escapado / XSS — ✅
React auto-escapa por defecto. Único `dangerouslySetInnerHTML` en `src/components/ui/chart.tsx` (inyecta **CSS de colores del chart**, no input de usuario). `escapeHtml()` en los correos de las Edge Functions. Comentarios del blog con **moderación previa** (ADR-011). Sin superficie de XSS reflejado/almacenado con input de usuario.

### 16. Subida de archivos — N/A
No hay uploads de usuario en `src/` (`git grep storage.from/.upload` → vacío). El PDF clínico se **genera** en cliente (jspdf/html2canvas), no se sube. Si se añade carga (p.ej. foto de perfil), aplicar el checklist: MIME real (magic numbers), tamaño máx., bucket aislado sin ejecución.

### 17. Minimización de respuestas — ✅
`public_therapist_directory` es una **vista de columnas allowlist** filtrada a `active+verified` (construida este mes justo para no exponer `license_number`/`availability`). Las consultas PostgREST piden **columnas específicas**, no `select *`. Los tests públicos guardan **solo puntaje total + banda**, nunca respuestas individuales (filosofía §"sensible por definición").

### 18. Cabeceras de seguridad HTTP — ❌ (brecha real)
No se encontró CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy` (sin `helmet`, sin `public/_headers`, sin headers en `wrangler.jsonc`).
**Recomendación (nuevo ítem):** archivo `public/_headers` (Cloudflare Pages/Workers) o middleware de TanStack Start:
```
/*
  Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; ...
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```
(La CSP hay que calibrarla con los orígenes reales: Supabase, Cloudflare Turnstile, Stripe.)

### 19. HTTPS / HSTS — ⚠️
HTTPS lo **fuerza la plataforma** (Supabase + Cloudflare). Falta la cabecera **`Strict-Transport-Security`** a nivel de la app (va junto con el pilar 18). TLS ≥1.2 lo cubre Cloudflare.

### 20. Escaneo de dependencias (SCA) — ❌ (brecha real; **1 crítica de runtime a corregir ya**)
`npm audit` hoy: **20 vulnerabilidades (1 crítica, 9 altas, 8 moderadas, 2 bajas)**. Triaje verificado por
cadena de dependencias (`npm ls`):
- **CRÍTICA — `seroval` (CVSS 9.8, GHSA-mv8w-475r-vwqw):** *type confusion* en `seroval.fromJSON()` que
  invoca métodos controlados por el atacante al deserializar. **Es dependencia de RUNTIME de producción**
  (transitiva de `@tanstack/react-router` y `@tanstack/react-start` — serialización SSR Worker↔cliente).
  **No es dev-only → se corrige de inmediato**, `fixAvailable: true`. (Matiz: en el flujo normal el cliente
  deserializa payload del propio servidor, no input del atacante; aun así se parchea.)
- **9 ALTAS — todas build/deploy tooling**, no llegan al bundle del navegador ni al runtime del Worker:
  `vite` (build), `undici` (miniflare + cheerio de build; el Worker usa fetch nativo), `ws` (miniflare +
  fallback Node de supabase-js, no se bundlea), `miniflare` (sim local), `sharp` (imágenes de build),
  `postcss`/`nanoid`/`brace-expansion`/`js-yaml` (cadena de build).
**Acción:** (1) **ya** — `npm audit fix` para parchear `seroval` (crítica de runtime); (2) **P8** — Dependabot
(`.github/dependabot.yml`) o Snyk en CI + triaje periódico de las altas de build.

---

## Ítems nuevos propuestos para el roadmap (no estaban en P0–P7)

Agrupables como **P8 · Hardening web/infra** (independiente de las configuraciones externas P0–P7):
1. **Cabeceras de seguridad HTTP** (CSP/HSTS/X-Frame/nosniff/Referrer) vía `public/_headers` de Cloudflare. *(pilar 18/19 — brecha, esfuerzo bajo, impacto alto)*
2. **SCA / escaneo de dependencias**: `npm audit fix` triado + Dependabot en CI. *(pilar 20 — 1 crítica + 9 altas)*
3. **Secret-scanning automatizado**: `gitleaks` pre-commit + CI. *(pilar 2)*
4. *(Evaluación)* **Cookie `HttpOnly` de sesión** vía `@supabase/ssr`. *(pilar 9)*
5. *(Evaluación)* **Zod** en la frontera de las Edge Functions. *(pilar 14)*
6. *(Evaluación)* **Cifrado a nivel de campo** para PII clínica de máxima sensibilidad. *(pilar 5)*
7. *(Evaluación)* **APM / alertas de slow-query**. *(pilar 13)*

Los pilares 11/12 (rate-limit+captcha) ya están en P1 (Turnstile); PITR (P0) y Resend (P1) refuerzan 5/19.
Ninguno de estos ítems nuevos toca las configuraciones externas bloqueadas: son código/config que se pueden
preparar sin depender del responsable.
