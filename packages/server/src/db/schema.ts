import type postgres from "postgres";

export async function migrate(sql: postgres.Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      sharering_address TEXT NOT NULL UNIQUE,
      developer_mode_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      thumbnail_url TEXT,
      file_tree JSONB NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      template_id UUID REFERENCES templates(id),
      status TEXT NOT NULL DEFAULT 'draft',
      file_tree JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      messages JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'planning'`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_content TEXT`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_content TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      triggers TEXT[] NOT NULL DEFAULT '{}',
      agent_types TEXT[] NOT NULL DEFAULT '{}',
      prompt TEXT NOT NULL,
      code_snippets JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}
