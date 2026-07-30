# Análisis de neuromarketing: lenguaje de planes/membresía menos invasivo

Encargo del usuario: evaluar, desde neuromarketing/publicidad, si los niveles de suscripción se sienten
invasivos, y proponer un lenguaje más cercano ("invertir en tu salud mental" en vez de "membresía") y
nombres de plan diferenciadores (ejemplos dados: "Primeros Pasos", "Mi mente, mi mundo").

## Qué encontré (con fuentes)

1. **Los dos referentes globales de bienestar (Headspace, Calm) NO diferencian sus niveles con nombres
   creativos** — usan nomenclatura funcional (mensual/anual/familiar/premium).
   [Teardown Headspace & Calm Pricing](https://sbigrowth.com/insights/headspace-calm-pricing) confirma
   que ambos compiten en duración y precio, no en naming emocional. Esto significa que nombrar los planes
   de forma diferenciadora (lo que pediste) **no es solo estético — es un espacio que la competencia
   directa de bienestar no ocupa**, y encaja con la idea ya registrada en memoria de diferenciarse de
   competidores como Selia/Terapify/BetterHelp.
2. **Guía ética explícita sobre el límite a no cruzar**: "el marketing de salud mental suele tocar fibras
   sensibles, y ese tono vende, pero puede hacer daño. Señales de alarma: promesas absolutas, presión por
   pagar 'paquetes' caros, poca claridad sobre credenciales." Esto confirma y refuerza la regla que ya
   tenía este proyecto (nunca explotar vulnerabilidad clínica para conversión) — el lenguaje más cálido
   que se propone abajo se queda deliberadamente lejos de urgencia, escasez artificial o promesas
   absolutas ("cura", "en 30 días", etc.).
3. **Framing de inversión vs. framing de gasto** es un principio de precios psicológicos bien documentado
   (efecto de encuadre/framing): la misma cifra se percibe distinto según si se presenta como "costo" o
   como "inversión en un resultado deseado". Aplicarlo aquí es coherente con lo que ya pediste.

## Diagnóstico de lo actual

- La palabra "Membresía" (título de la página, botón "Suscribirme", texto "Elige tu plan") tiene
  connotación de club/servicio recurrente genérico — funcional pero fría para un producto de salud
  mental.
- Los nombres de plan actuales (Esencial/Integral/Premium) son genéricos de SaaS — no dicen nada del
  proceso terapéutico ni generan identificación emocional con la etapa del usuario.
- Nada de esto es "invasivo" en el sentido de dark patterns (no hay countdown, no hay "solo quedan 3
  cupos", no hay presión de urgencia) — el problema es de **tono**, no de tácticas agresivas. Es una
  corrección de calidez, no una corrección de ética (esa ya estaba bien resuelta).

## Propuesta de renombrado

Mantiene sin cambios el campo técnico `plan_type` en la base de datos (`esencial`/`integral`/`premium` —
cero riesgo de migración, cero cambio de backend). Solo cambian los `name`/label que ya son campos de
texto puramente de presentación en `PLAN_OFFERS` y `PLAN_LABELS` (`src/lib/api/plans.ts`).

| Plan (`plan_type`, sin cambios) | Nombre actual | Nombre propuesto | Por qué |
| :--- | :--- | :--- | :--- |
| `free` | Gratuito | Primer Contacto | Es el punto de entrada, no un producto — "gratuito" ya está bien pero "Primer Contacto" conecta con el journey. Opcional, de menor prioridad que los 3 de pago. |
| `esencial` | Esencial | **Primeros Pasos** | Tu propia sugerencia. Encaja perfecto como entrada al proceso terapéutico — evoca inicio, no "versión básica/recortada". |
| `integral` | Integral | **Mi Equilibrio** | Extiende tu idea de "mi mente, mi mundo" hacia el plan de acompañamiento continuo (4 sesiones/mes) — "equilibrio" describe el resultado buscado, no la cantidad de features. |
| `premium` | Premium | **Mi Mundo en Foco** | Cierra el juego de palabras con el nombre de marca ("Mente en Foco") en el nivel más completo — sugiere que en este nivel el acompañamiento cubre todo tu entorno (familia incluida, que es justo un beneficio real de este plan). |

Copy que cambia junto con los nombres (todo en `src/lib/api/plans.ts` y `membresia.tsx`, sin tocar
lógica):
- Título de página: "Membresía Mente en Foco+" → **"Invierte en tu bienestar"** o **"Tu proceso, a tu
  ritmo"**.
- "Elige tu plan" → **"Elige cómo quieres avanzar"**.
- Botón "Suscribirme" → **"Empezar con [Nombre del plan]"** (ej. "Empezar con Primeros Pasos") — más
  cálido que el genérico "Suscribirme", y refuerza el nombre nuevo en el momento de decisión.
- `MEMBERSHIP_TIERS` ("Membresía Mensual"/"Membresía Anual"): dado que técnicamente mapean a
  `integral`/`premium`, conviene alinear su copy para que no contradiga los nuevos nombres — ej.
  "Membresía Mensual" → **"Mi Equilibrio, mes a mes"**, "Membresía Anual" → **"Mi Mundo en Foco, todo el
  año"**. Ajuste de texto, mismo mecanismo de pago.

## Qué NO tocar

- El campo `plan_type` en la base de datos, RLS, `plan_rank`, y cualquier lógica de negocio — cero riesgo
  de backend, esto es 100% copy/label.
- Ninguna urgencia artificial, countdown, ni lenguaje de escasez — el objetivo es calidez, no presión.
- Los precios y el modelo de facturación (Stripe test mode) — fuera de alcance de esta tarea.

## Fuentes

- [Teardown Headspace & Calm Pricing — SBI Growth](https://sbigrowth.com/insights/headspace-calm-pricing)
- [Terapia para todos: ¿necesidad real o negocio millonario? — advertencia sobre lenguaje invasivo en salud mental](https://www.saludyalimentacion.com/terapia-para-todos-necesidad-real-o-negocio-millonario/)
- [Images matter: Mindframe guidelines for image use](https://mindframe.org.au/images-matter-mindframe-guidelines-for-image-use) (reutilizada también para la curaduría de imágenes, spec 07)
