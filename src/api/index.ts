import "dotenv/config";
import express from "express";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { DEFAULT_PORT } from "@/shared/constants";
import { logger } from "@/core/logger";
import { registerMetrics } from "@/api/plugins/metrics.plugin";
import publishRouter from "@/api/routes/publish.route";
import secretsRouter from "@/api/routes/secrets.route";
import oauthRouter from "@/api/routes/oauth.route";
import projectsRouter from "@/api/routes/projects.route";
import platformsRouter from "@/api/routes/platforms.route";
import {
  errorHandler,
  RequestContext,
  requestContextMiddleware,
  requestLogger,
} from "./middleware";
import { getDBConnection } from "@/shared/connections/database";

const app = express();

// Validate database connection before starting server
async function validateConnections() {
  try {
    const db = getDBConnection();
    await db.authenticate();
    logger.info("✅ Database connection established successfully");
  } catch (error) {
    logger.error({ error }, "❌ Unable to connect to database");
    process.exit(1);
  }
}

app.use(express.json({ limit: "10mb" }));

app.use(requestContextMiddleware);

app.use(requestLogger);

registerMetrics(app);
app.use("/v1/publish", publishRouter);
app.use("/v1/secrets", secretsRouter);
app.use("/v1/oauth", oauthRouter);
app.use("/v1/projects", projectsRouter);
app.use("/v1/platforms", platformsRouter);

// Basic health
app.get("/health", (_req, res) => {
  return res.json({ status: "ok" });
});

app.use(errorHandler);

// Start server after validating connections
validateConnections().then(() => {
  app.listen(DEFAULT_PORT, () => {
    logger.info({ port: DEFAULT_PORT }, "🚀 API listening");
  });
});

export default app;
