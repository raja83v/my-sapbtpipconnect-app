import { Suspense } from "react";
import { getAPIProductDetail } from "@/app/actions/api-products";
import { APIProductDetailTabs } from "@/components/dashboard/api-product-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconAlertCircle } from "@tabler/icons-react";
import Link from "next/link";

function APIProductDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button skeleton */}
      <Skeleton className="h-8 w-28" />

      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b pb-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>

        {/* Content skeleton — overview cards */}
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ error, name }: { error: string; name?: string }) {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <IconAlertCircle className="h-5 w-5" />
          Error Loading API Product
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{error}</p>
        {name && (
          <p className="text-xs text-muted-foreground">
            Product name: <code className="bg-secondary px-1 rounded">{name}</code>
          </p>
        )}
        <Button asChild>
          <Link href="/dashboard/apis">
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back to APIs
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Async server component that fetches the product detail
async function APIProductDetailContent({ name }: { name: string }) {
  const result = await getAPIProductDetail(name);

  if (!result.success || !result.data) {
    return (
      <ErrorCard
        error={result.error || "Failed to load API Product details"}
        name={name}
      />
    );
  }

  return <APIProductDetailTabs data={result.data} />;
}

type PageProps = {
  params: Promise<{ name: string }>;
};

export default async function APIProductDetailPage({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  if (!decodedName) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <ErrorCard error="No API Product name provided in the URL." />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<APIProductDetailSkeleton />}>
        <APIProductDetailContent name={decodedName} />
      </Suspense>
    </div>
  );
}
