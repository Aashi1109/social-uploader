import type { Express } from "express";
import client from "prom-client";

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const metrics = {
  publishTotal: new client.Counter({
    name: "publish_total",
    help: "Total publish operations",
    labelNames: ["platform", "status"] as const,
  }),
  publishDuration: new client.Histogram({
    name: "publish_duration_seconds",
    help: "Publish duration seconds",
    labelNames: ["platform"] as const,
    buckets: [0.1, 0.3, 1, 3, 10, 30, 60],
  }),
  prepDuration: new client.Histogram({
    name: "prep_duration_seconds",
    help: "Prep duration seconds",
    labelNames: ["platform"] as const,
    buckets: [0.1, 0.3, 1, 3, 10, 30, 60],
  }),
};

registry.registerMetric(metrics.publishTotal);
registry.registerMetric(metrics.publishDuration);
registry.registerMetric(metrics.prepDuration);

export function registerMetrics(app: Express) {
  app.get("/metrics", async (_req, res) => {
    res.setHeader("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });
}
