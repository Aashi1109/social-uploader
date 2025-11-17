import { loadWorkers } from "@/core/loader";
import { logger } from "@/core/logger";
import { getDBConnection } from "@/shared/connections/database";

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

async function main() {
  await validateConnections();
  await loadWorkers();
  logger.info("🚀 Workers loaded and ready");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
