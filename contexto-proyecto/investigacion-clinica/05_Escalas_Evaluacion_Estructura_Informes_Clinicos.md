# Escalas de evaluación y estructura estándar de informes clínicos

## 1. Escalas psicométricas de cribado estandarizadas

Estas son las escalas de dominio público (no requieren licencia comercial) más usadas internacionalmente
para cribado en salud mental. `psychometric_evaluations` ya existe en el esquema de Mente en Foco según
la auditoría previa, pero ningún componente del frontend la usa — es el "quick win" de mayor impacto
clínico identificado en el informe general.

| Escala | Qué evalúa | Ítems | Puntos de corte relevantes |
|---|---|---|---|
| **PHQ-9** (Patient Health Questionnaire-9) | Severidad de síntomas depresivos, últimas 2 semanas | 9 | 0-4 mínimo, 5-9 leve, 10-14 moderado, 15-19 moderadamente grave, 20-27 grave. El ítem 9 pregunta directamente por ideación de muerte/autolesión — cualquier puntaje >0 ahí debe disparar evaluación de riesgo, no solo quedar en el número total. |
| **GAD-7** (Generalized Anxiety Disorder-7) | Severidad de síntomas de ansiedad generalizada, últimas 2 semanas | 7 | 0-4 mínimo, 5-9 leve, 10-14 moderado, 15-21 grave. |
| **C-SSRS** (Columbia-Suicide Severity Rating Scale) | Ideación y comportamiento suicida, con niveles de severidad e intensidad | Variable (versión de cribado: 6 preguntas clave) | No es un puntaje sumado sino una clasificación por nivel de riesgo; cualquier respuesta afirmativa a ideación con plan o intención requiere protocolo de crisis inmediato, no espera hasta la próxima sesión. |
| **AUDIT-C** | Cribado breve de consumo de riesgo de alcohol | 3 | ≥4 en hombres / ≥3 en mujeres sugiere consumo de riesgo y amerita evaluación más profunda (AUDIT completo de 10 ítems). |
| **MoCA / MMSE** | Cribado cognitivo (ver archivo 04) | 30 (ambas) | MoCA <26/30 sugiere deterioro; MMSE <24/30 sugiere deterioro, con matices por edad/escolaridad. |

Recomendación de uso en producto: cada escala debería quedar asociada a una fecha, un puntaje total,
las respuestas ítem por ítem (para poder graficar tendencia longitudinal con `recharts`, como ya sugiere
el roadmap del informe general), y una bandera automática cuando se cruce un umbral de riesgo — en
particular el ítem 9 del PHQ-9 y el C-SSRS deberían integrarse con el sistema de `clinical_alerts` que
ya existe y está conectado por Realtime al `PatientDashboard`.

## 2. Estructura estándar de nota clínica: modelo SOAP

El estándar más usado en documentación clínica de salud mental (y ya mencionado como implementado en
`ClinicalReportModal.tsx` según el handoff previo). Cuatro secciones:

- **S — Subjetivo:** lo que el paciente reporta en sus propias palabras (motivo de consulta, síntomas,
  cómo se ha sentido desde la última sesión).
- **O — Objetivo:** observaciones directas del clínico — apariencia, conducta, resultado de escalas
  aplicadas en la sesión, examen del estado mental (ver siguiente sección).
- **A — Análisis (Assessment):** impresión clínica, hipótesis diagnóstica con código CIE-11, evolución
  respecto a sesiones previas, factores de riesgo actuales.
- **P — Plan:** próximos pasos — ajuste de tratamiento, tareas entre sesiones, frecuencia de próximas
  citas, derivaciones necesarias (psiquiatría, neurología, trabajo social).

## 3. Examen del estado mental (Mental Status Exam / MSE)

Componente estándar de la sección "Objetivo" de cualquier nota clínica en salud mental, organizado en
estas categorías (útil como checklist/formulario estructurado en el producto, no solo texto libre):

1. **Apariencia** — arreglo personal, higiene, vestimenta apropiada al contexto/clima.
2. **Actitud y conducta** — cooperación, contacto visual, psicomotricidad (agitación/enlentecimiento).
3. **Habla** — ritmo, volumen, fluidez, espontaneidad.
4. **Estado de ánimo** (reportado por el paciente) **y afecto** (observado por el clínico) — congruencia
   entre ambos, rango, estabilidad.
5. **Pensamiento** — forma (curso: lineal, tangencial, circunstancial, fuga de ideas) y contenido
   (delirios, obsesiones, ideación suicida/homicida).
6. **Percepción** — alucinaciones (auditivas, visuales, etc.), despersonalización/desrealización.
7. **Cognición** — orientación (persona, tiempo, lugar), atención, memoria, capacidad de abstracción
   (aquí es donde se integraría el resultado de un MoCA/MMSE si se aplicó en la sesión).
8. **Introspección y juicio (insight y juicio)** — grado de conciencia de enfermedad, capacidad de
   tomar decisiones razonadas sobre su propio cuidado.

## 4. Recomendación de integración con `cie11_directory`

La búsqueda predictiva CIE-11 mencionada en el handoff previo (existente en el módulo B2B) debería
alimentarse de la tabla completa construida en `01_CIE11_Codigos_Salud_Mental.md`, no solo de los ~6
diagnósticos actuales. Cada nota SOAP debería permitir asociar uno o más códigos CIE-11 en el campo
"Análisis", lo cual además habilita a futuro reportes agregados reales (ej. "% de pacientes con
trastornos de ansiedad" para el panel de analítica que usa `telemetry_events`, mencionado en el roadmap).
