import { Hono } from "hono";
import type { AppEnv } from "../lib/types.js";
import { NotFoundError } from "../lib/errors.js";
import { listTemplates, getTemplate } from "../db/queries.js";

const templates = new Hono<AppEnv>();

// List templates, optionally filtered by category
templates.get("/", async (c) => {
  const sql = c.get("sql");
  const category = c.req.query("category");
  const result = await listTemplates(sql, category || undefined);
  return c.json(result);
});

// Get template by id
templates.get("/:id", async (c) => {
  const sql = c.get("sql");
  const template = await getTemplate(sql, c.req.param("id"));
  if (!template) throw new NotFoundError("Template");
  return c.json(template);
});

export default templates;
