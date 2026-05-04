# Informe de Auditoría Técnica y Ciberseguridad 360°

**Proyecto:** Mente en Foco
**Fecha:** 23 Abril 2026

## 🚦 Semáforo de Seguridad (Estado Global)

- **FASE 1 - Ciberseguridad (Hardening):** 🟡 **ADVERTENCIA**
- **FASE 2 - Integridad Técnica:** 🔴 **CRÍTICO**

---

### Fase 1: Auditoría de Ciberseguridad (Hardening)

#### 1. RLS (Row Level Security) — 🟡 ADVERTENCIA
- **Hallazgo:** No existen archivos de migraciones SQL locales para poder verificar las políticas RLS estáticamente.
- **Acción Requerida:** Es imperativo acceder al Dashboard de Supabase (Editor SQL / Authentication) y comprobar que las tablas (`profiles`, `crm_leads`, `clinical_tasks`) tienen activo `Enable RLS` y cuentan con políticas estrictas (ej. `(auth.uid() = id)` para `profiles`).

#### 2. Fuga de Variables de Entorno — 🟢 SEGURO
- **Hallazgo:** El frontend es seguro. No existen rastros de `STRIPE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` en el código fuente del cliente. Solo se detectó el uso correcto de `VITE_STRIPE_PUBLISHABLE_KEY` y `VITE_SUPABASE_ANON_KEY`, los cuales son públicos y seguros para el navegador.

#### 3. Sanitización de Inputs — 🟢 SEGURO (CORREGIDO EN ESTA AUDITORÍA)
- **Hallazgo Anterior:** El formulario en `contactanos.tsx` insertaba datos a Supabase sin ninguna validación previa (riesgo de inyección en campos de texto, datos maliciosos en la base de datos).
- **Corrección Aplicada:** Se implementó `zod` para validar y escapar nombres (solo letras, longitud máxima), formato estricto de email y saneamiento del teléfono antes de interactuar con la BD.

#### 4. Gestión de Sesiones — 🟢 SEGURO (CORREGIDO EN ESTA AUDITORÍA)
- **Hallazgo Anterior:** En `ingresa.tsx` la sesión se manejaba de forma puramente manual (solo al momento de dar clic en login). Si el token expiraba o el usuario recargaba la página, el estado se perdía dejando la sesión rota en el cliente.
- **Corrección Aplicada:** Se integró un listener global `supabase.auth.onAuthStateChange`. Ahora, si el token expira o la sesión es revocada remotamente, el sitio redirecciona inmediatamente al login limpiando el estado global. También persiste la sesión al recargar la página.

---

### Fase 2: Valoración Técnica e Integridad

#### 1. Mapeo de Rutas y Fallas de Conexión — 🟢 SEGURO
- **Hallazgo:** Se rastrearon todas las anclas y elementos de navegación. **No se encontraron enlaces rotos ni botones apuntando a `#` (Dead Links)**. El mapeo en `__root.tsx` e `index.tsx` cuenta con un sistema de rutas estático bien definido bajo TanStack Router.
- **Lista de Fallas de Conexión:** Ninguna (0 rutas rotas detectadas).

#### 2. Estado de Stripe — 🔴 CRÍTICO
- **Hallazgo:** No existe un endpoint para el webhook de Stripe en el código actual (ej. falta una *Supabase Edge Function* o ruta de API del lado del servidor).
- **Riesgo:** El ecosistema no está preparado para recibir eventos. El servidor no puede validar eventos de pago (`checkout.session.completed`), dejando a la plataforma sin capacidad para otorgar planes, renovar membresías o revocar accesos en caso de pagos fallidos de manera automatizada de forma segura.

#### 3. Consistencia de Branding — 🟢 SEGURO
- **Hallazgo:** Se buscaron rastros del branding anterior ("Mente Sana") en SEO, logs, comentarios y metadatos en todo el repositorio. **El resultado es completamente limpio.** La identidad de "Mente en Foco" se mantiene al 100%.

---

## 🗺️ Hoja de Ruta (Pasos para "Listo para Producción")

1. **Configurar el Webhook de Stripe (Edge Functions):**
   - Crear una función en Supabase (ej. `supabase/functions/stripe-webhook`).
   - Implementar validación de firmas (`stripe.webhooks.constructEvent`) usando la variable de entorno `STRIPE_WEBHOOK_SECRET`.
   - Programar lógica de actualización: al recibir un pago exitoso, actualizar el campo `subscription_status` a `active` en la tabla `profiles`.

2. **Verificar RLS en el Entorno de Producción (Supabase Dashboard):**
   - Habilitar RLS en **todas** las tablas.
   - Insertar políticas básicas de protección.
   - Ejemplo de política estricta para tabla `profiles`:
     ```sql
     CREATE POLICY "User can read own profile" ON profiles
       FOR SELECT USING (auth.uid() = id);
     CREATE POLICY "User can update own profile" ON profiles
       FOR UPDATE USING (auth.uid() = id);
     ```

3. **Prueba End-to-End Final (E2E):**
   - Ejecutar un flujo completo de registro de usuario.
   - Realizar un pago de prueba con tarjeta Stripe Test (`4242 4242 4242 4242`).
   - Validar que el webhook escuche el pago y que la sesión del portal de usuario refleje el nuevo plan ('Activo') automáticamente.

Una vez completados estos tres pasos, la arquitectura será robusta, el ecosistema de pagos estará cerrado con total seguridad y la plataforma podrá considerarse **Lista para Producción**.
