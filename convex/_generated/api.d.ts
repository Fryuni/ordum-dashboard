/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aggregates from "../aggregates.js";
import type * as auth from "../auth.js";
import type * as bountyBoard from "../bountyBoard.js";
import type * as craftPlans from "../craftPlans.js";
import type * as crons from "../crons.js";
import type * as empireData from "../empireData.js";
import type * as empireSync from "../empireSync.js";
import type * as http from "../http.js";
import type * as lib_bitjita from "../lib/bitjita.js";
import type * as lib_compare from "../lib/compare.js";
import type * as lib_user from "../lib/user.js";
import type * as storageAudit from "../storageAudit.js";
import type * as storageAuditIngestion from "../storageAuditIngestion.js";
import type * as sync from "../sync.js";
import type * as userManagement from "../userManagement.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aggregates: typeof aggregates;
  auth: typeof auth;
  bountyBoard: typeof bountyBoard;
  craftPlans: typeof craftPlans;
  crons: typeof crons;
  empireData: typeof empireData;
  empireSync: typeof empireSync;
  http: typeof http;
  "lib/bitjita": typeof lib_bitjita;
  "lib/compare": typeof lib_compare;
  "lib/user": typeof lib_user;
  storageAudit: typeof storageAudit;
  storageAuditIngestion: typeof storageAuditIngestion;
  sync: typeof sync;
  userManagement: typeof userManagement;
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

export declare const components: {
  openBountiesAggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"openBountiesAggregate">;
  myClosedBountiesAggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"myClosedBountiesAggregate">;
};
