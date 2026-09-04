# Prompt para Claude Code — Prueba estética en la home (reversible, no tocar el resto del sitio)

> Pégalo tal cual en Claude Code. Es un **experimento visual acotado a la página de inicio
> (`src/routes/index.tsx`)**, para aprobar antes de pensar en extenderlo al resto del sitio. Si no
> convence, se revierte fácil — por eso el alcance y el aislamiento del cambio importan tanto como el
> resultado visual.

## Antes de tocar nada

Lee `contexto-proyecto/vision-producto/04_SISTEMA_DE_EXPERIENCIA_Y_LENGUAJE.md` (tono) y revisa las
clases de diseño que ya existen (`glass-card`, `card-neon-hover` y cualquier token de Tailwind relacionado
con glassmorphism) — todo esto debe **extender** ese lenguaje visual, no inventar uno paralelo.

## ⛔ Alcance — léelo antes de escribir código

1. **Solo la home (`/`).** Nada de esto se aplica a otras rutas todavía.
2. **Investiga primero cómo está armado el navbar** (FASE 0, solo lectura). Si el navbar es un componente
   global compartido por todo el sitio (probable, ya que aparece en cada página), **no lo edites
   directamente** — en vez de eso, dame 2-3 opciones para aislar el cambio solo a la home (por ejemplo: un
   componente `HomeNavbar` que se usa únicamente en `index.tsx`, o una clase condicional que el layout
   aplique solo en la ruta `/`). Elige la opción más simple que no arriesgue romper el navbar en el resto
   del sitio, y dila explícitamente en tu respuesta antes de aplicarla.
3. **Que sea trivial de revertir.** Todo el cambio debe quedar en el menor número de archivos posible
   (idealmente solo `index.tsx` + un archivo de estilos/componente nuevo), para que un solo `git revert`
   lo quite limpio si no gusta. No mezcles esto con ningún otro cambio.

## Qué construir

### 1. Aparición de elementos al hacer scroll
Las secciones de la home deben aparecer con una transición suave (opacidad + un desplazamiento vertical
pequeño, 16-24px) la primera vez que entran en la pantalla al hacer scroll, en vez de estar visibles de
golpe. Usa `IntersectionObserver` (no listeners de scroll costosos). Requisitos:
- Debe **respetar `prefers-reduced-motion`**: si el usuario lo tiene activado, los elementos aparecen
  directamente sin animación — no es negociable, es accesibilidad.
- Duración/curva suave (aprox. 500-700ms, `ease-out`), nunca rebote ni nada llamativo — el tono del
  producto es calmado, no un sitio de marketing agresivo.
- Que no retrase la carga inicial ni cause parpadeo (`flash of unstyled content`) — el contenido visible
  al cargar la página (above the fold) puede aparecer normal, sin esperar el observer.

### 2. Luz sutil bajo el cursor
Un resplandor azul tenue, semejante a una luz suave (radial, muy difuminada, baja opacidad) que sigue
la posición del mouse dentro de la home, para que el puntero sea más fácil de ubicar visualmente.
Requisitos:
- `pointer-events: none` — nunca debe interferir con clics ni con los efectos de hover que ya existen
  (`card-neon-hover`).
- Solo en dispositivos con mouse real: **no lo actives en touch/mobile** (no tiene sentido ahí y podría
  generar elementos fantasma). Detecta con una media query tipo `(hover: hover) and (pointer: fine)`.
- Implementación performante: actualiza la posición vía CSS custom properties + `transform`, no
  reflow/repaint costoso en cada movimiento; considera limitar la frecuencia de actualización si notas
  jank.
- Sutil de verdad: baja opacidad, difuminado amplio — el objetivo es ayudar a ubicar el cursor, no crear
  un efecto de videojuego.

### 3. Barra de navegación "liquid glass"
Rediseña visualmente (solo en home, ver punto 2 del alcance) la barra superior:
- Forma **redondeada** (no rectángulo de esquina a esquina) — una barra flotante con márgenes del borde
  de la pantalla, esquinas muy redondeadas o tipo píldora.
- Efecto vidrio: fondo semitransparente + `backdrop-filter: blur(...)`, extendiendo los tokens de
  `glass-card` ya existentes en vez de crear un nuevo esquema de color.
- Elegante y sutil: borde muy fino y semitransparente, sombra suave, nada de brillos ni bordes de neón
  agresivos — coherente con el tono calmado del producto.
- Debe seguir siendo perfectamente legible y accesible (contraste de texto/iconos suficiente) sobre
  cualquier fondo de la home al hacer scroll.

## Verificación antes de terminar

- Build ✓ y los 220 tests siguen en verde (esto es CSS/interacción de frontend, no debería tocar lógica,
  pero confírmalo).
- Prueba manual: recorre la home haste abajo y confirma que las animaciones de aparición se ven en cada
  sección, que la luz del cursor se ve en desktop y no aparece en la emulación de móvil, y que el navbar
  nuevo no rompe ninguna otra ruta (visita al menos 2-3 páginas más y confirma que su navbar sigue igual
  que antes).
- Confirma explícitamente en tu respuesta: "el navbar de las demás páginas no cambió" — es la condición
  para que esto sea seguro de probar.

## Entrega

No hace falta el patrón de FASE 0/FASE 1 completo de los cambios de base de datos — esto es solo
frontend/CSS, sin riesgo de datos. Pero sí dame antes de commitear: qué archivos tocaste, la opción que
elegiste para aislar el navbar (punto 2 del alcance), y confirmación de la verificación de arriba. No
commitees hasta que yo lo vea funcionando y dé el visto bueno.
