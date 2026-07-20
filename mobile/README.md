# Mente en Foco — App móvil (Expo / React Native)

Esta carpeta es un proyecto Expo independiente del sitio web (`../src`), pero **usa el mismo
backend Supabase** (misma base de datos, mismas tablas, mismas políticas RLS). No es una app de
demostración: si el backend web funciona, esta app funciona contra los mismos datos reales.

## Qué contiene esta primera versión (Fase 1 — paciente)

- Login (`app/login.tsx`)
- Inicio: próxima sesión, accesos rápidos a mensajes y evaluaciones (`app/(tabs)/index.tsx`)
- Mi progreso: tendencia PHQ-9/GAD-7, historial de evaluaciones, resumen de anamnesis (`app/(tabs)/progreso.tsx`)
- Evaluaciones: PHQ-9, GAD-7 y C-SSRS, con contenido clínico literal y alerta automática de crisis (`app/(tabs)/evaluaciones.tsx` + `app/evaluacion/[scale].tsx`)
- Agenda: sesiones próximas y pasadas, botón "Unirme" con el enlace de videollamada (`app/(tabs)/agenda.tsx`)
- Mensajes: chat en tiempo real con el terapeuta asignado (`app/(tabs)/mensajes.tsx`)

**No incluida a propósito en esta fase:** pantallas de terapeuta/admin, pagos/Stripe, formulario de
anamnesis completo (el paciente lo llena desde la web). Eso queda para una Fase 2 si se decide
seguir por este camino nativo en paralelo a Base44.

## Lo que necesito que hagas (Claude Code)

1. **Instalar dependencias**
   ```
   cd mobile
   npm install
   ```

2. **Configurar variables de entorno**
   ```
   cp .env.example .env
   ```
   Abre `.env` y pon los mismos valores que ya están en el `.env` del sitio web (raíz del repo):
   `VITE_SUPABASE_URL` → `EXPO_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   No hay que crear ni tocar nada en Supabase — es el mismo proyecto que ya está en producción.

3. **Verificar compatibilidad de versiones**
   ```
   npx expo-doctor
   npx expo install --fix
   ```
   Armé este scaffold sin poder ejecutar `npm install` (mi sandbox no tiene acceso a este
   proyecto real ni red hacia Supabase), así que las versiones del `package.json` pueden necesitar
   ajuste fino de Expo SDK 52. `expo install --fix` corrige automáticamente cualquier
   desalineación de versiones entre paquetes.

4. **Arrancar el servidor de desarrollo en la misma red WiFi**
   ```
   npm run start:lan
   ```
   Esto abre un QR en la terminal. En el teléfono (misma WiFi que el computador):
   - Instala la app **Expo Go** (App Store / Play Store).
   - Abre Expo Go y escanea el QR (en iPhone, puedes escanear directamente desde la app Cámara).
   - La app carga en el teléfono con hot-reload: cada cambio de código se refleja al instante.

   Si el teléfono no logra conectar por red local (redes WiFi con aislamiento de clientes, VPN,
   etc.), usa en su lugar:
   ```
   npm run start:tunnel
   ```
   Es más lento pero funciona desde cualquier red.

5. **Probar el flujo completo con una cuenta de paciente real** (o de prueba) antes de avisarme:
   login → ver próxima sesión → completar un PHQ-9 → verificar que aparece en "Mi progreso" →
   enviar un mensaje al terapeuta y confirmar que llega en tiempo real → revisar que la
   evaluación C-SSRS con respuesta de riesgo genere la alerta y el aviso de seguridad en pantalla.

6. **Cuando todo lo anterior funcione**, avísame con capturas o una descripción de qué probaste y
   qué encontraste. A partir de ahí decidimos juntos si seguimos con Fase 2 nativa (terapeuta) o
   nos quedamos con Base44 para esa parte.

## Generar el APK/build real (solo cuando lo pidamos explícitamente)

Esto **no** hay que hacerlo todavía — es solo referencia para cuando estemos listos:
```
npx eas build --platform android --profile preview
```
Requiere cuenta gratuita en `expo.dev` y `eas-cli` (`npm install -g eas-cli`). No lo ejecutes sin
que te lo pida directamente, porque implica crear una cuenta externa.

## Notas técnicas para ti (Claude Code)

- El cliente de Supabase (`src/lib/supabase.ts`) usa `AsyncStorage` en vez de `localStorage` — no
  lo cambies, es requisito de React Native.
- Los colores en `src/theme/colors.ts` son una aproximación hexadecimal de la paleta `oklch()` del
  sitio web (`src/styles.css`), porque React Native no soporta `oklch()`. Si el diseño necesita
  fidelidad exacta, habría que exportar los valores reales desde el navegador (DevTools →
  computed style) y actualizar este archivo.
- El contenido clínico de PHQ-9, GAD-7 y C-SSRS (`src/lib/psychometricScales.ts` y
  `app/evaluacion/[scale].tsx`) está copiado literal desde la web — no lo traduzcas, resumas ni
  "mejores" el texto. Son instrumentos clínicos validados.
- `src/components/ui.tsx` es un scaffold mínimo a propósito (sin librería de componentes). Si vas
  a pulir el diseño visual, ese es el lugar por donde empezar.
- Los íconos de las pestañas (`app/(tabs)/_layout.tsx`) son emojis de marcador de posición.
  `@expo/vector-icons` ya viene incluido con Expo si quieres reemplazarlos.
