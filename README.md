# DNS Admin UI

Frontend admin panel for the custom DNS server.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn-style components
- react-i18next (default English, RTL-ready)
- React Router, Axios (JWT + refresh)
- Simple Context API (Auth + Theme)

## Features (current scaffold)

- Completely separate from the backend (`node-dns-server`)
- Login with RSA-OAEP encrypted password (matches backend)
- JWT access + refresh token handling with automatic refresh
- Role-aware sidebar (superadmin / admin / viewer)
- Responsive layout (sidebar becomes drawer on mobile)
- Dark / light / system theme
- i18n foundation (English default, direction flips for RTL languages)
- List page pattern demonstrated on DNS Records (search/sort/filter UI placeholders, pagination placeholders, three-dot ready)
- Settings page for theme + language

## Setup

```bash
cd dns-admin-ui
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000` (backend API).

Optional: create `.env` with `VITE_API_BASE_URL=http://your-api-host:3000` if not using the proxy.

## Project structure

```
src/
  api/          # Axios client + token helpers
  components/ui # Button, Input, Card, ...
  contexts/     # AuthContext, ThemeContext
  i18n/         # i18next config + locales
  layouts/      # AppLayout (topbar + sidebar)
  lib/          # utils, crypto (RSA-OAEP)
  pages/        # Login, Dashboard, Records, ...
```
