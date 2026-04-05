/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as construction from "../construction.js";
import type * as contribution from "../contribution.js";
import type * as crons from "../crons.js";
import type * as empire from "../empire.js";
import type * as inventorySearch from "../inventorySearch.js";
import type * as lib_bitjita from "../lib/bitjita.js";
import type * as settlement from "../settlement.js";
import type * as storageAudit from "../storageAudit.js";
import type * as storageAuditIngestion from "../storageAuditIngestion.js";
import type * as sync from "../sync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  construction: typeof construction;
  contribution: typeof contribution;
  crons: typeof crons;
  empire: typeof empire;
  inventorySearch: typeof inventorySearch;
  "lib/bitjita": typeof lib_bitjita;
  settlement: typeof settlement;
  storageAudit: typeof storageAudit;
  storageAuditIngestion: typeof storageAuditIngestion;
  sync: typeof sync;
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
