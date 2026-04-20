# CPI Connect: Dual-Mode (Open Source + Cloud SaaS) Implementation Plan

## Context

CPI Connect has been migrated from SaaS (Convex+Clerk+Stripe) to self-hosted (Supabase Auth+Prisma+PostgreSQL). All billing, Stripe, and usage-limit code was deleted. The app is now purely open-source with no feature gating. The user wants to make it **dual-mode**: free self-hosted open-source AND paid cloud SaaS, from a **single codebase** using an environment toggle (`DEPLOYMENT_MODE=cloud|self-hosted`).

**Decisions:**
- **Tiers (cloud):** Starter ($299/mo), Professional ($899/mo), Enterprise (custom)
- **Gating:** Usage limits only (tenants, iFlows, AI calls/month, team members) — all features accessible on every tier
- **Landing page:** Unified page with Cloud/Self-Hosted toggle showing both pricing and self-hosted options

**Current state:** Supabase Auth working, 12 Prisma models (no billing models), landing page is open-source only, auth pages are simple Cards (sign-in/sign-up already have two-panel layout per system reminders), reset-password.tsx is BROKEN (imports non-existent `@/lib/auth-client`), stale "HagenKit" branding in ~26 files.

---

## Phase 1: Deployment Mode Infrastructure

### New files

**`lib/deployment.ts`** — Foundation toggle
- Export `getDeploymentMode()`, `isCloudMode()`, `isSelfHostedMode()`
- Reads `NEXT_PUBLIC_DEPLOYMENT_MODE` (client+server) with `self-hosted` default

**`lib/plans.ts`** — Plan tier config
- Export `PlanType = "starter" | "professional" | "enterprise" | "self-hosted"`
- Export `PLANS` record with limits per tier:
  - Starter: 2 tenants, 50 iFlows, 100 AI calls/mo, 5 members
  - Professional: 10 tenants, unlimited iFlows, 1000 AI calls/mo, 20 members
  - Enterprise: all unlimited
  - Self-hosted: all unlimited
- Each plan has: name, description, priceMonthly (cents), stripePriceId, limits, features[]

**`hooks/use-deployment-mode.ts`** — Client hook
- Returns `{ isCloud, isSelfHosted, mode }`

### Modified files

**`.env`** — Add `NEXT_PUBLIC_DEPLOYMENT_MODE=self-hosted` and commented-out Stripe vars
**`.env.example`** — Document all new vars

---

## Phase 2: Database Schema

### Modified: `prisma/schema.prisma`

Add 3 models + 3 enums:

```
Subscription (userId @unique, planType, status, stripeCustomerId, stripeSubscriptionId,
              stripePriceId, currentPeriodStart/End, cancelAtPeriodEnd, canceledAt)
Invoice      (subscriptionId, stripeInvoiceId, amount, currency, status, paidAt, periodStart/End)
UsageRecord  (subscriptionId, periodStart, periodEnd, aiCallsUsed)
             @@unique([subscriptionId, periodStart])

enum PlanType { starter, professional, enterprise }
enum SubscriptionStatus { ACTIVE, PAST_DUE, CANCELED, UNPAID, TRIALING, INCOMPLETE }
enum InvoiceStatus { PENDING, PAID, FAILED, VOID }
```

Add `subscription Subscription?` relation to User model.

Run: `pnpm prisma migrate dev --name add-billing-models`

---

## Phase 3: Stripe Integration (cloud mode only)

### Install: `pnpm add stripe`

### New files

**`lib/stripe.ts`** — Stripe client singleton, guarded by `isCloudMode()` check

**`app/api/billing/checkout/route.ts`** — POST: accepts `planType`, creates Stripe Checkout session with correct price ID, returns checkout URL. Guards with `isCloudMode()`.

**`app/api/billing/portal/route.ts`** — POST: creates Stripe Customer Portal session for managing subscription. Returns portal URL.

**`app/api/billing/webhook/route.ts`** — POST: handles Stripe webhook events:
- `checkout.session.completed` → create Subscription + UsageRecord in Prisma
- `customer.subscription.updated` → update planType, status, period dates
- `customer.subscription.deleted` → mark CANCELED
- `invoice.paid` → create Invoice record
- `invoice.payment_failed` → mark FAILED, subscription PAST_DUE

Raw body parsing for webhook signature verification.

---

## Phase 4: Usage Limit Enforcement

### New: `lib/billing.ts`

Core functions (all return `{ allowed: true }` in self-hosted mode):
- `getUserSubscription(userId)` → returns `UserSubscriptionInfo` (planType, limits, current usage counts)
- `checkTenantLimit(userId)` → checks tenant count vs plan limit
- `checkAICallLimit(userId)` → checks monthly AI calls vs plan limit
- `checkMemberLimit(userId)` → checks team member count vs plan limit
- `incrementAIUsage(userId)` → upserts UsageRecord, increments aiCallsUsed

### Modified server actions (inject limit checks)

| File | Function | Check |
|------|----------|-------|
| `app/actions/ai-agents.ts` | `executeAgent` | `checkAICallLimit` before execution, `incrementAIUsage` after success |
| `app/actions/ai-agents-v2.ts` | agent execution functions | Same pattern |
| `app/actions/cost-analyzer.ts` | `analyzeCostsWithAI` | `checkAICallLimit` + `incrementAIUsage` |
| `app/actions/documentation-generator.ts` | `generateDocumentation` | `checkAICallLimit` + `incrementAIUsage` |
| `app/actions/test-case-generator.ts` | `generateTestCases` | `checkAICallLimit` + `incrementAIUsage` |
| `app/actions/iflow-creator.ts` | AI-related functions | `checkAICallLimit` + `incrementAIUsage` |
| `app/actions/iflow-orchestrator.ts` | pipeline execution | `checkAICallLimit` + `incrementAIUsage` |
| `app/actions/tenant.ts` | `createTenant` | `checkTenantLimit` |
| `app/actions/tenant-invitations.ts` | `inviteMember` | `checkMemberLimit` (check tenant owner's plan) |

Pattern: After auth check, before main operation:
```typescript
const limitCheck = await checkAICallLimit(currentUser.id);
if (!limitCheck.allowed) return { success: false, error: `AI call limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan.` };
```

---

## Phase 5: Landing Page (Dual-Mode)

### New: `components/marketing/pricing-section.tsx`

Toggle component with Cloud/Self-Hosted tabs:
- **Cloud tab:** 3 pricing cards (Starter, Professional with "Most Popular" badge, Enterprise)
- **Self-Hosted tab:** Single card with "Free Forever" + Docker/GitHub CTAs
- Uses `PLANS` from `lib/plans.ts`, shadcn Card/Badge components

### Modified: `app/(marketing)/page.tsx`

1. Insert `<PricingSection />` between "Why Open Source?" and testimonials
2. Rename "Why Open Source?" to "Why CPI Connect?" — make copy inclusive of both modes
3. Hero subtitle: "Cloud hosted or self-hosted · Always open source"
4. CTA section: Add "View Pricing" button alongside "Get Started" and GitHub

### Modified: `components/marketing/header.tsx`

Add "Pricing" to NavMenu and mobileLinks

### Modified: `components/marketing/footer.tsx`

Add "Pricing" link to Product group

---

## Phase 6: Billing UI Components

### New files (all `components/billing/`)

| Component | Purpose |
|-----------|---------|
| `pricing-cards.tsx` | Reusable 3-card pricing grid (used on landing + onboarding) |
| `subscription-status.tsx` | Current plan badge, next billing date, cancel warning |
| `usage-progress.tsx` | Progress bars per limit (green/yellow/red thresholds) |
| `billing-content.tsx` | Full billing settings tab: status + usage + "Change Plan" / "View Invoices" buttons |
| `limit-reached-banner.tsx` | Alert banner when limit at/near capacity, upgrade CTA |

### Modified files

**`components/settings/settings-navigation.tsx`** — Add "Billing" tab with `IconCreditCard`, conditionally rendered when `isCloud`

**`components/settings/settings-content.tsx`** — Render `<BillingContent>` when `activeSection === "billing" && isCloud`

**`components/nav-user.tsx`** — Add "Billing & Plans" dropdown item (cloud mode only), links to `/dashboard/settings?section=billing`

---

## Phase 7: Dashboard Updates

### New: `components/dashboard/usage-summary-card.tsx`

Card showing plan badge + usage progress bars. Only rendered in cloud mode.

### Modified files

**`app/actions/dashboard.ts`** — Add `subscription?: UserSubscriptionInfo` to `DashboardData`, call `getUserSubscription()` in `getDashboardData()`

**`app/dashboard/page.tsx`** — Conditionally render `<LimitReachedBanner>` and `<UsageSummaryCard>` when cloud mode

**`components/dashboard/ai-agent-usage.tsx`** — In cloud mode, show "X / Y AI calls remaining this month" at bottom

---

## Phase 8: Onboarding Updates

### New: `components/onboarding/plan-selection-step.tsx`

Renders `<PricingCards>` with onSelect callback. Enterprise shows "Contact Sales".

### Modified: `components/onboarding/onboarding-flow-cpi.tsx`

- Cloud mode: 4 steps (Profile → Plan → Tenant → Complete)
- Self-hosted: 3 steps (Profile → Tenant → Complete, current flow)
- On plan selection in cloud mode, store selectedPlan, trigger Stripe checkout
- Fix stale content: replace "HagenKit"/"Codehagen" references with CPI Connect branding
- Replace "Transform any website with AI" testimonial quote with SAP CPI-relevant copy

### Modified: `app/actions/onboarding.ts`

Add `selectedPlan` to OnboardingData. In cloud mode, create Subscription record.

---

## Phase 9: Auth Pages — Fix Broken + Rebrand

### Critical fix: `components/auth/reset-password.tsx`

1. Remove broken `import { authClient } from "@/lib/auth-client"` (file doesn't exist)
2. Replace with `import { createClient } from "@/lib/supabase/client"`
3. Replace `authClient.resetPassword()` with `supabase.auth.updateUser({ password })`
4. Remove token-based logic (Supabase handles this via session after callback)
5. Replace `IconInnerShadowTop` with `Cloud` icon
6. Replace "HagenKit" (lines 137, 316) with "CPI Connect"
7. Use `<AuthBrandPanel>` for left panel

### Minor: `components/auth/sign-up-form.tsx`

Pass `?plan=X` query param through to onboarding redirect if present from pricing CTA.

---

## Phase 10: Cleanup & Bug Fixes

### "HagenKit" → "CPI Connect" bulk rebrand (~26 files)

**User-facing priority:**
- `components/dashboard/empty-state-pro.tsx` — Rewrite to use `useDeploymentMode()`, link to billing settings
- `emails/templates/welcome-email.tsx` — Update stale "billing" copy
- `content/legal/terms.mdx` — Replace all HagenKit references
- `content/legal/privacy.mdx` — Replace all HagenKit references
- `content/help/what-is-hagenkit.mdx` — Rename + rewrite
- `content/blog/welcome-to-hagenkit.mdx` — Update or remove
- `components/blog/blog-layout-hero.tsx` — Replace HagenKit
- `app/(marketing)/help/page.tsx` — Replace HagenKit

### Stale auth files (verify deletion)

Confirm `lib/auth/jwt.ts`, `lib/auth/password.ts`, `lib/auth/session.ts` are already deleted. If present, delete them.

### Package cleanup

Verify `jose` and `bcryptjs` are removed from package.json (they appear to already be gone based on current state — confirm).

### Build verification

```bash
NEXT_PUBLIC_DEPLOYMENT_MODE=self-hosted pnpm build   # self-hosted mode
NEXT_PUBLIC_DEPLOYMENT_MODE=cloud pnpm build          # cloud mode
```

---

## Implementation Batches

| Batch | Phases | Description |
|-------|--------|-------------|
| **A** | 1 + 2 | Foundation: deployment toggle + Prisma schema |
| **B** | 3 + 4 | Backend billing: Stripe + usage limits |
| **C** | 5 + 6 | Frontend billing: landing page + billing UI |
| **D** | 7 + 8 | Integration: dashboard + onboarding |
| **E** | 9 + 10 | Polish: auth fixes + HagenKit rebrand + build check |

## New Files Summary (16)

`lib/deployment.ts`, `lib/plans.ts`, `lib/stripe.ts`, `lib/billing.ts`, `hooks/use-deployment-mode.ts`, `app/api/billing/checkout/route.ts`, `app/api/billing/portal/route.ts`, `app/api/billing/webhook/route.ts`, `components/marketing/pricing-section.tsx`, `components/billing/pricing-cards.tsx`, `components/billing/subscription-status.tsx`, `components/billing/usage-progress.tsx`, `components/billing/billing-content.tsx`, `components/billing/limit-reached-banner.tsx`, `components/onboarding/plan-selection-step.tsx`, `components/dashboard/usage-summary-card.tsx`

## Modified Files Summary (~30)

`prisma/schema.prisma`, `.env`, `.env.example`, `lib/config.ts`, `middleware.ts` (add billing routes to public), `app/(marketing)/page.tsx`, `components/marketing/header.tsx`, `components/marketing/footer.tsx`, `components/settings/settings-navigation.tsx`, `components/settings/settings-content.tsx`, `components/nav-user.tsx`, `app/dashboard/page.tsx`, `app/actions/dashboard.ts`, `components/dashboard/ai-agent-usage.tsx`, `components/onboarding/onboarding-flow-cpi.tsx`, `app/actions/onboarding.ts`, `components/auth/reset-password.tsx`, `components/auth/sign-up-form.tsx`, `components/dashboard/empty-state-pro.tsx`, `emails/templates/welcome-email.tsx`, `app/actions/ai-agents.ts`, `app/actions/ai-agents-v2.ts`, `app/actions/cost-analyzer.ts`, `app/actions/documentation-generator.ts`, `app/actions/test-case-generator.ts`, `app/actions/iflow-creator.ts`, `app/actions/iflow-orchestrator.ts`, `app/actions/tenant.ts`, `app/actions/tenant-invitations.ts`, plus ~8 content/blog files for HagenKit rebrand
