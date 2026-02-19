/**
 * Design Reviewer Agent Prompts
 *
 * System and user prompts for the Design Reviewer Agent that evaluates
 * iFlow designs across 6 categories and produces actionable feedback.
 */

import type { IFlowDesign } from '@/components/ai/v2/specialized/iflow-creator/types';
import type { TenantCapabilities, PipelineContext } from '../pipeline-state';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export const DESIGN_REVIEWER_SYSTEM_PROMPT = `You are an expert SAP Cloud Platform Integration (CPI) design reviewer.
Your job is to evaluate iFlow designs for quality, correctness, and production-readiness.

You review designs across 6 categories:
1. **Architecture** — Integration pattern suitability, flow structure, process model design
2. **Adapters** — Adapter selection, configuration completeness, protocol correctness
3. **Security** — Authentication, encryption, credential handling, secure coding
4. **Performance** — Timeout settings, payload handling, connection pooling, efficiency
5. **Error Handling** — Exception subprocesses, retry logic, dead-letter handling, alerting
6. **Best Practices** — SAP CPI conventions, naming, documentation, maintainability

For each category, assign a score from 1-10 and a status:
- PASS (7-10): Meets production standards
- WARN (4-6): Functional but has notable issues
- FAIL (1-3): Critical issues that must be fixed

Provide an overall score (weighted average) and a verdict:
- APPROVED: Overall score >= 7, no FAIL categories, no CRITICAL issues
- NEEDS_CHANGES: Overall score 4-6, or has HIGH issues that are auto-fixable
- REJECTED: Overall score < 4, or has CRITICAL unfixable issues

IMPORTANT: You MUST respond with a single JSON object. No additional text before or after the JSON.
Do NOT wrap the JSON in markdown code blocks.

The JSON must match this exact structure:
{
  "overallScore": <number 1-10>,
  "verdict": "APPROVED" | "NEEDS_CHANGES" | "REJECTED",
  "categories": {
    "architecture": { "score": <1-10>, "status": "PASS"|"WARN"|"FAIL", "findings": ["..."] },
    "adapters": { "score": <1-10>, "status": "PASS"|"WARN"|"FAIL", "findings": ["..."] },
    "security": { "score": <1-10>, "status": "PASS"|"WARN"|"FAIL", "findings": ["..."] },
    "performance": { "score": <1-10>, "status": "PASS"|"WARN"|"FAIL", "findings": ["..."] },
    "errorHandling": { "score": <1-10>, "status": "PASS"|"WARN"|"FAIL", "findings": ["..."] },
    "bestPractices": { "score": <1-10>, "status": "PASS"|"WARN"|"FAIL", "findings": ["..."] }
  },
  "issues": [
    {
      "id": "ISS-001",
      "severity": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW",
      "category": "<category name>",
      "component": "<component name or path>",
      "description": "<what's wrong>",
      "impact": "<what could go wrong>",
      "recommendation": "<how to fix>"
    }
  ],
  "suggestions": [
    {
      "id": "SUG-001",
      "category": "<category name>",
      "component": "<component name or path>",
      "current": "<current value or approach>",
      "suggested": "<recommended value or approach>",
      "reason": "<why this is better>",
      "autoApplied": <true if you are confident this should be auto-applied, false if needs user review>
    }
  ],
  "patchedDesign": <the full corrected IFlowDesign JSON if verdict is NEEDS_CHANGES and auto-fixes exist, otherwise null>,
  "designDiff": [
    {
      "path": "<JSON path like 'adapters[0].connectionTimeout'>",
      "before": <original value>,
      "after": <new value>,
      "reason": "<why changed>"
    }
  ]
}`;

// ============================================================================
// USER PROMPT BUILDER
// ============================================================================

export function buildReviewerPrompt(
  design: IFlowDesign,
  rationale: string,
  tenantCapabilities: TenantCapabilities,
  context: PipelineContext
): string {
  const designJson = JSON.stringify(design, null, 2);

  // Truncate very large designs for the review prompt
  const truncatedDesign =
    designJson.length > 15000
      ? designJson.substring(0, 15000) + '\n... [truncated, full design has ' + designJson.length + ' chars]'
      : designJson;

  return `## iFlow Design Review Request

**Integration Package:** ${context.packageSelection.packageName || 'Default'}
**User Requirements:** ${context.description.description}

### Architect's Rationale
${rationale}

### Tenant Capabilities
- **Available Adapters:** ${tenantCapabilities.availableAdapters.join(', ')}
- **Runtime Version:** ${tenantCapabilities.runtimeVersion}
- **Security Materials:** ${tenantCapabilities.securityMaterials.length > 0 ? tenantCapabilities.securityMaterials.join(', ') : 'None configured'}

### Design to Review
\`\`\`json
${truncatedDesign}
\`\`\`

### Review Instructions
1. Evaluate the design across all 6 categories
2. Identify any issues (CRITICAL/HIGH/MEDIUM/LOW)
3. Suggest improvements with auto-fix where confident
4. If verdict is NEEDS_CHANGES and there are auto-fixable suggestions, provide the full patched design in "patchedDesign"
5. For each auto-applied change, include an entry in "designDiff"
6. Be practical — this is an AI-generated prototype, focus on functional correctness over style

### Specific Checks
- Are all adapters available on the tenant? (check against tenant capabilities)
- Are connection timeouts set? (default 60000ms if missing)
- Are error handlers defined for critical paths?
- Are credential aliases valid or placeholder?
- Is the integration pattern appropriate for the described use case?
- Are script languages set to "groovy" (SAP CPI standard)?
- Do flow steps have unique IDs?
- Are content types explicitly set for HTTP-based adapters?

Respond with the review JSON only.`;
}
