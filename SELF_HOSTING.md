# Self-Hosting CPI Connect

Deploy CPI Connect on your own infrastructure in minutes. Everything runs in Docker — no external services required.

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
| RAM                  | 4 GB         |
| Disk                 | 20 GB        |
| OS                   | Linux (recommended), macOS, Windows with WSL2 |
| Open ports           | 3000, 8000, 4000 (configurable)  |

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
- Checks Docker, openssl, and node are installed
- Generates all secrets (database password, encryption key, JWT secret, Supabase keys, LiteLLM key)
- Writes a complete `.env` file
- Starts all services via `docker compose -f docker-compose.selfhost.yml up -d`

Once complete, open **http://localhost:3000** — you'll be redirected to the sign-in page. The first user to register becomes **admin**.

### What Gets Deployed

| Service              | Image                                    | Port  | Purpose                         |
|----------------------|------------------------------------------|-------|---------------------------------|
| **app**              | `raja83v/cpiconnect:latest`              | 3000  | CPI Connect application         |
| **supabase-kong**    | `kong:3.7`                               | 8000  | Supabase API gateway            |
| **litellm**          | `ghcr.io/berriai/litellm:main-latest`    | 4000  | AI model proxy                  |
| **supabase-studio**  | `supabase/studio:20240422-5cf8f30`       | 3100  | Database admin UI               |
| **supabase-db**      | `supabase/postgres:15.8.1.060`           | 5433  | PostgreSQL database             |
| **supabase-auth**    | `supabase/gotrue:v2.158.1`               | —     | Authentication (internal)       |
| **supabase-rest**    | `postgrest/postgrest:v12.2.3`            | —     | REST API (internal)             |
| **supabase-meta**    | `supabase/postgres-meta:v0.83.2`         | —     | Metadata API (internal)         |

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
# Generate Supabase JWT secret and keys
bash docker/generate-supabase-keys.sh

# Generate an encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate a database password
openssl rand -hex 24
```

### 3. Edit `.env`

Fill in the generated values:

```dotenv
POSTGRES_PASSWORD=<generated-password>
SUPABASE_JWT_SECRET=<from-generate-supabase-keys.sh>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-generate-supabase-keys.sh>
SUPABASE_SERVICE_ROLE_KEY=<from-generate-supabase-keys.sh>
ENCRYPTION_KEY=<generated-encryption-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Start the stack

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

### 5. Verify

```bash
docker compose -f docker-compose.selfhost.yml ps
curl http://localhost:3000/api/health
```

---

## Configuration Reference

All variables are set in your `.env` file. See `.env.example` for the complete list.

### Required Variables

| Variable                           | Description                                      |
|------------------------------------|--------------------------------------------------|
| `POSTGRES_PASSWORD`                | PostgreSQL password                              |
| `SUPABASE_JWT_SECRET`              | JWT secret for Supabase auth                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Supabase anonymous key (derived from JWT secret) |
| `SUPABASE_SERVICE_ROLE_KEY`        | Supabase service role key (derived from JWT secret) |
| `ENCRYPTION_KEY`                   | AES-256 key for SAP CPI credential encryption   |
| `NEXT_PUBLIC_APP_URL`              | Public URL of your instance                      |

### Optional Variables

| Variable                           | Default      | Description                              |
|------------------------------------|-------------|------------------------------------------|
| `AI_PROVIDER`                      | `llmlite`   | AI provider (`llmlite` or `google`)      |
| `LITELLM_MASTER_KEY`              | auto-generated | LiteLLM API key                        |
| `OPENAI_API_KEY`                   | —            | OpenAI key (passed to LiteLLM)          |
| `ANTHROPIC_API_KEY`                | —            | Anthropic key (passed to LiteLLM)       |
| `GOOGLE_API_KEY`                   | —            | Google Gemini key (passed to LiteLLM)   |
| `SELF_HOSTED_AI_CALLS_LIMIT`       | unlimited    | Max AI calls per month                  |
| `SELF_HOSTED_MAX_TENANTS`          | unlimited    | Max SAP CPI tenants                     |
| `SELF_HOSTED_MAX_IFLOWS`           | unlimited    | Max iFlows                              |
| `SELF_HOSTED_MAX_MEMBERS`          | unlimited    | Max team members                        |
| `APP_PORT`                         | `3000`       | App port                                |
| `SUPABASE_PORT`                    | `8000`       | Supabase API gateway port               |
| `LITELLM_PORT`                     | `4000`       | LiteLLM proxy port                      |
| `STUDIO_PORT`                      | `3100`       | Supabase Studio port                    |
| `DB_PORT`                          | `5433`       | PostgreSQL direct access port           |

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
docker compose -f docker-compose.selfhost.yml restart litellm
```

---

## Port Reference

| Port  | Service           | Configurable via   |
|-------|-------------------|--------------------|
| 3000  | CPI Connect App   | `APP_PORT`         |
| 8000  | Supabase API      | `SUPABASE_PORT`    |
| 4000  | LiteLLM Proxy     | `LITELLM_PORT`     |
| 3100  | Supabase Studio   | `STUDIO_PORT`      |
| 5433  | PostgreSQL        | `DB_PORT`          |

To change ports, update the variable in `.env` and restart:

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

---

## Updating

```bash
# Pull the latest images
docker compose -f docker-compose.selfhost.yml pull

# Restart (database migrations run automatically on startup)
docker compose -f docker-compose.selfhost.yml up -d
```

---

## Backup & Restore

### Backup

```bash
# Database dump
docker exec -t $(docker compose -f docker-compose.selfhost.yml ps -q supabase-db) \
  pg_dumpall -c -U postgres > backup_$(date +%F).sql

# Backup .env (contains your secrets)
cp .env .env.backup
```

### Restore

```bash
# Stop the app (keep DB running)
docker compose -f docker-compose.selfhost.yml stop app

# Restore database
cat backup_2025-01-15.sql | docker exec -i \
  $(docker compose -f docker-compose.selfhost.yml ps -q supabase-db) \
  psql -U postgres

# Restart
docker compose -f docker-compose.selfhost.yml up -d
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
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| App returns 503 | Database not ready | Wait for health checks; check `docker compose logs supabase-db` |
| `invalid JWT` errors | Supabase keys don't match JWT secret | Regenerate keys: `bash docker/generate-supabase-keys.sh` and update `.env` |
| LiteLLM returns errors | No API key configured | Set at least one provider key in `.env` and restart |
| Port already in use | Another service on that port | Change the port in `.env` (e.g., `APP_PORT=3001`) |
| Login fails | GoTrue not ready | Check `docker compose logs supabase-auth` |
| Migrations fail on start | Database schema conflict | Check `docker compose logs app` for details |

### View Logs

```bash
# All services
docker compose -f docker-compose.selfhost.yml logs -f

# Specific service
docker compose -f docker-compose.selfhost.yml logs -f app
docker compose -f docker-compose.selfhost.yml logs -f supabase-auth
docker compose -f docker-compose.selfhost.yml logs -f litellm
```

### Reset Everything

> **Warning:** This deletes all data.

```bash
docker compose -f docker-compose.selfhost.yml down -v
# Re-run setup
bash docker/setup.sh
```
