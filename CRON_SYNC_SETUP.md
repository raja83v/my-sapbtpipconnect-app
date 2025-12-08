# Automatic Data Sync Setup Guide

## ⚠️ Important Note About Convex Cron Jobs

Convex cron jobs run in a sandboxed environment that **cannot access Node.js modules** like `crypto`, `async_hooks`, or make external HTTP requests with authentication. This means we cannot directly call the `syncTenantInternal()` function from Convex crons.

## 🔄 Recommended Solutions

### Option 1: Vercel Cron Jobs (Recommended)

Use Vercel's built-in cron jobs to trigger the sync via API routes.

**Setup:**

1. Create `vercel.json` in project root:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-all-tenants",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

2. Create API route `app/api/cron/sync-all-tenants/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { syncTenantInternal } from "@/app/actions/tenant";

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all tenants
    const tenants = await convex.query(api.tenants.listAll, { limit: 100 });
    
    let successCount = 0;
    let errorCount = 0;

    // Sync each OAuth tenant
    for (const tenant of tenants) {
      if (!tenant.isConnected || tenant.authType !== "OAUTH") {
        continue;
      }

      try {
        const result = await syncTenantInternal(tenant._id);
        if (result.success) {
          successCount++;
          console.log(`✓ Synced ${tenant.name}`);
        } else {
          errorCount++;
          console.error(`✗ Failed ${tenant.name}: ${result.error}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ Error ${tenant.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      synced: successCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

3. Add to `.env.local`:
```
CRON_SECRET=your-random-secret-here
```

4. Deploy to Vercel - cron will run automatically!

### Option 2: External Cron Service

Use a service like **cron-job.org** or **EasyCron** to call your API endpoint.

**Setup:**

1. Use the same API route from Option 1
2. Configure external service to call:
   - URL: `https://your-app.vercel.app/api/cron/sync-all-tenants`
   - Method: GET
   - Header: `Authorization: Bearer your-cron-secret`
   - Schedule: Every 5 minutes (`*/5 * * * *`)

### Option 3: Manual Sync Button

Add a manual sync button in the dashboard for on-demand syncing.

**Implementation:**

1. Create button component:
```typescript
"use client";

import { Button } from "@/components/ui/button";
import { syncTenantIFlows } from "@/app/actions/tenant";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export function SyncButton({ tenantId }: { tenantId: string }) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTenantIFlows(tenantId);
      if (result.success) {
        toast.success("Sync complete!", {
          description: `Synced ${result.data.count} iFlows and ${result.data.executionsSynced} executions`,
        });
      } else {
        toast.error("Sync failed", { description: result.error });
      }
    } catch (error) {
      toast.error("Sync error");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button onClick={handleSync} disabled={isSyncing}>
      <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Syncing..." : "Sync Now"}
    </Button>
  );
}
```

## 📊 Current Status

- ✅ **Sync Function** - `syncTenantInternal()` works perfectly
- ✅ **Manual Sync** - Can be triggered from dashboard
- ✅ **API Route** - `/api/cron/sync-tenant` ready
- ⏳ **Automatic Sync** - Needs one of the above solutions

## 🎯 Recommendation

**Use Option 1 (Vercel Cron Jobs)** because:
- ✅ Built into Vercel (no external dependencies)
- ✅ Free on all Vercel plans
- ✅ Reliable and well-integrated
- ✅ Easy to monitor in Vercel dashboard
- ✅ Automatic retries on failure

## 🚀 Quick Start

For immediate testing without cron:

1. Go to your tenant settings
2. Click "Sync Now" button
3. Data will be fetched and stored
4. Error Diagnostician will show real errors!

Then set up automatic sync using Option 1 for production.