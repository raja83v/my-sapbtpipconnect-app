---
tracker:
  kind: linear
  project_slug: "REPLACE_WITH_LINEAR_PROJECT_SLUG"
  active_states:
    - Todo
    - In Progress
    - Rework
    - Merging
  terminal_states:
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
    - Done
polling:
  interval_ms: 30000
workspace:
  root: $SYMPHONY_WORKSPACE_ROOT
hooks:
  after_create: |
    git clone --depth 1 https://github.com/raja83v/my-sapbtpipconnect-app .
    if command -v corepack >/dev/null 2>&1; then
      corepack enable
    fi
    if ! command -v pnpm >/dev/null 2>&1; then
      echo "pnpm is required before Symphony can prepare this workspace" >&2
      exit 1
    fi
    pnpm install --frozen-lockfile
  before_run: |
    git status --short --branch
  timeout_ms: 600000
agent:
  max_concurrent_agents: 2
  max_turns: 12
  max_retry_backoff_ms: 300000
codex:
  command: codex --config shell_environment_policy.inherit=all --config 'model="gpt-5.5"' --config model_reasoning_effort=high app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
  turn_timeout_ms: 3600000
  read_timeout_ms: 5000
  stall_timeout_ms: 300000
---
You are working unattended on Linear issue `{{ issue.identifier }}` for the CPI Connect repository.

{% if attempt %}
Continuation context:
- This is retry or continuation attempt #{{ attempt }}.
- Resume from the current workspace state. Do not repeat completed investigation unless the current repository state changed.
{% endif %}

Issue context:
- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- Current status: {{ issue.state }}
- Labels: {{ issue.labels }}
- URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Repository operating rules:
1. Work only inside the Symphony-created workspace for this issue.
2. Treat `AGENTS.md` as mandatory repository guidance.
3. Preserve unrelated user changes. Do not reset, revert, or delete work you did not create.
4. Use a branch named `codex/{{ issue.identifier | downcase }}-<short-topic>` unless the issue explicitly requires a different branch.
5. Keep changes scoped to the issue. File follow-up work instead of expanding scope.
6. Prefer existing project patterns: Next.js 16, React 19, pnpm, Drizzle, Radix/shadcn-style components, and the repo's local helpers.

Linear workflow:
1. If the issue is `Todo`, move it to `In Progress` before implementation.
2. Maintain one persistent Linear comment headed `## Codex Workpad`; update that comment instead of posting progress spam.
3. Keep the workpad current with plan, acceptance criteria, validation, notes, blockers, branch, commit, and PR evidence.
4. If the issue is `Human Review`, do not code. Poll for review decisions only.
5. If the issue is `Rework`, re-read all issue and PR feedback, update the plan, and address every actionable item.
6. If the issue is `Merging`, merge only after checks and approvals satisfy the repository policy, then move the issue to `Done`.

Implementation expectations:
1. Reproduce or inspect the current behavior before changing code.
2. Update the workpad with the reproduction signal and the implementation plan before edits.
3. Run the narrowest useful validation first, then broader checks when risk warrants it.
4. For app-touching changes, validate at least:
   - `pnpm lint`
   - `pnpm build` when the change affects runtime, routing, data access, or shared UI
   - a focused manual browser check when the change affects user-visible UI
5. For database changes, include Drizzle migration generation or migration notes as appropriate.
6. For environment/config changes, update `.env.example` or docs without exposing secrets.

Handoff requirements:
1. Commit logically grouped changes.
2. Push the branch and open or update a pull request.
3. Link the PR to the Linear issue and add a `symphony` label to the PR when possible.
4. Before moving to `Human Review`, verify all required validation is complete, PR checks are green or documented, and outstanding review comments are resolved or explicitly answered.
5. Final response should contain only completed actions, validation evidence, PR/commit references, and blockers.
