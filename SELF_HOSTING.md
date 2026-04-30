# Self-Hosting CPI Connect

Deploy CPI Connect on your own infrastructure in minutes. The full stack is just three services — PostgreSQL, the Next.js app (with Better-Auth running in-process), and an optional LiteLLM proxy for AI features. Everything runs in Docker — no external services required.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Recommended)](#quick-start-recommended)
- [Manual Setup](#manual-setup)
- [Configuration Reference](#configuration-reference)
- [LiteLLM — AI Provider Setup](#litellm--ai-provider-setup)
- [Port Reference](#port-reference)
- [Updating](#updating)
- [Backup & Restore](#backup--restore)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement          | Minimum      |
|----------------------|--------------|
| Docker Engine        | 24+          |
| Docker Compose       | v2           |
| RAM                  | 2 GB         |
| Disk                 | 10 GB        |
| OS                   | Linux (recommended), macOS, Windows with WSL2 |
| Open ports           | 3000, 4000, 5432 (configurable)  |

---

## Quick Start (Recommended)

The setup script generates all secrets, writes the `.env` file, and starts the full stack automatically.

```bash
# 1. Clone the repo
git clone https://github.com/raja83v/my-sapbtpipconnect-app.git
cd my-sapbtpipconnect-app

# 2. Run the interactive setup
bash docker/setup.sh
```

The script does the following:
- Checks Docker and openssl are installed
- Generates all secrets (database password, encryption key, Better-Auth secret, LiteLLM key, cron secret)
- Writes a complete `.env` file
- Starts all services via `docker compose up -d --build`

Once complete, open **http://localhost:3000** — you'll be redirected to the sign-in page. The first user to register becomes **admin**.

### What Gets Deployed

| Service              | Image                                    | Port  | Purpose                         |
|----------------------|------------------------------------------|-------|---------------------------------|
| **app**              | Built from `Dockerfile`                  | 3000  | Next.js app + Better-Auth (in-process) |
| **db**               | `postgres:16-alpine`                     | 5432  | PostgreSQL database             |
| **litellm** *(opt.)* | `ghcr.io/berriai/litellm:main-latest`    | 4000  | AI model proxy                  |

> The application's authentication runs inside the Next.js process via [Better-Auth](https://better-auth.com/) — there is no separate auth container.

---

## Manual Setup

If you prefer more control over the process:

### 1. Clone and configure

```bash
git clone https://github.com/raja83v/my-sapbtpipconnect-app.git
cd my-sapbtpipconnect-app
cp .env.example .env
```

### 2. Generate secrets

```bash
# Generate an encryption key (for SAP credentials at rest)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate a Better-Auth signing secret
openssl rand -hex 32

# Generate a database password
openssl rand -hex 24

# Generate a cron secret (optional)
openssl rand -hex 16
```

### 3. Edit `.env`

Fill in the generated values:

```dotenv
POSTGRES_PASSWORD=<generated-password>
ENCRYPTION_KEY=<generated-encryption-key>
BETTER_AUTH_SECRET=<generated-better-auth-secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEPLOYMENT_MODE=self-hosted
```

### 4. Start the stack

```bash
docker compose up -d --build
```

### 5. Verify

```bash
docker compose ps
curl http://localhost:3000/api/health
```

Drizzle migrations run automatically on container startup via `docker/entrypoint.sh`.

---

## Configuration Reference

All variables are set in your `.env` file. See `.env.example` for the complete list.

### Required Variables

| Variable                           | Description                                      |
|------------------------------------|--------------------------------------------------|
| `POSTGRES_PASSWORD`                | PostgreSQL password                              |
| `ENCRYPTION_KEY`                   | AES-256 key (base64) for SAP CPI credential encryption |
| `BETTER_AUTH_SECRET`               | High-entropy signing secret for Better-Auth sessions |
| `NEXT_PUBLIC_APP_URL`              | Public URL of your instance                      |

### Optional Variables

| Variable                           | Default      | Description                              |
|------------------------------------|--------------|------------------------------------------|
| `NEXT_PUBLIC_DEPLOYMENT_MODE`      | `self-hosted` | `self-hosted` or `cloud` (marketing-only) |
| `AI_PROVIDER`                      | `llmlite`    | AI provider (`llmlite` or `google`)      |
| `LITELLM_MASTER_KEY`               | auto-generated | LiteLLM API key                        |
| `OPENAI_API_KEY`                   | —            | OpenAI key (passed to LiteLLM)           |
| `ANTHROPIC_API_KEY`                | —            | Anthropic key (passed to LiteLLM)        |
| `GOOGLE_API_KEY`                   | —            | Google Gemini key (passed to LiteLLM)    |
| `CRON_SECRET`                      | —            | Protects `/api/cron/*` trigger endpoints |
| `SELF_HOSTED_AI_CALLS_LIMIT`       | unlimited    | Max AI calls per month                   |
| `SELF_HOSTED_MAX_TENANTS`          | unlimited    | Max SAP CPI tenants                      |
| `SELF_HOSTED_MAX_IFLOWS`           | unlimited    | Max iFlows                               |
| `SELF_HOSTED_MAX_MEMBERS`          | unlimited    | Max team members                         |
| `APP_PORT`                         | `3000`       | App port                                 |
| `LITELLM_PORT`                     | `4000`       | LiteLLM proxy port                       |
| `DB_PORT`                          | `5432`       | PostgreSQL direct access port            |

> **Local dev (no Docker):** when running `pnpm dev` directly, you can leave `DATABASE_URL` unset — the app auto-spawns an [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres) cluster under `.data/db/` on port `5435`. Inside Docker Compose, `DATABASE_URL` is set automatically and points at the `db` service.

---

## LiteLLM — AI Provider Setup

CPI Connect uses [LiteLLM](https://litellm.ai/) as a unified proxy to 100+ LLM providers. The default config is at `docker/litellm-config.yaml`.

### Using OpenAI

Set your API key in `.env`:

```dotenv
OPENAI_API_KEY=sk-...
```

Edit `docker/litellm-config.yaml`:

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
```

### Using Anthropic Claude

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
```

```yaml
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY
```

### Using Google Gemini

```dotenv
GOOGLE_API_KEY=AIza...
```

```yaml
model_list:
  - model_name: gemini-2.0-flash
    litellm_params:
      model: gemini/gemini-2.0-flash
      api_key: os.environ/GOOGLE_API_KEY
```

### Using Ollama (Local Models)

Run Ollama on the host or in another container, then configure:

```yaml
model_list:
  - model_name: llama3
    litellm_params:
      model: ollama/llama3
      api_base: http://host.docker.internal:11434
```

After editing, restart LiteLLM:

```bash
docker compose restart litellm
```

---

## Port Reference

| Port  | Service           | Configurable via   |
|-------|-------------------|--------------------|
| 3000  | CPI Connect App   | `APP_PORT`         |
| 4000  | LiteLLM Proxy     | `LITELLM_PORT`     |
| 5432  | PostgreSQL        | `DB_PORT`          |

To change ports, update the variable in `.env` and restart:

```bash
docker compose up -d
```

---

## Updating

```bash
# Pull the latest code and rebuild
git pull
docker compose up -d --build
```

Drizzle migrations run automatically on startup.

---

## Backup & Restore

### Backup

```bash
# Database dump
docker compose exec -T db pg_dump -U cpiconnect cpiconnect > backup_$(date +%F).sql

# Backup .env (contains your secrets)
cp .env .env.backup
```

### Restore

```bash
# Stop the app (keep DB running)
docker compose stop app

# Restore database
cat backup_2026-01-15.sql | docker compose exec -T db psql -U cpiconnect cpiconnect

# Restart
docker compose up -d
```

---

## Troubleshooting

### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "deployment_mode": "self-hosted",
  "timestamp": "2026-01-15T10:00:00.000Z"
}
```

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| App returns 503 on startup | Database not ready | Wait for the `db` health check; check `docker compose logs db` |
| `Missing required env: BETTER_AUTH_SECRET` | Secret not set | Generate with `openssl rand -hex 32` and add to `.env`, then restart |
| `Missing required env: ENCRYPTION_KEY` | Encryption key not set | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| LiteLLM returns errors | No API key configured | Set at least one provider key in `.env` and restart `litellm` |
| Port already in use | Another service on that port | Change the port in `.env` (e.g., `APP_PORT=3001`) and `docker compose up -d` |
| Migrations fail on start | Database schema conflict | Check `docker compose logs app` for details; fix or drop the conflicting tables |
| Cannot sign in after restore | `BETTER_AUTH_SECRET` was rotated | Existing session cookies are now invalid — clear cookies and sign in again |

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f db
docker compose logs -f litellm
```

### Reset Everything

> **Warning:** This deletes all data.

```bash
docker compose down -v
# Re-run setup
bash docker/setup.sh
```
