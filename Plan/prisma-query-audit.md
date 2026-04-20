# Prisma Query Audit — Complete Inventory for Drizzle Migration

> **Purpose**: Research-only audit of every Prisma query call across the codebase.
> **Generated**: Automated analysis of 50+ files.
> **Status**: NO files modified — read-only.

---

## Table of Contents

1. [Schema Summary](#1-schema-summary)
2. [File-by-File Query Inventory](#2-file-by-file-query-inventory)
3. [Complex Pattern Catalog](#3-complex-pattern-catalog)
4. [Type Import Map](#4-type-import-map)
5. [Files Grouped by Complexity](#5-files-grouped-by-complexity)
6. [Migration Risk Assessment](#6-migration-risk-assessment)

---

## 1. Schema Summary

### Models (14 total)

| Model | Table Name | Composite Unique Keys |
|-------|-----------|----------------------|
| `User` | `user` | — |
| `Session` | `session` | — |
| `Account` | `account` | — |
| `Verification` | `verification` | — |
| `CpiTenant` | `cpi_tenant` | — |
| `IFlow` | `iflow` | `@@unique([tenantId, iFlowId])` |
| `IFlowExecution` | `iflow_execution` | — (`messageId @unique`) |
| `TenantMember` | `tenant_member` | `@@unique([userId, tenantId])` |
| `TenantInvitation` | `tenant_invitation` | — (`token @unique`) |
| `AIAgentExecution` | `ai_agent_execution` | — |
| `IFlowPipeline` | `iflow_pipeline` | — |
| `IFlowPipelineAgentLog` | `iflow_pipeline_agent_log` | — |
| `AIConfiguration` | `ai_configuration` | — |
| `Subscription`* | — | — |
| `Invoice`* | — | — |

> *`Subscription` and `Invoice` are referenced in billing code (`app/actions/billing.ts`, `app/actions/admin/billing.ts`, `lib/cron/jobs/trial-reminders.ts`) but are **NOT defined in `prisma/schema.prisma`**. These models are either planned, in a separate schema extension, or from a future migration. The code will fail at runtime if these models don't exist.

### Enums (14 total)

`UserRole`, `UserStatus`, `Role`, `AuthType`, `TenantStatus`, `IFlowStatus`, `ExecutionStatus`, `ErrorCategory`, `AIAgentType`, `AIAgentStatus`, `PipelinePhase`, `PipelineAgentLogStatus`, `OrganizationType`, `AIProvider`

---

## 2. File-by-File Query Inventory

### A. Database Helper Layer (`lib/db/`)

---

#### `lib/db/users.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.findUnique({ where: { id } })` | Get user by ID |
| 2 | `user.findUnique({ where: { email } })` | Get user by email |
| 3 | `user.create({ data })` | Create new user |
| 4 | `user.update({ where: { id }, data })` | Update user profile |
| 5 | `user.update({ where: { id }, data: { status: "DELETED" } })` | Soft-delete user |
| 6 | `user.findMany({ where, skip, take, orderBy, select })` | Paginated user list with partial select |
| 7 | `user.count({ where })` | Filtered user count |
| 8 | `cpiTenant.count()` | Total tenant count (dashboard stat) |
| 9 | `iFlow.count()` | Total iFlow count (dashboard stat) |

**Patterns**: `Promise.all` for parallel counts, `select` clause for partial fields

---

#### `lib/db/tenants.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findUnique({ where: { id } })` | Get tenant by ID |
| 2 | `cpiTenant.findUnique({ where: { slug } })` | Get tenant by slug |
| 3 | `cpiTenant.create({ data })` | Create tenant |
| 4 | `cpiTenant.update({ where: { id }, data })` | Update tenant |
| 5 | `cpiTenant.delete({ where: { id } })` | Delete tenant |
| 6 | `cpiTenant.findMany({ where, skip, take, orderBy })` | Paginated tenant list |
| 7 | `cpiTenant.count({ where })` | Filtered tenant count |
| 8 | `tenantMember.findMany({ where: { userId }, include: { tenant } })` | User's tenant memberships |
| 9 | `tenantMember.findMany({ where: { tenantId }, include: { user: { select } } })` | Tenant's members with user select |
| 10 | `tenantMember.findUnique({ where: { userId_tenantId } })` | **Composite key lookup** |
| 11 | `tenantMember.create({ data })` | Add member |
| 12 | `tenantMember.update({ where, data })` | Update member role |
| 13 | `tenantMember.delete({ where })` | Remove member |
| 14 | `tenantMember.count({ where })` | Member count |
| 15 | `tenantInvitation.create({ data })` | Create invitation |
| 16 | `tenantInvitation.findUnique({ where: { token }, include: { tenant, invitedBy } })` | Get invitation by token with nested includes |
| 17 | `tenantInvitation.findMany({ where: { tenantId, acceptedAt: null, expiresAt: { gt: now } } })` | Active (unexpired, unaccepted) invitations |
| 18 | `tenantInvitation.delete({ where: { id } })` | Delete invitation |
| 19 | **`$transaction(async (tx) => { ... })`** | Accept invitation: update invitation + create member + set default tenant |

**Complex**: Interactive `$transaction`; `OR` clause with null check; composite unique key; nested includes

---

#### `lib/db/iflows.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `iFlow.findUnique({ where: { id } })` | Get iFlow by ID |
| 2 | `iFlow.findUnique({ where: { tenantId_iFlowId } })` | **Composite key lookup** |
| 3 | `iFlow.findMany({ where, skip, take, orderBy })` | Paginated iFlows |
| 4 | `iFlow.count({ where })` | Filtered count |
| 5 | `iFlow.update({ where, data })` | Update iFlow |
| 6 | **`iFlow.upsert({ where: { tenantId_iFlowId }, create, update })`** | Upsert with composite key |
| 7 | **`$transaction(upsertOps[])`** | Batch transaction with array of upserts |
| 8 | `iFlowExecution.findMany({ where, skip, take, orderBy })` | Paginated executions |
| 9 | `iFlowExecution.findUnique({ where: { messageId } })` | Get execution by message ID |
| 10 | **`iFlowExecution.createMany({ data, skipDuplicates: true })`** | Batch create, skip dupes |
| 11 | `iFlowExecution.count({ where })` | Execution count |
| 12 | **`iFlowExecution.groupBy({ by: ['status'], _count: true })`** | Group by status with counts |

**Complex**: Batch `$transaction` with upsert array; `groupBy` + `_count`; `createMany` + `skipDuplicates`; composite unique key lookups

---

#### `lib/db/ai-agents.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `aIAgentExecution.create({ data })` | Log new agent execution |
| 2 | `aIAgentExecution.update({ where: { id }, data })` | Update execution status/output |
| 3 | `aIAgentExecution.findUnique({ where: { id } })` | Get execution by ID |
| 4 | `aIAgentExecution.findMany({ where, skip, take, orderBy })` | Paginated executions |
| 5 | `aIAgentExecution.count({ where })` | Execution count (multiple variants) |
| 6 | **`aIAgentExecution.groupBy({ by: ['agentType'], _count, _sum: { tokensUsed } })`** | Group by type with count + sum |

**Complex**: `groupBy` with `_count` AND `_sum` aggregation

---

#### `lib/db/pipelines.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `iFlowPipeline.create({ data })` | Create pipeline |
| 2 | `iFlowPipeline.update({ where: { id }, data })` | Update pipeline phase/data |
| 3 | `iFlowPipeline.findUnique({ where: { id }, include: { agentLogs: { orderBy } } })` | Get pipeline with ordered agent logs |
| 4 | `iFlowPipeline.findMany({ where, skip, take, orderBy, include: { tenant } })` | Paginated pipelines with tenant |
| 5 | `iFlowPipeline.count({ where })` | Pipeline count |
| 6 | `iFlowPipelineAgentLog.create({ data })` | Create agent log entry |
| 7 | `iFlowPipelineAgentLog.update({ where: { id }, data })` | Update agent log |
| 8 | `iFlowPipelineAgentLog.findMany({ where })` | Get logs for pipeline |

---

### B. Auth & Config Layer

---

#### `lib/auth-helpers.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.findUnique({ where: { email }, select: { ...8 fields } })` | Get user by email (cached with React `cache()`) |
| 2 | `user.count()` | Check if first user (for admin role assignment) |
| 3 | `user.create({ data, select })` | Lazy-create user on first login |
| 4 | `user.update({ where: { id }, data: { supabaseId } })` | Backfill supabaseId migration |

**Patterns**: React `cache()` wrapper; conditional create (lazy user provisioning); first-user admin pattern

---

#### `lib/ai-config.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `aIConfiguration.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } })` | Get active AI config (public) |
| 2 | `aIConfiguration.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } })` | Get active AI config (internal, with decrypt) |
| 3 | **`$transaction(async (tx) => { tx.aIConfiguration.updateMany({ where: { isActive: true }, data: { isActive: false } }); tx.aIConfiguration.create({ data }) })`** | Deactivate all + create new config |

**Complex**: Interactive `$transaction` with `updateMany` + `create`; `findFirst` with `orderBy`

---

### C. Server Actions (`app/actions/`)

---

#### `app/actions/tenant.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findMany({ where: { userId }, include: { tenant } })` | User's memberships |
| 2 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Composite key access check (×3) |
| 3 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |
| 4 | `cpiTenant.findUnique({ where: { slug } })` | Slug uniqueness check |
| 5 | `user.update({ data: { defaultTenantId } })` | Set default tenant |
| 6 | **`cpiTenant.findFirst({ where: { members: { some: { userId } } } })`** | **Nested relation filter** |
| 7 | `cpiTenant.update({ where, data })` | Update tenant |
| 8 | `cpiTenant.delete({ where })` | Delete tenant |
| 9 | **`$transaction(async (tx) => { tx.cpiTenant.create + tx.tenantMember.create })`** | Create tenant + owner |

**Complex**: `findFirst` with `members: { some: { userId } }` nested relation filter; interactive `$transaction`

---

#### `app/actions/onboarding.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |
| 2 | `cpiTenant.findFirst({ where: { members: { some: { userId } } } })` | Nested relation filter |
| 3 | **`$transaction(async (tx) => { tx.cpiTenant.create + tx.tenantMember.create })`** | Create workspace + owner |
| 4 | `user.update({ data: { onboardingData: JSON, defaultTenantId, onboardingCompleted } })` | JSON field update |
| 5 | `cpiTenant.update({ where, data })` | Update tenant connection |

**Complex**: `$transaction`; JSON field updates (`onboardingData`); nested relation filter

---

#### `app/actions/iflows.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `iFlow.findUnique({ where: { id } })` | Get iFlow |
| 2 | `iFlow.findUnique({ where: { tenantId_iFlowId } })` | Composite key lookup |
| 3 | `tenantMember.findMany({ where: { userId }, select: { tenantId: true } })` | Get user's tenant IDs only |
| 4 | `user.findUnique({ where: { id }, select: { defaultTenantId } })` | Get default tenant |
| 5 | **`iFlow.count({ where: { tenantId: { in: tenantIds } } })`** | Count with `IN` clause |
| 6 | **`iFlow.findMany({ where: { tenantId: { in: [...] }, AND: [{ OR: [...] }] }, include: { tenant } })`** | Complex compound filter |
| 7 | `tenantMember.findMany({ where: { userId }, include: { tenant: { select } } })` | Memberships with tenant select |
| 8 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |

**Complex**: `{ in: [...] }` IN clause; `AND: [{ OR: [...] }]` compound filters; include with nested select

---

#### `app/actions/ai-agents.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |
| 2 | `iFlow.count({ where: { tenantId } })` | Count tenant's iFlows |
| 3 | **`iFlowExecution.findMany({ where: { iFlow: { tenantId }, startTime: { gte } } })`** | **Nested relation filter** in where |
| 4 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |
| 5 | `aIAgentExecution.create/update/findMany/findFirst` | CRUD for executions |

**Complex**: Nested relation filter `{ iFlow: { tenantId } }` in where clause

---

#### `app/actions/ai-agents-v2.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |
| 2 | `iFlow.findMany({ where: { tenantId } })` | Tenant's iFlows |
| 3 | `iFlowExecution.findMany({ where: { ..., status: "FAILED" } })` | Failed executions |
| 4 | `aIAgentExecution.create({ data })` | Log execution |

---

#### `app/actions/ai-agents-tools.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |
| 2 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |
| 3 | `iFlow.findUnique({ where: { id } })` | Get iFlow |
| 4 | `aIAgentExecution.create/update` | Log execution |

---

#### `app/actions/dashboard.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`aIAgentExecution.groupBy({ by: ['agentType'], _count, _sum: { tokensUsed } })`** | Group by agent type |
| 2 | **`aIAgentExecution.aggregate({ _sum: { tokensUsed } })`** | Sum all tokens |
| 3 | **`iFlow.groupBy({ by: ['status'], _count })`** | Group iFlows by status |
| 4 | **`iFlowExecution.groupBy({ by: ['status'], where: { iFlowId: { in } }, _count })`** | Group executions by status with IN |
| 5 | `iFlow.findMany({ where, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }] })` | Multi-field orderBy |

**Complex**: `groupBy` × 3; `aggregate` with `_sum`; `IN` clause; multi-field `orderBy` array

---

#### `app/actions/tenant-actions.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`$transaction(async (tx) => { tx.cpiTenant.create + tx.tenantMember.create })`** | Create tenant + owner |

---

#### `app/actions/tenant-connection.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |
| 2 | `cpiTenant.update({ where, data })` | Update connection settings |

---

#### `app/actions/tenant-members.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Composite key access check |
| 2 | `tenantMember.findUnique({ where: { id }, include: { user } })` | Get member with user |
| 3 | `tenantMember.findMany({ where: { tenantId }, include: { user } })` | Tenant's members |
| 4 | `tenantMember.update({ where, data, include })` | Update member role |
| 5 | `tenantMember.delete({ where })` | Remove member |

---

#### `app/actions/tenant-invitations.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`tenantInvitation.findFirst({ where: { email: { mode: 'insensitive' } } })`** | **Case-insensitive** email search |
| 2 | `tenantInvitation.create/findMany/delete` | Invitation CRUD |
| 3 | **`$transaction(async (tx))`** | Accept invitation |

**Complex**: Case-insensitive `mode: 'insensitive'`; interactive `$transaction`

---

#### `app/actions/workspace-settings.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findFirst({ where })` | Find membership |
| 2 | `cpiTenant.findUnique({ where: { slug } })` | Slug uniqueness check |
| 3 | `cpiTenant.update({ where, data })` | Update workspace |
| 4 | **`$transaction(async (tx))`** | Create workspace |

---

#### `app/actions/workspace-members.ts`

Same as `tenant-members.ts` plus `tenantMember.count` for last-owner protection.

---

#### `app/actions/workspace-invitations.ts`

Same as `tenant-invitations.ts` with `$transaction` for accept invitation.

---

#### `app/actions/user-settings.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.update({ where: { id }, data })` | Update profile |
| 2 | `user.update({ where: { id }, data: { status: 'DELETED' } })` | Soft-delete |

---

#### `app/actions/iflow-creator.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findUnique({ where: { id } })` | Access check (read-only) |
| 2 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check (read-only) |

---

#### `app/actions/iflow-orchestrator.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |
| 2 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |
| 3 | **`iFlowPipeline.findFirst({ where: { phase: { notIn: ['COMPLETED', 'FAILED', 'CANCELLED'] } } })`** | **`notIn`** filter |
| 4 | `iFlowPipeline.update/create` | Pipeline management |

**Complex**: `notIn` filter for enum values

---

#### `app/actions/message-logs.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.findUnique({ where: { id }, select: { defaultTenantId } })` | Get default tenant |
| 2 | `tenantMember.findFirst({ where, select: { tenantId } })` | Get first membership |
| 3 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |
| 4 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |

---

#### `app/actions/cost-analyzer.ts`, `documentation-generator.ts`, `test-case-generator.ts`

All follow the same pattern:
| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Access check |
| 2 | `cpiTenant.findUnique({ where: { id } })` | Get tenant credentials |

---

#### `app/actions/billing.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`subscription.findUnique({ where: { userId }, select: { invoices: { orderBy, take, select } } })`** | **Nested relation select** in findUnique |

**Complex**: Nested relation select pattern (subscription → invoices); **NOTE: `Subscription` model not in schema.prisma**

---

### D. Admin Actions (`app/actions/admin/`)

---

#### `app/actions/admin/users.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`user.findMany({ where: { OR: [{ email: { contains, mode: 'insensitive' } }, { name: { contains, mode: 'insensitive' } }] }, include: { _count: { select: { tenants: true } } } })`** | Paginated search with **`_count` relation** + case-insensitive OR |
| 2 | `user.count({ where })` | Filtered count |
| 3 | `user.findUnique({ where: { id }, include: { tenants: { include: { tenant: { select } } } } })` | **Deep nested include** (3 levels) |
| 4 | `user.findUnique({ where: { email } })` | Uniqueness check |
| 5 | `user.create({ data })` | Admin-created user |
| 6 | `user.update({ where, data })` | Admin user update |
| 7 | `user.update({ data: { status: 'DELETED' } })` | Admin soft-delete |

**Complex**: `include: { _count: { select: { tenants } } }`; deep nested include; case-insensitive `mode: 'insensitive'`

---

#### `app/actions/admin/dashboard.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.count()` | Total users |
| 2 | `user.count({ where: { createdAt: { gte } } })` | New users (30 days) |
| 3 | `user.count({ where: { lastLoginAt: { gte } } })` | Active users (30 days) |
| 4 | `user.count({ where: { createdAt: { gte, lt } } })` | Previous period users (date range) |
| 5 | `user.findMany({ take: 5, orderBy: { createdAt: 'desc' } })` | Recent users |
| 6 | `user.findMany({ take: 3, orderBy: { createdAt: 'desc' } })` | Recent users (activity) |
| 7 | `cpiTenant.findMany({ take: 3, orderBy: { createdAt: 'desc' } })` | Recent tenants (activity) |

**Patterns**: `Promise.all` for parallel counts; date range filters with `gte`/`lt`

---

#### `app/actions/admin/billing.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `subscription.findMany({ where: { status: 'ACTIVE' }, select })` | Active subscriptions for MRR |
| 2 | `subscription.findMany({ select: { planType, status } })` | All subscriptions for breakdown |
| 3 | `invoice.findMany({ where: { status: 'PAID', paidAt: { gte } }, select: { amount } })` | Paid invoices this month |
| 4 | `invoice.count({ where: { status: 'FAILED' } })` | Failed invoices count |
| 5 | `subscription.findMany({ where, include: { user: { select } }, orderBy, skip, take })` | Paginated subscriptions with user |
| 6 | `subscription.count({ where })` | Filtered subscription count |

**Complex**: Inline type imports `import("@prisma/client").SubscriptionStatus`; nested relation filter for search (`user: { OR: [...] }`); **NOTE: `Subscription`/`Invoice` models not in schema.prisma**

---

#### `app/actions/admin/workspaces.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`cpiTenant.findMany({ include: { _count: { select: { members: true, invitations: true } } } })`** | **Multi-field `_count`** |
| 2 | `cpiTenant.count({ where })` | Filtered count |
| 3 | `cpiTenant.findUnique({ where: { id }, include: { members: { include: { user: { select } } }, _count: { select: { invitations } } } })` | Deep include + _count |
| 4 | `cpiTenant.findUnique({ where: { slug } })` | Slug uniqueness |
| 5 | **`$transaction(async (tx) => { tx.cpiTenant.create + tx.tenantMember.create })`** | Create workspace + owner |
| 6 | `cpiTenant.update({ where, data, include: { _count } })` | Update with _count in result |

**Complex**: Multi-field `_count` in include; deep nested include; `$transaction`; `_count` in update return

---

#### `app/actions/admin/impersonate.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `session.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })` | Latest session (for impersonation check) |
| 2 | `user.findUnique({ where: { id } })` | Get user (×3 calls) |

---

### E. API Routes (`app/api/`)

---

#### `app/api/auth/sign-up/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.findUnique({ where: { email } })` | Uniqueness check |
| 2 | `user.count()` | First-user check (for admin role) |
| 3 | `user.create({ data })` | Create Prisma user after Supabase auth |

---

#### `app/api/auth/sign-in/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.findUnique({ where: { email }, select })` | Get user by email |
| 2 | `user.update({ where: { id }, data: { lastLoginAt } })` | Update last login |

---

#### `app/api/auth/setup/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.count()` | Check if setup needed (POST + GET) |
| 2 | `user.create({ data })` | Create first admin user |

---

#### `app/api/auth/me/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `user.findUnique({ where: { email }, select: { ...8 fields } })` | Get current user |

---

#### `app/api/health/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`$queryRawUnsafe('SELECT 1')`** | **RAW SQL** — health check ping |

**Complex**: **Only raw SQL query in the entire codebase**

---

#### `app/api/cron/sync-executions/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findMany({ where: { isConnected, authType: 'OAUTH', clientId: { not: null }, ..., OR: [{ lastSyncAt: null }, { lastSyncAt: { lt } }] }, take, orderBy })` | Complex filtered tenant query |

**Complex**: Multiple `{ not: null }` checks; `OR` with null and date comparison; ordered pagination

---

#### `app/api/cron/sync-all-tenants/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findMany({ take: 100 })` | All tenants (bulk) |

---

#### `app/api/pipelines/[id]/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `iFlowPipeline.findUnique({ where: { id }, include: { agentLogs: { orderBy } } })` | Pipeline with ordered logs |

---

#### `app/api/mcp/tools/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Composite key access check |
| 2 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |

---

#### `app/api/ai/diagnose-error/route.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findUnique({ where: { id } })` | Get tenant |
| 2 | `tenantMember.findUnique({ where: { userId_tenantId } })` | Composite key access check |

---

### F. Cron Jobs (`lib/cron/jobs/`)

---

#### `lib/cron/jobs/cleanup.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`session.deleteMany({ where: { expiresAt: { lt: now } } })`** | Bulk delete expired sessions |
| 2 | **`tenantInvitation.deleteMany({ where: { expiresAt: { lt }, acceptedAt: null } })`** | Bulk delete expired invitations |

**Complex**: `deleteMany` with compound where (date + null check)

---

#### `lib/cron/jobs/sync-tenants.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `cpiTenant.findMany({ where: { status: 'ACTIVE', isConnected: true, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt } }] }, take, orderBy })` | Active tenants needing sync |
| 2 | `cpiTenant.update({ where: { id }, data: { lastSyncAt } })` | Update sync timestamp (×2) |

**Complex**: `OR` with null check + date comparison

---

#### `lib/cron/jobs/trial-reminders.ts`

| # | Query | Description |
|---|-------|-------------|
| 1 | `subscription.findMany({ where: { status: 'TRIALING', trialEndsAt: { gte, lte } }, include: { user: { select } } })` | Subscriptions in trial window with user |

**NOTE**: `Subscription` model not in schema.prisma

---

### G. Dashboard Pages (`app/dashboard/`)

---

#### `app/dashboard/analytics/page.tsx`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`aIAgentExecution.aggregate({ where, _count: { id }, _sum: { tokensUsed }, _avg: { duration } })`** | **Triple aggregation** |
| 2 | **`aIAgentExecution.groupBy({ by: ['agentType'], where, _count })`** | Group by agent type |
| 3 | `aIAgentExecution.findMany({ where, take: 50, orderBy })` | Recent executions |

**Complex**: `aggregate` with `_count` + `_sum` + `_avg`; `groupBy`

---

#### `app/dashboard/ai-agents/page.tsx`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`aIAgentExecution.groupBy({ by: ['agentType'], where, _count, _sum: { tokensUsed } })`** | Group by type with count + sum |

---

#### `app/dashboard/ai-agents/analytics/page.tsx`

Same as `app/dashboard/analytics/page.tsx` (duplicate):
| # | Query | Description |
|---|-------|-------------|
| 1 | **`aIAgentExecution.aggregate({ _count, _sum, _avg })`** | Triple aggregation |
| 2 | **`aIAgentExecution.groupBy({ by: ['agentType'], _count })`** | Group by type |
| 3 | `aIAgentExecution.findMany({ take: 50 })` | Recent executions |

---

#### `app/dashboard/ai-agents-v1/page.tsx`

| # | Query | Description |
|---|-------|-------------|
| 1 | **`aIAgentExecution.groupBy({ by: ['agentType'], where, _count, _sum: { tokensUsed } })`** | Group by type with count + sum |

---

#### `app/dashboard/ai-agents-v1/analytics/page.tsx`

| # | Query | Description |
|---|-------|-------------|
| 1 | `aIAgentExecution.findMany({ where, take: 1000, orderBy })` | Bulk fetch for client-side aggregation |

**Note**: This page fetches up to 1000 rows and aggregates in JS rather than using `groupBy`/`aggregate` — migration should consider keeping this pattern or converting to SQL aggregation.

---

## 3. Complex Pattern Catalog

### 3.1 Interactive Transactions (`$transaction(async (tx) => { ... })`)

| Location | Purpose |
|----------|---------|
| `lib/db/tenants.ts` | Accept invitation: update invitation + create member + set default tenant |
| `lib/ai-config.ts` | Deactivate all configs + create new config |
| `app/actions/tenant.ts` | Create tenant + owner member |
| `app/actions/onboarding.ts` | Create workspace + owner member |
| `app/actions/tenant-actions.ts` | Create tenant + owner |
| `app/actions/tenant-invitations.ts` | Accept invitation |
| `app/actions/workspace-settings.ts` | Create workspace |
| `app/actions/workspace-invitations.ts` | Accept invitation |
| `app/actions/admin/workspaces.ts` | Create workspace + owner |

**Total: 9 interactive transactions**

### 3.2 Batch Transaction (`$transaction(ops[])`)

| Location | Purpose |
|----------|---------|
| `lib/db/iflows.ts` | Array of `upsert` operations for batch iFlow sync |

**Total: 1 batch transaction**

### 3.3 `groupBy` with Aggregations

| Location | Aggregations |
|----------|-------------|
| `lib/db/iflows.ts` | `groupBy(['status'])` + `_count` |
| `lib/db/ai-agents.ts` | `groupBy(['agentType'])` + `_count` + `_sum(tokensUsed)` |
| `app/actions/dashboard.ts` | `groupBy(['agentType'])` + `_count` + `_sum(tokensUsed)` |
| `app/actions/dashboard.ts` | `groupBy(['status'])` + `_count` (iFlow) |
| `app/actions/dashboard.ts` | `groupBy(['status'])` + `_count` (iFlowExecution with IN) |
| `app/dashboard/analytics/page.tsx` | `groupBy(['agentType'])` + `_count` |
| `app/dashboard/ai-agents/page.tsx` | `groupBy(['agentType'])` + `_count` + `_sum` |
| `app/dashboard/ai-agents/analytics/page.tsx` | `groupBy(['agentType'])` + `_count` |
| `app/dashboard/ai-agents-v1/page.tsx` | `groupBy(['agentType'])` + `_count` + `_sum` |

**Total: 9 groupBy calls**

### 3.4 `aggregate`

| Location | Fields |
|----------|--------|
| `app/actions/dashboard.ts` | `_sum(tokensUsed)` |
| `app/dashboard/analytics/page.tsx` | `_count(id)` + `_sum(tokensUsed)` + `_avg(duration)` |
| `app/dashboard/ai-agents/analytics/page.tsx` | `_count(id)` + `_sum(tokensUsed)` + `_avg(duration)` |

**Total: 3 aggregate calls**

### 3.5 `createMany` with `skipDuplicates`

| Location | Purpose |
|----------|---------|
| `lib/db/iflows.ts` | Batch create executions, skip existing |

**Total: 1**

### 3.6 `upsert` with Composite Unique

| Location | Purpose |
|----------|---------|
| `lib/db/iflows.ts` | Upsert iFlow by `tenantId_iFlowId` composite key |

**Total: 1 (but called in batch via `$transaction`)**

### 3.7 `deleteMany`

| Location | Purpose |
|----------|---------|
| `lib/cron/jobs/cleanup.ts` | Delete expired sessions |
| `lib/cron/jobs/cleanup.ts` | Delete expired invitations |

**Total: 2**

### 3.8 `updateMany`

| Location | Purpose |
|----------|---------|
| `lib/ai-config.ts` | Deactivate all active AI configs |

**Total: 1**

### 3.9 Raw SQL (`$queryRawUnsafe`)

| Location | Query |
|----------|-------|
| `app/api/health/route.ts` | `SELECT 1` (health check) |

**Total: 1** — trivial, easy to migrate

### 3.10 Nested Relation Filters

| Location | Pattern |
|----------|---------|
| `app/actions/tenant.ts` | `{ members: { some: { userId } } }` |
| `app/actions/onboarding.ts` | `{ members: { some: { userId } } }` |
| `app/actions/ai-agents.ts` | `{ iFlow: { tenantId } }` in where |
| `app/actions/admin/billing.ts` | `{ user: { OR: [...] } }` for subscription search |

### 3.11 Case-Insensitive Search (`mode: 'insensitive'`)

| Location | Fields |
|----------|--------|
| `app/actions/admin/users.ts` | email, name |
| `app/actions/admin/workspaces.ts` | name, slug |
| `app/actions/admin/billing.ts` | email, name (via user relation) |
| `app/actions/tenant-invitations.ts` | email |

### 3.12 `_count` in Include (Relation Counting)

| Location | Fields |
|----------|--------|
| `app/actions/admin/users.ts` | `_count: { select: { tenants } }` |
| `app/actions/admin/workspaces.ts` | `_count: { select: { members, invitations } }` |

### 3.13 Composite Unique Key Lookups

| Key | Count |
|-----|-------|
| `userId_tenantId` (TenantMember) | ~25+ lookups across the codebase |
| `tenantId_iFlowId` (IFlow) | ~5 lookups |

### 3.14 `connectOrCreate`

**None found** — not used anywhere.

### 3.15 JSON Field Operations

| Location | Field |
|----------|-------|
| `app/actions/onboarding.ts` | `onboardingData: Json` (write) |

---

## 4. Type Import Map

### Direct `@prisma/client` Imports

| File | Imports |
|------|---------|
| `lib/db/users.ts` | `Prisma`, `UserRole`, `UserStatus` |
| `lib/db/tenants.ts` | `Prisma`, `Role`, `TenantStatus` |
| `lib/db/iflows.ts` | `Prisma`, `ExecutionStatus`, `IFlowStatus` |
| `lib/db/ai-agents.ts` | `Prisma`, `AIAgentType`, `AIAgentStatus` |
| `lib/db/pipelines.ts` | `Prisma`, `PipelinePhase`, `PipelineAgentLogStatus` |
| `lib/ai-config.ts` | `AIProvider` |
| `app/actions/admin/billing.ts` | `SubscriptionStatus`, `PlanType` (inline `import()`) |

### Implicit Prisma Usage (via `prisma` client, no direct type imports)

All other files import `prisma` from `@/lib/db` and use its methods without importing types directly.

---

## 5. Files Grouped by Complexity

### Tier 1 — HIGH Complexity (requires careful migration)

| File | Reason |
|------|--------|
| `lib/db/iflows.ts` | Batch `$transaction`, `upsert` with composite key, `createMany`+`skipDuplicates`, `groupBy` |
| `lib/db/tenants.ts` | Interactive `$transaction`, composite key lookups, nested includes, null+date filters |
| `lib/db/ai-agents.ts` | `groupBy` with `_count` + `_sum` |
| `lib/ai-config.ts` | Interactive `$transaction` with `updateMany` + `create` |
| `app/actions/dashboard.ts` | Multiple `groupBy`, `aggregate`, `IN` clause, multi-field `orderBy` |
| `app/actions/tenant.ts` | Interactive `$transaction`, nested relation filter (`some`) |
| `app/actions/onboarding.ts` | Interactive `$transaction`, JSON field, nested relation filter |
| `app/actions/iflows.ts` | `IN` clause, `AND: [{ OR: [...] }]` compound filters |
| `app/actions/admin/users.ts` | `_count` in include, deep nested include (3 levels), case-insensitive OR |
| `app/actions/admin/workspaces.ts` | Multi-field `_count`, deep include, `$transaction` |
| `app/actions/admin/billing.ts` | Missing schema models, nested relation search, inline type imports |
| `app/dashboard/analytics/page.tsx` | Triple `aggregate` (`_count`+`_sum`+`_avg`), `groupBy` |

### Tier 2 — MEDIUM Complexity

| File | Reason |
|------|--------|
| `lib/db/users.ts` | `Promise.all` parallel queries, `select` clause |
| `lib/db/pipelines.ts` | Nested include with orderBy |
| `lib/auth-helpers.ts` | React `cache()`, conditional create, first-user logic |
| `app/actions/ai-agents.ts` | Nested relation filter (`iFlow: { tenantId }`) |
| `app/actions/tenant-invitations.ts` | Case-insensitive search, `$transaction` |
| `app/actions/workspace-invitations.ts` | Same as tenant-invitations |
| `app/actions/workspace-settings.ts` | `$transaction`, slug uniqueness |
| `app/actions/iflow-orchestrator.ts` | `notIn` filter |
| `app/actions/billing.ts` | Nested relation select (invoices) |
| `app/actions/admin/dashboard.ts` | Multiple date-range counts, `Promise.all` |
| `app/actions/admin/impersonate.ts` | `session.findFirst` with orderBy |
| `app/api/cron/sync-executions/route.ts` | Complex multi-field where with `not: null` + OR |
| `lib/cron/jobs/cleanup.ts` | `deleteMany` with compound where |
| `lib/cron/jobs/sync-tenants.ts` | OR with null + date filter |
| `lib/cron/jobs/trial-reminders.ts` | Date range window filter |
| `app/dashboard/ai-agents/page.tsx` | `groupBy` with `_count` + `_sum` |
| `app/dashboard/ai-agents-v1/page.tsx` | `groupBy` with `_count` + `_sum` |
| `app/dashboard/ai-agents-v1/analytics/page.tsx` | Bulk fetch (1000 rows) for client-side aggregation |

### Tier 3 — LOW Complexity (straightforward CRUD)

| File | Reason |
|------|--------|
| `app/actions/tenant-connection.ts` | Simple findUnique + update |
| `app/actions/tenant-members.ts` | Standard CRUD with composite key |
| `app/actions/workspace-members.ts` | Standard CRUD with count |
| `app/actions/user-settings.ts` | Simple update |
| `app/actions/ai-agents-v2.ts` | Simple queries |
| `app/actions/ai-agents-tools.ts` | Simple CRUD |
| `app/actions/iflow-creator.ts` | Read-only access checks |
| `app/actions/cost-analyzer.ts` | Read-only access checks |
| `app/actions/documentation-generator.ts` | Read-only access checks |
| `app/actions/test-case-generator.ts` | Read-only access checks |
| `app/actions/message-logs.ts` | Simple reads |
| `app/actions/tenant-actions.ts` | Single `$transaction` (create + member) |
| `app/api/auth/sign-up/route.ts` | findUnique + count + create |
| `app/api/auth/sign-in/route.ts` | findUnique + update |
| `app/api/auth/setup/route.ts` | count + create |
| `app/api/auth/me/route.ts` | Single findUnique with select |
| `app/api/health/route.ts` | `$queryRawUnsafe('SELECT 1')` |
| `app/api/cron/sync-all-tenants/route.ts` | Simple findMany |
| `app/api/pipelines/[id]/route.ts` | findUnique with include |
| `app/api/mcp/tools/route.ts` | Composite key lookup + findUnique |
| `app/api/ai/diagnose-error/route.ts` | findUnique + composite key access check |
| `app/dashboard/ai-agents/analytics/page.tsx` | Duplicate of analytics (aggregate + groupBy) |

---

## 6. Migration Risk Assessment

### Critical Findings

1. **Missing Models**: `Subscription` and `Invoice` are used in 3 files but not defined in `schema.prisma`. Must be resolved before migration (either add to schema or remove dead code).

2. **Raw SQL**: Only 1 instance (`SELECT 1` in health check) — trivial to port to Drizzle's `sql` template literal.

3. **No `connectOrCreate`**: Not used anywhere — one less complex pattern to worry about.

4. **No nested writes**: No `create` with nested `connect`/`create` — all relationships are managed explicitly with separate queries or transactions.

5. **Composite keys are pervasive**: `userId_tenantId` is used ~25+ times as the primary access pattern for authorization. Drizzle handles this via `and(eq(), eq())` but it's more verbose.

### Key Drizzle Equivalents Needed

| Prisma Pattern | Drizzle Equivalent | Difficulty |
|---------------|-------------------|-----------|
| `findUnique` | `db.query.table.findFirst({ where: eq() })` | Easy |
| `findMany` + pagination | `db.select().from().where().limit().offset()` | Easy |
| `create` | `db.insert().values().returning()` | Easy |
| `update` | `db.update().set().where().returning()` | Easy |
| `delete` | `db.delete().where()` | Easy |
| `count` | `db.select({ count: count() }).from().where()` | Easy |
| `$transaction(async (tx))` | `db.transaction(async (tx) => { ... })` | Easy (same pattern) |
| `$transaction(ops[])` | `db.transaction(async (tx) => { for...await })` | Medium |
| `upsert` | `db.insert().values().onConflictDoUpdate()` | Medium |
| `createMany` + `skipDuplicates` | `db.insert().values([]).onConflictDoNothing()` | Easy |
| `groupBy` + `_count` + `_sum` | `db.select({ count(), sum() }).from().groupBy()` | Medium |
| `aggregate` (`_sum`, `_avg`, `_count`) | `db.select({ sum(), avg(), count() }).from().where()` | Medium |
| `include` (relations) | Drizzle `with` in query mode, or manual joins | Medium |
| `_count` in include | Subquery or separate query | Hard |
| Deep nested include (3+ levels) | Multiple queries or complex joins | Hard |
| `mode: 'insensitive'` | `ilike()` in Drizzle (Postgres) | Easy |
| Nested relation filter (`some`) | `EXISTS` subquery via `sql` or Drizzle subquery | Hard |
| `$queryRawUnsafe` | `db.execute(sql\`...\`)` | Easy |
| `deleteMany` | `db.delete().where()` | Easy |
| `updateMany` | `db.update().set().where()` | Easy |
| `findFirst` | `db.query.table.findFirst()` | Easy |
| Composite unique lookup | `and(eq(col1, val1), eq(col2, val2))` | Easy (verbose) |

### Estimated Migration Scope

- **Total unique Prisma query patterns**: ~35 distinct patterns
- **Total Prisma call sites**: ~180+ across all files
- **Files requiring changes**: ~50
- **High-risk patterns**: 5 (nested relation filters, `_count` in include, deep includes, `groupBy`+`aggregate`, batch upsert transactions)
- **Medium-risk patterns**: 8 (transactions, upserts, composite keys, case-insensitive, IN clause, compound AND/OR, JSON fields, `notIn`)
- **Low-risk patterns**: ~22 (standard CRUD)
