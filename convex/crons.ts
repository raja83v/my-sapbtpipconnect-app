import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * CRON JOBS DISABLED
 *
 * All automatic sync jobs are disabled to prevent excessive data loading.
 * Run sync jobs manually when needed using the Convex dashboard or API.
 *
 * To re-enable, uncomment the cron job definitions below.
 */

/**
 * Sync iFlows from SAP CPI every 5 minutes
 * Keeps the iFlow list up to date with deployments/changes
 */
// crons.interval(
//     "sync-iflows",
//     { minutes: 5 },
//     internal.cronJobs.syncAllTenantIFlows
// );

/**
 * Sync message logs (executions) from SAP CPI every 2 minutes
 * Keeps execution data fresh for monitoring and error detection
 */
// crons.interval(
//     "sync-messages",
//     { minutes: 2 },
//     internal.cronJobs.syncAllTenantMessages
// );

export default crons;