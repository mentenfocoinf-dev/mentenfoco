# Informe de mejoras propuestas — Mente en Foco (2026-07-03)

Ideas para hacer la plataforma más completa, organizadas por impacto. Ninguna está implementada aún; son el menú de lo que sigue.

## Alto impacto comercial

**Registro público de pacientes.** Hoy solo se crean cuentas por compra en Stripe o por el admin. Una ruta `/registro` gratuita alimenta el embudo: el paciente se inscribe con sus datos, llena su anamnesis y desde su dashboard ve los planes (esa vitrina ya quedó construida hoy). Es la mejora con mejor relación esfuerzo/beneficio.

**Agenda de sesiones.** Los planes venden "1, 4 u 8 sesiones al mes" pero no existe módulo de citas. Una tabla `sessions` (paciente, terapeuta, fecha, estado, enlace de videollamada) con vista de calendario en ambos dashboards convierte la promesa comercial en algo tangible. Puede integrarse con Google Calendar o Cal.com después.

**Notificaciones por correo.** Edge Function con un proveedor tipo Resend: bienvenida al registrarse, confirmación de compra con su nivel de plan, alerta de crisis al correo del terapeuta (hoy solo aparece si tiene el dashboard abierto), recordatorio de sesión. La alerta de crisis por correo es también una mejora clínica importante.

**Contenido real de la membresía.** La membresía promete webinars, meditaciones y comunidad, pero no hay sección para consumirlos. Un módulo "Recursos" con audios/videos subidos a Supabase Storage, gateado con el mismo `min_plan` de las guías, hace que los niveles Integral y Premium se sientan valiosos desde el primer día.

## Alto impacto clínico

**Gráficas de evolución psicométrica.** Ya se guardan PHQ-9/GAD-7/C-SSRS con fecha; falta graficar la serie temporal (Recharts ya está disponible en el stack) en el dashboard del paciente y en el informe del terapeuta. Ver la curva bajar es terapéutico y demuestra resultados.

**Exportar el informe clínico a PDF.** Con membrete, datos del terapeuta (T.P.), examen mental, SOAP y diagnóstico CIE-11. Necesario para remisiones, EPS y solicitudes del paciente (habeas data).

**Integración de la carpeta `investigacion-clinica-cie11-dsm5/`.** Ya existe el plan técnico en el archivo 06. Enriquecería el buscador CIE-11 (161 diagnósticos), agregaría escalas (MoCA/MMSE ya tienen tipos en la base) y ampliaría el catálogo de tareas de intervención.

**Módulo "ADN Clínico".** Mencionado en commits: perfil profundo del paciente combinando anamnesis + psicometría + notas. Puede empezar como una vista resumen para el terapeuta (ya quedó la semilla hoy con el panel "Contexto del paciente" del informe).

**Chat seguro paciente–terapeuta.** Mensajería asincrónica dentro del portal (tabla + Realtime, que ya usan para alertas). Refuerza el "seguimiento continuo por la plataforma" que venden los planes.

## Confianza y conversión (páginas públicas)

Testimonios con consentimiento, sección de preguntas frecuentes en planes y membresía, páginas legales (política de privacidad y tratamiento de datos según Habeas Data Colombia, consentimiento informado, términos), y perfil del equipo con tarjetas profesionales. Para SEO: blog basado en las guías gratuitas, sitemap.xml y datos estructurados schema.org.

**Alex — IA 24/7.** Se vende como beneficio de membresía y no existe. Un chatbot con guardrails clínicos estrictos (nunca diagnostica, detecta lenguaje de riesgo y escala al protocolo de crisis) es viable con la API de Claude; requiere diseño cuidadoso del protocolo de seguridad antes de lanzarlo.

## Operación interna

Panel de métricas para el admin (ingresos por plan, leads por estado, pacientes activos, alertas atendidas), pipeline editable del CRM (cambiar estado de leads: nuevo → contactado → cerrado), y bitácora de auditoría visible usando la tabla `telemetry_events` que ya existe.

## Fase final de seguridad (ya identificada, no olvidar)

Password=email en el webhook de Stripe, Payment Links en modo test, migraciones sin versionar de 4 tablas, revisión completa de RLS tabla por tabla (hoy se encendió el de `clinical_guides`), y re-activar el bloqueo real de sesión única en `useAuth`.

---

## Resumen de lo entregado hoy (2026-07-03)

Sistema de planes de 4 niveles funcionando de punta a punta (base de datos + RLS verificado + UI), capa de servicios `src/lib/api` que saca la lógica de negocio del frontend, panel admin con asignación de pacientes y creación de cuentas vía Edge Function desplegada, dashboard del paciente con vitrina de planes y beneficios por nivel, informe clínico del terapeuta corregido y ampliado (el examen mental ahora sí se guarda), tabla comparativa de membresías, guías con candado por nivel visible en el catálogo, voseo eliminado del contenido clínico, 4 usuarios de prueba por nivel verificados, y build + typecheck en verde.
