# Backend B2B (Empresas) — mecanismo inerte, consentimiento pendiente de revisión legal

**Fecha:** 21 de agosto de 2026 · **Sprint propio** (no mezclado con journaling/directorio/admin).
**Marco:** ADR-008 (consentimientos separados e indelegables), ADR-010 (detenerse ante decisión legal),
filosofía §"dato de salud sensible por definición". Disciplina completa de migración.

> ⚠️ **INERTE Y PENDIENTE DE REVISIÓN JURÍDICA.** Se construyó el mecanismo (mismo patrón que el
> consentimiento clínico), pero el **texto** del consentimiento `employer_link_consents` y su activación
> quedan **pendientes de revisión legal**. Nada de esto está conectado a UI ni a flujo de producción. Las
> tablas y la función existen inertes (0 filas) — es el patrón ya usado con `clinical_consents`.

**Baseline:** tablas 39 · RLS 35 · políticas 102 · funciones 274 · enums 18 · POL `3974d052` · ACL `82e5ce2f`.

## Qué se creó
**Migración:** `supabase/20260821_b2b_companies.sql` · **Backup:** `backups/20260821_pre_b2b_companies.sql`

- **Enums:** `company_status (prospecto|negociando|contrato_activo|pausado|cerrado)`,
  `company_member_status (invitado|vinculado|desvinculado)`.
- **`companies`** — entidad empresa; estado de negociación/contrato **sin precios** (cotización manual
  fuera del sistema). RLS: **solo admin** (`get_my_role()='admin'`).
- **`employer_link_consents`** — consentimiento **separado, específico y revocable** para vincular la
  cuenta al empleador. **NUNCA reutiliza `clinical_consents`** (ADR-008). Owner del paciente + lectura
  admin. Revocar sella `revoked_at`, no borra. **Texto pendiente de revisión jurídica.**
- **`company_members`** — vínculo empleado↔empresa; `consent_id` liga al consentimiento (un empleado solo
  cuenta como `vinculado` con consentimiento vigente). RLS: el paciente ve/gestiona su propio vínculo,
  el admin gestiona todo; `UNIQUE(company_id, patient_id)`.
- **`company_aggregate_metrics(company_id)`** — `SECURITY DEFINER`, devuelve solo **conteos**
  (`vinculados`, `activos_mes`) con **k-anonimato (umbral k=5)**: si hay menos de 5 vinculados devuelve
  cifras `NULL` y `suficiente=false`. **Nunca** desagrega por persona ni por actividad. `EXECUTE` solo
  `service_role` (inerte; el grant al panel admin se decide al construir la UI, post-revisión legal).

## Prueba en tx revertida (8/8)
```
1) k-anon con 5 vinculados -> vinculados=5, suficiente=true                 ✔
2) k-anon con 4 vinculados -> vinculados=NULL, suficiente=false (oculta)    ✔
3) anon SELECT companies -> 42501                                           ✔
4) paciente (no admin) SELECT companies -> 0                                ✔
5) paciente ve solo su propio vínculo                                       ✔
6) paciente INSERT company -> 42501 (bloqueado)                             ✔
7) admin SELECT companies -> >=1                                            ✔
8) función EXECUTE anon/auth/service = false/false/true                     ✔
```

## Aplicación / idempotencia / invariantes / round-trip
- **Aplicada.** **4 pasadas idempotentes** (enums guardados por DO, tablas IF NOT EXISTS, políticas
  DROP+CREATE, función CREATE OR REPLACE).
- **Invariantes:** tablas 39→42, RLS 35→38, políticas 102→108 (+6), funciones 274→275, enums 18→20. Las 3
  tablas con RLS, anon denegado en las tres, función execute false/false/true, **0 filas (inerte)**.
  journaling, vista del directorio y R4/R5 intactos.
- **Round-trip:** rollback → baseline EXACTO (39/35/102/274/18, POL `3974d052`, ACL `82e5ce2f`);
  reaplicación → 42/38/108/275/20.

## Discrepancias
- FALLO REAL / ERROR DE SCRIPT / CAMBIO DE CAPA / ARTEFACTO: ninguno.
- **BLOQUEO DECLARADO (ADR-010):** el texto del consentimiento y toda conexión a producción quedan
  pendientes de revisión jurídica. El mecanismo existe inerte; no se activa sin confirmación legal.

## Pendiente
- Revisión jurídica del texto de `employer_link_consents` antes de cualquier activación.
- Frontend/panel admin de Empresas (post-legal): gestión de `companies`, invitación/vínculo, y consumo de
  `company_aggregate_metrics` (con el grant de EXECUTE que se decida entonces).
- **No commiteado** — plan de commit del sprint B2B presentado por separado.
