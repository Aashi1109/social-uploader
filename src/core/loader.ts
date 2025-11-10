import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadWorkers() {
  const pattern = path.join(__dirname, "../workers/*.worker.*");
  const files = glob.sync(pattern).sort();
  const only = (process.env.WORKER_NAME || "").trim().toLowerCase();
  for (const file of files) {
    const base = path.basename(file).toLowerCase();
    if (only && !base.includes(only)) continue;
    // eslint-disable-next-line no-await-in-loop
    const mod = await import(pathToFileURL(file).href);
    if (mod && typeof mod.default === "function") {
      // eslint-disable-next-line new-cap
      new mod.default();
    }
  }
}
