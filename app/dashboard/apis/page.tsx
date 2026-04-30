import { APIProductsDataTable } from "@/components/dashboard/api-products-data-table";

export default function APIsPage() {
  // Render immediately — auth handled by middleware, data fetched client-side
  // API Products are filtered by the currently selected tenant in the sidebar
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">APIs</h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage API Products from SAP API Management
          </p>
        </div>

        {/* Data Table — loads data client-side, filtered by selected tenant */}
        <APIProductsDataTable />
      </div>
    </div>
  );
}
