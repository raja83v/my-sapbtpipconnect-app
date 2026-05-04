# Symphony Setup

This repository is prepared for the OpenAI Symphony reference implementation with the repo-owned workflow in `WORKFLOW.md`.

Symphony itself is not vendored into this app. Run the upstream Elixir service from a separate checkout and point it at this repository's `WORKFLOW.md`.

## Prerequisites

- Linear personal API key with access to the project Symphony should monitor.
- Linear project slug for the project to monitor.
- Git access to `https://github.com/raja83v/my-sapbtpipconnect-app`.
- Codex CLI available as `codex` and authenticated.
- Node.js 20+ and `pnpm` available in the environment where Symphony creates workspaces.
- Elixir/Erlang managed by `mise`, as recommended by the Symphony reference implementation.

On Windows, run Symphony from WSL or another shell environment that supports `bash`, `git`, `mise`, and `pnpm`. The upstream runner launches hooks through a shell command and is not intended to be a native PowerShell service.

## One-time repository configuration

1. Open `WORKFLOW.md`.
2. Replace `REPLACE_WITH_LINEAR_PROJECT_SLUG` with your Linear project slug.
   - In Linear, open the project, copy its URL, and use the slug segment from the URL.
3. Review `agent.max_concurrent_agents`.
   - The current default is `2` to avoid overloading local CPU, lockfiles, or API limits.
4. Confirm the clone URL in `hooks.after_create` is correct for your preferred remote.
   - Use SSH instead if your machine authenticates GitHub through SSH.

## Run Symphony

From a workspace outside this app repository:

```bash
git clone https://github.com/openai/symphony.git
cd symphony/elixir
mise trust
mise install
mise exec -- mix setup
mise exec -- mix build
```

Set the runtime environment:

```bash
export LINEAR_API_KEY="<your-linear-token>"
export SYMPHONY_WORKSPACE_ROOT="$HOME/code/cpi-connect-symphony-workspaces"
```

Start the service without the dashboard:

```bash
mise exec -- ./bin/symphony /mnt/c/Users/rvelayuthanp/Documents/Projects/droid/my-sapcpipconnect-app/WORKFLOW.md
```

Start it with the Phoenix dashboard:

```bash
mise exec -- ./bin/symphony /mnt/c/Users/rvelayuthanp/Documents/Projects/droid/my-sapcpipconnect-app/WORKFLOW.md --port 4000
```

Then open `http://localhost:4000` for runtime state, or inspect JSON at `http://localhost:4000/api/v1/state`.

## Operational flow

1. Symphony polls Linear for issues in `Todo`, `In Progress`, `Rework`, or `Merging`.
2. For each eligible issue, it creates a workspace under `$SYMPHONY_WORKSPACE_ROOT`.
3. The `after_create` hook clones this repository and runs `pnpm install --frozen-lockfile`.
4. Symphony starts `codex app-server` in that workspace.
5. Codex follows the issue prompt in `WORKFLOW.md`, updates Linear, implements the change, validates it, pushes a PR, and moves the issue through the configured workflow.

## Useful commands

Run the app checks manually inside a Symphony-created issue workspace:

```bash
pnpm lint
pnpm build
pnpm dev
```

Run Symphony with a custom log directory:

```bash
mise exec -- ./bin/symphony /path/to/WORKFLOW.md --logs-root "$HOME/code/symphony-logs"
```

## Troubleshooting

- `tracker.project_slug is required`: replace the placeholder in `WORKFLOW.md`.
- `LINEAR_API_KEY missing`: export `LINEAR_API_KEY` in the shell that starts Symphony.
- `pnpm is required`: install pnpm or enable Corepack in the Symphony host environment.
- Git clone fails: switch `hooks.after_create` to an SSH clone URL or fix GitHub credentials.
- Codex does not start: run `codex app-server` manually from a cloned workspace and confirm Codex is authenticated.
- Workspaces are created in the wrong location: set `SYMPHONY_WORKSPACE_ROOT` to an absolute path before starting Symphony.
