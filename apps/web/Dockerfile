# ── Build stage ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ARG APP_REVISION=dev

COPY package.json ./
COPY apps/web/package.json ./apps/web/
RUN npm install --workspace=apps/web

COPY apps/web/ ./apps/web/
RUN cd apps/web && VITE_API_URL=$VITE_API_URL npm run build

# ── Serve stage ────────────────────────────────
FROM nginx:alpine

ARG APP_REVISION=dev

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
RUN printf '{"revision":"%s"}\n' "$APP_REVISION" > /usr/share/nginx/html/version.json

# SPA fallback with a revalidated entry point and immutable hashed assets.
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location = /index.html { \
    add_header Cache-Control "no-cache, no-store, must-revalidate" always; \
    } \
    location = /version.json { \
    add_header Cache-Control "no-cache, no-store, must-revalidate" always; \
    } \
    location /assets/ { \
    add_header Cache-Control "public, max-age=31536000, immutable" always; \
    try_files $uri =404; \
    } \
    location /api { \
    proxy_pass http://api:3001; \
    proxy_set_header Host $host; \
    proxy_set_header X-Real-IP $remote_addr; \
    } \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
