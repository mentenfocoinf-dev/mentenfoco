# Scrape — Estructura del panel de paciente de Selia (sesión iniciada, 24-jul-2026)

Recorrido de `app.selia.co` con sesión real de paciente. Se documenta **la arquitectura de
información** (organización de la barra lateral y de cada vista), NO el contenido, copy ni diseño
propietario de Selia. Objetivo: inspirar el layout de barra lateral para los dashboards de Mente en
Foco (paciente / terapeuta / admin).

## Layout global

- **Barra lateral fija a la izquierda** (fondo morado oscuro de marca), presente en todas las vistas.
  - Logo arriba.
  - Ítems de navegación con icono + etiqueta; el activo se resalta en blanco.
  - Abajo: tarjetas promocionales ("Refer a friend", "Save with packages").
  - Al pie: **Settings** y **Help** separados del resto.
- **Barra superior derecha**: Notificaciones (campana), Chat, nombre de usuario + avatar + menú.
- **Área de contenido** a la derecha, con título de página arriba y a veces flecha "volver".
- Cada vista tiene un **estado vacío bien diseñado** (icono + mensaje + CTA) cuando no hay datos.

## Ítems de la barra lateral (paciente)

| Ítem | URL | Qué contiene |
|---|---|---|
| **Home** | `/` | Saludo, carrusel de promos, "Quick accesses", diario emocional (mood), Programas |
| **For You** | `/for-you` | Hub de contenido: tipos (Video, Blog, Meditación, Herramienta, Podcast, Respiración) + temas + filas temáticas. **Acceso libre a todo el contenido** |
| **Specialists** | `/search` | Directorio con búsqueda inteligente + filtros; perfiles ricos |
| **My appointments** | `/agenda` | Agenda de sesiones (estado vacío: "Schedule your first") |
| **My packages** | `/my-packages` | Paquetes comprados |
| **My specialists** | `/my-specialists` | Especialistas asignados/favoritos |
| **Payments** | `/payments` | Balance, métodos de pago, historial |
| **Settings** | `/settings` | Info personal, seguridad, notificaciones, privacidad, cerrar sesión |
| **Help** | — | Ayuda |

## Detalle por vista

### Home
- Saludo "Hello {nombre}!".
- Carrusel de banners promocionales (descuentos, "encuentra tu especialista ideal").
- **"Search specialists across"**: chips de temas (Social Skills, Anxiety, Depression, Sexuality, Trauma, Life Changes, Self-Harm, +43).
- **Quick accesses** (4 tarjetas): Schedule a session, My appointments, My check-ins, My emotional diary.
- **My emotional diary — "How do you feel today?"**: 5 caritas de ánimo (idéntico a nuestro mood tracker).
- **Programs**: tarjetas de programas por situación (Madres, Burnout, TUSA) con precio y duración.

### For You (contenido — libre)
- Encabezado "Thousands of resources to help you feel better".
- **Filtros por tipo de contenido** (tarjetas icono): Video guide · Blog · Meditation · Tool · Podcast · Breathing.
- **Featured content**: carrusel de tarjetas con badge de tipo (Tool, Blog), título y duración ("5 min", "10 min").
- **Themes**: chips (Stress, Psychology, Mood, Relax, Sleep better, Breathing, Productivity, Social Skills, …).
- Debajo, **filas temáticas** ("Spirituality — View all", etc.).
- **Dato clave confirmado**: el contenido es de acceso libre; no hay pantalla de bloqueo por plan.

### Specialists (directorio / matching)
- Barra de filtros: **Smart search** (IA) · Specialist Type ▾ · Service ▾ · Speciality ▾ · Appointment time ▾ · buscador · Filters.
- "229 Specialists available for you".
- **Tarjeta de especialista**: foto, badge "Featured", nombre, "Online psychologist · N años exp.", rating (★5.0), idiomas, "Specializes in:" (chips), "Services from: $ · View all", "Available {fecha} · horarios", botones **View profile** + **Schedule**.

### My appointments / My packages / My specialists / Payments
- Estados vacíos limpios con icono + mensaje + CTA (ej. "You haven't scheduled your first session" → "Schedule your first").
- Payments: balance disponible, métodos de pago (Add), historial (Order by).

### Settings
- Lista de secciones con chevron: Personal Information · Sign In & Security · Notifications · Privacy & data · Sign Out. Versión al pie.

## Patrones a adoptar para Mente en Foco

1. **Barra lateral persistente** con icono+etiqueta, activo resaltado, Settings/Help al pie, para los 3 roles.
2. **Barra superior** con notificaciones, mensajes y menú de usuario.
3. **Estados vacíos con CTA** en cada sección.
4. **Hub de contenido tipo "For You"** con filtros por tipo y temas — libre para todos (incluida cuenta gratuita).
5. **Diario emocional / mood** como acceso destacado en el Home del paciente (ya lo tenemos).
6. El directorio de especialistas es su gap #2/#3 — no está en esta ola, pero el patrón de tarjeta queda documentado.

## Decisión de producto derivada (del usuario)
- La cuenta gratuita tendrá **acceso libre a todo el contenido** (guías/blog); se elimina el muro de
  plan sobre el contenido informativo. Revisar el bloqueo freemium de guías en consecuencia
  (`guidesService`, candados en `/guia` e Inicio) cuando se aborde el contenido.
