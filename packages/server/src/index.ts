import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import postgres from "postgres";
import { migrate } from "./db/schema.js";
import { seedTemplates } from "./db/seed-templates.js";
import { seedExtendedTemplates } from "./db/seed-templates-extended.js";
import { seedSkills } from "./db/seed-skills.js";
import { createApp } from "./app.js";
import { setupWebSocket } from "./routes/ws-chat.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

async function main() {
  // Support both connection string and local peer auth via unix socket
  const sql = DATABASE_URL
    ? postgres(DATABASE_URL)
    : postgres({
        database: process.env.PGDATABASE ?? "memodule_dev",
        host: "/var/run/postgresql",
      });

  console.log("Running database migrations...");
  await migrate(sql);
  console.log("Migrations complete.");

  await seedTemplates(sql);
  await seedExtendedTemplates(sql);
  await seedSkills(sql);

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
