# DNS Admin UI

Frontend admin panel for the custom DNS server  
(repository: [dns-server-frontend](https://github.com/Mohammad-Alaaei/dns-server-frontend)).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn-style components
- react-i18next (default English, RTL-ready)
- React Router, Axios (JWT + refresh)
- Auth + Theme contexts
- **RSA-OAEP password encryption** via `node-forge` (works on HTTP and HTTPS; does not depend on browser secure-context / `crypto.subtle`)

## Features

- Completely separate from the backend (`node-dns-server`)
- Login / change-password / create-user with RSA-OAEP encrypted passwords (always encrypted, independent of TLS)
- JWT access + refresh token handling with automatic refresh
- Role-aware sidebar (superadmin / admin / viewer)
- Responsive layout (sidebar becomes drawer on mobile)
- Dark / light / system theme
- i18n foundation (English default, direction flips for RTL languages)
- DNS Records, Servers, Memory, Logs, Statistics, Settings pages

---

## Local development setup

```bash
npm install
npm run dev
```

Vite listens on **http://localhost:8000** and proxies `/api` to `http://localhost:3000` (backend API).

Optional: create a `.env` file:

```env
VITE_API_BASE_URL=http://your-api-host:3000
```

Leave it empty (or omit the variable) to use the built-in proxy.

Passwords are always encrypted in the browser with the backend public key (RSA-OAEP + SHA-256, base64), including on plain HTTP during local dev.

---

## Docker setup (frontend-only)

This repository ships a production-ready image: multi-stage Node build → **nginx** with optional TLS.

### Files

```
docker/
  Dockerfile          # multi-stage: node build → nginx:alpine + openssl
  entrypoint.sh       # TLS mode selection, cert bootstrap, nginx config
  nginx.conf          # static HTTP fallback (replaced at runtime by entrypoint)
docker-compose.yml    # frontend only
certs/                # mounted at /etc/nginx/certs (self-signed or custom)
```

### Quick start

```bash
# from the root of this repository
docker compose up -d --build
```

Defaults: **HTTPS on**, **self-signed** certificates, HTTP → HTTPS redirect.

**Published ports**

| Port | Service                                       |
| ---- | --------------------------------------------- |
| 80   | HTTP (redirects to HTTPS when TLS is enabled) |
| 443  | HTTPS Admin UI                                |

Open **https://localhost** (browser will warn on self-signed certs — expected).

#### Backend API URL (standalone)

If the backend is on another host, rebuild with the correct base URL:

```bash
VITE_API_BASE_URL=http://192.168.1.50:3000 docker compose up -d --build
```

> phpMyAdmin lives with the **full-stack** compose (port 8080), not here.

### TLS / HTTPS configuration

TLS is handled entirely by **nginx** at container start (`docker/entrypoint.sh`). The SPA does **not** need rebuild when you change TLS mode.

| Variable         | Default               | Description                                                                          |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `HTTPS_ENABLED`  | `true`                | Master switch. When `false`, forces HTTP-only (`SSL_MODE` ignored / treated as off). |
| `SSL_MODE`       | `selfsigned`          | `selfsigned` \| `custom` \| `off`                                                    |
| `SSL_CERT_HOSTS` | `localhost,127.0.0.1` | Comma-separated DNS names / IPs used as SANs when generating a self-signed cert      |
| `SSL_CERTS_DIR`  | `./certs`             | Host directory mounted at `/etc/nginx/certs`                                         |

#### Mode behaviour

| `HTTPS_ENABLED` | `SSL_MODE`   | Result                                                                                        |
| --------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `true`          | `selfsigned` | Listen **443** with auto-generated (or existing) self-signed cert; **80 → 301 HTTPS**         |
| `true`          | `custom`     | Listen **443** with `fullchain.pem` + `privkey.pem` from the certs volume; **80 → 301 HTTPS** |
| `true`          | `off`        | HTTP only on **80** (no redirect)                                                             |
| `false`         | _(any)_      | HTTP only on **80** (no redirect)                                                             |

#### Examples

```bash
# Default: HTTPS + self-signed
docker compose up -d --build

# Self-signed for a LAN hostname / IP
SSL_CERT_HOSTS=dns-admin.local,192.168.1.10 docker compose up -d --build

# Custom certificates (place files in ./certs first)
#   ./certs/fullchain.pem
#   ./certs/privkey.pem
SSL_MODE=custom docker compose up -d --build

# Disable TLS entirely
HTTPS_ENABLED=false docker compose up -d --build
# or
SSL_MODE=off docker compose up -d --build
```

#### Certificates directory

- Mount: `${SSL_CERTS_DIR:-./certs}` → `/etc/nginx/certs`
- **selfsigned**: if `fullchain.pem` / `privkey.pem` are missing, the entrypoint generates them (and keeps them on the volume across restarts)
- **custom**: both files **must** already exist or the container exits with an error

#### nginx behaviour

- Serves the SPA from `/usr/share/nginx/html`
- Proxies `/api/*` → `http://backend:3000` (works when a `backend` service shares the network; full-stack compose does this)
- SPA fallback (`try_files … /index.html`)
- Basic security and static caching headers
- When HTTPS is on: `X-Forwarded-Proto https` on API proxy requests

### Password encryption vs TLS

These are **separate**:

| Concern                                                 | Mechanism                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Transport (browser ↔ nginx)                             | TLS via `HTTPS_ENABLED` / `SSL_MODE`                                                 |
| Password field on login / user create / change password | Always RSA-OAEP (`node-forge`), using the backend public key — **not** tied to HTTPS |

Turning TLS off does **not** send passwords in plaintext from the UI.

---

## Project structure

```
src/
  api/          # Axios client + token helpers
  components/   # UI + feature components
  contexts/     # AuthContext, ThemeContext
  i18n/         # i18next config + locales
  layouts/      # AppLayout (topbar + sidebar)
  lib/          # utils, crypto (RSA-OAEP via node-forge)
  pages/        # Login, Dashboard, Records, …
docker/
  Dockerfile
  entrypoint.sh # TLS bootstrap
  nginx.conf
```

## Notes

- Translations live in the frontend only. Backend user settings store the last selected language.
- `VITE_*` variables are baked in at **build time**. Changing the API URL later requires a rebuild.
- TLS env vars are **runtime** (container environment); no frontend rebuild needed to switch HTTPS on/off.
