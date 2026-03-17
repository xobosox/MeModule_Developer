import { Hono, type Context } from "hono";
import type { AppEnv } from "../lib/types.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../lib/errors.js";
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
} from "../db/queries.js";
import { createConversation, getConversationByProjectId, getTemplate } from "../db/queries.js";

const projects = new Hono<AppEnv>();

async function getAuthorizedProject(c: Context<AppEnv>, projectId: string) {
  const sql = c.get("sql");
  const userId = c.get("userId");
  const project = await getProject(sql, projectId);
  if (!project) throw new NotFoundError("Project");
  if (project.user_id !== userId) throw new ForbiddenError();
  return project;
}

// List projects for current user
projects.get("/", async (c) => {
  const sql = c.get("sql");
  const userId = c.get("userId");
  const result = await listProjects(sql, userId);
  return c.json(result);
});

// Create project
projects.post("/", async (c) => {
  const sql = c.get("sql");
  const userId = c.get("userId");
  const body = await c.req.json();

  if (!body.name || typeof body.name !== "string") {
    throw new ValidationError("name is required");
  }

  // If a template is specified, load its file_tree
  let fileTree: Record<string, string> = body.file_tree ?? {};
  if (body.template_id) {
    const template = await getTemplate(sql, body.template_id);
    if (template) {
      fileTree = template.file_tree;
    }
  }

  const project = await createProject(
    sql,
    userId,
    body.name,
    body.description ?? null,
    body.template_id ?? null,
    fileTree
  );

  // Also create a conversation for the new project
  const conversation = await createConversation(sql, project.id);

  // Return just the project (conversation is internal)
  return c.json(project, 201);
});

// Get project by id
projects.get("/:id", async (c) => {
  const project = await getAuthorizedProject(c, c.req.param("id"));
  return c.json(project);
});

// Get conversation for a project
projects.get("/:id/conversation", async (c) => {
  const sql = c.get("sql");
  await getAuthorizedProject(c, c.req.param("id"));
  const conversation = await getConversationByProjectId(sql, c.req.param("id"));
  return c.json(conversation ?? { messages: [] });
});

// Update project
projects.put("/:id", async (c) => {
  const sql = c.get("sql");
  await getAuthorizedProject(c, c.req.param("id"));

  const body = await c.req.json();
  const updated = await updateProject(sql, c.req.param("id"), {
    name: body.name,
    description: body.description,
    status: body.status,
    file_tree: body.file_tree,
  });

  if (!updated) throw new NotFoundError("Project");
  return c.json(updated);
});

// Delete project
projects.delete("/:id", async (c) => {
  const sql = c.get("sql");
  await getAuthorizedProject(c, c.req.param("id"));
  await deleteProject(sql, c.req.param("id"));
  return c.json({ ok: true });
});

export default projects;
