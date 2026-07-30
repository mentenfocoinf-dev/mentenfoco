# Recomendaciones de implementación técnica (para Claude Code)

Este archivo traduce la investigación de los 5 archivos anteriores en pasos concretos de código. No se
modificó ningún archivo del proyecto para esto — todo queda pendiente de ejecución.

## 1. Poblar `cie11_directory` con el catálogo completo

- Origen de datos: `01_CIE11_Codigos_Salud_Mental.md` (161 códigos, 21 bloques).
- Antes de escribir el `INSERT`/migración, correr `SELECT * FROM cie11_directory LIMIT 5;` en el SQL
  Editor de Supabase para confirmar el nombre real de las columnas (no está versionado en ningún `.sql`
  del repo — ver hallazgo de esquema sin migración en `CONTEXTO_HANDOFF_2026-07-01.md`). Nombres
  probables por convención del resto del repo: `codigo`, `categoria` (el bloque), `nombre`,
  `descripcion_breve`.
- **Importante:** ya que esta tabla no tiene migración versionada, aprovechar esta carga para crear
  por fin el archivo `supabase/migrations/YYYYMMDD_seed_cie11_directory.sql` con el `CREATE TABLE IF
  NOT EXISTS` real (columnas + tipos que ya existan en producción) seguido del `INSERT`. Así se resuelve
  a la vez el hallazgo de "esquema sin migración" para esta tabla específica.
- Los códigos "calificador transversal" marcados en el archivo 01 (`6A25`, `6A80`, `6D86`) no son
  diagnósticos independientes — decidir si se cargan igual (útiles para búsqueda) o se excluyen; mi
  recomendación es cargarlos pero con un flag `es_calificador: true` si la tabla lo permite, para que
  el buscador no los ofrezca como diagnóstico principal.

## 2. Reforzar `psychometric_evaluations` con MoCA/MMSE

- La tabla ya existe (según el handoff previo) pero solo contempla PHQ-9/GAD-7/C-SSRS/AUDIT-C.
- Añadir MoCA y MMSE como tipos de evaluación posibles (ver estructura en
  `05_Escalas_Evaluacion_Estructura_Informes_Clinicos.md`), especialmente relevante dado que el pedido
  explícito de esta investigación fue reforzar el apartado de deterioro cognitivo.
- Construir el componente de UI que falta (mencionado como gap en el handoff): ningún componente del
  frontend usa esta tabla todavía. Prioridad sugerida: primero PHQ-9/GAD-7 (más simples, 2 pantallas de
  formulario), después C-SSRS (requiere lógica condicional de ramificación de preguntas) y MoCA/MMSE al
  final (requieren tareas más complejas de UI, como dibujo/copia de figuras en el MoCA).

## 3. Enriquecer `/anamnesis`

Hallazgo repetido en ambas auditorías: el formulario solo pide nombre completo. A la luz de
`04_Neurologia_Comorbilidades_Deterioro_Cognitivo.md`, los campos mínimos que debería tener una
anamnesis clínica real son:

- Motivo de consulta (texto libre).
- Antecedentes médicos generales (checklist + texto libre: enfermedad cardiovascular, tiroidea,
  neurológica, epilepsia, etc.).
- Medicación actual (nombre, dosis, quién la prescribe).
- Antecedentes psiquiátricos personales (diagnósticos previos, tratamientos previos, hospitalizaciones).
- Antecedentes psiquiátricos familiares.
- Consumo de sustancias (alcohol, tabaco, otras) — idealmente con el AUDIT-C ya integrado aquí mismo.
- Antecedentes de autolesión/intentos de suicidio previos (con manejo sensible de UI — no debe sentirse
  como un interrogatorio frío; considerar texto explicativo antes de esta sección).
- Red de apoyo social/familiar actual.
- Para el caso específico de deterioro cognitivo: si el paciente es adulto mayor o hay sospecha
  cognitiva, preguntas de cribado rápidas antes de programar un MoCA completo (¿ha notado cambios en
  la memoria? ¿algún familiar lo ha notado? ¿interfiere con actividades diarias como manejar dinero o
  tomar medicamentos?).

## 4. Guías clínicas — usar el catálogo para expandir contenido

`guia.tsx`/`guias.$guiaId.tsx` actualmente tienen 12 guías en 4 categorías (ansiedad, infantil,
autoestima + una más, según lo verificado en vivo). Con el catálogo completo de 161 códigos y 15
modelos terapéuticos de los archivos 01 y 03, hay material de sobra para expandir categorías —
sugerencia de categorías nuevas con mayor cobertura clínica: trastornos del estado de ánimo, trauma y
estrés, trastornos de la conducta alimentaria, y una categoría específica de salud cognitiva/adultos
mayores (directamente pedida por el usuario), ya que ninguna categoría actual cubre deterioro cognitivo.

## 5. Recordatorio de la regla de seguridad "al final"

Nada de esta integración toca los 4 hallazgos críticos de seguridad ya documentados (password=email,
Stripe en modo test, RLS de guías premium, esquema sin migración) — esto es contenido y estructura de
datos, no seguridad. Se puede implementar de inmediato sin violar la decisión explícita de dejar
seguridad para el final del roadmap. La única excepción parcial es el punto 1 de arriba (crear la
migración faltante de `cie11_directory`), que es higiene de esquema, no un cambio de política de
seguridad — vale la pena hacerlo de una vez ya que se está tocando esa tabla de todas formas.

## 6. Prioridad sugerida de implementación (de mayor a menor impacto/esfuerzo)

1. Migración + carga de `cie11_directory` completo (archivo 01) — impacto alto, esfuerzo bajo (es
   básicamente un `INSERT` grande).
2. Enriquecer `/anamnesis` con los campos del punto 3 — impacto alto, esfuerzo medio.
3. UI de PHQ-9 y GAD-7 sobre `psychometric_evaluations` — impacto alto, esfuerzo medio.
4. Expandir guías clínicas con contenido de los archivos 03 y 04 — impacto medio, esfuerzo medio
   (requiere redacción de contenido para el público final, no solo datos).
5. C-SSRS y MoCA/MMSE — impacto alto pero esfuerzo mayor por su complejidad de UI condicional/gráfica.
