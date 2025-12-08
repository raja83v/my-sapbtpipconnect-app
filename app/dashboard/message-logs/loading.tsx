import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function MessageLogsLoading() {
    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            {/* Header skeleton */}
            <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
            </div>

            {/* Filters skeleton */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Skeleton className="h-10 w-[200px]" />
                        <Skeleton className="h-10 w-[180px]" />
                        <Skeleton className="h-10 w-[150px]" />
                        <Skeleton className="h-10 w-[200px]" />
                        <Skeleton className="h-10 w-[250px]" />
                        <div className="ml-auto flex items-center gap-2">
                            <Skeleton className="h-10 w-10" />
                            <Skeleton className="h-10 w-10" />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Table skeleton */}
            <Card>
                <CardContent className="p-0">
                    {/* Table header */}
                    <div className="border-b">
                        <div className="flex items-center gap-4 p-4">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-32 flex-1" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>

                    {/* Table rows */}
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-6 w-20" />
                            <div className="flex-1">
                                <Skeleton className="h-4 w-48 mb-1" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-8 w-8 rounded" />
                        </div>
                    ))}

                    {/* Pagination skeleton */}
                    <div className="flex items-center justify-between p-4 border-t">
                        <Skeleton className="h-4 w-48" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-24" />
                            <Skeleton className="h-10 w-24" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
