import type postgres from "postgres";
import { v4 as uuidv4 } from "uuid";
import type {
  User,
  Project,
  Conversation,
  ConversationMessage,
  Template,
} from "../lib/types.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    description: row.description as string | null,
    template_id: row.template_id as string | null,
    status: row.status as Project["status"],
    phase: (row.phase as Project["phase"]) ?? "planning",
    plan_content: (row.plan_content as string | null) ?? null,
    design_content: (row.design_content as string | null) ?? null,
    file_tree:
      typeof row.file_tree_raw === "string"
        ? JSON.parse(row.file_tree_raw)
        : (row.file_tree as Record<string, string>),
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}

function parseConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    messages:
      typeof row.messages_raw === "string"
        ? JSON.parse(row.messages_raw)
        : (row.messages as ConversationMessage[]),
    updated_at: new Date(row.updated_at as string),
  };
}

function parseTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    thumbnail_url: row.thumbnail_url as string | null,
    file_tree:
      typeof row.file_tree_raw === "string"
        ? JSON.parse(row.file_tree_raw)
        : (row.file_tree as Record<string, string>),
    tags: row.tags as string[],
  };
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(
  sql: postgres.Sql,
  id: string,
  shareringAddress: string
): Promise<User> {
  const rows = await sql`
    INSERT INTO users (id, sharering_address)
    VALUES (${id}, ${shareringAddress})
    ON CONFLICT (sharering_address) DO UPDATE
      SET id = EXCLUDED.id
    RETURNING *
  `;
  return rows[0] as unknown as User;
}

export async function getUserById(
  sql: postgres.Sql,
  id: string
): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows.length ? (rows[0] as unknown as User) : null;
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(
  sql: postgres.Sql,
  userId: string,
  name: string,
  description: string | null = null,
  templateId: string | null = null,
  fileTree: Record<string, string> = {}
): Promise<Project> {
  const id = uuidv4();
  const rows = await sql`
    INSERT INTO projects (id, user_id, name, description, template_id, file_tree)
    VALUES (${id}, ${userId}, ${name}, ${description}, ${templateId}, ${JSON.stringify(fileTree)})
    RETURNING *, file_tree::text AS file_tree_raw
  `;
  return parseProject(rows[0] as unknown as Record<string, unknown>);
}

export async function getProject(
  sql: postgres.Sql,
  id: string
): Promise<Project | null> {
  const rows = await sql`
    SELECT *, file_tree::text AS file_tree_raw
    FROM projects WHERE id = ${id}
  `;
  return rows.length
    ? parseProject(rows[0] as unknown as Record<string, unknown>)
    : null;
}

export async function listProjects(
  sql: postgres.Sql,
  userId: string
): Promise<Project[]> {
  const rows = await sql`
    SELECT *, file_tree::text AS file_tree_raw
    FROM projects WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => parseProject(r as unknown as Record<string, unknown>));
}

export async function updateProject(
  sql: postgres.Sql,
  id: string,
  updates: Partial<Pick<Project, "name" | "description" | "status" | "file_tree">>
): Promise<Project | null> {
  // Build a plain object of columns to update
  const data: Record<string, string | null> = {};

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.file_tree !== undefined)
    data.file_tree = JSON.stringify(updates.file_tree);

  const columns = Object.keys(data);
  if (columns.length === 0) return getProject(sql, id);

  const rows = await sql`
    UPDATE projects SET
      ${sql(data, ...columns)},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *, file_tree::text AS file_tree_raw
  `;
  return rows.length
    ? parseProject(rows[0] as unknown as Record<string, unknown>)
    : null;
}

export async function deleteProject(
  sql: postgres.Sql,
  id: string
): Promise<boolean> {
  const rows = await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// ── File operations (JSONB) ──────────────────────────────────────────────────

export async function updateFile(
  sql: postgres.Sql,
  projectId: string,
  path: string,
  content: string
): Promise<Project | null> {
  const patch = JSON.stringify({ [path]: content });
  const rows = await sql`
    UPDATE projects
    SET file_tree = file_tree || ${patch}::jsonb,
        updated_at = now()
    WHERE id = ${projectId}
    RETURNING *, file_tree::text AS file_tree_raw
  `;
  return rows.length
    ? parseProject(rows[0] as unknown as Record<string, unknown>)
    : null;
}

export async function createFile(
  sql: postgres.Sql,
  projectId: string,
  path: string,
  content: string
): Promise<Project | null> {
  const patch = JSON.stringify({ [path]: content });
  const rows = await sql`
    UPDATE projects
    SET file_tree = file_tree || ${patch}::jsonb,
        updated_at = now()
    WHERE id = ${projectId}
    RETURNING *, file_tree::text AS file_tree_raw
  `;
  return rows.length
    ? parseProject(rows[0] as unknown as Record<string, unknown>)
    : null;
}

export async function deleteFile(
  sql: postgres.Sql,
  projectId: string,
  path: string
): Promise<Project | null> {
  const rows = await sql`
    UPDATE projects
    SET file_tree = file_tree - ${path},
        updated_at = now()
    WHERE id = ${projectId}
    RETURNING *, file_tree::text AS file_tree_raw
  `;
  return rows.length
    ? parseProject(rows[0] as unknown as Record<string, unknown>)
    : null;
}

// ── Conversations ────────────────────────────────────────────────────────────

export async function createConversation(
  sql: postgres.Sql,
  projectId: string
): Promise<Conversation> {
  const id = uuidv4();
  const rows = await sql`
    INSERT INTO conversations (id, project_id)
    VALUES (${id}, ${projectId})
    RETURNING *, messages::text AS messages_raw
  `;
  return parseConversation(rows[0] as unknown as Record<string, unknown>);
}

export async function getConversation(
  sql: postgres.Sql,
  id: string
): Promise<Conversation | null> {
  const rows = await sql`
    SELECT *, messages::text AS messages_raw
    FROM conversations WHERE id = ${id}
  `;
  return rows.length
    ? parseConversation(rows[0] as unknown as Record<string, unknown>)
    : null;
}

export async function getConversationByProjectId(
  sql: postgres.Sql,
  projectId: string
): Promise<Conversation | null> {
  const rows = await sql`
    SELECT *, messages::text AS messages_raw
    FROM conversations WHERE project_id = ${projectId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return rows.length
    ? parseConversation(rows[0] as unknown as Record<string, unknown>)
    : null;
}

export async function appendMessage(
  sql: postgres.Sql,
  conversationId: string,
  message: ConversationMessage
): Promise<Conversation | null> {
  const rows = await sql`
    UPDATE conversations
    SET messages = messages || ${JSON.stringify([message])}::jsonb,
        updated_at = now()
    WHERE id = ${conversationId}
    RETURNING *, messages::text AS messages_raw
  `;
  return rows.length
    ? parseConversation(rows[0] as unknown as Record<string, unknown>)
    : null;
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(
  sql: postgres.Sql,
  category?: string
): Promise<Template[]> {
  const rows = category
    ? await sql`
        SELECT *, file_tree::text AS file_tree_raw
        FROM templates WHERE category = ${category}
        ORDER BY name
      `
    : await sql`
        SELECT *, file_tree::text AS file_tree_raw
        FROM templates ORDER BY name
      `;
  return rows.map((r) => parseTemplate(r as unknown as Record<string, unknown>));
}

export async function getTemplate(
  sql: postgres.Sql,
  id: string
): Promise<Template | null> {
  const rows = await sql`
    SELECT *, file_tree::text AS file_tree_raw
    FROM templates WHERE id = ${id}
  `;
  return rows.length
    ? parseTemplate(rows[0] as unknown as Record<string, unknown>)
    : null;
}

// ── Project Phase & Content ─────────────────────────────────────────────────

export async function updateProjectPhase(
  sql: postgres.Sql,
  projectId: string,
  phase: Project["phase"]
): Promise<void> {
  await sql`
    UPDATE projects SET phase = ${phase}, updated_at = now()
    WHERE id = ${projectId}
  `;
}

export async function updatePlanContent(
  sql: postgres.Sql,
  projectId: string,
  content: string
): Promise<void> {
  await sql`
    UPDATE projects SET plan_content = ${content}, updated_at = now()
    WHERE id = ${projectId}
  `;
}

export async function updateDesignContent(
  sql: postgres.Sql,
  projectId: string,
  content: string
): Promise<void> {
  await sql`
    UPDATE projects SET design_content = ${content}, updated_at = now()
    WHERE id = ${projectId}
  `;
}

// ── Skills ──────────────────────────────────────────────────────────────────

export interface SkillRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  triggers: string[];
  agent_types: string[];
  prompt: string;
  code_snippets: Record<string, string>;
  created_at: Date;
}

function parseSkillRow(row: Record<string, unknown>): SkillRow {
  const codeSnippets =
    typeof row.code_snippets === "string"
      ? JSON.parse(row.code_snippets)
      : (row.code_snippets ?? {});
  return {
    id: row.id as string,
    name: row.name as string,
    display_name: row.display_name as string,
    description: row.description as string,
    triggers: row.triggers as string[],
    agent_types: row.agent_types as string[],
    prompt: row.prompt as string,
    code_snippets: codeSnippets as Record<string, string>,
    created_at: new Date(row.created_at as string),
  };
}

export async function listSkills(
  sql: postgres.Sql
): Promise<SkillRow[]> {
  const rows = await sql`SELECT * FROM skills ORDER BY name`;
  return rows.map((r) => parseSkillRow(r as unknown as Record<string, unknown>));
}

export async function getSkillByName(
  sql: postgres.Sql,
  name: string
): Promise<SkillRow | null> {
  const rows = await sql`SELECT * FROM skills WHERE name = ${name}`;
  return rows.length
    ? parseSkillRow(rows[0] as unknown as Record<string, unknown>)
    : null;
}
