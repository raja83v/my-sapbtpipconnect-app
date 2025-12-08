/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiAgentMutations from "../aiAgentMutations.js";
import type * as aiAgents from "../aiAgents.js";
import type * as billing from "../billing.js";
import type * as billingMutations from "../billingMutations.js";
import type * as cronJobs from "../cronJobs.js";
import type * as crons from "../crons.js";
import type * as iflowMutations from "../iflowMutations.js";
import type * as iflows from "../iflows.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as sapSync from "../sapSync.js";
import type * as tenantMutations from "../tenantMutations.js";
import type * as tenants from "../tenants.js";
import type * as userMutations from "../userMutations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiAgentMutations: typeof aiAgentMutations;
  aiAgents: typeof aiAgents;
  billing: typeof billing;
  billingMutations: typeof billingMutations;
  cronJobs: typeof cronJobs;
  crons: typeof crons;
  iflowMutations: typeof iflowMutations;
  iflows: typeof iflows;
  "lib/encryption": typeof lib_encryption;
  sapSync: typeof sapSync;
  tenantMutations: typeof tenantMutations;
  tenants: typeof tenants;
  userMutations: typeof userMutations;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
