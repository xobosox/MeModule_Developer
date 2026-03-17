import { Hono } from "hono";
import type { AppEnv } from "../lib/types.js";
import { createToken } from "../auth/jwt.js";
import { issueTicket } from "../auth/ws-ticket.js";
import { upsertUser } from "../db/queries.js";
import { ValidationError } from "../lib/errors.js";

const authRoutes = new Hono<AppEnv>();

// POST /auth/sharering — authenticate via ShareRing address
authRoutes.post("/sharering", async (c) => {
  const body = await c.req.json<{ id: string; sharering_address: string }>();

  if (!body.id || !body.sharering_address) {
    throw new ValidationError("id and sharering_address are required");
  }

  const sql = c.get("sql");
  const user = await upsertUser(sql, body.id, body.sharering_address);

  const jwtSecret = c.get("jwtSecret" as never) as unknown as string;
  const token = await createToken(
    { userId: user.id, address: user.sharering_address },
    jwtSecret
  );

  return c.json({ token, user });
});

// POST /auth/ws-ticket — issue a short-lived WebSocket ticket (requires auth)
authRoutes.post("/ws-ticket", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ projectId: string }>();

  if (!body.projectId) {
    throw new ValidationError("projectId is required");
  }

  const ticket = issueTicket(userId, body.projectId);
  return c.json({ ticket });
});

export default authRoutes;
