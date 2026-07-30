# Scrape profundo de competencia — 24 de julio de 2026

Captura directa (web fetch + render de navegador) de las 5 plataformas de salud mental que el usuario
pidió analizar a fondo. Objetivo: tener **absolutamente toda** la oferta de cada competidor documentada
para decidir qué le falta a Mente en Foco y volverla la plataforma más completa del mercado hispano.

## Archivos de esta carpeta

- `01_Selia.md` — Selia (Colombia). El competidor directo más fuerte en el mismo mercado.
- `02_Terapify.md` — Terapify (México/LatAm, opera en Colombia).
- `03_Terapi_Chile.md` — Terapi (Chile). SPA con JS; datos por meta + búsqueda + render parcial.
- `04_BetterHelp.md` — BetterHelp (EE. UU., referente global). La versión /es redirige a la home en inglés.
- `05_PorqueQuieroEstarBien.md` — Fundación Santo Domingo (Colombia). El modelo "psicólogos gratis".
- `06_Comparativa_y_gaps.md` — **El documento clave**: tabla comparativa de todo + qué le falta a Mente
  en Foco + respuesta a la pregunta "¿cómo es rentable dar terapia gratis?".

## Método y limitaciones (honestidad sobre los datos)

- Selia, Terapify, BetterHelp y PorqueQuieroEstarBien: capturadas en texto completo, datos confiables.
- Terapi (Chile): es una single-page app con animaciones; el fetch y el render solo exponen fragmentos.
  Los precios y features vienen de su meta-descripción oficial + prensa (La Tercera) + búsqueda web, no
  de captura directa del DOM completo. Marcado como tal en su archivo.
- Los precios cambian y algunos dependen de promociones/ubicación; se anota la fecha de captura
  (24-jul-2026) en cada uno. Verificar antes de usar cifras exactas en materiales públicos.
- Esto se queda local por ahora; se migra a Obsidian al final del día junto con el resto, según la rutina
  acordada.
