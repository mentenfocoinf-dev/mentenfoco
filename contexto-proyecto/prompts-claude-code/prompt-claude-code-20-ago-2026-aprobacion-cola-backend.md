# Prompt para Claude Code — Aprobación de la cola de backend (journaling, directorio, admin-create-user, B2B)

> Pégalo tal cual en Claude Code. Responde a tu entrega de FASE 0 + FASE 1 de los ítems 1-3 y a tus
> preguntas de alcance del ítem 4. No has aplicado nada todavía — esto es la aprobación para empezar.

---

## Ítem 1 — Journaling: aprobado

- Prompts como **constante estática** (recomendado) — no crear `journal_prompts`.
- **DELETE del propietario: sí**, inclúyelo — es un diario privado, no un registro clínico firmado.
- **Dentro de "Mi camino"** como subsección, no ítem propio de nav.

Procede con el esquema propuesto (`journal_entries`, RLS owner-only espejo de `mood_entries`) y la
disciplina completa de migración: baseline → backup → prueba en transacción revertida → aplicación →
idempotencia → invariantes → rollback real → reaplicación → doc en auditorías.

## Ítem 2 — Directorio público (Ola 3): aprobado

- **Apruebo cerrar la sobre-exposición** de `therapist_profiles` con la vista
  `public_therapist_directory` + columnas allowlist. Es una corrección de seguridad real (ADR-013),
  trátala como tal en el registro de auditoría, no solo como paso de la Ola 3.
- **`license_number` fuera del público** — confirmado, solo autenticados.
- Columnas de la vista, aprobadas tal cual: `profile_id, professional_name, bio, specializations,
  languages, modalities, age_groups, accepts_online, accepts_in_person, years_experience, verified`.
- **Ruta `/especialistas`** — aprobada.
- Migración completa (vista + ajuste de política), con toda la disciplina de siempre.

## Ítem 3 — `admin-create-user`: aprobado

Procede con `must_change_password: true` en el UPDATE (líneas 74-81), para paciente y terapeuta creados
por admin. Verifica build + tests después. Una línea, no interrumpe el resto de la cola.

**Orden entre 1-3:** el que prefieras, no dependen entre sí.

---

## Ítem 4 — Backend de Empresas/B2B: requisitos (respuestas del responsable)

1. **Cuenta B2B real**: empresa como entidad propia, multi-usuario, facturación agregada. Es el proyecto
   grande, no la opción mínima — trátalo como su propio sprint, no lo mezcles con 1-3.
2. **Sin modelo de precios fijo todavía**: cotización manual caso por caso. No modeles planes/tarifas
   B2B por ahora — solo un estado de negociación/contrato gestionado por el admin.
3. **Empleados SÍ quedan vinculados visiblemente** a la cuenta de la empresa (para habilitar reportes
   agregados).
4. **Reportes a la empresa: solo métricas agregadas/anónimas.** Nunca qué consultó, qué guía leyó, ni
   ningún dato clínico individual de un empleado — solo cifras tipo "23 empleados activos este mes",
   nunca desagregado por persona identificable.

### Punto que tienes que resolver tú antes de diseñar el esquema (aplica ADR-010 si hace falta)

Los puntos 3+4 juntos son delicados: un empleado vinculado a la cuenta de su empresa está aceptando que
su empleador sepa, aunque sea de forma agregada, que usa un servicio de salud mental. Eso no es neutro.
Revisa si el flujo de consentimiento clínico existente (`clinical_consents`, `ClinicalConsentCard.tsx`)
cubre este caso o si hace falta un consentimiento **específico y separado** para "vincular mi cuenta a mi
empleador". La filosofía del proyecto (dato de salud sensible por definición) y ADR-008/012 probablemente
lo exigen. Si al diseñar ves que esto choca con la filosofía o falta una decisión legal, **detente y
repórtalo** en vez de asumir — es el caso que ADR-010 anticipa.

### Qué sí puedes diseñar ya

- Modelo de datos: entidad `companies` (o similar), tabla de vínculo empleado↔empresa, estado de
  negociación/contrato (sin precios fijos).
- RLS: quién ve qué. Propón si hace falta un rol nuevo `company_admin` o si el admin de Mente en Foco
  gestiona esto manualmente por ahora — no asumas que hace falta rol nuevo si el volumen no lo justifica.
- Cómo se calculan y exponen las métricas agregadas sin tocar tablas clínicas directamente (vista
  agregada o función `SECURITY DEFINER` que cuenta sin exponer filas individuales).
- Dónde vive esto en el admin (nueva sección, o extensión del panel de leads existente).

Preséntame FASE 0 (diagnóstico del código/esquema actual) + FASE 1 (propuesta) antes de tocar nada, igual
que hiciste con journaling y el directorio. Si el punto del consentimiento te bloquea antes de poder
proponer un esquema completo, dilo explícitamente y entrega lo que sí puedas diseñar mientras se resuelve
esa decisión.

---

## Recordatorio de alcance

Nada de R1, R2, R6, Turnstile E2E, Stripe live, dominio propio — siguen para el final. No commitees nada
de esta cola hasta que yo lo confirme, mismo patrón de siempre.
