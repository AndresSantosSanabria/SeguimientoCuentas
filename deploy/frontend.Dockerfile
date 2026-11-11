# syntax=docker/dockerfile:1.7

# ============================================
# Frontend: React + Vite compilado, servido por Nginx
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ============================================
# Runtime
# ============================================
FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx-main.conf /etc/nginx/nginx.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Config de Keycloak en runtime: el entrypoint oficial de nginx ejecuta este
# script al arrancar y escribe /config.js con las variables del contenedor.
COPY deploy/app-entrypoint.sh /docker-entrypoint.d/40-keycloak-config.sh
RUN chmod +x /docker-entrypoint.d/40-keycloak-config.sh

# Proxy /oidc/token: copia por defecto (se sobreescribe en runtime).
COPY deploy/oidc-proxy.default.conf /etc/nginx/oidc-proxy.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
