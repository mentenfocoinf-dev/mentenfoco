# Fix: visibilidad de guías para plan gratis/anónimo + expansión de categorías

## El bug (diagnosticado, no solo reportado)

En `src/lib/api/guidesService.ts`, `listGuides()`:

```ts
let query = supabase.from("clinical_guides_meta").select("*");
if (freeLead) query = query.eq("visible_en_plan_gratis", true);
```

Esta línea filtra la lista completa a solo las 4 guías de vitrina para cuentas free/anónimas — **antes**
de que la UI tenga oportunidad de mostrar el candado. El comentario del propio archivo (línea 3-5) dice
que la intención original era mostrar TODAS las guías con candado en las bloqueadas, y `guia.tsx` ya
tiene el código del candado listo (`{g.min_plan && g.min_plan !== "free" && <span>... <Lock/> ...`) —
ese candado nunca se renderiza para free/anónimo porque esas filas nunca llegan. Confirmado también que
`clinical_guides_meta` es una vista sin RLS propio (`grant select ... to anon, authenticated`, sin
policy adicional), así que quitar el filtro no expone nada que no debiera verse — son solo metadatos,
nunca `contenidoCompleto`.

**Fix de una línea**: `listGuides()` deja de filtrar por `visible_en_plan_gratis` — siempre trae las 20
(y las que se agreguen). Ese campo sigue existiendo y se sigue usando exactamente igual, pero solo en
`getGuide()`, que ya gatea correctamente el contenido completo (eso no se toca, ya funciona bien).

## Aclaración importante sobre el modelo de planes (esto ya estaba bien, no cambiarlo)

Verificado en `20260703_plan_tiers_admin_rpcs.sql`: **cualquier guía marcada `es_premium=true` ya se
guarda con `min_plan='esencial'`** (el plan pago más barato), nunca `integral` o `premium`. Y
`plan_rank(min_plan) = 0 OR get_my_plan_rank() >= plan_rank(min_plan)` significa que integral y premium
(rango mayor) también pasan esa condición. Es decir: **el backend ya cumple exactamente lo que pediste
hoy** — cualquier plan pago, incluido el más económico, desbloquea el catálogo completo. Esto **revierte
la recomendación pendiente #5 del diagnóstico** ("diferenciar de verdad los 3 planes de pago" repartiendo
guías por `min_plan`) — esa recomendación queda descartada explícitamente por decisión del usuario de
hoy: la diferenciación entre esencial/integral/premium debe darse en otros beneficios, nunca en acceso a
guías.

## Expansión de categorías

Categorías actuales (8, 20 guías): Alimentación, Ánimo, Ansiedad, Autoestima, Infantil, Memoria,
Relaciones, Trauma.

**Aclaración antes de expandir**: pediste agregar "TCA" — ya existe, es la categoría **Alimentación**
(trastornos de la conducta alimentaria, CIE-11 6B80–6B8Z). No se duplica.

**Corrección importante sobre "clusters de personalidad"**: la CIE-11 (nuestro estándar diagnóstico
principal en toda la plataforma) eliminó el modelo categórico de "Cluster A/B/C" — ese es el modelo del
DSM-IV/CIE-10, ya superado. La CIE-11 usa un **modelo dimensional**: severidad (leve/moderada/grave,
6D10.0–.2) + 5 dominios de rasgos prominentes (afectividad negativa, desapego, disocialidad,
desinhibición, anancastia, 6D11.0–.4). Para mantener coherencia con el resto de la plataforma (que usa
CIE-11 en todo diagnóstico) y para evitar contenido estigmatizante de autoayuda tipo "qué cluster sos",
la categoría se llama **"Personalidad"** y las guías se enfocan en rasgos/patrones de funcionamiento
interpersonal (ej. "por qué me cuesta regular mis emociones en las relaciones", "rigidez y perfeccionismo:
cuándo se vuelve un patrón"), no en diagnósticos categóricos con nombre propio.

Categorías nuevas propuestas (5), con justificación de por qué no están ya cubiertas:

1. **Personalidad** — rasgos/patrones dimensionales (arriba). No solapa con Ánimo/Ansiedad, que son
   episodios/estados, no patrones estables de funcionamiento.
2. **Sueño** — insomnio, higiene del sueño. Comórbido con casi todas las categorías existentes pero sin
   cobertura propia hoy; altísima demanda de autoayuda.
3. **Estrés laboral / Burnout** — CIE-11 lo reconoce como fenómeno ocupacional (QD85, fuera del capítulo
   de salud mental pero con relevancia clínica reconocida). No cubierto por Ansiedad (el estrés laboral
   crónico tiene un perfil distinto: despersonalización, cinismo, agotamiento — no es solo ansiedad).
4. **Adicciones** — consumo de sustancias y conductas adictivas (CIE-11 6C4x). Vacío total hoy en el
   catálogo.
5. **Salud mental perinatal** — depresión/ansiedad en embarazo y posparto. Población y presentación
   clínica distintas de Ánimo/Ansiedad genéricos (factores hormonales, culpa específica de la maternidad,
   riesgo de infravaloración por el entorno).

No se generan las guías de estas categorías todavía — el usuario pidió investigar la base científica
primero (ver `guias-bienestar/00_plantilla_maestra_estructura_guias.md` y
`01_taxonomia_categorias.md`).

## UI: menú desplegable de categorías

Con 8 categorías ya la fila de pills en `guia.tsx` ocupa 2 líneas (ver captura); con 13 (8+5) necesita
un patrón distinto. Recomendación: mantener las pills para "Todas" + las categorías con más guías, y
agregar un desplegable ("Más categorías ▾") para el resto — o migrar todas a un único `<select>`/menú
desplegable si el usuario prefiere consistencia visual sobre mantener el estilo pill actual. Dejar esta
decisión de detalle visual a Claude Code, manteniendo la línea gráfica glass/neon ya establecida.
