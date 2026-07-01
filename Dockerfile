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
