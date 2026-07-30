# Prompt para Claude Code — Pendientes tras la sesión del 2026-07-03

Copia y pega este prompt directamente en Claude Code, ubicado en la raíz del proyecto.

---

Estás retomando "Mente en Foco" (React 19 + TypeScript, TanStack Router, Vite 7, Tailwind v4, Supabase, Stripe Payment Links en modo test). Comunícate en español neutro (tuteo, nunca voseo). Código y commits en inglés.

## Contexto de lo que YA quedó hecho el 2026-07-03 (no lo repitas)

1. **Planes de 4 niveles** (`free < esencial < integral < premium`) implementados de punta a punta:
   - Migración aplicada en producción y versionada en `supabase/20260703_plan_tiers_admin_rpcs.sql`: columna `profiles.email` sincronizada desde auth, `clinical_guides.min_plan`, vista pública `clinical_guides_meta` (solo metadatos), función `plan_rank()`, `get_my_plan_rank()`, RPCs `admin_assign_patient`, `admin_unassign_patient`, `admin_set_plan`, `admin_get_directory`, y `handle_new_user` actualizado (copia email, role y plan_type desde metadata).
   - RLS de `clinical_guides` estaba APAGADO en producción; se encendió y se verificó: anónimo/free leen 15 guías, esencial+ leen las 20, la vista meta muestra las 20 a todos.
2. **Capa de servicios** `src/lib/api/` (plans.ts, authService.ts, adminService.ts, clinicalService.ts, guidesService.ts). Los componentes ya NO llaman a Supabase directamente para lógica de negocio. `src/lib/api/plans.ts` es la fuente única de precios, beneficios (PLAN_BENEFITS) y enlaces de Stripe.
3. **AdminDashboard**: asigna/reasigna pacientes a terapeutas, cambia planes, activa/desactiva terapeutas y crea usuarios (pacientes y terapeutas) desde el modal "Nuevo usuario".
4. **Edge Function `admin-create-user`** desplegada y verificada (verifica que quien llama sea admin; usa service role solo en el backend). Código en `supabase/functions/admin-create-user/index.ts`.
5. **PatientDashboard**: si el paciente no tiene plan activo muestra las opciones de compra; muestra beneficios incluidos y bloqueados según su nivel.
6. **Informe clínico del terapeuta** (`ClinicalReportModal`): se corrigió el bug donde el Examen del Estado Mental no se guardaba (ahora persiste en `soap_data.mental_exam`); se agregó panel de contexto del paciente (últimas evaluaciones PHQ-9/GAD-7/C-SSRS, estado de anamnesis) e historial de notas firmadas.
7. **Membresía**: tabla comparativa de los 4 niveles; membresía mensual = contenido nivel Integral, anual = nivel Premium.
8. **Usuarios de prueba** (password `Password123!`): `paciente.free@`, `paciente.esencial@`, `paciente.integral@`, `paciente.premium@test.com` (todos asignados al terapeuta de prueba), más los históricos admin@/terapeuta@/paciente@test.com.
9. Se eliminó el voseo argentino que estaba en el CONTENIDO de 4 guías dentro de la base de datos (anotá→anota, podés→puedes, etc.).
10. `npm run build` y `tsc --noEmit` pasan sin errores.

## TAREAS PENDIENTES (en orden de prioridad)

### 1. Webhook de Stripe: mapear cada Payment Link a su nivel de plan
Revisa `supabase/functions/stripe-webhook/`. Hoy los 5 Payment Links (esencial, integral, premium, membresía mensual, membresía anual) existen en `src/lib/api/plans.ts` (STRIPE_LINKS), pero hay que garantizar que al completarse el checkout el webhook escriba el `plan_type` correcto en `profiles`:
- esencial → `esencial` · integral → `integral` · premium → `premium`
- membresía mensual → `integral` · membresía anual → `premium`
Usa el `price_id`/`payment_link` del evento `checkout.session.completed` para el mapeo (crea una tabla o constante de mapeo). Respeta `client_reference_id` cuando venga (usuario ya logueado: actualizar su perfil, no crear cuenta nueva). NO toques todavía el tema password=email (se atiende en la fase de seguridad).

### 2. Registro público de pacientes
Regla de negocio: "las cuentas se les dan a los pacientes luego de que se inscriban a la plataforma incluyendo ellos sus datos". Crea una ruta `/registro` con formulario (nombre completo, correo, contraseña, aceptación de tratamiento de datos) que use `supabase.auth.signUp` con `user_metadata { full_name, role: 'patient', plan_type: 'free' }` (el trigger `handle_new_user` ya hace el resto). Tras registrarse, el flujo existente los manda a `/anamnesis` (onboarding) y su dashboard les mostrará los planes disponibles. Agrega el enlace "Crear cuenta" en `/ingresa`.

### 3. Prueba E2E en navegador (npm run dev)
Levanta la app y verifica manualmente con los usuarios de prueba:
- Login de cada nivel y que el dashboard muestre los beneficios correctos.
- Admin: crear un usuario nuevo, asignarlo a un terapeuta, cambiarle el plan.
- Terapeuta: abrir el informe clínico, llenar el examen mental, guardar borrador, reabrir y confirmar que TODO persiste; firmar y verificar inmutabilidad.
- Guía premium con usuario free → paywall con el plan requerido.

### 4. Integrar la investigación clínica
Sigue el plan de `investigacion-clinica-cie11-dsm5/06_Recomendaciones_Implementacion_Tecnica.md` (161 diagnósticos CIE-11, escalas adicionales, metodologías) para enriquecer `cie11_directory` y el catálogo de tareas clínicas.

### 5. Exportar las migraciones faltantes
Las tablas `cie11_directory`, `clinical_notes`, `patient_therapist`, `clinical_alerts` y la columna `profiles.professional_card` siguen sin migración versionada. Expórtalas con `supabase db dump` (o genera los CREATE TABLE) a `supabase/` para eliminar el drift de esquema.

### REGLAS
- Mantén la estructura visual existente (glassmorphism, glass-card, card-neon-hover).
- Toda lógica nueva de datos va en `src/lib/api/`, no en los componentes.
- Español neutro en la interfaz; ortografía correcta con tildes.
- Los temas de seguridad (password=email del webhook, Stripe live, endurecimiento general de RLS) quedan para la fase final salvo indicación explícita.
