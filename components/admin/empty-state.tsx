import { ShieldCheckIcon, ArrowUpRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function AdminEmptyState() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldCheckIcon />
        </EmptyMedia>
        <EmptyTitle>Admin Panel</EmptyTitle>
        <EmptyDescription>
          Manage users, configure system settings, and oversee platform
          operations. Use the sidebar to navigate to different admin sections.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button asChild>
            <a href="#">Manage Users</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="#">System Settings</a>
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
          Admin Documentation <ArrowUpRightIcon className="ml-1 h-4 w-4" />
        </a>
      </Button>
    </Empty>
  )
}
