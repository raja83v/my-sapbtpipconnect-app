import { AdminEmptyState } from "@/components/admin/empty-state"

export default async function AdminPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-8">
      <AdminEmptyState />
    </div>
  )
}
