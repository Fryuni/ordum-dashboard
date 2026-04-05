import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Storage audit ingestion — every 5 minutes (matches old CF cron)
crons.interval(
  "storage audit ingestion",
  { minutes: 5 },
  internal.storageAuditIngestion.ingestAll,
  {},
);

export default crons;
