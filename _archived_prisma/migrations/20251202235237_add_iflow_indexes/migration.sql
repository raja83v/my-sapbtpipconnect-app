-- CreateIndex
CREATE INDEX "iflow_status_idx" ON "iflow"("status");

-- CreateIndex
CREATE INDEX "iflow_updatedAt_idx" ON "iflow"("updatedAt");

-- CreateIndex
CREATE INDEX "iflow_tenantId_status_idx" ON "iflow"("tenantId", "status");

-- CreateIndex
CREATE INDEX "iflow_tenantId_updatedAt_idx" ON "iflow"("tenantId", "updatedAt");
