# Prompt para Claude Code — Cerrar la sesión de auth/OAuth de hoy + expansión

Contexto: retomamos una sesión que quedó interrumpida a propósito (te detuviste después de escribir la
migración de OAuth, esperando confirmación de que se ejecutara). Verifiqué el estado real del repo desde mi
sandbox (sin acceso de red a Supabase, pero sí al mismo working tree que usas tú) y confirmo exactamente dónde
quedó todo antes de darte instrucciones nuevas.

## Estado verificado ahora mismo

- `git log`: 9 commits locales por delante de `origin/main`, el último es `113515f` (widgets de dashboard).
- Sin commitear todavía: `public/images/pasareladepago.jpg` (subida, correcta), el cambio en
  `src/routes/ingresa.tsx` que apunta `BRAND_PANEL_IMAGE` a esa imagen, y
  `supabase/20260721_oauth_profile_automation.sql` (escrita, sin ejecutar).
- Pendiente sin empezar: Fase 3 (borrar el lead roto) y Fase 4 (commit) de tu propio resumen de sesión.

Antes de escribir código nuevo, retoma exactamente donde quedaste:

## Parte 0 — Terminar lo que empezamos

1. Ejecuta la migración que ya escribiste:
   ```
   node run_sql_migration.cjs supabase/20260721_oauth_profile_automation.sql
   ```
   Confírmame que corrió sin error antes de seguir.
2. **Fase 3:** elimina de `auth.users` y de `profiles` el registro asociado a `sgreyes2000@gmail.com` (el
   lead roto que quedó sin credenciales). **Regla estricta, sin excepción:** no toques ninguna cuenta
   `@test.com` (`admin@test.com`, `terapeuta@test.com`, `paciente.free@test.com`, `paciente.esencial@test.com`,
   `paciente.integral@test.com`, `paciente.premium@test.com`).
3. **Fase 4:** commit de lo pendiente (imagen + `ingresa.tsx` + la migración de OAuth) con
   `fix: oauth auto-profile and asset update`, como ya tenías planeado.
4. Con la migración corrida y confirmada, recién ahí activa el provider de Google en Supabase Auth (client ID
   + secret desde Google Cloud Console). Si lo activas antes de correr la migración, vuelves a crear perfiles
   huérfanos.
5. `git push origin main` — deja los 10 commits (los 9 anteriores + este) en `origin/main`. Ya tienes
   autorización para este push; no hace falta que me confirmes antes de correrlo esta vez.

## Parte 1 — Lo que el trigger de hoy no resuelve (expansión, nueva)

El trigger `handle_new_auth_user` resuelve que exista el perfil. No resuelve dos cosas que sí necesitamos:
que el usuario acepte el tratamiento de datos, y que la plataforma tenga los datos mínimos para operar con él
(cédula para facturación electrónica DIAN, teléfono, contacto de emergencia). Investigué la normativa vigente
(Resolución Única DIAN 000227 de 2025): solo se pueden exigir 3 campos al comprador — nombre, tipo+número de
identificación, correo — así que pedir cédula está justificado y acotado, no es sobre-pedir datos.

### 1.1 Migración — añadir a `supabase/20260721_oauth_profile_automation.sql` (o una nueva, tu criterio)

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cedula text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

COMMENT ON COLUMN profiles.cedula IS
  'Numero de identificacion. Requerido para facturacion electronica DIAN antes de poder cobrar un plan pago (Resolucion Unica DIAN 000227 de 2025 exige nombre + tipo/numero de identificacion + correo al comprador).';
COMMENT ON COLUMN profiles.emergency_contact_name IS
  'Contacto de emergencia del paciente. Dato de seguridad clinica, no solo administrativo: a quien escalar si una crisis supera el alcance del terapeuta asignado.';
```

### 1.2 Gate de "completar perfil" post-OAuth

Mismo patrón que ya usaste para `must_change_password` en el signup gratuito (gate en `useAuth`/`ingresa.tsx`
que bloquea el resto de la app hasta resolverse). Aquí son dos pasos, en orden, solo para
`role === 'patient'` (nunca para admin/therapist):

1. Si `profile.terms_accepted_at` es `null` → pantalla de aceptación de tratamiento de datos. Reusa el
   contenido de `PrivacyPolicyModal.tsx` pero en una vista de pantalla completa (no modal) con un solo botón
   "Acepto y continúo", que al confirmar hace `UPDATE profiles SET terms_accepted_at = now(), terms_version =
   PRIVACY_POLICY_VERSION WHERE id = ...`. Este paso es el único que le falta al usuario de OAuth para tener
   el mismo nivel de consentimiento que ya tiene el del signup manual — no actives el provider de Google en
   producción (parte 0.4) sin tener este gate listo, o vas a tener usuarios reales sin consentimiento
   registrado y sin forma de pedírselo después de que ya están navegando.
2. Una vez aceptado, si falta `cedula`, `phone` o `emergency_contact_name`/`emergency_contact_phone` →
   pantalla breve de 3-4 campos. Explica el "para qué" de cada uno en el copy (no lo dejes como un formulario
   en blanco): "tu número de identificación es necesario para poder facturarte cuando actives un plan pago" /
   "tu contacto de emergencia es para que tu terapeuta sepa a quién avisar si es necesario". Guárdalo con un
   `UPDATE profiles`.

Nota importante de diseño: este gate es **distinto** del gate de `must_change_password` que ya existe para el
signup gratuito manual — son casos mutuamente excluyentes según `signup_source` (`web_free_signup` vs
`oauth`), pero resuélvelos en el mismo bloque de lógica de gates en `useAuth`/`ingresa.tsx` para que no queden
dos flujos de "pantalla obligatoria antes del dashboard" divergentes y difíciles de mantener.

### 1.3 Métrica de confianza en el panel de login (gratis, sin backend)

El panel izquierdo de marca (`BrandPanel` en `ingresa.tsx`) hoy dice genéricamente "un lugar seguro para
cuidar tu salud mental". La landing (`src/routes/index.tsx`) ya tiene el contador "+5,000 Pacientes
Atendidos". Reutiliza ese mismo dato en el panel de login (una línea de texto, sin lógica nueva) — es la forma
más barata de cerrar parte de la brecha de confianza frente a Selia, que se apoya fuerte en su prueba social
(83.000 reseñas a 4.92/5) en el primer contacto con el usuario.

## Qué hacer con este documento

1. Ejecuta la Parte 0 completa primero (migración → fase 3 → commit → activar Google → push). No actives el
   provider de Google antes de confirmar que la migración corrió.
2. Luego la Parte 1 (gates de consentimiento + datos + métrica de confianza).
3. Cuando termines, dime: si la migración de OAuth corrió sin error, si el lead roto se borró sin tocar las
   cuentas `@test.com`, y si probaste el gate nuevo creando un usuario de prueba por Google (o simulando
   `signup_source='oauth'` y `terms_accepted_at=null` en una cuenta de prueba) para confirmar que efectivamente
   bloquea el dashboard hasta completarse.
