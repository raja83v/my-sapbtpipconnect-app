import { RocketIcon, ArrowUpRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function DashboardEmptyState() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RocketIcon />
        </EmptyMedia>
        <EmptyTitle>Welcome to HagenKit</EmptyTitle>
        <EmptyDescription>
          This is your dashboard. Get started by adding your first project,
          creating content, or exploring the features available to you.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button asChild>
            <a href="#">Create Project</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="#">Browse Templates</a>
          </Button>
        </div>
      </EmptyContent>
      <Button
        variant="link"
        asChild
        className="text-muted-foreground"
        size="sm"
      >
        <a href="#">
          View Documentation <ArrowUpRightIcon className="ml-1 h-4 w-4" />
        </a>
      </Button>
    </Empty>
  )
}
