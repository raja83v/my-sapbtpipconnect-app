"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface IFlowErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function IFlowError({ error, reset }: IFlowErrorProps) {
  useEffect(() => {
    console.error("[iFlow Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle
              className="h-6 w-6 text-destructive"
              aria-hidden="true"
            />
          </div>
          <CardTitle>Failed to load iFlow</CardTitle>
          <CardDescription>
            The iFlow could not be loaded. It may have been deleted, or you may
            not have permission to view it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error.message && (
            <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {error.message}
            </p>
          )}
          <div className="flex gap-3">
            <Button onClick={reset} className="flex-1" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/dashboard/iflows">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                All iFlows
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
