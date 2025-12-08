import { IFlowsDataTable } from "@/components/dashboard/iflows-data-table";

export default function IFlowsPage() {
  // Render immediately - auth handled by middleware, data fetched client-side
  // iFlows are filtered by the currently selected tenant in the sidebar
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">iFlows</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your SAP CPI integration flows
          </p>
        </div>

        {/* Data Table - loads data client-side, filtered by selected tenant */}
        <IFlowsDataTable />
      </div>
    </div>
  );
}
