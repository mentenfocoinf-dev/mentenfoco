# Prompt para Claude Code — Quick-wins (B2B admin UI + copy) y scoping de Programas ampliados

> Pégalo tal cual en Claude Code. Sigue la reorientación vigente: backend primero, configuraciones
> externas (R1, R2, R6, Turnstile E2E, Stripe live, dominio, revisión jurídica del consentimiento B2B)
> para el final.

## Antes de tocar nada

Vision de producto (`contexto-proyecto/vision-producto/`) sigue mandando. En particular para el ítem 2
de abajo: ADR-006 (backend antes que frontend) y ADR-010 (detenerse ante conflicto/decisión bloqueada).

---

## 1 — UI admin para B2B (quick-win, aprobado)

El backend de B2B ya está aplicado e inerte (`companies`, `company_members`, `employer_link_consents`,
`company_aggregate_metrics` — commit `319625e`). Construye **solo** la parte segura: un panel en el admin
para gestionar `companies` (crear, ver, cambiar `status` del pipeline de negociación: prospecto →
negociando → contrato_activo → pausado/cerrado, notas). **No construyas nada del vínculo
empleado↔empresa ni de los reportes agregados** — eso sigue bloqueado por la revisión legal del
consentimiento, tal como quedó documentado.

- Extiende el panel de leads existente (`interest='empresa'` en `crm_leads`) hacia esta gestión, como ya
  propusiste en el diseño original — no crees una sección aparte si el panel de leads es un lugar natural.
- Es solo frontend + lectura/escritura sobre una tabla RLS admin-only ya existente — no requiere
  migración. Verifica build + tests al terminar.
- Commit propio: `feat: admin UI for B2B company pipeline`.

## 2 — Fix de copy: recovery link "24h" vs expiración real (~1h)

`/compra-exitosa.tsx` promete un enlace "válido por 24 horas" pero el recovery de Supabase caduca en
~1h por defecto. Ajusta el **copy** para que diga lo que realmente pasa (no asumas que puedes cambiar la
expiración del proyecto en Supabase Auth — eso es configuración de panel, fuera de alcance ahora). Texto
con el tono del sistema de lenguaje (`04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md`), sin urgencia artificial.
Commit propio: `fix(copy): align recovery link expiration copy with actual Supabase default`.

---

## 3 — Programas ampliados (terapia de pareja, orientación para padres): SOLO investigación y preguntas

El responsable quiere avanzar esto, pero el alcance no está definido. **No diseñes ni implementes nada
todavía.** Antes de proponer, investiga (solo lectura) y responde con evidencia:

- ¿`therapy_sessions`/`appointments` asumen **un solo `patient_id`** por sesión? Si es así, terapia de
  pareja (dos personas en la misma sesión) rompe ese supuesto — ¿cómo lo resolverías sin romper lo que ya
  funciona para terapia individual? Propón opciones (ej. sesión con `patient_id` principal + acompañante
  vinculado, vs. modelo distinto), no asumas una.
- ¿La anamnesis (`anamnesis` o como se llame la tabla real) es de una sola persona? Terapia de pareja y
  orientación para padres probablemente necesitan historia de más de una persona — ¿historia conjunta, o
  dos historias individuales enlazadas?
- ¿Esto es principalmente una **especialización nueva** de terapeuta (`specializations` en
  `therapist_profiles`, ya existe el campo) + contenido/guías nuevas, sin tocar el modelo de sesión? Esa
  sería la opción de menor alcance — evalúa si alcanza para un v1 razonable.
- ¿Hay diferencia de precio/plan entre terapia individual y de pareja? (Probablemente sí — dos personas
  por sesión.) No asumas, señálalo como pregunta abierta.

Entrega tus hallazgos + las preguntas de alcance que esto genera (mismo formato que usaste para B2B). Yo
las relayo al responsable antes de que diseñes nada.

---

## Orden

Ítems 1 y 2 puedes aplicarlos ya (son independientes entre sí y de bajo riesgo). El ítem 3 es solo
investigación — no lo mezcles con los commits de 1 y 2.
