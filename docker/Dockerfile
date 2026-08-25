# ---------- build stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# VITE_API_BASE_URL is baked at build time.
# Empty = same-origin (nginx will proxy /api in full-stack mode)
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---------- production stage ----------
FROM nginx:1.27-alpine

RUN apk add --no-cache openssl \
    && rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /etc/nginx/certs

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Static fallback config (entrypoint replaces at runtime)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

ENV HTTPS_ENABLED=true \
    SSL_MODE=selfsigned \
    SSL_CERT_HOSTS=localhost,127.0.0.1

EXPOSE 80 443

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD []
