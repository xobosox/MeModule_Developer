import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type postgres from "postgres";
import type { AppEnv } from "./lib/types.js";
import { AppError } from "./lib/errors.js";
import health from "./routes/health.js";
import projects from "./routes/projects.js";
import files from "./routes/files.js";
import templates from "./routes/templates.js";
import exportRoute from "./routes/export.js";

export function createApp(sql: postgres.Sql) {
  const app = new Hono<AppEnv>();

  // Middleware
  app.use("*", cors());
  app.use("*", logger());

  // Inject DB connection into context
  app.use("*", async (c, next) => {
    c.set("sql", sql);
    await next();
  });

  // PLACEHOLDER: replaced with JWT auth in Chunk 2
  // For now, read user id from x-user-id header
  app.use("/api/*", async (c, next) => {
    const userId = c.req.header("x-user-id");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("userId", userId);
    await next();
  });

  // Routes
  app.route("/health", health);
  app.route("/api/projects", projects);
  app.route("/api/projects", files);
  app.route("/api/projects", exportRoute);
  app.route("/api/templates", templates);

  // Error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message }, err.statusCode as 400);
    }
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
