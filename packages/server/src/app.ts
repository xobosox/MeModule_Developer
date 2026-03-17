import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type postgres from "postgres";
import type { AppEnv } from "./lib/types.js";
import { AppError } from "./lib/errors.js";
import { verifyToken } from "./auth/jwt.js";
import authRoutes from "./routes/auth.js";
import health from "./routes/health.js";
import projects from "./routes/projects.js";
import files from "./routes/files.js";
import templates from "./routes/templates.js";
import exportRoute from "./routes/export.js";

export function createApp(sql: postgres.Sql, jwtSecret: string) {
  const app = new Hono<AppEnv>();

  // Middleware
  app.use("*", cors());
  app.use("*", logger());

  // Inject DB connection and JWT secret into context
  app.use("*", async (c, next) => {
    c.set("sql", sql);
    (c as any).set("jwtSecret", jwtSecret);
    await next();
  });

  // JWT auth middleware — skip for public paths
  app.use("/api/*", async (c, next) => {
    const path = c.req.path;
    if (path.startsWith("/api/auth/") || path.startsWith("/api/health")) {
      await next();
      return;
    }

    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    try {
      const payload = await verifyToken(token, jwtSecret);
      c.set("userId", payload.userId);
    } catch {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    await next();
  });

  // Routes
  app.route("/api/health", health);
  app.route("/api/auth", authRoutes);
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
