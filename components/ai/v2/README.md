# AI Agents V2 - Component Structure

This directory contains the redesigned AI Agent components with specialized task-focused UIs.

## Directory Structure

```
components/ai/v2/
├── README.md                           # This file
├── shared/                             # Shared components
│   ├── agent-card.tsx                  # ✅ Agent card for listing
│   ├── severity-badge.tsx              # ✅ Severity indicator
│   ├── recommendation-card.tsx         # Recommendation display
│   ├── action-button.tsx               # Action buttons
│   └── empty-state.tsx                 # Empty state component
├── general-assistant/                  # Chat-based general AI
│   ├── chat-interface.tsx              # Main chat interface
│   ├── message-list.tsx                # Message display
│   └── chat-input.tsx                  # Input with suggestions
└── specialized/                        # Task-focused UIs
    ├── error-diagnostician/            # ✅ COMPLETE REFERENCE
    │   ├── error-diagnostician.tsx     # Main component
    │   ├── error-list.tsx              # Error selection
    │   ├── diagnosis-view.tsx          # Analysis display
    │   └── solution-card.tsx           # Solution recommendations
    ├── performance-optimizer/          # TODO
    │   └── performance-optimizer.tsx
    ├── smart-monitor/                  # TODO
    │   └── smart-monitor.tsx
    ├── security-auditor/               # TODO
    │   └── security-auditor.tsx
    ├── cost-analyzer/                  # TODO
    │   └── cost-analyzer.tsx
    ├── iflow-creator/                  # TODO
    │   └── iflow-creator.tsx
    ├── documentation-generator/        # TODO
    │   └── documentation-generator.tsx
    ├── test-case-generator/            # TODO
    │   └── test-case-generator.tsx
    └── predictive-insights/            # TODO
        └── predictive-insights.tsx
```

## Implementation Status

### ✅ Complete
- Shared components (agent-card, severity-badge)
- Error Diagnostician (full reference implementation)
- Agent type definitions
- Main routing structure

### 🚧 In Progress
- General AI Assistant
- Performance Optimizer
- Smart Monitor

### ⏳ Planned
- Security Auditor
- Cost Analyzer
- iFlow Creator
- Documentation Generator
- Test Case Generator
- Predictive Insights

## Usage

Each specialized agent is a self-contained component that can be imported and used independently:

```tsx
import { ErrorDiagnostician } from "@/components/ai/v2/specialized/error-diagnostician/error-diagnostician";

<ErrorDiagnostician tenantId={tenantId} iflowId={iflowId} />
```

## Design Principles

1. **Task-Focused**: Each agent has a custom UI optimized for its specific workflow
2. **Self-Contained**: Agents manage their own state and data fetching
3. **Consistent**: All agents follow the same design system and patterns
4. **Accessible**: WCAG 2.1 AA compliant
5. **Responsive**: Mobile-first design