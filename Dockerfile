# Etapa 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar el package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Construir la aplicación para producción (Vite crea la carpeta 'dist')
RUN npm run build

# Etapa 2: Producción (Node.js para SSR)
FROM node:22-alpine

WORKDIR /app

# Copiamos los archivos necesarios desde el builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Variables de entorno para que Vite Preview se exponga al exterior en el puerto 80
ENV HOST=0.0.0.0
ENV PORT=80

EXPOSE 80

# Usamos preview para levantar el servidor SSR en producción
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "80"]
