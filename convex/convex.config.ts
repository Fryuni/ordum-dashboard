import { defineApp } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config.js";

const app = defineApp();

// One aggregate per logical collection. Distinct names isolate their BTrees.
app.use(aggregate, { name: "openBountiesAggregate" });
app.use(aggregate, { name: "myClosedBountiesAggregate" });

export default app;
