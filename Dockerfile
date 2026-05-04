# Etapa 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar el package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Construir la aplicación para producción (Vite crea la carpeta 'dist')
RUN npm run build

# Etapa 2: Producción
FROM nginx:alpine

# Copiar los archivos compilados desde la etapa anterior hacia el directorio público de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Opcional: Si usamos React Router (TanStack Router) en modo history,
# necesitamos redirigir el tráfico a index.html. Un nginx.conf personalizado
# o un comando para reescribir la ruta sería ideal, pero lo más simple es
# exponer el puerto y dejar que Nginx sirva los estáticos por defecto.
# Nota: Si el enrutamiento falla al recargar en rutas como /sobre-nosotros,
# deberías inyectar un nginx.conf personalizado.

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
