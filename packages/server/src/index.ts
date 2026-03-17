import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import postgres from "postgres";
import { migrate } from "./db/schema.js";
import { createApp } from "./app.js";
import { setupWebSocket } from "./routes/ws-chat.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/memodule_dev";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

async function main() {
  const sql = postgres(DATABASE_URL);

  console.log("Running database migrations...");
  await migrate(sql);
  console.log("Migrations complete.");

  const app = createApp(sql, JWT_SECRET);

  console.log(`Server starting on port ${PORT}...`);
  const server = serve({
    fetch: app.fetch,
    port: PORT,
  }) as unknown as Server;
  console.log(`Server running at http://localhost:${PORT}`);

  setupWebSocket(server, sql);
  console.log("WebSocket handler attached.");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
