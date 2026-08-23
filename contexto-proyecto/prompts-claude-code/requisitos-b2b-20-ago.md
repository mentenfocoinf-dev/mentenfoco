# Requisitos — Backend de Empresas/B2B (ítem 4, respuestas del responsable)

Respuestas a tus 4 preguntas de alcance:

1. **Cuenta B2B real**: empresa como entidad propia, multi-usuario, facturación agregada. Confirmado:
   es el proyecto grande, no la opción mínima. Trátalo como su propio sprint, no lo mezcles con 1-3.
2. **Sin modelo de precios fijo todavía**: cotización manual caso por caso. No modeles planes/tarifas B2B
   por ahora — solo un estado de negociación/contrato gestionado por el admin.
3. **Empleados SÍ quedan vinculados visiblemente** a la cuenta de la empresa (para habilitar reportes
   agregados).
4. **Reportes a la empresa: solo métricas agregadas/anónimas.** Nunca qué consultó, qué guía leyó, ni
   ningún dato clínico individual de un empleado — solo cifras tipo "23 empleados activos este mes",
   nunca desagregado por persona identificable.

## Antes de diseñar el esquema — un punto que tienes que resolver tú (ADR-010 si hace falta)

El punto 3+4 juntos son delicados: un empleado que se vincula a la cuenta de su empresa está aceptando
que su empleador sepa, aunque sea de forma agregada, que usa un servicio de salud mental. Eso **no es
neutro** — revisa si el flujo de consentimiento clínico existente (`clinical_consents`,
`ClinicalConsentCard.tsx`) cubre este caso o si hace falta un consentimiento **específico y separado**
para "vincular mi cuenta a mi empleador" — la filosofía del proyecto (dato de salud como sensible por
definición) y ADR-008/012 probablemente lo exigen. Si al diseñar ves que esto choca con la filosofía o
falta una decisión legal, **detente y repórtalo** en vez de asumir — es exactamente el caso que ADR-010
anticipa.

## Qué sí puedes diseñar ya (FASE 0 + FASE 1, mismo patrón que los otros ítems)

- Modelo de datos: entidad `companies` (o similar), tabla de vínculo empleado↔empresa, estado de
  negociación/contrato (sin precios fijos).
- RLS: quién puede ver qué. La empresa (¿un rol nuevo `company_admin`, o el admin de Mente en Foco
  gestiona esto manualmente por ahora?) — propón, no asumas que hace falta un rol nuevo si el volumen no
  lo justifica todavía.
- Cómo se calculan y exponen las métricas agregadas sin tocar tablas clínicas directamente (vista
  agregada, función `SECURITY DEFINER` que cuenta sin exponer filas individuales, etc.).
- Dónde vive esto en el admin (nueva sección, o extensión del panel de leads/directorio existente).

Preséntame el diseño (FASE 0 diagnóstico del código/esquema actual + FASE 1 propuesta) antes de tocar
nada, igual que hiciste con journaling y el directorio. Si el punto del consentimiento te bloquea antes
de poder proponer un esquema completo, dilo explícitamente y entrega lo que sí puedas diseñar mientras
esperamos esa decisión.
