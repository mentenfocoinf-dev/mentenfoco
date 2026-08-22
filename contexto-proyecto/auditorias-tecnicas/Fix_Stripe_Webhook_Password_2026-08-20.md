# Fix — webhook de Stripe creaba la cuenta con contraseña = correo

**Fecha:** 20 de agosto de 2026 · **Tipo:** fix de seguridad acotado (sin migración). **Independiente de R1-R6.**
**Marco:** ADR-013 (seguridad técnica que expone a terceros se cierra siempre) + ADR-006 (backend sostiene lo
que la interfaz promete).

## El defecto (con evidencia)

`supabase/functions/stripe-webhook/index.ts`, handler `checkout.session.completed`, rama de compra directa
sin sesión (`!userId && customerEmail`). Línea original:

```ts
// Credenciales Espejo: el correo funciona como contraseña inicial
generatedPassword = customerEmail;   // password = email, literal
```

La cuenta del paciente (rol `patient`, `plan_type=premium`, `subscription_status=active`) quedaba con
**contraseña igual a su correo** — adivinable por cualquiera que supiera el email. Agravantes medidos:

- El webhook **no** seteaba `must_change_password`, así que el gate de cambio (`onboardingGates.ts:79`, que sí
  existe y funciona) **no se disparaba**: la contraseña-igual-al-email era permanente.
- El webhook **no** enviaba correo (solo `console.log`), pese a que `/compra-exitosa` **ya promete** *"un
  enlace para activar tu cuenta y establecer tu contraseña"* → violación ADR-006/ADR-005 (la UI prometía algo
  que el backend no cumplía).
- **Cuentas afectadas hoy: 0** (0 profiles con `stripe_customer_id`; Stripe en modo test). El fix es
  **preventivo**, no hubo limpieza de cuentas existentes.

## Alcance del patrón

Aislado en el webhook. `public-signup` ya era correcto (contraseña aleatoria `generatePassword()` +
`must_change_password: true` + envío de la temporal). `admin-create-user` recibe la contraseña del request
(mín. 8 chars, no derivada del email) y la comunica el admin — no es esta vulnerabilidad; queda anotado como
item aparte de severidad baja (tampoco setea `must_change_password`).

## El fix

En la rama de creación del webhook:

1. **Contraseña aleatoria criptográfica** (`generatePassword()`, patrón de `public-signup`), **nunca** el
   email. No se almacena, registra ni envía. Cierra el hueco de inmediato, **sin dependencia externa**.
2. **`must_change_password: true`** solo para cuentas **nuevas** creadas por el webhook (no para cuentas
   existentes que compran). Defensa en profundidad.
3. **Enlace `recovery` por Resend** (`admin.generateLink({ type: 'recovery', redirectTo: SITE_URL/ingresa })`)
   con la voz del producto, para que el usuario **cree su propia contraseña** — cumpliendo lo que
   `/compra-exitosa` ya promete. Envío no-fatal: si falla, la cuenta sigue segura (clave aleatoria) y el
   usuario puede pedir el enlace desde "¿Olvidaste tu contraseña?".
4. Eliminado el `console.log` de "Credenciales Espejo".

**Flujo resultante (verificado por lectura):** enlace `recovery` → sesión + `/ingresa` → `useAuth` lee perfil
→ gate ve `must_change_password:true` → `/nueva-contrasena` → el usuario fija su clave y la línea 69 limpia el
flag. Un solo flujo, sin doble prompt. No tocó `compra-exitosa.tsx` (ya describía el flujo correcto).

## Verificación

- Sin migración: `must_change_password` ya existía y el gate estaba cableado.
- **build ✓** · **tests 220/220** tras el cambio.
- Sin tocar R1-R6, RLS, ni los archivos de R3 sin commitear. **No se introdujo `DEV_MAIL_REDIRECT`** (R6 sin
  expandir). Sin Stripe live.

## Pendientes / notas

- **Entrega del correo** del enlace a clientes reales depende de **R2** (dominio Resend verificado; hoy en
  modo prueba). La **seguridad** del fix no depende de eso. Con 0 clientes reales y Stripe en test, aceptable.
- **Discrepancia de copy a verificar:** `/compra-exitosa` afirma que el enlace es *"válido por 24 horas"*,
  pero la expiración de los enlaces de recovery es un ajuste de Auth de Supabase (por defecto ~1 h). El correo
  del webhook evita afirmar un número concreto ("por seguridad el enlace caduca; pide uno nuevo si expira").
  Alinear el ajuste de Auth a 24 h **o** corregir el copy de la página — fuera del alcance de este fix.
- **`admin-create-user`**: item aparte, severidad baja (roadmap).
