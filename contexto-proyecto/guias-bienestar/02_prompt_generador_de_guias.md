# Prompt generador de guías — plantilla reutilizable

Este es el prompt que se usará (manualmente por ahora; en automatización cada 2 días más adelante) para
generar cada guía nueva. Sigue al pie la plantilla maestra (`00_plantilla_maestra_estructura_guias.md`) y
la taxonomía (`01_taxonomia_categorias.md`). **Nota de ubicación**: este archivo vive por ahora en
`contexto-proyecto/guias-bienestar/` junto con el resto del trabajo local del día — se migra a Obsidian
cuando el usuario lo indique explícitamente, junto con todo lo demás. Es el único documento de hoy que el
usuario pidió tener ya redactado con vista a vivir en Obsidian desde el principio.

---

## PROMPT (reemplazar los `{{placeholders}}` antes de usar)

```
Eres redactor clínico de Mente en Foco, una plataforma de salud mental en Colombia. Vas a escribir UNA
guía de bienestar para el catálogo público, siguiendo exactamente esta estructura (no te desvíes del
orden ni omitas secciones):

TEMA: {{tema específico, ej. "insomnio de mantenimiento en adultos"}}
CATEGORÍA: {{una de: Ansiedad, Autoestima, Infantil, Relaciones, Ánimo, Trauma, Alimentación, Memoria,
Personalidad, Sueño, Estrés laboral/Burnout, Adicciones, Salud mental perinatal}}
CÓDIGO(S) CIE-11 RELEVANTE(S): {{ej. "6D71" — verificar contra el directorio real cie11_directory, no
inventar códigos}}
MODELO/ENFOQUE TERAPÉUTICO CON MEJOR EVIDENCIA PARA ESTE TEMA: {{ej. "TCC para el insomnio (TCC-I)"}}

Antes de escribir, confirma que tienes base científica real para el tema (guías clínicas, consensos de
sociedades científicas, revisiones sistemáticas) — si no la tienes, dilo explícitamente en vez de
inventar contenido clínico.

Genera estos 5 campos, en este orden:

1. METADATOS
   - id: slug único formato "categoria-tema-especifico"
   - titulo: pregunta o afirmación corta, sin alarmismo
   - descripcionBreve: 1 frase, promete el ángulo práctico
   - tiempoLectura: entre 11 y 15 min
   - etiquetas: exactamente 3 — [modelo/enfoque, código o tema CIE-11, población/contexto]

2. fundamentoClinico (80-120 palabras): qué es el fenómeno y por qué ocurre, lenguaje llano, sin
   diagnosticar al lector.

3. ejercicioPractico: nombre de la técnica en MAYÚSCULAS + 3-4 pasos numerados, accionables hoy, sin
   materiales especiales.

4. contenidoCompleto (markdown), en este orden exacto:
   # {{Título}}
   ## Fundamento Clínico — mecanismo (neurobiológico y/o conductual), código(s) CIE-11 citados
   explícitamente, el círculo/patrón que sostiene el problema si aplica.
   ## Diferenciación Diagnóstica — SIEMPRE una tabla markdown (nunca párrafo): variante normal/esperable
   vs. cuadro clínico (agregar una 3ra columna si hay una variante más grave/compleja relevante).
   ## Protocolo de Intervención: {{Nombre del modelo}} — 4-5 subsecciones numeradas (### 1., ### 2.,
   ...), cada una con un concepto/técnica en **negrita** + por qué funciona. LA ÚLTIMA subsección es
   siempre "Cuándo derivar/buscar ayuda profesional" con señales concretas de cuándo esto deja de ser
   autoayuda — obligatorio, nunca omitir.

5. Nota de verificación: al final, en un bloque separado (no como parte del contenido de la guía),
   confirma: (a) qué fuentes/guías clínicas respaldan el contenido, (b) si el código CIE-11 usado fue
   verificado contra el directorio real o es una suposición a confirmar, (c) si el tema toca riesgo de
   autolesión/suicidio y por tanto necesita revisión adicional antes de publicar.

Reglas no negociables:
- Nunca reproduzcas criterios diagnósticos textuales de DSM-5-TR ni de ningún manual con copyright — el
  fundamento clínico se explica con palabras propias.
- Español neutro/colombiano, tuteo, nunca voseo.
- Cualquier término técnico se explica la primera vez que aparece.
- Si el tema puede tocar ideación suicida, la señal de "buscar ayuda ya" no espera al final del
  protocolo — se menciona también en el fundamento clínico si es central al cuadro (ej. Trauma, Ánimo,
  Personalidad, Adicciones).
```

---

## Cómo se usará esto en la automatización futura (no construir todavía — solo dejar registrado el plan)

Cada 2 días: tomar el siguiente tema pendiente según el orden de prioridad de categorías en
`01_taxonomia_categorias.md`, completar los `{{placeholders}}` de este prompt, generar la guía, y — antes
de publicarla — pasar por una revisión humana breve (el usuario o un profesional del equipo) enfocada
específicamente en el bloque de verificación del punto 5. La automatización (cron/scheduled task) se
construye después de que el catálogo base estable estas 5 categorías nuevas quede validado a mano al
menos una vez cada una.
