import { Suspense } from "react";
import { getIFlowFullDetails } from "@/app/actions/iflows";
import { IFlowDetailTabs } from "@/components/dashboard/iflow-detail/iflow-detail-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconAlertCircle } from "@tabler/icons-react";
import Link from "next/link";

function IFlowDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b pb-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ error, id }: { error: string; id?: string }) {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <IconAlertCircle className="h-5 w-5" />
          Error Loading iFlow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{error}</p>
        {id && <p className="text-xs text-muted-foreground">iFlow ID: {id}</p>}
        <Button asChild>
          <Link href="/dashboard/iflows">
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back to iFlows
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Async component for iFlow details
async function IFlowDetailContent({ id }: { id: string }) {
  const result = await getIFlowFullDetails(id);

  if (!result.success || !result.data) {
    return <ErrorCard error={result.error || "Failed to load iFlow details"} id={id} />;
  }

  return <IFlowDetailTabs iflow={result.data} />;
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function IFlowDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <ErrorCard error="No iFlow ID provided in the URL." />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<IFlowDetailSkeleton />}>
        <IFlowDetailContent id={id} />
      </Suspense>
    </div>
  );
}
