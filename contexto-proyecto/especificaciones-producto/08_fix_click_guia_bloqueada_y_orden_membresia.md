# Fix: click en guía bloqueada + orden de secciones en Membresía

## 1. Click en guía bloqueada debe abrir el modal ahí mismo, sin navegar

**Diagnóstico**: en `src/routes/guia.tsx`, el botón "Leer guía" es siempre un `<Link to="/guias/$guiaId">`
(línea 204-210), sin importar si `locked` es `true`. El modal de paywall (`PaywallModal`) solo existe hoy
en `guias.$guiaId.tsx`, y se abre recién después de navegar y de que el loader confirme que no hay acceso
— por eso el usuario ve "otra página" antes del popup.

**Fix**: en `guia.tsx`:
- Importar `PaywallModal` y agregar estado local: `const [paywallGuide, setPaywallGuide] = useState<GuideMeta | null>(null)`.
- En el render de cada tarjeta, si `locked` es `true`, el botón "Leer guía" deja de ser un `Link` y pasa a
  ser un `<button onClick={() => setPaywallGuide(g)}>` (mismo estilo visual, no cambia nada de diseño).
  Si no está bloqueada, se queda igual (`Link` a la guía).
- Al final del componente, un solo `<PaywallModal isOpen={!!paywallGuide} onOpenChange={() => setPaywallGuide(null)} requiredPlan={paywallGuide ? lockInfo(paywallGuide).plan : undefined} />`.
- No tocar `guias.$guiaId.tsx` — ese flujo (acceso directo por URL a una guía bloqueada, por ejemplo por
  un enlace compartido) sigue funcionando igual y sigue siendo necesario para ese caso.

## 2. Quitar el emoji del modal

En `PaywallModal.tsx` línea 33: `Contenido <Sparkles className="h-6 w-6 text-amber-400" />` — quitar el
ícono `Sparkles` (y su import si no se usa en otro lado del archivo). El título queda simplemente
"Contenido".

## 3. Orden de secciones en `/membresia`

Hoy: banner → "¿Qué incluye?" (carrusel) → "Compara los niveles de acceso" (tabla) → "Elige tu plan".
Pedido: mover la tabla comparativa **antes** del carrusel, para que se vea sin tanto scroll. Nuevo orden:
banner → "Compara los niveles de acceso" → "¿Qué incluye?" → "Elige tu plan". Es un simple reordenamiento
de los 2 bloques JSX en `membresia.tsx` (líneas ~83-131 y ~134-180) — ningún dato ni lógica cambia.
