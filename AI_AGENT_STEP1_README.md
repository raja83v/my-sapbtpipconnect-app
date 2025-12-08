# AI Agent Implementation - Step 1: Intelligent Error Diagnosis

## Overview
This implementation adds AI-powered error diagnosis to CPI Connect using Vercel AI SDK and Claude 3.5 Sonnet.

## What Was Implemented

### 1. Core AI Infrastructure
- **`lib/ai/client.ts`**: AI model configuration (Claude 3.5 Sonnet & Haiku)
- **`lib/ai/prompts.ts`**: System prompts for SAP CPI error analysis
- **`lib/ai/types.ts`**: TypeScript interfaces for AI features

### 2. Server Action
- **`app/actions/iflows.ts`**: Added `diagnoseExecutionError()` function
  - Fetches execution details with full context (payloads, error messages, metadata)
  - Streams AI-generated diagnosis using React Server Actions
  - Enforces multi-tenant security with session validation
  - Truncates payloads to 10KB to avoid token limits

### 3. UI Components
- **`components/ai/error-explainer.tsx`**: Client component for AI diagnosis
  - "Explain Error with AI" button with sparkle icon
  - Real-time streaming of AI responses
  - Markdown rendering with syntax highlighting
  - Loading states and error handling

- **`components/dashboard/message-logs-table.tsx`**: Enhanced message logs
  - Expandable rows showing full error details
  - Request/response payload viewer
  - Integrated ErrorExplainer component for failed messages
  - Visual distinction for failed executions (red background)

## How It Works

### User Flow
1. User navigates to an iFlow detail page (`/dashboard/iflows/[id]`)
2. Clicks on any message row to expand details
3. For failed messages, sees error details and "Explain Error with AI" button
4. Clicks the button to trigger AI analysis
5. Receives real-time streaming diagnosis with:
   - Root cause identification
   - Detailed technical analysis
   - Recommended fixes
   - Prevention strategies

### Technical Flow
```
User clicks "Explain Error"
  ↓
ErrorExplainer.tsx calls diagnoseExecutionError(executionId)
  ↓
Server action fetches execution from database
  ↓
Validates user has access to tenant
  ↓
Builds context (error, payloads, metadata)
  ↓
Streams AI response via streamText()
  ↓
Client receives chunks via readStreamableValue()
  ↓
UI updates in real-time with markdown rendering
```

## Configuration Required

### Environment Variables
Add to `.env`:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Get your API key from: https://console.anthropic.com/

### Dependencies Installed
- `ai`: Vercel AI SDK core (v5.0.102)
- `@ai-sdk/anthropic`: Anthropic provider (v2.0.49)
- `react-markdown`: Markdown rendering (v10.1.0)

## Security Features

✅ **Multi-tenant isolation**: Validates user access to tenant before processing  
✅ **Session validation**: Requires authenticated user  
✅ **Payload truncation**: Limits context to 10KB to prevent token abuse  
✅ **No data persistence**: AI analysis is not stored (stateless)

## Cost Considerations

### Token Usage per Diagnosis
- **Input**: ~2,000-3,000 tokens (context + error + payloads)
- **Output**: ~500-1,000 tokens (diagnosis)
- **Cost**: ~$0.01-0.02 per analysis (Claude 3.5 Sonnet pricing)

### Recommended Usage
- Use for critical production errors
- Consider caching similar errors (future enhancement)
- Set rate limits if needed (not yet implemented)

## Files Modified

### New Files
```
lib/ai/
  ├── client.ts
  ├── prompts.ts
  └── types.ts

components/ai/
  └── error-explainer.tsx
```

### Modified Files
```
app/actions/iflows.ts          # Added diagnoseExecutionError + imports
components/dashboard/message-logs-table.tsx  # Added expandable rows + AI integration
.env                            # Added ANTHROPIC_API_KEY
package.json                    # New dependencies
```

## Testing Instructions

### 1. Set API Key
```bash
# Add to .env file
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Start Development Server
```bash
pnpm dev
```

### 3. Test the Feature
1. Navigate to `/dashboard/iflows`
2. Click on any iFlow
3. Click on a failed message row to expand
4. Click "Explain Error with AI"
5. Watch the AI diagnosis stream in real-time

### 4. Test with Mock Data
If you don't have real SAP CPI errors yet, you can test by:
1. Creating a test execution in the database with:
   - `status: "FAILED"`
   - `errorMessage: "Mapping error: Invalid namespace..."`
   - `requestPayload: "<xml>...</xml>"`

## Known Limitations

### Current Implementation
- ❌ Error messages from SAP API may not always be detailed
- ❌ Payloads require expanded rows (not fetched by default)
- ❌ No caching of similar error patterns
- ❌ No rate limiting implemented
- ❌ No audit logging of AI usage

### SAP CPI API Constraints
The current `getMessageLogs()` function doesn't fetch:
- Full error details (only basic status)
- Request/response payloads (requires separate API call per message)
- Error categories (would need classification logic)

**Workaround**: The AI can still analyze based on:
- Error status codes
- Execution duration patterns
- Sender/receiver context
- Integration flow metadata

### Future Enhancements (Not in Scope)
- Batch error analysis
- Error pattern caching
- Automatic severity classification
- Integration with Slack/Teams notifications
- Historical error comparison

## Next Steps (Step 2-4)

According to the roadmap:
- **Step 2**: Natural Language Search Agent
- **Step 3**: Proactive Monitoring Agent  
- **Step 4**: AI-Powered Analytics Dashboard

## Troubleshooting

### "Unauthorized" Error
- Verify user is logged in
- Check session is valid
- Ensure user is member of the tenant

### "Execution not found"
- Verify execution ID exists in database
- Check user has access to the tenant

### API Rate Limits
- Anthropic rate limits: 50 requests/min (Tier 1)
- Implement caching if hitting limits
- Consider using Haiku model for faster responses

### Streaming Not Working
- Ensure React 19 is installed
- Check browser console for errors
- Verify `ai/rsc` import is correct

## Architecture Decisions

### Why Claude 3.5 Sonnet?
- Superior reasoning for complex SAP integration errors
- Better context understanding (200K token window)
- High accuracy for technical diagnostics
- Supports streaming for real-time UX

### Why Server Actions vs API Routes?
- Simpler authentication (reuses Better Auth session)
- Type-safe end-to-end
- Better integration with Next.js App Router
- Automatic error handling

### Why Streaming?
- Better UX (user sees progress immediately)
- Reduces perceived latency
- Allows for interactive experiences
- Standard pattern for AI chat interfaces

## Performance Metrics

### Expected Response Times
- Database query: ~50-100ms
- AI streaming start: ~500-1000ms
- Full response: ~3-5 seconds
- Total user wait: ~4-6 seconds

### Optimization Opportunities
- Cache tenant credentials
- Pre-fetch execution details on row expand
- Implement response caching for identical errors
- Use Haiku for simple classification tasks

---

**Implementation Date**: November 26, 2025  
**Developer**: AI Agent Assistant  
**Status**: ✅ Complete and Ready for Testing
