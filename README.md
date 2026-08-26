# WG Router

Web app for managing WireGuard peers on MikroTik RouterOS 7.x via REST API.

## Features

- Email/password login and registration (Cloudflare Turnstile)
- Google OAuth2 SSO
- User dashboard: generate, download, QR code, delete configs (default limit: 3)
- Admin panel: manage users and all configs
- Configurable MikroTik host, WireGuard server public key, and client IP pool
- Local PostgreSQL on Linux

## Requirements

- Linux host on the same network as MikroTik
- Node.js 20+ (or Docker)
- PostgreSQL 14+
- MikroTik RouterOS 7.1+ with REST enabled
- Google OAuth client (Web application, optional if using email login only)
- Cloudflare Turnstile site key + secret

## Quick start (Linux)

### 1. PostgreSQL

```bash
sudo -u postgres createuser wgrouter --pwprompt
sudo -u postgres createdb wgrouter --owner=wgrouter
```

### 2. MikroTik REST user

Create a dedicated API user on the router with permissions for WireGuard peers only (recommended), or a limited group.

After starting the app, open **Admin → MikroTik connection** to enter the router host, credentials, and WireGuard interface name, then click **Test connection**.

### 3. Authentication

**Cloudflare Turnstile** (required for email login/register):

1. Open [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a widget for your domain
3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `.env`

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
| `WG_SERVER_PUBLIC_KEY` | Server public key in client configs |
| `WG_SERVER_ENDPOINT` | Public endpoint `host:51820` for clients |
| `WG_SERVER_ADDRESS` | Tunnel gateway IP(s), IPv4 and/or IPv6 (e.g. `10.8.0.1/32,fd00:8::1/128`) |
| `WG_CLIENT_IP_POOL` | IPv4/IPv6 CIDR and/or comma-separated client addresses |
| `ADMIN_EMAILS` | Comma-separated Google emails with admin role |

MikroTik REST connection (host, credentials, WireGuard interface) is configured in the **Admin** page after login.

Example IP pool:

```env
# IPv4 only
WG_CLIENT_IP_POOL=10.8.0.0/24

# Dual-stack (each client gets one IPv4 + one IPv6)
WG_CLIENT_IP_POOL=10.8.0.0/24,fd00:8::/64
WG_SERVER_ADDRESS=10.8.0.1/32,fd00:8::1/128

# Explicit addresses
# WG_CLIENT_IP_POOL=10.8.0.2,fd00:8::2,fd00:8::3
```

Generate secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
```

### 5. Install and run

```bash
npm ci
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`.

## Production on Linux (systemd)

```bash
chmod +x deploy/install.sh
./deploy/install.sh

sudo cp deploy/wg-router.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wg-router
```

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

```bash
docker build -t wg-router .
docker run --env-file .env -p 3000:3000 wg-router
```

Ensure the container can reach your MikroTik router on the LAN (host networking or macvlan as needed). Configure MikroTik connection details in the admin UI.

## Roles

- **User**: sign in with Google, manage own configs (max 3)
- **Admin**: listed in `ADMIN_EMAILS` or promoted in admin UI; can enable/disable users and delete any config

## Client config output

Each generated config includes:

- Client private key (shown once at creation; stored encrypted in DB)
- Assigned client address(es) from `WG_CLIENT_IP_POOL` (IPv4 `/32`, IPv6 `/128`, or both)
- Server public key from `WG_SERVER_PUBLIC_KEY`
- Endpoint from `WG_SERVER_ENDPOINT`

## Security notes

- Keep MikroTik API credentials in the database (encrypted); configure them via the admin UI
- Use HTTPS in production (`AUTH_URL` must match public URL)
- Restrict Google OAuth to your organization if possible
- Use a dedicated MikroTik API account with minimal privileges
- Back up PostgreSQL regularly

## License

Private / internal use.
