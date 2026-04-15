import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Storage audit ingestion
crons.interval(
  "storage audit ingestion",
  { minutes: 30 },
  internal.storageAuditIngestion.ingestAll,
  {},
);

// Empire data sync
crons.interval(
  "empire data sync",
  { minutes: 30 },
  internal.empireSync.syncAll,
  {},
);

export default crons;
