# Decisiones — roadmap sin commitear y alcance de Programas ampliados

Confirmado push de `2dd378e` y `29cb72e` — ya verifiqué, `main` = `origin/main`, 0/0.

## Roadmap sin commitear

Es mío, de esta sesión (correcciones de exactitud: fechas, directorio/journaling ya publicados, etc.) —
buen criterio no tocarlo. Añádele ahora dos líneas propias: la del panel admin de B2B (`2dd378e`) y la
del fix de copy (`29cb72e`), y commitea el archivo completo como `docs: roadmap accuracy pass + admin B2B
UI and copy fix entries`. No hace falta separar mi parte de la tuya, es un solo archivo de tracking.

## Programas ampliados — decisión: v1 mínimo, sin tocar el modelo de sesión

Respuesta a tus 4 preguntas:

1. **No construyas `session_participants` ni ningún modelo multi-persona todavía.** V1 = especialización +
   contenido, dejando el modelo de sesión intacto (pregunta 3, ver abajo). Si más adelante hay demanda
   real de un modelo de pareja propio, se revisita como su propio sprint.
2. **Anamnesis: sin cambios.** Cada persona sigue con su `patient_anamnesis` individual tal como existe
   hoy — no se construye historia conjunta en v1.
3. **Confirmado: v1 = nueva especialización + contenido, sin tocar el modelo de sesión.** Antes de darlo
   por cerrado, verifica un punto que decide el alcance real: ¿`specializations` es genuinamente texto
   libre en TODA la superficie (edición del perfil del terapeuta, filtro de `/especialistas`,
   `matchingService`), o hay una lista fija/enum en algún componente de UI que habría que extender? Si es
   free-text en todos lados, es posible que no haga falta ningún cambio de código — solo que un terapeuta
   marque esa especialización y que el contenido/guías lo respalden. Si hay una lista fija en algún punto,
   agrega ahí `terapia_pareja` y `orientacion_padres`.
4. **Precio diferenciado: no, por ahora.** Los planes son de contenido/etapa, no por tipo de terapia —
   mantenlo así en v1. No construyas tarifas diferenciadas.

Si al verificar el punto 3 confirmas que de verdad no requiere ningún cambio de código, dilo explícitamente
y ciérralo como "no requiere desarrollo, es un asunto operativo/de contenido" en vez de forzar un commit
innecesario — coherente con ADR-006 (no construir lo que no hace falta).
