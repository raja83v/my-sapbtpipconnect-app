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

## What's New

### April 2026

- **Auth Stack — Supabase → Better-Auth + Embedded PostgreSQL**
  - Replaced Supabase Auth (GoTrue) with [Better-Auth](https://better-auth.com/) using its Drizzle adapter — email/password, sessions, and the admin plugin run directly inside the Next.js app.
  - Replaced the Supabase-managed Postgres with [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres). On `pnpm dev` / `pnpm start`, [instrumentation.ts](instrumentation.ts) auto-spawns a local PostgreSQL 18 cluster under `.data/db/` on port `5435` and runs Drizzle migrations — **no Docker, no Supabase CLI, no separate services required for local dev**.
  - Set `DATABASE_URL` if you want to point at an external Postgres (e.g. inside Docker Compose); otherwise the embedded cluster is used automatically.
  - All Supabase client code, `supabase/` config, and `@supabase/*` packages have been removed.

- **Open-Source Auth Boundary (Cloud vs Self-Hosted)**
  - The hosted domain ([btpiconnect.com](https://btpiconnect.com)) now runs in **cloud (marketing-only) mode** — there is no sign-up, sign-in, or app surface. It exists purely to showcase the open-source project.
  - **Self-hosted installs go straight to `/sign-in`** instead of the marketing landing page. The first visitor on a fresh install is bounced through `/sign-up` / setup automatically.
  - Auth and app routes (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/setup`, `/dashboard`, `/admin`, `/api/auth/*`) are blocked at the proxy layer when `NEXT_PUBLIC_DEPLOYMENT_MODE=cloud`.
  - Marketing header and CTAs swap "Login / Get Started" for "Star on GitHub / Self-Host Guide" in cloud mode so there is no dead-end auth UI.

- **Documentation Generator — Major Overhaul**
  - Section selection is now fully respected — select exactly which of 13 sections to include and only those appear in the output
  - 8-step resilient JSON parsing with regex-based content extraction and nuclear-parse recovery
  - Fuzzy section ID matching handles AI response variations (no more empty placeholders)
  - Rich fallback content generated directly from iFlow metadata when AI misses a section
  - Professional `.docx` export: real tables with dark-blue headers, manual TOC with dot-leaders, page headers/footers, numbered headings, code blocks, cover page
  - Mermaid diagrams validated client-side before rendering (no more "error in text" messages)
  - AI content sanitized — all HTML tags stripped and converted to proper Markdown

- **Database — Prisma → Drizzle ORM**
  - Migrated from Prisma 6 to Drizzle ORM for better performance and type safety
  - Schema defined in `lib/db/schema.ts`; migrations managed with `drizzle-kit`

- **Self-Hosting Improvements**
  - GitHub Actions CI/CD workflows
  - Automated entrypoint with migration support

---

## Quick Start

> **Prerequisites:** [Node.js 20+](https://nodejs.org/), [pnpm](https://pnpm.io/). Docker is optional — only needed for the full self-hosted stack.

### 1. Clone &amp; Install

```bash
git clone https://github.com/raja83v/my-sapbtpipconnect-app.git
cd my-sapbtpipconnect-app
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

For local development you only need two values:

```dotenv
# Encryption key for SAP CPI credentials (generate one with):
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=<your-base64-key>

# Better-Auth signing secret (any high-entropy string):
#   openssl rand -hex 32
BETTER_AUTH_SECRET=<your-secret>

# Optional — leave unset to use the auto-managed embedded Postgres on port 5435.
# Set this only if you want to point at an external PostgreSQL instance.
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See [.env.example](.env.example) for the full list of optional variables (AI provider, cron secret, SMTP, corporate-network TLS fix, etc.).

### 3. Start the Dev Server

```bash
pnpm dev
```

On first launch [instrumentation.ts](instrumentation.ts) automatically:

1. Spawns an [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres) cluster under `.data/db/` (port `5435` by default — auto-shifts if busy).
2. Runs all Drizzle migrations from [drizzle/](drizzle/).
3. Starts the cron scheduler.

No Docker, no Supabase CLI, no `psql` setup — the database is fully self-contained inside the project folder. Override `EMBEDDED_PG_PORT` or `APP_DATA_DIR` to relocate it.

Open [http://localhost:3000](http://localhost:3000). The first user to register automatically becomes **admin**.

> **Heads-up — landing page behavior:** Self-hosted installs (the default) redirect `/` straight to `/sign-in`. The marketing landing page is only rendered when `NEXT_PUBLIC_DEPLOYMENT_MODE=cloud` is set, which is reserved for the public open-source site at [btpiconnect.com](https://btpiconnect.com).

### Deployment Modes

CPI Connect ships with two deployment modes controlled by `NEXT_PUBLIC_DEPLOYMENT_MODE`:

| Mode | Env Value | Landing `/` | Auth (`/sign-in`, `/sign-up`, …) | Use Case |
|------|-----------|-------------|----------------------------------|----------|
| **Self-Hosted** *(default)* | unset / `self-hosted` | Redirects to `/sign-in` | Available — first user becomes admin | Your own server / Docker |
| **Cloud** | `cloud` | Marketing landing page | Disabled — proxy redirects to `/`, API returns 404 | Public open-source site (btpiconnect.com) |

In **cloud** mode the marketing header replaces "Login / Get Started" with "Star on GitHub / Self-Host Guide", so visitors on the public site can only learn about the project and grab the source — they cannot create accounts. To run the app, clone it and follow the Quick Start above.

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with Turbopack (auto-starts embedded Postgres) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server (auto-starts embedded Postgres) |
| `pnpm lint` | Run ESLint |
| `npx drizzle-kit generate` | Generate a new migration from schema changes |
| `npx drizzle-kit migrate` | Apply pending Drizzle migrations manually |
| `npx drizzle-kit studio` | Open Drizzle Studio — point it at `postgresql://app:app@127.0.0.1:5435/app` |

---

## Self-Hosting Guide

CPI Connect can be deployed on any machine that runs Docker. The full stack is just three services — PostgreSQL, LiteLLM (AI proxy), and the Next.js application — all in one command.

> **Detailed instructions:** See [SELF_HOSTING.md](SELF_HOSTING.md) for the complete guide, including LiteLLM model configuration, backup/restore, and troubleshooting.

### Prerequisites

| Requirement | Minimum |
|-------------|---------|
| Docker Engine | 24+ |
| Docker Compose | v2 |
| RAM | 4 GB |
| Disk | 20 GB |

### One-Command Setup

```bash
git clone https://github.com/raja83v/my-sapbtpipconnect-app.git
cd my-sapbtpipconnect-app
bash docker/setup.sh
```

This generates all secrets, writes `.env`, and starts the entire stack. Open **http://localhost:3000** to get started.

### Or Pull from Docker Hub

```bash
docker pull raja83v/cpiconnect:latest
```

Then use the provided `docker-compose.selfhost.yml`:

```bash
curl -O https://raw.githubusercontent.com/raja83v/my-sapbtpipconnect-app/main/docker-compose.selfhost.yml
curl -O https://raw.githubusercontent.com/raja83v/my-sapbtpipconnect-app/main/.env.example
cp .env.example .env
# Edit .env with your secrets (see SELF_HOSTING.md)
docker compose -f docker-compose.selfhost.yml up -d
```

### Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| CPI Connect | `3000` | Next.js application (Better-Auth runs in-process) |
| LiteLLM | `4000` | AI model proxy (100+ providers, optional) |
| PostgreSQL | `5432` | Database — managed by Docker Compose; data persisted in the `postgres_data` volume |

All ports are configurable via `.env`. When running `pnpm dev` outside Docker, you can skip Compose entirely — the embedded Postgres on port `5435` is used instead.

### Updating

```bash
docker compose -f docker-compose.selfhost.yml pull
docker compose -f docker-compose.selfhost.yml up -d
```

Migrations run automatically on startup.
```

### Development Setup (Without Docker)

For local development, see the [Quick Start](#quick-start) section above.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `EADDRINUSE: address already in use 127.0.0.1:5435` | A previous `pnpm dev` process didn't release the embedded Postgres port | Startup auto-shifts to the next free port; or kill the stale Node process and delete `.data/db/postmaster.pid` |
| Embedded Postgres won't start on Windows | Antivirus blocking `initdb` / `postgres.exe` from `node_modules/@embedded-postgres/win32-x64` | Allow the binary in your AV, or set `DATABASE_URL` to use an external Postgres |
| `relation "user" does not exist` after pulling new code | New Drizzle migrations haven't run | They run automatically on `pnpm dev`; or trigger manually with `npx drizzle-kit migrate` |
| Want to wipe local data and start fresh | n/a | Stop the dev server and delete the `.data/db/` directory — the next `pnpm dev` will re-create the cluster and re-run all migrations |
| `BETTER_AUTH_SECRET` warnings in console | Secret missing in `.env` | Generate with `openssl rand -hex 32` and add to `.env` |
| AI / SAP requests fail with `self-signed certificate in certificate chain` | Corporate SSL inspection proxy | Set `CORPORATE_NETWORK=true` and `NODE_EXTRA_CA_CERTS=<path>` — see the *Corporate Network* section of [.env.example](.env.example) |

### Backing Up

**Docker Compose deployments**

```bash
# Dump the database
docker compose exec -T db pg_dump -U cpiconnect cpiconnect > backup_$(date +%F).sql

# Restore
cat backup_2026-02-23.sql | docker compose exec -T db psql -U cpiconnect cpiconnect
```

**Embedded Postgres (local dev)**

All application data lives under `.data/db/`. To back up, simply stop the dev server and copy/archive that directory. To restore, drop the archive back in place before starting `pnpm dev` again.

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
│  Better-Auth       │ │  Drizzle   │ │  AI Runtime    │
│  (in-process,      │ │  ORM       │ │  (LLMLite /    │
│   Drizzle adapter) │ │            │ │   Google AI)   │
└─────────┬──────────┘ └─────┬──────┘ └────────────────┘
          │                  │
          └────────┬─────────┘
                   ▼
   ┌──────────────────────────────────────┐
   │  PostgreSQL 18                       │
   │  Embedded (`.data/db/`, port 5435)   │
   │  — or external via DATABASE_URL —    │
   └──────────────────────────────────────┘
                   │
                   ▼
   ┌──────────────────────────────────────┐
   │  SAP CPI (OData APIs)                │
   │  OAuth 2.0 / Basic / Service Key     │
   └──────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, Turbopack |
| Auth | **Better-Auth** with email/password + admin plugin (Drizzle adapter) |
| Database | PostgreSQL 18 via **Drizzle ORM** — embedded by default (`embedded-postgres`), or external via `DATABASE_URL` |
| UI | Shadcn UI, Tailwind CSS 4, Radix primitives |
| Charts | Recharts |
| Icons | Lucide React, Tabler Icons |
| Animations | Motion (Framer Motion) |
| AI | LLMLite (OpenAI-compatible) / Google Gemini |
| Email | React Email + Resend |
| Content | MDX via content-collections |
| MCP | Custom MCP server for AI assistant integration |
| Documents | `docx` v9 — professional .docx export with tables, TOC, and diagrams |
| Deployment | Docker, Vercel, any Node.js host |

### Route Groups

| Route | Purpose |
|-------|---------|
| `app/(marketing)` | Public landing pages, blog, help center |
| `app/(auth)` | Sign-in, sign-up, forgot password |
| `app/(admin)` | Admin panel — users, workspaces, analytics |
| `app/(onboarding)` | First-time user onboarding |
| `app/dashboard` | Main authenticated dashboard |
| `app/api/auth` | Better-Auth API routes (`/api/auth/[...all]`) |
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
| Documentation Generator | Auto-generate iFlow documentation with selectable sections and .docx export |
| Test Case Generator | Create test scenarios |
| Cost Analyzer | Usage analysis and cost insights |
| Predictive Insights | Trend analysis and forecasts |

#### Documentation Generator Highlights

The Documentation Generator produces professional technical documentation from live iFlow metadata:

- **13 selectable sections** — Overview, Architecture Diagram, Data Flow, Adapter Configuration, Message Mappings, Scripts & Logic, Error Handling, API Endpoints, Security, Testing, Troubleshooting, Configuration, Deployment
- **Professional .docx export** — Real tables with dark-blue headers, manual TOC with dot-leader tab stops, page headers/footers with page numbers, numbered section headings, code blocks with language labels, cover page
- **Mermaid diagrams** — Architecture and data-flow diagrams rendered client-side with syntax validation
- **Resilient JSON parsing** — 8-step repair pipeline including regex-based section extraction and content recovery from malformed AI responses
- **Fuzzy section matching** — Handles AI ID variations (e.g. `architecture-diagram` → `architecture`) so all selected sections always appear

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

CPI Connect uses **Drizzle ORM** with PostgreSQL. Core models:

| Model | Description |
|-------|-------------|
| `User` | User accounts (managed by Better-Auth) |
| `Session` / `Account` / `Verification` | Better-Auth session, OAuth account, and email-verification tables |
| `CpiTenant` | SAP CPI tenant configurations (encrypted credentials) |
| `IFlow` | Integration flows synced from SAP CPI |
| `IFlowExecution` | Execution history and message logs |
| `TenantMember` | User-tenant membership with roles |
| `TenantInvitation` | Pending team invitations |
| `AIAgentExecution` | AI agent interaction history |
| `IFlowPipeline` | Multi-agent iFlow creation pipelines |

Schema is defined in `lib/db/schema.ts` and managed via `drizzle-kit`.

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
│   ├── auth/              # Auth forms (Better-Auth client)
│   ├── dashboard/         # Dashboard components
│   ├── marketing/         # Marketing page components
│   └── settings/          # Settings components
├── lib/
│   ├── auth/              # Better-Auth server config and client utilities
│   ├── ai/                # AI agent types, prompts, tools, runtime
│   ├── sap-cpi/           # SAP CPI client and BPMN2 parser
│   ├── db/                # Drizzle ORM schema, client, embedded-postgres bootstrap, migrations
│   ├── docx-export.ts     # Professional .docx generation (tables, TOC, headers)
│   └── validations/       # Zod schemas
├── mcp-server/            # MCP server implementation
├── drizzle/               # Drizzle migrations
├── content/               # MDX content (blog, help, legal)
├── docker/                # Docker support files (entrypoint, LiteLLM config)
├── emails/                # React Email templates
├── scripts/               # Seed and utility scripts
├── types/                 # TypeScript type definitions
├── docker-compose.yml     # Dev Docker config (app + Postgres)
└── docker-compose.selfhost.yml  # Full self-hosted stack
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | 32-byte AES-256 key (base64) for SAP credential encryption |
| `BETTER_AUTH_SECRET` | Yes | High-entropy signing secret for Better-Auth sessions (`openssl rand -hex 32`). Falls back to `ENCRYPTION_KEY` only as a dev convenience |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (used as Better-Auth `baseURL`) |
| `DATABASE_URL` | No | External PostgreSQL connection string. **If unset, an embedded Postgres cluster is started automatically** under `.data/db/` on port `5435` |
| `EMBEDDED_PG_PORT` | No | Override the default port (`5435`) for the embedded Postgres cluster |
| `APP_DATA_DIR` | No | Override the data directory for the embedded Postgres cluster (default: `<repo>/.data`) |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | No | `self-hosted` (default) or `cloud` |
| `AI_PROVIDER` | No | `llmlite` (default) or `google` |
| `LITELLM_MASTER_KEY` | No | LiteLLM proxy master key |
| `GOOGLE_API_KEY` | No | Google Gemini API key |
| `LLMLITE_BASE_URL` | No | LLMLite-compatible endpoint URL |
| `LLMLITE_API_KEY` | No | LLMLite API key |
| `CRON_SECRET` | No | Secret to protect cron trigger endpoints |
| `CORPORATE_NETWORK` | No | Set to `true` to enable the corporate-proxy TLS workaround in [lib/corporate-tls.ts](lib/corporate-tls.ts) |
| `NODE_EXTRA_CA_CERTS` | No | Path to a corporate CA bundle (used with `CORPORATE_NETWORK=true`) |

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
