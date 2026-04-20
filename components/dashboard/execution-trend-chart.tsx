"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ExecutionTrendChartProps {
  data: { date: string; success: number; failed: number }[];
}

export function ExecutionTrendChart({ data }: ExecutionTrendChartProps) {
  const maxValue = Math.max(
    ...data.map((d) => d.success + d.failed),
    1
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const totalSuccess = data.reduce((sum, d) => sum + d.success, 0);
  const totalFailed = data.reduce((sum, d) => sum + d.failed, 0);
  const total = totalSuccess + totalFailed;

  if (total === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-lg">Execution Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-24 w-full flex items-end justify-center gap-2 mb-4">
              {data.map((_, index) => (
                <div
                  key={index}
                  className="w-12 bg-muted rounded-t animate-pulse"
                  style={{ height: `${20 + ((index * 37 + 13) % 60)}%` }}
                />
              ))}
            </div>
            <p className="text-muted-foreground">No execution data for the last 7 days</p>
            <p className="text-sm text-muted-foreground/70">
              Run some integrations to see the trend
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Execution Trend (Last 7 Days)</CardTitle>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Success ({totalSuccess})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Failed ({totalFailed})</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 flex items-end gap-2">
          {data.map((day, index) => {
            const successHeight = (day.success / maxValue) * 100;
            const failedHeight = (day.failed / maxValue) * 100;
            const totalHeight = successHeight + failedHeight;

            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div 
                  className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden"
                  style={{ height: "160px" }}
                >
                  {/* Stacked bar */}
                  <div 
                    className="w-full flex flex-col justify-end transition-all duration-300"
                    style={{ height: `${totalHeight}%` }}
                  >
                    {day.failed > 0 && (
                      <div 
                        className="w-full bg-red-500 rounded-t-sm"
                        style={{ height: `${(day.failed / (day.success + day.failed)) * 100}%`, minHeight: day.failed > 0 ? "4px" : "0" }}
                      />
                    )}
                    {day.success > 0 && (
                      <div 
                        className={cn(
                          "w-full bg-green-500",
                          day.failed === 0 && "rounded-t-sm"
                        )}
                        style={{ height: `${(day.success / (day.success + day.failed)) * 100}%`, minHeight: day.success > 0 ? "4px" : "0" }}
                      />
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(day.date)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
