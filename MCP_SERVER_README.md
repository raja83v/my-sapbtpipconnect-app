# SAP CPI MCP Server Implementation

## Overview

The MCP (Model Context Protocol) server provides AI-powered tools for interacting with SAP Cloud Platform Integration. These tools enable the AI assistant to fetch real-time data, analyze configurations, and execute actions on SAP CPI tenants.

---

## Recent Updates (Dec 2025)
- Tool registry, executor, and handlers refactored for clarity and reliability
- All tool schemas now use Zod for strict validation
- Action tools (deploy, restart, create, undeploy) require confirmation and support audit logging
- Caching and rate limiting are enforced per tool and user
- AI agent actions now use real tool calls (see `app/actions/ai-agents-tools.ts`)
- UI components for tool execution visualization and confirmation dialogs are integrated
- See `components/ai/tool-execution-display.tsx` and `components/ai/action-confirmation-dialog.tsx`
- API route `/api/mcp/tools` supports listing and executing tools
- All tools are documented in `mcp-server/src/tools/registry.ts`

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        AI Assistant                              │
│  (Vercel AI SDK with Google Gemini 2.5 Flash)                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent Actions                              │
│  (app/actions/ai-agents-tools.ts)                               │
│  - Creates tools for each AI agent type                          │
│  - Builds context from Convex database                           │
│  - Handles tool execution with rate limiting & caching           │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Server                                   │
│  (mcp-server/src/)                                               │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐         │
│  │ Tool        │  │ Tool         │  │ Tool           │         │
│  │ Registry    │  │ Executor     │  │ Handlers       │         │
│  └─────────────┘  └──────────────┘  └────────────────┘         │
│         │               │                    │                  │
│         └───────────────┼────────────────────┘                  │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────────┐  │
│  │                    Utilities                              │  │
│  │  - Cache Manager (30-60s TTL)                            │  │
│  │  - Rate Limiter (per-user, per-tool)                     │  │
│  │  - Confirmation Manager (for destructive ops)             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SAP CPI Client                                │
│  (lib/sap-cpi/client.ts)                                        │
│  - OAuth 2.0 / Basic Auth                                        │
│  - All SAP CPI OData APIs                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool List & Schemas

See `mcp-server/src/tools/registry.ts` for all available tools and their Zod schemas. Each tool is strictly validated and documented. Categories include:
- Monitoring (message logs, error info, run steps)
- iFlow (CRUD, config, performance)
- Package (list, details, create)
- Action (deploy, restart, create, undeploy)
- Analytics (stats, trends, metrics)

---

## Integration Points

- **AI Agent Actions:** `app/actions/ai-agents-tools.ts` (tool-enabled chat, confirmation, caching)
- **API Route:** `app/api/mcp/tools/route.ts` (REST endpoint for tool execution)
- **AI Tools Library:** `lib/ai/tools.ts` (Vercel AI SDK integration)
- **UI Components:** `components/ai/tool-execution-display.tsx`, `components/ai/action-confirmation-dialog.tsx`

---

## Caching & Rate Limiting
- Monitoring tools: 30s TTL
- iFlow/package tools: 60s TTL
- Action tools: No cache
- Read ops: 30 req/min; Action ops: 5 req/min

---

## Security & Audit
- Clerk authentication required
- Tenant membership checked before execution
- Confirmation required for destructive actions
- All executions logged for audit

---

## Usage Examples

### Error Diagnostician
```
User: "What's causing the errors in my ORDER_PROCESSING iFlow?"
AI uses tools:
1. get_message_logs(iFlowId: "ORDER_PROCESSING", status: "FAILED", limit: 20)
2. get_error_info(messageGuid: "...")
AI Response: "I found 15 failed messages in the last 24 hours. The primary error is..."
```

### Performance Optimizer
```
User: "How can I improve performance of my API_GATEWAY iFlow?"
AI uses tools:
1. get_iflow_config(iFlowId: "API_GATEWAY")
2. get_iflow_performance(iFlowId: "API_GATEWAY", daysBack: 7)
AI Response: "Based on the configuration and performance data, I recommend..."
```

### Smart Monitor
```
User: "Give me a status update on all iFlows"
AI uses tools:
1. list_iflows()
2. get_tenant_overview()
3. get_error_trends(daysBack: 7)
AI Response: "Tenant Overview: 45 iFlows deployed, 42 healthy, 3 with errors..."
```

---

## Next Steps
- UI polish: streaming tool results, compact summaries, error handling
- Advanced analytics: multi-step tool workflows
- Add more tests and documentation

---

For full details, see:
- `mcp-server/src/tools/registry.ts` (tool definitions)
- `mcp-server/src/executor.ts` (execution logic)
- `mcp-server/src/types.ts` (schemas/types)
- `app/actions/ai-agents-tools.ts` (AI agent integration)
- `components/ai/tool-execution-display.tsx` (tool visualization)
- `components/ai/action-confirmation-dialog.tsx` (confirmation UI)
