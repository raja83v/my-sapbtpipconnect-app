/**
 * SAP CPI MCP Server - Main Entry Point
 * 
 * Exports all public APIs for integration with the AI assistant
 */

// Types
export * from "./types";

// Tool Registry
export { 
  toolRegistry, 
  getAllTools, 
  getToolsByCategory, 
  getToolByName,
  getActionTools,
  requiresConfirmation,
  getToolsForAI,
} from "./tools/registry";

// Executor
export { 
  executeTool, 
  getAuditLog, 
  getToolStats,
  type SAPCPIClient,
} from "./executor";

// Utilities
export { 
  getCached, 
  setCache, 
  invalidateTenantCache, 
  invalidateToolCache,
  clearCache,
  getCacheStats,
} from "./utils/cache";

export {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
} from "./utils/rate-limiter";

export {
  createConfirmation,
  validateConfirmation,
  cancelConfirmation,
  getPendingConfirmation,
  getUserPendingConfirmations,
} from "./utils/confirmation";
