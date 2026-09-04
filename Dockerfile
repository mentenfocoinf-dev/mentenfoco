# ╔══════════════════════════════════════════════════════════════════════════╗
# ║ NOTA: este Dockerfile (nginx sirviendo estático) está OBSOLETO y HOY NO    ║
# ║ FUNCIONA. El build de TanStack Start genera `dist/server/index.js` +       ║
# ║ `wrangler.json` (Cloudflare Worker con SSR) y `dist/client/` SIN un        ║
# ║ `index.html`, por lo que el `try_files … /index.html` de nginx daría 404.  ║
# ║                                                                            ║
# ║ El deploy REAL de producción es el Cloudflare Worker (hace SSR y ejecuta   ║
# ║ src/start.ts: CSP, /sitemap.xml, /api/health). Este archivo se conserva    ║
# ║ solo como referencia; para volver a un deploy con nginx habría que         ║
# ║ prerenderizar o configurar salida SPA. Ver GUIA_ACTIVACIONES_MANUALES.     ║
# ╚══════════════════════════════════════════════════════════════════════════╝

# ── Etapa 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias (sin devtools innecesarios en la imagen final)
COPY package*.json ./
RUN npm ci --frozen-lockfile

# Copiar fuente (el .dockerignore excluye .env, node_modules, dist, .git)
COPY . .

# Variables públicas inyectadas como ARG en CI/CD (no en .env)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

RUN npm run build

# ── Etapa 2: Producción con nginx (ligero, gzip, headers de cache) ────────────
FROM nginx:alpine

# Copiar solo los estáticos compilados
COPY --from=builder /app/dist/client /usr/share/nginx/html

# Configuración de nginx con SPA fallback + gzip + cache headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
