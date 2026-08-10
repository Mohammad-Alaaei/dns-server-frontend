```markdown
# DNS Admin UI

Frontend admin panel for the custom DNS server  
(repository: [dns-server-frontend](https://github.com/Mohammad-Alaaei/dns-server-frontend)).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn-style components
- react-i18next (default English, RTL-ready)
- React Router, Axios (JWT + refresh)
- Auth + Theme contexts
- RSA-OAEP password encryption on login (matches backend)

## Features

- Completely separate from the backend (`node-dns-server`)
- Login with RSA-OAEP encrypted password
- JWT access + refresh token handling with automatic refresh
- Role-aware sidebar (superadmin / admin / viewer)
- Responsive layout (sidebar becomes drawer on mobile)
- Dark / light / system theme
- i18n foundation (English default, direction flips for RTL languages)
- DNS Records, Servers, Memory, Logs, Statistics, Settings pages

---

## Local development setup

```bash
npm install --legacy-peer-deps
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000` (backend API).

Optional: create a `.env` file:

```env
VITE_API_BASE_URL=http://your-api-host:3000
```

Leave it empty (or omit the variable) to use the built-in proxy.

---

## Docker setup

This repository ships a production-ready Docker image that serves the built SPA with nginx.

### Files

```
docker/
  Dockerfile          # multi-stage: node build → nginx:alpine
  nginx.conf          # SPA + /api proxy to backend service
docker-compose.yml    # frontend only
.dockerignore
```

### Quick start (standalone)

```bash
# from the root of this repository
docker compose up -d --build
```

**Published ports**

| Port | Service  |
| ---- | -------- |
| 80   | Admin UI |

#### Important when running standalone

The frontend talks to the backend API. If the backend is on another host, rebuild with the correct base URL:

```bash
VITE_API_BASE_URL=http://192.168.1.50:3000 docker compose up -d --build
```

> phpMyAdmin lives with the **backend** stack (port 8080), not here.

### nginx behaviour

- Serves the static SPA from `/usr/share/nginx/html`
- Proxies `/api/*` → `http://backend:3000` (useful in the full-stack compose where both containers share a network)
- SPA fallback (`try_files … /index.html`)
- Basic security & caching headers

---

## Project structure

```
src/
  api/          # Axios client + token helpers
  components/   # UI + feature components
  contexts/     # AuthContext, ThemeContext
  i18n/         # i18next config + locales
  layouts/      # AppLayout (topbar + sidebar)
  lib/          # utils, crypto (RSA-OAEP)
  pages/        # Login, Dashboard, Records, …
```

## Notes

- Translations live in the frontend only. Backend user settings store the last selected language.
- `VITE_*` variables are baked in at **build time**. Changing the API URL later requires a rebuild.
```