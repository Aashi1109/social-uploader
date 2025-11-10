import { loadWorkers } from "@/core/loader";
import { logger } from "@/core/logger";

async function main() {
  await loadWorkers();
  logger.info("Workers loaded");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
