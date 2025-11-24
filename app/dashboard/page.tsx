import { DashboardProEmptyState } from "@/components/dashboard/empty-state-pro"

export default async function Home() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-8">
      <DashboardProEmptyState />
    </div>
  )
}
