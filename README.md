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

- **Billing & Subscription Management**
  - Stripe integration for subscription plans and invoice management
  - Admin subscription overview with usage tracking

- **Self-Hosting Improvements**
  - Dedicated `docker-compose.selfhost.yml` with full stack (app + Supabase + LiteLLM)
  - GitHub Actions CI/CD workflows
  - Automated entrypoint with migration support

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
npx drizzle-kit migrate
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
| `npx drizzle-kit migrate` | Apply Drizzle migrations |
| `npx drizzle-kit studio` | Open Drizzle Studio (DB admin UI) |
| `npx drizzle-kit push` | Push schema changes to database |

---

## Self-Hosting Guide

CPI Connect can be deployed on any machine that runs Docker. The full stack includes Supabase (auth + database), LiteLLM (AI proxy), and the application — all in one command.

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
| CPI Connect | `3000` | Application |
| Supabase API | `8000` | Auth & REST gateway |
| LiteLLM | `4000` | AI model proxy (100+ providers) |
| Supabase Studio | `3100` | Database admin UI |
| PostgreSQL | `5433` | Direct DB access |

All ports are configurable via `.env`.

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
│  Supabase Auth     │ │  Drizzle   │ │  AI Runtime    │
│  (GoTrue JWT)      │ │  ORM       │ │  (LLMLite /    │
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
| Database | PostgreSQL 17 via **Drizzle ORM** |
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
| `User` | User accounts with Supabase auth integration |
| `Session` | User sessions with tenant context |
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
│   ├── auth/              # Auth forms (Supabase)
│   ├── dashboard/         # Dashboard components
│   ├── marketing/         # Marketing page components
│   └── settings/          # Settings components
├── lib/
│   ├── supabase/          # Supabase client utilities (client, server, admin, middleware)
│   ├── ai/                # AI agent types, prompts, tools, runtime
│   ├── sap-cpi/           # SAP CPI client and BPMN2 parser
│   ├── db/                # Drizzle ORM schema, client, and query helpers
│   ├── docx-export.ts     # Professional .docx generation (tables, TOC, headers)
│   └── validations/       # Zod schemas
├── mcp-server/            # MCP server implementation
├── drizzle/               # Drizzle migrations
├── content/               # MDX content (blog, help, legal)
├── docker/                # Docker support files (entrypoint, LiteLLM config, Supabase init)
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
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase API URL (e.g., `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only, bypasses RLS) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ENCRYPTION_KEY` | Yes | 32-byte AES-256 key (base64) for SAP credential encryption |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | No | `self-hosted` (default) or `cloud` |
| `AI_PROVIDER` | No | `llmlite` (default) or `google` |
| `LITELLM_MASTER_KEY` | No | LiteLLM proxy master key |
| `GOOGLE_API_KEY` | No | Google Gemini API key |
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
