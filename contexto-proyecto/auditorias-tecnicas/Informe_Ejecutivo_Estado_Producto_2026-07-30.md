# Informe ejecutivo — Estado del producto Mente en Foco

**Fecha:** 30 de julio de 2026 · **Rol:** auditoría de arquitectura de software senior (solo diagnóstico) ·
**Base:** repositorio, contexto maestro, roadmap, especificaciones, investigación clínica y de competencia,
prompts históricos, memoria del proyecto y estado real del código/migraciones.

---

## 1. Porcentaje real del proyecto

**~70% global**, pero el número engaña si no se separa en dos ejes:

- **Funcionalidad construida: ~80%.** El producto es funcionalmente rico: portal clínico completo, sistema
  de contenido, sitio público, auth, pagos en modo test, consentimientos.
- **Preparación para producción real: ~35–40%.** No puede recibir pacientes reales hoy: RLS desactivada en
  tablas sensibles, Stripe en modo test con contraseña = correo, sin dominio propio, sin verificaciones.

El proyecto está **más cerca de "demo excelente" que de "plataforma operable"**. La distancia entre ambos
no es de features, es de endurecimiento (seguridad, pagos, infraestructura). Ponderando ambos ejes: **~68–72%**.

## 2. Las 10 capacidades más importantes que YA existen

1. **Portal clínico por roles** (paciente / terapeuta / admin) con navegación propia.
2. **Historia clínica real:** anamnesis + documentos tipados (valoración / informe / evolución) con firma
   electrónica inmutable y exportación a PDF.
3. **Evaluaciones psicométricas** (PHQ-9, GAD-7, C-SSRS, MoCA/MMSE) con **alertas de crisis** y trazabilidad
   de quién y cómo las resolvió.
4. **Agenda de sesiones** + recordatorios automáticos por correo.
5. **Mensajería** paciente↔terapeuta con badge de no leídos.
6. **Sistema de contenido con workflow editorial** (terapeuta propone → admin publica, blindado en base) +
   biblioteca de 24 piezas escalonadas por plan **sin pantallas de bloqueo**.
7. **Blog interactivo** con comentarios de pacientes moderados (comunidad).
8. **Tests públicos sin login** (captación) — recién construidos.
9. **Autenticación** (Google OAuth + gate de onboarding) con **doble consentimiento**: datos (Ley 1581) y
   clínico (Ley 1090), este último con inmutabilidad y autoría indelegable.
10. **Modelo de monetización** (planes freemium renombrados, upsells conectados a Stripe, membresías) +
    catálogo CIE-11 y guías clínicas de base.

## 3. Las 10 capacidades que aún faltan

1. **Emparejamiento (matching) paciente-terapeuta** y elección de profesional.
2. **Directorio público de especialistas** con perfiles y reseñas.
3. **Seguridad de datos de producción** (reactivar RLS en tablas clínicas).
4. **Pasarela de pago real** (hoy modo test; el webhook crea cuentas con contraseña = correo).
5. **Dominio propio + verificaciones** (Google Cloud, Resend); no hay URL de producción.
6. **Audio real** (meditaciones y podcast están en "próximamente").
7. **Analítica / panel de métricas** del admin (`telemetry_events` se escribe pero nadie lo lee).
8. **B2B / Empresas funcional** (hoy es una landing hacia `crm_leads`).
9. **Paridad de la app móvil** (solo existe la Fase 1 del paciente).
10. **Compliance de datos clínicos**: bitácora de acceso a la historia clínica y/o cifrado de campos
    sensibles; y el **esquema base sin versionar** (trazabilidad).

## 4. Cuello de botella actual del producto

El cuello de botella **no es técnico de construcción, es de habilitación**: el producto está construido pero
**no es lanzable con usuarios reales**. Concretamente, la **fase de seguridad/producción** (RLS apagada,
pagos en test, sin dominio) es la represa que contiene todo lo demás — se puede seguir sumando features,
pero nada de eso se traduce en pacientes reales hasta cerrar esa fase.

En segundo plano, hay un cuello de botella **de crecimiento**: la **asignación manual paciente↔terapeuta por
el admin**. Sin matching, cada paciente nuevo exige trabajo manual del administrador, lo que impide escalar
la captación que el propio producto está montando (tests públicos, blog, SEO).

## 5. Si solo pudiera desarrollar UNA cosa esta semana

**Cerrar la fase de seguridad de datos (reactivar y verificar RLS en las tablas clínicas + versionar el
esquema base).** Por tres razones: (a) es el **mayor riesgo vivo** — hoy datos de salud (categoría especial,
Ley 1581) son accesibles con la clave anónima/servicio en varias tablas; (b) es el **único gate real hacia
pacientes reales** — sin esto, todo lo demás es esfuerzo que no se puede monetizar ni usar de verdad; (c) es
**deuda que crece con cada tabla nueva** — cuanto más se construye encima, más caro es cerrarla después.

*Nota de auditor:* el equipo eligió deferir la seguridad a propósito para agilizar pruebas — decisión
válida en su momento. Pero desde el riesgo, a esta altura de madurez del producto, es lo que yo priorizaría.
Si la pregunta se limita a una feature **de cara al usuario**, la respuesta sería el **matching**, por ser
la palanca de crecimiento que además desatasca el cuello manual del admin.

## 6. Qué módulos dependen de esa decisión

De la seguridad de datos dependen, para poder operar con pacientes reales, **todos los módulos que tocan
datos personales o clínicos**: anamnesis, evaluaciones psicométricas, alertas de crisis, notas/documentos
clínicos, mensajería, consentimientos, tracker de ánimo, agenda de sesiones y captación pública. También
dependen de ella el **lanzamiento comercial** (pagos reales) y la **exposición pública con dominio**. En la
práctica, la producción-readiness de casi todo el portal clínico cuelga de esta decisión.

## 7. Decisiones arquitectónicas importantes aún no tomadas

1. **Modelo de negocio de fondo:** ¿marketplace de especialistas independientes (estilo Selia/Terapify) o
   equipo clínico propio? Define si hay directorio, matching, reseñas y perfiles públicos — y condiciona la
   Ola 3 entera.
2. **Emparejamiento:** ¿el paciente elige terapeuta o sigue la asignación por admin? Sin resolver.
3. **RLS vs. triggers a largo plazo:** hoy los triggers suplen a la RLS ausente. Falta decidir si la RLS
   pasa a ser la barrera primaria de lectura o el modelo sigue siendo mixto.
4. **Esquema base no versionado:** `profiles`, `clinical_notes`, `patient_therapist`, `plan_type` se crearon
   fuera del historial de migraciones. Falta decidir cómo versionar/reconstruir el baseline.
5. **Datos de salud en producción:** cifrado a nivel de columna, bitácora de acceso y política de retención
   — no definidos.
6. **Alcance geográfico:** ¿solo Colombia o LatAm? Impacta normativa, líneas de crisis y facturación.
7. **Audio:** grabaciones propias vs. embeber externos vs. descartar — pendiente.

## 8. Partes suficientemente maduras para no tocar por semanas

- **Historia clínica y documentos** (valoración/informe/evolución + firma + PDF): construidos, verificados,
  con integridad protegida en base.
- **Evaluaciones psicométricas + alertas de crisis:** sólidos y probados.
- **Agenda de sesiones + recordatorios por correo:** probados y corriendo (cron activo).
- **Mensajería:** estable, en `origin/main`.
- **Auth / OAuth / gate de onboarding + consentimientos:** maduros, con la seguridad crítica en triggers.
- **Sistema de contenido, blog y tests públicos:** recién construidos y verificados; conviene **dejarlos
  estabilizar** en vez de seguir tocándolos.

Estas áreas pueden congelarse varias semanas con bajo riesgo.

## 9. Módulos con mayor deuda técnica o de UX

**Deuda técnica (alta):**
- **Seguridad de datos:** RLS desactivada en tablas sensibles (la mayor).
- **Esquema base no versionado:** no se puede reconstruir desde cero solo con migraciones.
- **Pagos:** Stripe en modo test + contraseña = correo en el webhook.
- **Datos muertos:** `telemetry_events` se escribe y nadie lo consume.
- **Menor:** posible duplicidad de funciones de alta de usuario (`handle_new_auth_user` / `handle_new_user`).

**Deuda de UX (alta):**
- **Asignación manual paciente-terapeuta:** fricción y no escala; es el mayor lastre de experiencia y de
  crecimiento.
- **Audio en "próximamente":** promesa visible sin cumplir (bien manejada, pero deuda al fin).
- **B2B / Empresas:** landing sin backend real detrás.
- **App móvil:** incompleta (solo paciente Fase 1); paridad del terapeuta pendiente.

## 10. Ranking 1–20 de prioridades de desarrollo

| # | Prioridad | Eje |
| :-- | :--- | :--- |
| 1 | Reactivar y verificar RLS en tablas clínicas | Seguridad / lanzamiento |
| 2 | Versionar el esquema base (baseline reconstruible) | Trazabilidad |
| 3 | Pasarela de pago real + eliminar contraseña = correo | Monetización / seguridad |
| 4 | Dominio propio + verificaciones (Google, Resend) | Infraestructura / lanzamiento |
| 5 | Matching / test de afinidad paciente-terapeuta | Crecimiento |
| 6 | Directorio público de especialistas (perfiles, reseñas) | Crecimiento / competitividad |
| 7 | Bitácora de acceso a datos clínicos | Compliance |
| 8 | Revisión jurídica de los consentimientos | Legal |
| 9 | Captcha / rate-limit en el signup público | Seguridad |
| 10 | Validación en vivo (logueada) de consentimiento clínico y tests públicos | Calidad |
| 11 | Panel de analítica del admin (explotar `telemetry_events`) | Operación |
| 12 | Cifrado de campos clínicos sensibles | Compliance |
| 13 | Audio real (grabaciones) para meditaciones y podcast | Contenido |
| 14 | Más tests públicos verificados (insomnio, burnout, TCA, trauma) | Captación |
| 15 | B2B / Empresas funcional | Ingresos B2B |
| 16 | Capa de autocuidado ampliada (journaling) | Retención |
| 17 | Automatización de contenido (1 pieza cada 2 días) | Escala de contenido |
| 18 | 5 categorías nuevas de guías | Contenido |
| 19 | Depurar deuda menor (funciones duplicadas, datos muertos) | Higiene técnica |
| 20 | Paridad de la app móvil (terapeuta) | Multicanal |

---

**Lectura de una línea:** Mente en Foco es un producto **funcionalmente muy avanzado y clínicamente serio**,
cuya única barrera real para volverse un negocio operativo es **cerrar la fase de seguridad/producción** y,
para escalar, **automatizar el emparejamiento paciente-terapeuta**. Todo lo demás es enriquecimiento sobre
una base ya sólida.
