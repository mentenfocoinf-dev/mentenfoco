# Curaduría de imágenes para las 8 guías sin imagen

## Limitación técnica encontrada (importante)

Intenté buscar y descargar directamente, pero mi sandbox bloquea por allowlist cualquier dominio de
bancos de imágenes (`images.pexels.com`, `images.unsplash.com`, `cdn.pixabay.com` — probado, los 4
devuelven `403 blocked-by-allowlist`), y la herramienta de fetch de páginas web no guarda archivos
binarios en disco. Por eso esto llega como **brief curado + términos de búsqueda exactos**, no como
imágenes ya descargadas — la descarga/renombrado queda para Claude Code, que sí corre con acceso de red
completo en tu máquina.

## Criterios (para las 8 nuevas y para cualquier guía futura)

- Banco: Pexels o Unsplash (licencia libre, sin atribución obligatoria, sin marca de agua nunca).
- Formato/calidad: horizontal o cuadrada, mínimo 1200px de lado, sin texto superpuesto, sin logos.
- Estilo, para que combine con las 12 imágenes ya existentes (referencia:
  `public/guias/Diálogo interno positivo.png`): fotografía de persona real (retrato o lifestyle),
  iluminación suave de estudio o luz natural cálida, fondo neutro/desenfocado, expresión calmada o
  reflexiva — nunca de angustia extrema, nunca clichés de "encerrado entre rejas" o "cabeza entre las
  manos en la oscuridad".
- Principio ético (basado en las guías Mindframe de uso de imágenes en salud mental — ver fuente abajo):
  priorizar imágenes que transmitan ayuda/esperanza o un momento de calma, no solo sufrimiento; mostrar el
  espectro completo (afrontando, no solo sufriendo); evitar reforzar estigma o victimización.
- Nice-to-have, no bloqueante: aplicar el mismo desvanecido inferior (blanco, degradado) que ya tienen las
  12 imágenes existentes, para que la tarjeta se vea uniforme — Claude Code puede automatizarlo con
  Pillow/ImageMagick si quiere, o dejar la imagen sin desvanecer si toma más tiempo del que vale.

## Las 8 imágenes, con brief y términos de búsqueda

| Guía (`id`) | Nombre de archivo exacto | Brief visual | Términos de búsqueda sugeridos |
| :--- | :--- | :--- | :--- |
| `animo-depresion-episodio` | `Entender un episodio depresivo.png` | Persona en un momento de quietud/introspección, luz suave, sin gesto de angustia extrema — transmite "pausa", no colapso. | "person sitting window contemplative", "quiet moment alone calm" |
| `animo-prevencion-recaida` | `Prevenir una recaída depresiva.png` | Persona practicando algo pausado/consciente (respirar, mirar por la ventana, caminar) — connota mantenimiento y cuidado continuo, no crisis. | "mindfulness breathing calm person", "morning routine self care" |
| `trauma-primeros-pasos` | `Primeros pasos tras un evento traumático.png` | Persona en movimiento hacia adelante (caminando, primer paso) o en gesto de anclaje/respiración — nunca imagen literal del evento traumático. | "person walking forward hope", "grounding exercise calm" |
| `trauma-duelo-prolongado` | `Cuando el duelo no avanza.png` | Persona sosteniendo un objeto con significado (foto, carta) o en actitud reflexiva serena — nunca luto genérico en cementerio/velo negro. | "person holding photograph reflective", "quiet remembrance warm light" |
| `alimentacion-relacion-comida` | `Reconstruir una relación sana con la comida.png` | Persona en cocina o mesa en actitud relajada/neutral con comida — nunca básculas, cintas métricas, primeros planos de cuerpo/peso (esto es explícitamente lo que las guías clínicas de TCA piden evitar). | "person cooking calm kitchen", "mindful eating table" |
| `alimentacion-atracones` | `Entender el trastorno por atracones.png` | Similar al anterior: persona en contexto cotidiano de comida, sin foco en peso/cuerpo. | "kitchen table warm natural light person" |
| `memoria-cambios-normales` | `Cambios de memoria qué es normal y cuándo consultar.png` | Persona adulta mayor en actitud activa/serena (leyendo, en una actividad), no mirada perdida ni imagen clínica de escáner cerebral. | "senior person reading engaged", "older adult smiling activity" |
| `memoria-apoyo-familiar-demencia` | `Acompañar a un familiar con demencia.png` | Dos personas (adulto mayor + familiar) en interacción cálida — mano sobre mano, conversación — transmite acompañamiento, no carga/agotamiento. | "elderly person family caregiver warm", "hands together generations" |

## Fuente para el criterio ético de imágenes

Mindframe (Australia), guía de referencia para uso de imágenes en comunicación sobre salud mental:
prioriza imágenes de ayuda/esperanza, evita estereotipos y palabras como "víctima"/"sufriendo", y pide
representar el espectro completo de experiencias, no solo el sufrimiento.
[Images matter: Mindframe guidelines for image use](https://mindframe.org.au/images-matter-mindframe-guidelines-for-image-use)
