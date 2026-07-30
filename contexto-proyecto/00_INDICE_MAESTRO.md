# Índice maestro — Contexto del proyecto Mente en Foco

Esta carpeta reúne **todo** el contexto de auditorías, investigación clínica, análisis competitivo,
especificaciones de producto y prompts de handoff para Claude Code generados a lo largo del proyecto.
Antes de esta reorganización (22-jul-2026), estos archivos estaban sueltos en la raíz del repositorio o
repartidos en 3 carpetas distintas — ahora todo vive aquí, agrupado por tipo.

## Cómo está organizada

- **`diagnostico-vivo/`** — `diagnostico_sitio.html`, el documento de trazabilidad que se actualiza cada
  vez que se avanza en el proyecto. Es la fuente de verdad más reciente sobre qué módulo está en qué
  estado (backend vs. frontend, % de avance, pendientes). **Si solo vas a leer un archivo de esta
  carpeta, que sea este.**
- **`investigacion-clinica/`** — CIE-11, DSM-5-TR, metodologías terapéuticas basadas en evidencia,
  neurología/comorbilidades/deterioro cognitivo, escalas de evaluación y estructura de informes
  clínicos, y recomendaciones de implementación técnica. Investigación original hecha para este
  proyecto (no genérica).
- **`investigacion-competencia/`** — Perfil de Selia, Terapify y BetterHelp: onboarding, matching,
  pricing, diferenciadores. Se actualiza cada vez que se investiga algo nuevo de la competencia.
- **`analisis-estrategico/`** — Análisis del rol de "consultor estratégico": comparación de features
  propias contra la competencia y propuestas de expansión, con límites éticos explícitos (nunca
  explotar vulnerabilidad clínica real para conversión comercial).
- **`especificaciones-producto/`** — Specs técnicas detalladas de features pendientes de construir
  (qué tabla, qué componente, qué UX), escritas para que Claude Code las ejecute con precisión.
- **`prompts-claude-code/`** — Todos los prompts de handoff a Claude Code, en orden cronológico. Cada
  uno documenta qué se le pidió hacer y por qué.
- **`guias-bienestar/`** — Plantilla maestra de estructura de guías, taxonomía de categorías y el prompt
  reutilizable para generar guías nuevas (base de la futura automatización de 1 guía cada 2 días). Es el
  único contenido de esta carpeta pensado para vivir en Obsidian desde el principio — el resto del
  trabajo diario se queda local hasta que el usuario indique migrar todo a Obsidian.
- **`contenido-plataforma/`** — El contenido editorial real de la plataforma (artículos, resúmenes de
  audio) y la guía de estilo de redacción (`00_guia_estilo_redaccion.md`, extraída de Selia). El artículo
  modelo aprueba el tono antes de producir en volumen. El schema y el flujo de publicación
  (terapeuta→admin) están en `especificaciones-producto/10_...md`.
- **`auditorias-historicas/`** — Auditorías y documentos de contexto más antiguos (mayo-julio 2026),
  conservados como referencia histórica aunque ya no reflejen el estado actual del proyecto — para eso
  está `diagnostico-vivo/`.
- **`_revisar_no_pertenece_a_este_proyecto/`** — Un archivo (`Bocaditos_Estrategia_Instagram.docx`) que
  apareció guardado por error en la carpeta de Mente en Foco en una sesión anterior — es de otra marca
  (Bocaditos, no salud mental). Queda aquí visible en vez de borrado, a la espera de que confirmes si
  lo mueves a la carpeta correcta o lo eliminas.

## Regla de mantenimiento

Cuando se genere un documento nuevo de cualquiera de estos tipos, debe guardarse directamente en la
subcarpeta correspondiente — no en la raíz del proyecto. Así esta carpeta se mantiene como el único
lugar donde buscar contexto, sin volver a acumular archivos sueltos.
