<a href="https://github.com/raja83v/my-sapbtpipconnect-app">
  <h1 align="center">CPI Connect</h1>
</a>

<p align="center">
  Free, open-source, self-hosted monitoring &amp; analytics platform for SAP Cloud Platform Integration.
</p>

<p align="center">
  <a href="https://github.com/raja83v/my-sapbtpipconnect-app/stargazers"><img src="https://img.shields.io/github/stars/raja83v/my-sapbtpipconnect-app?style=social" alt="Stars" /></a>&nbsp;
  <a href="https://github.com/raja83v/my-sapbtpipconnect-app/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" /></a>&nbsp;
  <a href="https://github.com/raja83v/my-sapbtpipconnect-app/issues"><img src="https://img.shields.io/github/issues/raja83v/my-sapbtpipconnect-app" alt="Issues" /></a>
</p>

<p align="center">
  <img width="1200" alt="CPI Connect dashboard" src="public/hero.png" />
</p>

<p align="center">
  <a href="#why-cpi-connect"><strong>Why CPI Connect?</strong></a> ·
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#self-hosting-guide"><strong>Self-Hosting</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a>
</p>
<br/>

## Why CPI Connect?

CPI Connect gives you **full visibility** into your SAP CPI landscape — iFlows, executions, payloads, and performance — without vendor lock-in. Deploy it on your own infrastructure in minutes.

- **100% Open Source** — AGPL-3.0 licensed. Audit every line.
- **Self-Hosted** — Your data never leaves your network.
- **Free Forever** — No usage tiers, no artificial limits.
- **AI-Powered** — 10 specialized agents for iFlow creation, error diagnosis, performance tuning, and more.
- **MCP Server** — Model Context Protocol integration lets AI assistants interact with SAP CPI in real-time.

---

## Quick Start

> **Prerequisites:** [Node.js 20+](https://nodejs.org/), [pnpm](https://pnpm.io/), [Docker](https://www.docker.com/products/docker-desktop/)

### 1. Clone &amp; Install

```bash
git clone https://github.com/raja83v/my-sapbtpipconnect-app.git
cd my-sapbtpipconnect-app
pnpm install
```

### 2. Start Supabase (local Docker)

CPI Connect uses [Supabase](https://supabase.com/) for authentication. The easiest way to run it locally is with the Supabase CLI:

```bash
# Install Supabase CLI (if you haven't already)
npx supabase init     # only needed once — creates supabase/ config folder
npx supabase start    # starts all Supabase Docker containers
```

This spins up the following containers on your machine:

| Container | Port | Purpose |
|-----------|------|---------|
| **Kong** (API Gateway) | `54321` | Main API entry-point (`NEXT_PUBLIC_SUPABASE_URL`) |
| **GoTrue** (Auth) | `9999` (internal) | Email/password sign-up, JWT session management |
| **PostgreSQL 17** | `54322` | Primary database (shared by Supabase Auth + your app) |
| **PostgREST** | internal | Auto-generated REST API from Postgres schema |
| **Supabase Studio** | `54323` | Browser-based admin UI (tables, auth users, SQL editor) |
| **Realtime** | internal | WebSocket-based change subscriptions |
| **Storage API** | internal | File/object storage (S3-compatible) |
| **Edge Runtime** | internal | Deno-based serverless functions |
| **Inbucket / Mailpit** | `54324` | Local email inbox — captures all emails sent during dev |
| **pg_meta** | internal | Postgres metadata API for Studio |
| **Logflare / Vector** | internal | Log aggregation and analytics |

After `supabase start` completes, it prints your local keys:

```
API URL:   http://127.0.0.1:54321
anon key:  eyJhbGci...
service_role key: eyJhbGci...
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Fill in the keys from the previous step:

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>

# Database — points at the same Postgres Supabase spun up
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Encryption key for SAP CPI credentials (generate one with):
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=<your-base64-key>

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See [.env.example](.env.example) for the full list of optional variables (AI provider, cron secret, etc.).

### 4. Run Database Migrations

```bash
npx prisma migrate deploy
```

### 5. Start the Dev Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The first user to register automatically becomes **admin**.

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Push Prisma schema to database |
| `pnpm db:studio` | Open Prisma Studio |
| `npx prisma migrate deploy` | Apply migrations |

---

## Self-Hosting Guide

CPI Connect can be deployed on any machine that runs Docker. Below are step-by-step instructions for a **production-grade self-hosted** setup.

### Prerequisites

| Requirement | Minimum |
|-------------|---------|
| Docker Engine | 24+ |
| Docker Compose | v2 |
| RAM | 4 GB |
| Disk | 20 GB |
| OS | Linux (recommended), macOS, Windows with WSL2 |

### Option A — Docker Compose (Recommended)

This is the simplest path. It runs CPI Connect + PostgreSQL together.

#### Step 1: Prepare the environment file

```bash
mkdir cpiconnect && cd cpiconnect

cat > .env <<'EOF'
# Database
POSTGRES_PASSWORD=change_me_to_a_strong_password
DB_PORT=5432
APP_PORT=3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Encryption (generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_KEY=<your-encryption-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI (optional)
AI_PROVIDER=google
GOOGLE_API_KEY=
EOF
```

#### Step 2: Download docker-compose.yml

```bash
curl -O https://raw.githubusercontent.com/raja83v/my-sapbtpipconnect-app/main/docker-compose.yml
```

#### Step 3: Start the stack

```bash
docker compose up -d
```

This creates two containers:

| Container | Image | Port | Description |
|-----------|-------|------|-------------|
| `cpiconnect-db` | `postgres:16-alpine` | `5432` | PostgreSQL database with health checks |
| `cpiconnect-app` | Built from `Dockerfile` | `3000` | Next.js app (auto-runs Prisma migrations on start) |

Data is persisted in a Docker volume (`postgres_data`).

#### Step 4: Verify

```bash
docker compose ps          # both containers should be "Up"
docker compose logs app    # check for "Ready on http://0.0.0.0:3000"
```

Open `http://<your-server-ip>:3000` and register your admin account.

#### Updating

```bash
docker compose pull        # pull latest images
docker compose up -d       # restart with new version (runs migrations automatically)
```

### Option B — Manual Setup (Without Docker)

If you prefer running directly on the host:

```bash
# 1. Install Node.js 20+ and pnpm
corepack enable && corepack prepare pnpm@latest --activate

# 2. Clone and install
git clone https://github.com/raja83v/my-sapbtpipconnect-app.git
cd my-sapbtpipconnect-app
pnpm install

# 3. Set up Supabase (local Docker)
npx supabase start

# 4. Configure .env (see Quick Start section)
cp .env.example .env
# Edit .env with your Supabase keys

# 5. Run migrations
npx prisma migrate deploy

# 6. Build and start
pnpm build
pnpm start
```

### Option C — Supabase Self-Hosted (Full Docker Stack)

For a fully self-contained deployment with Supabase running alongside the app:

```bash
# 1. Clone the Supabase Docker repo
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# 2. Copy the example env and edit it
cp .env.example .env
# IMPORTANT: Change POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY

# 3. Start Supabase stack
docker compose up -d

# 4. In a separate directory, clone CPI Connect
cd ~/
git clone https://github.com/raja83v/my-sapbtpipconnect-app.git
cd my-sapbtpipconnect-app

# 5. Configure .env with the Supabase keys from step 2
cp .env.example .env
# Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Set DATABASE_URL to point at the Supabase Postgres instance

# 6. Build and run
pnpm install
npx prisma migrate deploy
pnpm build
pnpm start
```

### Supabase Docker Containers — Deep Dive

When running the full Supabase stack, these containers work together:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Your Browser / App                               │
│                  http://localhost:3000                                │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Kong API Gateway (:54321)                                           │
│  Routes /auth/* → GoTrue, /rest/* → PostgREST, /storage/* → Storage │
└──────┬──────────────┬───────────────┬──────────────┬─────────────────┘
       │              │               │              │
       ▼              ▼               ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐
│  GoTrue    │ │ PostgREST  │ │  Storage   │ │ Edge Runtime   │
│  (Auth)    │ │ (REST API) │ │  (Files)   │ │ (Deno funcs)   │
│  :9999     │ │  :3000     │ │  :5000     │ │  :54325        │
└─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────────────────┘
      │              │              │
      └──────────────┴──────────────┘
                     │
                     ▼
        ┌─────────────────────┐       ┌─────────────────┐
        │  PostgreSQL (:54322)│◄──────│  Realtime        │
        │  (All app data +   │       │  (WebSocket      │
        │   auth.users table)│       │   subscriptions) │
        └─────────────────────┘       └─────────────────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
     ┌─────────────┐  ┌──────────────┐
     │  pg_meta     │  │  Studio      │
     │  (metadata)  │  │  (:54323)    │
     └─────────────┘  └──────────────┘
```

**Key things to know:**

- **GoTrue** manages `auth.users` — when a user registers in CPI Connect, a row is created here *and* in the app's `public.User` table via Prisma.
- **Kong** validates JWT tokens on every API request. If your `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` don't match the JWT secret configured in GoTrue, you'll get `invalid JWT` errors.
- **Mailpit** (`:54324`) captures all emails locally — useful for testing email confirmation flows.
- **Studio** (`:54323`) is the admin UI — you can browse auth users, run SQL, and inspect tables.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `invalid JWT: unable to parse or verify signature` | Anon/service role key doesn't match the JWT secret in GoTrue | Run `npx supabase status` or check Kong config to get the correct keys |
| `User already registered` | User exists in Supabase `auth.users` but not in Prisma `User` table | The app auto-recovers from this; or delete the user from Supabase Studio → Authentication |
| Port 54321 already in use | Another Supabase instance is running | `npx supabase stop` the other project, or change ports in `supabase/config.toml` |
| `SUPABASE_SERVICE_ROLE_KEY` is empty | Key not set in `.env` | Copy from `npx supabase status` output |
| Database connection refused on 54322 | Supabase Postgres not running | `docker ps` to check; `npx supabase start` to restart |
| Source map parse errors in console | Known issue with `@supabase/ssr` package | Harmless warning; suppressed via `serverExternalPackages` in `next.config.ts` |

### Backing Up

```bash
# Dump the database
docker exec -t cpiconnect-db pg_dumpall -c -U postgres > backup_$(date +%F).sql

# Restore
cat backup_2026-02-23.sql | docker exec -i cpiconnect-db psql -U postgres
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16 + React 19)                │
│  App Router · Server Components · Server Actions · Turbopack         │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
┌────────────────────┐ ┌────────────┐ ┌────────────────┐
│  Supabase Auth     │ │  Prisma 6  │ │  AI Runtime    │
│  (GoTrue JWT)      │ │  (ORM)     │ │  (LLMLite /    │
│                    │ │            │ │   Google AI)   │
└────────────────────┘ └─────┬──────┘ └────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  PostgreSQL 17               │
              │  (Supabase-managed)          │
              └──────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  SAP CPI (OData APIs)        │
              │  OAuth 2.0 / Basic / Service │
              └──────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, Turbopack |
| Auth | Supabase Auth (GoTrue) with email/password |
| Database | PostgreSQL 17 via Prisma 6 ORM |
| UI | Shadcn UI, Tailwind CSS 4, Radix primitives |
| Charts | Recharts |
| Icons | Lucide React, Tabler Icons |
| Animations | Motion (Framer Motion) |
| AI | LLMLite (OpenAI-compatible) / Google Gemini |
| Email | React Email + Resend |
| Content | MDX via content-collections |
| MCP | Custom MCP server for AI assistant integration |
| Deployment | Docker, Vercel, any Node.js host |

### Route Groups

| Route | Purpose |
|-------|---------|
| `app/(marketing)` | Public landing pages, blog, help center |
| `app/(auth)` | Sign-in, sign-up, forgot password |
| `app/(admin)` | Admin panel — users, workspaces, analytics |
| `app/(onboarding)` | First-time user onboarding |
| `app/dashboard` | Main authenticated dashboard |
| `app/api/auth` | Auth API routes (Supabase-backed) |
| `app/api/mcp` | MCP server tool execution endpoint |

---

## Features

### SAP CPI Management
- **Multi-Tenant** — Connect Dev, QA, Prod environments with OAuth 2.0, Basic Auth, or Service Key.
- **iFlow Monitoring** — Real-time status, execution history, duration, and error categorization.
- **Sync** — Manual and cron-based synchronization of iFlows and executions.
- **BPMN2 Parser** — Parse and generate SAP CPI iFlow BPMN2 definitions.

### AI Agents

10 specialized agents powered by LLMLite / Google Gemini:

| Agent | What it does |
|-------|-------------|
| General Assistant | General-purpose SAP CPI help |
| iFlow Creator | AI-assisted iFlow creation with BPMN2 generation |
| Smart Monitor | Intelligent monitoring and alerting |
| Performance Optimizer | Optimization recommendations |
| Error Diagnostician | Root-cause analysis and fix suggestions |
| Security Auditor | Compliance checks and vulnerability detection |
| Documentation Generator | Auto-generate iFlow documentation |
| Test Case Generator | Create test scenarios |
| Cost Analyzer | Usage analysis and cost insights |
| Predictive Insights | Trend analysis and forecasts |

### MCP Server

The built-in [Model Context Protocol](https://modelcontextprotocol.io/) server lets AI assistants (Claude, Copilot, etc.) interact with SAP CPI:

- **Monitoring** — Message logs, errors, run steps
- **iFlow** — CRUD, config, performance metrics
- **Package** — List, details, create packages
- **Actions** — Deploy, restart, undeploy (with confirmation)
- **Analytics** — Stats, trends, metrics

Features: Zod validation, 30-60s caching, rate limiting, audit logging, confirmation dialogs for destructive actions.

### Dashboard
- Stats cards (tenants, iFlows, executions, AI usage)
- 7-day execution trend chart
- Top 10 active iFlows with status
- Quick actions panel
- AI agent usage tracking

### Team &amp; Admin
- Workspace invitations with role-based access (Owner / Admin / Member / Viewer)
- Admin panel with user management, impersonation, audit logs
- Tenant sharing across team members

---

## Data Models

CPI Connect uses **Prisma 6** with PostgreSQL. Core models:

| Model | Description |
|-------|-------------|
| `User` | User accounts with Supabase auth integration |
| `Session` | User sessions with tenant context |
| `CpiTenant` | SAP CPI tenant configurations (encrypted credentials) |
| `IFlow` | Integration flows synced from SAP CPI |
| `IFlowExecution` | Execution history and message logs |
| `TenantMember` | User-tenant membership with roles |
| `TenantInvitation` | Pending team invitations |
| `AIAgentExecution` | AI agent interaction history |
| `IFlowPipeline` | Multi-agent iFlow creation pipelines |

---

## Directory Structure

```
.
├── app/
│   ├── (marketing)/       # Landing pages, blog, help center
│   ├── (auth)/            # Sign-in, sign-up
│   ├── (admin)/           # Admin panel
│   ├── (onboarding)/      # Onboarding flow
│   ├── dashboard/         # Main dashboard
│   │   ├── ai-agents/     # AI agent interfaces
│   │   ├── iflows/        # iFlow listing and details
│   │   ├── message-logs/  # Execution logs
│   │   ├── analytics/     # Reporting
│   │   ├── lifecycle/     # iFlow lifecycle
│   │   ├── settings/      # User/workspace settings
│   │   └── team/          # Team management
│   ├── actions/           # Server actions (business logic)
│   └── api/               # API routes (auth, cron, mcp, sap-cpi)
├── components/
│   ├── ui/                # Shadcn UI library (50+ components)
│   ├── ai/                # AI agent UI
│   ├── auth/              # Auth forms (Supabase)
│   ├── dashboard/         # Dashboard components
│   ├── marketing/         # Marketing page components
│   └── settings/          # Settings components
├── lib/
│   ├── supabase/          # Supabase client utilities (client, server, admin, middleware)
│   ├── ai/                # AI agent types, prompts, tools
│   ├── sap-cpi/           # SAP CPI client and BPMN2 parser
│   ├── db/                # Prisma client extensions
│   └── validations/       # Zod schemas
├── mcp-server/            # MCP server implementation
├── prisma/                # Database schema and migrations
├── content/               # MDX content (blog, help, legal)
├── emails/                # React Email templates
├── scripts/               # Seed and utility scripts
├── types/                 # TypeScript type definitions
└── docker-compose.yml     # Docker deployment config
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase API URL (e.g., `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only, bypasses RLS) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ENCRYPTION_KEY` | Yes | 32-byte AES-256 key (base64) for SAP credential encryption |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `AI_PROVIDER` | No | `google` or `llmlite` (default: `google`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Google Gemini API key |
| `LLMLITE_BASE_URL` | No | LLMLite-compatible endpoint URL |
| `LLMLITE_API_KEY` | No | LLMLite API key |
| `CRON_SECRET` | No | Secret to protect cron trigger endpoints |

---

## Contributing

We welcome contributions! To get involved:

1. **Fork** the repository and create a feature branch.
2. **Open an issue** for bugs, feature requests, or questions.
3. **Submit a pull request** with clear scope and description.
4. **Star the repo** if you find it useful — it helps others discover the project.

### Development Guidelines
- Follow existing code patterns and naming conventions.
- Add tests for new features when applicable.
- Update documentation for significant changes.
- Use conventional commit messages.

---

## License

This project is licensed under the **AGPL-3.0 License** — see [LICENSE.md](LICENSE.md) for details.

---

<p align="center">
  Built with ❤️ for the SAP integration community
</p>
