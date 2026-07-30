# Prompt para Claude Code — Sistema de contenido (backend + panel de revisión + lector)

Contexto: vamos a montar el área de contenido del portal del paciente (artículos/blog, programas,
herramientas, audio) con un **flujo editorial real**: los terapeutas redactan y **envían a revisión**, y
**solo los administradores publican**. La spec completa de schema y workflow está en
`contexto-proyecto/especificaciones-producto/10_sistema_contenido_blog_programas_workflow.md` y la guía de
estilo del contenido en `contexto-proyecto/contenido-plataforma/00_guia_estilo_redaccion.md` — léelas
antes de tocar código.

Regla del proyecto, no negociable: **backend antes que frontend, simultáneos pero en ese orden lógico.**
Construye la tabla + RLS + policies primero, y sobre eso la UI. No hay UI de contenido sin su tabla.

**Esta tanda construye la PLOMERÍA (schema + panel + lector); el contenido se siembra después**, cuando el
usuario apruebe el tono del artículo modelo. Puedes arrancar ya porque el schema no depende de eso.

## 1. Backend — migración

Crea la migración con la tabla `content_items` y los enums (`content_type`, `audio_kind`,
`content_status`) exactamente como en la sección 1 de la spec 10. Reutiliza `plan_type`/`plan_rank`/
`min_plan` que ya existen para el gating (mismo patrón que `clinical_guides`). Añade:
- Índices por `status`, `content_type`, `categoria`, `slug`.
- **Constraint/policy crítica:** solo un perfil con `role='admin'` puede dejar `status='publicado'` o
  setear `published_by`. Un terapeuta no puede autopublicarse ni manipulándolo desde el cliente.
- RLS de la sección 3 (lectura pública solo de `publicado` + gating por plan; autor ve lo suyo; admin ve
  todo). Escríbelas; si el proyecto sigue con RLS desactivado en pruebas, déjalas comentadas/listas igual
  que las demás tablas, y déjame una nota.
- Vista `content_items_meta` (metadatos sin `body_md`) equivalente a `clinical_guides_meta`, para listar
  incluidas las piezas bloqueadas con su candado.

Opcional (si no alarga demasiado): `content_revisions` para versionar ediciones del admin sobre lo que
envió un terapeuta.

## 2. Frontend — 3 piezas

### a) Lector del paciente/público
Hub de contenido (`/contenido` o integrado al portal) + detalle por slug, reutilizando el renderizado
markdown (ReactMarkdown + remark-gfm) y el gating/paywall que ya usan las guías. Render por tipo:
- Artículo: markdown + bloque "En resumen" (`en_resumen`) + FAQ (`faq`) destacada.
- Programa: hero + "qué vas a lograr" + lista de `program_steps` enlazados.
- Herramienta: pasos accionables.
- Audio: muestra el `resumen_breve` + `body_md`; si `audio_url`/`external_embed_url` son null, badge
  "Audio próximamente" (el resumen ya aporta valor solo). Cuando existan, reproductor/embed.

### b) Envío del terapeuta (nutrir el blog)
En el dashboard del terapeuta, una opción "Escribir / proponer contenido": formulario que crea un
`content_item` en `borrador`, permite editarlo, y un botón **"Enviar a revisión"** (→ `en_revision`). El
terapeuta ve una lista de sus propuestas con su estado y las `review_notes` del admin cuando pidan cambios.
No puede publicar.

### c) Panel de revisión del admin
En el dashboard del admin, una **cola de revisión** con los ítems en `en_revision`. Por cada uno, el admin
puede: previsualizar, **editar**, **aprobar** (→ `aprobado`), **solicitar cambios** (→
`cambios_solicitados` + `review_notes`), y **publicar** (→ `publicado`, `published_by=él`). También puede
crear contenido propio y publicarlo directo, y archivar. Este panel es la pieza central del pedido: el
admin es el único con potestad de publicación.

## 3. Imágenes
Van en `public/contenido/` con nombre = slug. Donde el tema coincida con una guía existente, reutiliza la
imagen de `public/guias/`. Para las nuevas, descárgalas de banco libre (Pexels/Unsplash, sin marca de agua,
criterio no estigmatizante) siguiendo los briefs — mi sandbox no puede bajar binarios de bancos.

## 4. Siembra (después de aprobación de tono)
Cuando el usuario apruebe el artículo modelo, sembraré/entregaré el contenido real (el artículo de
`contenido-plataforma/articulos/articulo-modelo-01-ansiedad-que-no-para.md` y los resúmenes de audio de
`contenido-plataforma/audio-temas/`) para cargarlos como `content_items` publicados. Deja el seed script
preparado para recibirlos. **No inventes artículos tú**: el contenido clínico lo redactamos con la
metodología del proyecto, no se improvisa.

## Verificación
Con las 3 cuentas: `terapeuta@test.com` crea y envía una propuesta → `admin@test.com` la ve en la cola,
pide cambios, el terapeuta la corrige y reenvía, el admin la aprueba y publica → un paciente la ve
publicada con el gating correcto, y un terapeuta NO puede publicar por ningún camino. Repórtame el recorrido.
