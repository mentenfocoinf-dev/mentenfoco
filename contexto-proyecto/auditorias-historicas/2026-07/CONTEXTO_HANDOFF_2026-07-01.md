# Contexto de sesión — Mente en Foco (1 julio 2026)

## REGLAS OBLIGATORIAS PARA LA HERRAMIENTA QUE RETOME ESTO

1. **Alcance de archivos:** trabajar ÚNICAMENTE dentro de
   `C:\Users\santy\Desktop\Antigravity\Mente en Foco`. No leer, referenciar, ni modificar absolutamente
   nada de otras carpetas o proyectos (por ejemplo, `Maxprinter` u otro directorio distinto). Si esta
   carpeta no es el directorio de trabajo activo, cambiarlo antes de continuar.
2. **Idioma:** comunicarte conmigo (el usuario) en **español** siempre. Usar español también para
   cualquier contenido que vaya a mostrarse en la página (copys, textos de guías, UI). El código en sí
   (nombres de variables, funciones, comentarios técnicos, commits) va en **inglés**, como ya está en
   el resto del repo — no traducir el código existente ni escribir código nuevo en español.

---

Este documento resume lo auditado, corregido y pendiente en la sesión de hoy, para que cualquier
herramienta (Antigravity, Claude Code corriendo localmente, u otra) pueda continuar sin re-descubrir
todo desde cero. Complementa (no reemplaza) el `CLAUDE.md` / contexto general del proyecto, que en
algunos puntos está desactualizado — ver sección "Discrepancias con la documentación del proyecto".

## Por qué este documento existe

Se trabajó sobre el proyecto en un entorno con acceso de red restringido (sandbox en la nube, salida
a internet limitada a una lista blanca de dominios que NO incluye Supabase). Eso significa que todos
los cambios de **código** se hicieron y verificaron directamente, pero cualquier cambio que requiera
llamar a la API de Supabase (crear usuarios, insertar filas) tuvo que resolverse escribiendo scripts
de Node para que el usuario los corra desde su propia terminal (con red real). Si retomas esto desde
Claude Code local o Antigravity — con ejecución directa en la máquina del usuario — ese límite
específico no debería existir y puedes correr esos scripts (o llamadas equivalentes) tú mismo.

## Stack

React 19 + TypeScript, TanStack Router/Start, Vite 7, Tailwind v4, Supabase (`@supabase/supabase-js`),
Stripe (Payment Links, sin integración de Checkout embebido). Repo: `github.com/mentenfocoinf-dev/mentenfoco`.
Server de dev: `npm run dev` → `http://localhost:8080` (puerto fijado vía `@lovable.dev/vite-tanstack-config`).

## Estado de credenciales de prueba (ya creadas y funcionando)

| Rol | Email | Password |
|---|---|---|
| Admin | admin@test.com | Password123! |
| Terapeuta | terapeuta@test.com | Password123! |
| Paciente | paciente@test.com | Password123! |

Creadas/corregidas con `seed_users.cjs` (ver sección de scripts).

## Cambios de código ya aplicados en esta sesión

1. **`seed_users.cjs`** — corregido un typo (`subscription_status: "activate"` → `"active"` para el
   paciente de prueba) y agregado `onboarding_completed: true` a los tres perfiles para evitar el
   redirect forzoso a `/anamnesis`.
2. **`src/hooks/useAuth.tsx`** — la lógica de "sesión única por dispositivo" comparaba un token en
   `localStorage` contra `profiles.session_token` y forzaba `signOut()` si no coincidían. Como
   `localStorage` se comparte entre TODAS las cuentas de prueba logueándose en el mismo navegador,
   cualquier cambio de cuenta disparaba un loop de "sesión en otro dispositivo" y te sacaba
   inmediatamente después de loguear. Se cambió para que "reclame" el dispositivo silenciosamente en
   vez de cerrar sesión. **Esto es una relajación temporal a propósito** (decisión explícita del
   usuario: seguridad se atiende al final, después de tener todo funcional) — antes de producción hay
   que restaurar el `signOut()` real ante mismatch.
3. **`src/components/dashboard/AdminDashboard.tsx`** — la pestaña "Pacientes" hacía un query con un
   embed anidado (`patient_therapist!patient_id(profiles!therapist_id(...))`) que fallaba
   silenciosamente (el código ignoraba `error`), dejando la lista vacía sin ningún aviso. Se separó en
   dos queries simples (pacientes, luego sus asignaciones) unidas en JS, y se agregó logging real de
   errores en las tres pestañas (leads/terapeutas/pacientes).

## Scripts nuevos creados (correr con `node <archivo>.cjs` desde una terminal con red real)

Todos leen `VITE_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del `.env` del proyecto.

- **`cleanup_test_therapists.cjs`** — lista (dry-run por defecto) o borra (`--delete`) perfiles de
  terapeuta duplicados/de prueba, dejando solo `terapeuta@test.com`. Motivo: aparecían 3 terapeutas
  de prueba ("Dr.Karen Cobo", "Karen Cobo", "Terapeuta de Prueba") en el AdminDashboard.
  **Pendiente de confirmar si el usuario ya lo corrió con `--delete`.**
- **`link_test_patient_therapist.cjs`** — enlaza `paciente@test.com` con `terapeuta@test.com` en la
  tabla `patient_therapist` (borra cualquier asignación previa del paciente primero). Necesario porque
  **no existe ninguna pantalla en la app para asignar un paciente a un terapeuta** — es un hueco de
  producto real, no solo un dato de prueba faltante. **Pendiente de confirmar si el usuario ya lo
  corrió.**

## Hallazgos críticos de seguridad (del informe completo `Auditoria_Mente_en_Foco_Julio_2026.docx`)

1. **Password = email ("Credenciales Espejo")** — `supabase/functions/stripe-webhook/index.ts` crea
   usuarios nuevos con `password = customerEmail`. La pantalla `compra-exitosa.tsx` dice que se
   enviará un correo para "establecer tu contraseña", pero ese flujo no existe — solo se corrigió el
   texto en una auditoría previa (junio 2026), no la lógica insegura de fondo.
2. **Stripe en modo test** — los 5 links de pago (`stripe_links.json` y los hardcodeados en
   `asesoramiento.tsx`/`membresia.tsx`) son todos `buy.stripe.com/test_*`. No procesan pagos reales.
   Nota adicional: `stripe_links.json` no lo importa ningún componente (los links reales están
   hardcodeados inline) y el link "Anual" del JSON no coincide con el hardcodeado en
   `membresia.tsx` — el archivo está huérfano y desactualizado.
3. **RLS de guías premium no se está aplicando en el proyecto reactivado (confirmado en vivo)** —
   entré sin sesión (localStorage vacío, verificado) a una guía marcada `es_premium: true`
   (`/guias/ansiedad-ataques`) y se mostró el contenido clínico completo, no el paywall. Cualquiera
   puede leer contenido premium gratis solo con la URL directa. Hay que revisar en el SQL Editor de
   Supabase que la policy `"Permitir lectura premium a usuarios premium"` sobre `clinical_guides`
   realmente esté activa.
4. **Esquema sin migración versionada** — `cie11_directory`, `clinical_notes` y la columna
   `profiles.professional_card` se usan en `ClinicalReportModal.tsx` pero no existen en ningún archivo
   `.sql` del repo (solo hay 3: `20240514_security_sprint.sql`, `20240514_fix_rls_patients.sql`,
   `20240514_b2b_clinical_prescriptions.sql`). Se crearon directo en el dashboard de Supabase en algún
   momento. Igual pasa con `patient_therapist` (referenciada pero nunca creada por un `CREATE TABLE`
   en el repo). Recomendado: exportar el esquema real y commitearlo antes de seguir desarrollando
   sobre estas tablas, para no perder la funcionalidad clínica si el proyecto se vuelve a mover.

## Discrepancias con la documentación del proyecto (`CLAUDE.md` / contexto general)

- Los 3 dashboards (Paciente/Terapeuta/Admin) están completos y funcionales, no son wireframes.
- El webhook de Stripe ya está implementado (con la falla de seguridad de la sección anterior).
- Existe un módulo clínico B2B completo no documentado: catálogo de prescripciones, asignación
  terapeuta→paciente (sin UI, ver script `link_test_patient_therapist.cjs`), informes clínicos con
  modelo SOAP, examen de estado mental, búsqueda predictiva CIE-11, firma electrónica inmutable de
  notas.
- Alertas de crisis en tiempo real ya implementadas (`PatientDashboard.tsx` se suscribe a
  `clinical_alerts` vía Supabase Realtime).

## Gaps de producto encontrados en la revisión general del sitio

- **"Alex AI" 24/7** — se promociona en Membresía y Contáctanos como asistente de IA disponible, pero
  no tiene ninguna implementación en el código. Promesa sin funcionalidad detrás.
- **Sección "Nuestro equipo"** (Sobre Nosotros) solo muestra 1 persona (Dr. Santiago González) pese a
  que el resto de la página habla de un equipo multidisciplinario.
- **`psychometric_evaluations`** (PHQ-9/GAD-7/C-SSRS/AUDIT-C) existe en el esquema pero ningún
  componente del frontend la usa — quick win de alto impacto clínico sugerido en el informe completo.
- **No existe UI para asignar paciente↔terapeuta** (ver arriba).
- Anamnesis (`/anamnesis`) solo pide nombre completo, pese al nombre clínico de la ruta.
- Sin agenda/sesiones programadas en el dashboard del paciente.

## Notas de entorno

- `node_modules` tuvo que reinstalarse una vez por un bug conocido de npm con dependencias opcionales
  (binarios nativos de `rollup`/`esbuild` según plataforma) — no es un bug del proyecto, solo
  reinstala con `npm install` si ves errores raros de esos paquetes.
- El `.env` ya tiene todas las keys necesarias (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `SUPABASE_ACCESS_TOKEN`).

## Informe completo

Ver `Auditoria_Mente_en_Foco_Julio_2026.docx` en la raíz del proyecto para el detalle completo,
severidades, y el roadmap de ideas de desarrollo (evaluaciones psicométricas, agenda, seguimiento
longitudinal con `recharts`, notificaciones, panel de analítica con `telemetry_events`, SSR para SEO,
módulo "ADN Clínico").
