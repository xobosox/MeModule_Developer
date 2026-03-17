import { Hono, type Context } from "hono";
import type { AppEnv } from "../lib/types.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../lib/errors.js";
import { getProject, updateFile, createFile, deleteFile } from "../db/queries.js";

const MAX_FILES = 100;
const MAX_FILE_SIZE = 500 * 1024; // 500KB

const files = new Hono<AppEnv>();

async function getAuthorizedProject(c: Context<AppEnv>, projectId: string) {
  const sql = c.get("sql");
  const userId = c.get("userId");
  const project = await getProject(sql, projectId);
  if (!project) throw new NotFoundError("Project");
  if (project.user_id !== userId) throw new ForbiddenError();
  return project;
}

// List all files in project
files.get("/:projectId/files", async (c) => {
  const project = await getAuthorizedProject(c, c.req.param("projectId"));
  return c.json(project.file_tree);
});

// Get single file content
files.get("/:projectId/files/:path{.+}", async (c) => {
  const project = await getAuthorizedProject(c, c.req.param("projectId"));
  const filePath = c.req.param("path");
  const content = project.file_tree[filePath];
  if (content === undefined) throw new NotFoundError("File");
  return c.json({ path: filePath, content });
});

// Create file
files.post("/:projectId/files/:path{.+}", async (c) => {
  const sql = c.get("sql");
  const project = await getAuthorizedProject(c, c.req.param("projectId"));
  const filePath = c.req.param("path");

  if (project.file_tree[filePath] !== undefined) {
    throw new ValidationError("File already exists");
  }

  const fileCount = Object.keys(project.file_tree).length;
  if (fileCount >= MAX_FILES) {
    throw new ValidationError(`Maximum of ${MAX_FILES} files allowed`);
  }

  const body = await c.req.json();
  const content = body.content ?? "";

  if (typeof content === "string" && content.length > MAX_FILE_SIZE) {
    throw new ValidationError(`File size exceeds ${MAX_FILE_SIZE / 1024}KB limit`);
  }

  const updated = await createFile(sql, project.id, filePath, content);
  if (!updated) throw new NotFoundError("Project");
  return c.json({ path: filePath, content }, 201);
});

// Update file
files.put("/:projectId/files/:path{.+}", async (c) => {
  const sql = c.get("sql");
  const project = await getAuthorizedProject(c, c.req.param("projectId"));
  const filePath = c.req.param("path");

  if (project.file_tree[filePath] === undefined) {
    throw new NotFoundError("File");
  }

  const body = await c.req.json();
  const content = body.content ?? "";

  if (typeof content === "string" && content.length > MAX_FILE_SIZE) {
    throw new ValidationError(`File size exceeds ${MAX_FILE_SIZE / 1024}KB limit`);
  }

  const updated = await updateFile(sql, project.id, filePath, content);
  if (!updated) throw new NotFoundError("Project");
  return c.json({ path: filePath, content });
});

// Delete file
files.delete("/:projectId/files/:path{.+}", async (c) => {
  const sql = c.get("sql");
  const project = await getAuthorizedProject(c, c.req.param("projectId"));
  const filePath = c.req.param("path");

  if (project.file_tree[filePath] === undefined) {
    throw new NotFoundError("File");
  }

  await deleteFile(sql, project.id, filePath);
  return c.json({ ok: true });
});

export default files;
