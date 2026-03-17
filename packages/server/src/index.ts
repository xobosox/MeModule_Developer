import { serve } from "@hono/node-server";
import postgres from "postgres";
import { migrate } from "./db/schema.js";
import { createApp } from "./app.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/memodule_dev";

async function main() {
  const sql = postgres(DATABASE_URL);

  console.log("Running database migrations...");
  await migrate(sql);
  console.log("Migrations complete.");

  const app = createApp(sql);

  console.log(`Server starting on port ${PORT}...`);
  serve({
    fetch: app.fetch,
    port: PORT,
  });
  console.log(`Server running at http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
