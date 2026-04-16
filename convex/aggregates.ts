/**
 * Aggregate component instances for bounty pagination.
 *
 * - openBountiesAggregate: all bounties with status="open", sorted by creation
 *   time (desc = newest first). Used for the public "Open Bounties" listing.
 * - myClosedBountiesAggregate: bounties with status="closed", namespaced by
 *   the poster's userId. Used for paginating a user's own closed bounties
 *   (which can grow unbounded over time).
 */
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";

// Sort key: creation time (number). Newest-first is achieved by order="desc"
// on reads.
export const openBountiesAggregate = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "bountyEntries";
}>(components.openBountiesAggregate, {
  sortKey: (doc) => doc._creationTime,
});

export const myClosedBountiesAggregate = new TableAggregate<{
  Namespace: Id<"users">;
  Key: number;
  DataModel: DataModel;
  TableName: "bountyEntries";
}>(components.myClosedBountiesAggregate, {
  namespace: (doc) => doc.userId,
  sortKey: (doc) => doc._creationTime,
});
