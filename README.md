# WG Router

Web app for managing WireGuard peers on MikroTik RouterOS 7.x via REST API.

## Features

- Email/password login and registration (Cloudflare Turnstile)
- Google OAuth2 SSO
- User dashboard: generate, download, QR code, delete configs (default limit: 3)
- Admin panel: manage users and all configs
- Configurable MikroTik host, WireGuard server public key, and client IP pool
- SQLite by default, or PostgreSQL when `DATABASE_URL` is set

## Requirements

- Linux host on the same network as MikroTik
- Node.js 20+ (or Docker)
- MikroTik RouterOS 7.1+ with REST enabled
- PostgreSQL 14+ (optional — SQLite is used when `DATABASE_URL` is unset)
- Google OAuth client (Web application, optional if using email login only)
- Cloudflare Turnstile site key + secret

## Quick start (Linux)

### 1. Database (optional)

**SQLite (default)** — no setup. The app uses `./data/wg-router.db` when `DATABASE_URL` is not set.

**PostgreSQL** (recommended for multi-user production):

```bash
sudo -u postgres createuser wgrouter --pwprompt
sudo -u postgres createdb wgrouter --owner=wgrouter
```

Set in `.env`:

```env
DATABASE_URL=postgresql://wgrouter:YOUR_PASSWORD@localhost:5432/wgrouter
```

### 2. MikroTik REST user

Create a dedicated API user on the router with permissions for WireGuard peers only (recommended), or a limited group.

After starting the app, open **Admin → MikroTik connection** to enter the router host, credentials, WireGuard interface name, and server settings. Use **Fetch from router** to load the public key, listen port, tunnel address, and client IP pool from RouterOS, then **Save settings**.

### 3. Authentication

**Cloudflare Turnstile** (required for email login/register):

1. Open [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a widget for your domain
3. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `.env` (runtime — no Docker rebuild needed)

**Google OAuth** (optional):

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth client ID** → **Web application**
3. Authorized redirect URI:
   - Dev: `http://localhost:3000/api/auth/callback/google`
   - Prod: `https://your-domain.example/api/auth/callback/google`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

Users can **register** at `/register` or **sign in** at `/login` with email/password (Turnstile required) or Google.

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Important variables:

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAILS` | Comma-separated emails with admin role |
| `AUTH_SECRET` | Session signing secret |
| `ENCRYPTION_KEY` | Encrypts stored WireGuard private keys |
| `DATABASE_URL` | Optional. `postgresql://…` or `file:./data/wg-router.db` (default) |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (read at runtime) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret |

WireGuard server settings (public key, endpoint, tunnel address, client IP pool) are configured in **Admin → MikroTik connection**. Optional `WG_*` env vars can bootstrap the first run on existing deployments.

Example client IP pool (set in admin UI):

```
# IPv4 only
10.8.0.0/24

# Dual-stack (each client gets one IPv4 + one IPv6)
10.8.0.0/24,fd00:8::/64

# Server address for client DNS (from /ip/address on the WG interface)
10.8.0.1/32,fd00:8::1/128
```

MikroTik REST connection (host, credentials, WireGuard interface) is also on that admin page.

Generate secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
```

### 5. Install and run

```bash
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

## Production on Linux (systemd)

```bash
chmod +x deploy/install.sh
./deploy/install.sh
```

`install.sh` builds the app, syncs it to `/opt/wg-router` (override with `APP_DIR=...`),
creates the `wgrouter` system user, installs `/etc/systemd/system/wg-router.service`,
and reloads systemd. On first install, enable the service:

```bash
sudo systemctl enable --now wg-router
sudo systemctl status wg-router
```

Subsequent `./deploy/install.sh` runs restart the service if it is already enabled.

Override paths if needed:

```bash
APP_DIR=/opt/wgrouter NODE_BIN=/usr/local/bin/node ./deploy/install.sh
```

The app binds to **127.0.0.1:3000** by default (`HOSTNAME` / `BIND_HOST` in `.env` or
`install.sh`). nginx proxies public HTTPS to that address — do not expose port 3000 on
`0.0.0.0` in production unless you have no reverse proxy.

Put nginx/Caddy in front for HTTPS.

**Important:** set `AUTH_URL` to your public **https** URL in `.env`, e.g.:

```env
AUTH_URL=https://wg.example.com
AUTH_TRUST_HOST=true
```

Do not leave `AUTH_URL=http://localhost:3000` in production — Auth.js uses it for the OAuth
`redirect_uri`, and `http` values override nginx `X-Forwarded-Proto`.

Example nginx config: [`deploy/nginx.conf`](deploy/nginx.conf)

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/wg-router
sudo ln -s /etc/nginx/sites-available/wg-router /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Docker

### Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env — DATABASE_URL is overridden by compose to use the postgres service

docker compose up -d --build
```

Open http://localhost:3000 (or `${APP_PORT}` if set).

Migrations run automatically via the `migrate` service on startup.

```bash
docker compose logs -f app
docker compose down          # stop
docker compose down -v       # stop and delete database volume
```

If the app container cannot reach MikroTik on your LAN, uncomment `network_mode: host` on the `app` service in `docker-compose.yml` and remove the `ports` mapping.

### Docker only

SQLite (default — good for containers / sidecar on CHR host):

```bash
docker build -t wg-router .
docker run -d \
  --name wg-router \
  --env-file .env \
  -v wg-router-data:/app/data \
  -p 3000:3000 \
  wg-router
```

Required in `.env` for Docker: `AUTH_SECRET`, `ENCRYPTION_KEY`, `ADMIN_EMAILS`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `AUTH_URL`. Do **not** set `HOSTNAME=127.0.0.1` — the entrypoint binds `0.0.0.0` inside the container.

The entrypoint runs `prisma generate` and applies the schema using `DATABASE_URL` from the container env (defaults to SQLite at `/app/data/wg-router.db`). Turnstile keys are read at **runtime** — no build args.

PostgreSQL (external or on host):

```bash
docker build -t wg-router .
docker run -d \
  --name wg-router \
  --env-file .env \
  -e DATABASE_URL=postgresql://user:pass@host:5432/wgrouter \
  -p 3000:3000 \
  wg-router
```

## Roles

- **User**: sign in with Google, manage own configs (max 3)
- **Admin**: listed in `ADMIN_EMAILS` or promoted in admin UI; can enable/disable users and delete any config

## Client config output

Each generated config includes:

- Client private key (shown once at creation; stored encrypted in DB)
- Assigned client address(es) from the configured client IP pool (IPv4 `/32`, IPv6 `/128`, or both)
- Server public key and endpoint from MikroTik WireGuard settings in the admin UI

## Security notes

- Keep MikroTik API credentials in the database (encrypted); configure them via the admin UI
- Use HTTPS in production (`AUTH_URL` must match public URL)
- Restrict Google OAuth to your organization if possible
- Use a dedicated MikroTik API account with minimal privileges
- Back up PostgreSQL regularly

## License

Private / internal use.
