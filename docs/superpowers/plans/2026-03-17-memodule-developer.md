# MeModule Developer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered hosted platform for creating ShareRing Me Modules through natural language conversation.

**Architecture:** Hybrid client-server — Hono API server handles auth, AI (Claude tool use), and project storage (PostgreSQL JSONB). Browser handles code editing (Monaco), live preview (esbuild-wasm transpilation in sandboxed iframe), and real-time AI chat (WebSocket). Two-panel UI: chat left, tabbed (Plan/Code/Preview) right.

**Tech Stack:** React 18, TypeScript, Vite, TailwindCSS, Monaco Editor, esbuild-wasm, Hono, PostgreSQL, Redis, Claude API (Anthropic SDK), WebSocket

**Spec:** `docs/superpowers/specs/2026-03-17-memodule-developer-design.md`

---

## File Structure

### Monorepo Layout

```
packages/
  server/
    src/
      index.ts                    # Entry point, start server
      app.ts                      # Hono app setup, middleware, route mounting
      db/
        schema.ts                 # PostgreSQL table definitions + migrations
        queries.ts                # Query functions (users, projects, conversations, templates)
      routes/
        auth.ts                   # POST /auth/sharering
        projects.ts               # CRUD /projects
        files.ts                  # CRUD /projects/:id/files/*
        templates.ts              # GET /templates
        export.ts                 # POST /projects/:id/export
        ws-chat.ts                # WebSocket /projects/:id/chat
      ai/
        system-prompt.ts          # Layered prompt builder
        tool-definitions.ts       # Claude tool schemas (chat, write_file, show_preview, show_plan)
        stream-processor.ts       # Process Claude streaming responses → WS messages
        context-manager.ts        # Conversation sliding window + summarization
      auth/
        jwt.ts                    # JWT creation + validation
        ws-ticket.ts              # Short-lived WebSocket auth tickets
      lib/
        types.ts                  # Shared TypeScript types
        errors.ts                 # Error classes
    package.json
    tsconfig.json

  frontend/
    src/
      main.tsx                    # Entry point
      App.tsx                     # Root component, routing
      lib/
        types.ts                  # Shared frontend types
        api-client.ts             # REST API wrapper
        ws-client.ts              # WebSocket client with reconnection + seq tracking
        auth.ts                   # Auth state + ShareRing login flow
      pages/
        Login.tsx                 # ShareRing Me login page
        Dashboard.tsx             # Project list + create + template gallery
        Workspace.tsx             # Main IDE workspace (two-panel layout)
      components/
        chat/
          ChatPanel.tsx           # Left panel: message list + input
          ChatMessage.tsx         # Single message (user or AI)
          StreamingMessage.tsx    # AI message being streamed
        tabs/
          TabBar.tsx              # Plan / Code / Preview tab switcher
          PlanTab.tsx             # Renders AI-generated HTML plans
          CodeTab.tsx             # Monaco editor + file tree
          PreviewTab.tsx          # iframe preview container + mobile frame
        code/
          FileTree.tsx            # File tree sidebar for code editor
          MonacoEditor.tsx        # Monaco editor wrapper
        preview/
          PreviewEngine.ts        # esbuild-wasm transpilation + import map generation
          PreviewFrame.tsx        # Sandboxed iframe management
          MockBridge.ts           # Mock ShareRing Me bridge for preview
          ErrorOverlay.tsx        # Preview error display + "Fix with AI" button
        dashboard/
          ProjectCard.tsx         # Project card for dashboard list
          TemplateCard.tsx        # Template card for gallery
      preview-iframe/
        index.html                # Template HTML loaded into preview iframe
        error-boundary.js         # React error boundary for preview
      store/
        auth-store.ts             # Auth state (Zustand)
        project-store.ts          # Current project state (Zustand)
        chat-store.ts             # Chat messages + streaming state (Zustand)
        workspace-store.ts        # Active tab, file selection, UI state (Zustand)
    index.html
    vite.config.ts
    package.json
    tsconfig.json

  prebundle/
    scripts/
      bundle-deps.ts              # Script to pre-bundle React, Zustand, etc. as ESM
    dist/                         # Pre-bundled ESM files served as static assets
    package.json

package.json                      # Workspace root
```

---

## Chunk 1: Project Scaffolding + Server Foundation

### Task 1: Monorepo Setup

**Files:**
- Create: `package.json` (root)
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/vite.config.ts`
- Create: `packages/frontend/index.html`
- Create: `.gitignore`

- [ ] **Step 1: Initialize root package.json with workspaces**

```json
{
  "name": "memodule-developer",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=packages/frontend",
    "dev:server": "npm run dev --workspace=packages/server",
    "dev:all": "concurrently \"npm run dev:server\" \"npm run dev\"",
    "build": "npm run build --workspace=packages/server && npm run build --workspace=packages/frontend",
    "test": "npm run test --workspace=packages/server && npm run test --workspace=packages/frontend",
    "lint": "npm run lint --workspace=packages/server && npm run lint --workspace=packages/frontend"
  },
  "devDependencies": {
    "concurrently": "^9.1.2",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Create server package.json**

```json
{
  "name": "@memodule-dev/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.7.4",
    "@hono/node-server": "^1.14.1",
    "@anthropic-ai/sdk": "^0.39.0",
    "postgres": "^3.4.5",
    "ioredis": "^5.4.2",
    "jose": "^6.0.8",
    "archiver": "^7.0.1",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "vitest": "^3.0.5",
    "@types/node": "^22.13.0",
    "@types/archiver": "^6.0.3",
    "@types/uuid": "^10.0.0"
  }
}
```

- [ ] **Step 3: Create server tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create frontend with Vite + React + TailwindCSS**

```bash
cd packages/frontend
```

`packages/frontend/package.json`:
```json
{
  "name": "@memodule-dev/frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.1.5",
    "zustand": "^5.0.11",
    "@monaco-editor/react": "^4.7.0",
    "esbuild-wasm": "^0.25.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.1.0",
    "tailwindcss": "^4.1.18",
    "@tailwindcss/vite": "^4.1.18",
    "vitest": "^3.0.5",
    "@testing-library/react": "^16.2.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "typescript": "^5.7.3"
  }
}
```

`packages/frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
  resolve: {
    alias: { "@": "/src" },
  },
});
```

`packages/frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MeModule Developer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] },
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.sqlite
.superpowers/
```

- [ ] **Step 6: Install dependencies and verify build**

```bash
npm install
npm run lint
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold monorepo with server and frontend packages"
```

---

### Task 2: Database Schema + Queries

**Files:**
- Create: `packages/server/src/db/schema.ts`
- Create: `packages/server/src/db/queries.ts`
- Create: `packages/server/src/lib/types.ts`
- Test: `packages/server/src/db/__tests__/queries.test.ts`

- [ ] **Step 1: Write shared types**

`packages/server/src/lib/types.ts`:
```typescript
export interface User {
  id: string;
  sharering_address: string;
  developer_mode_enabled: boolean;
  created_at: Date;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  status: "draft" | "building" | "ready";
  file_tree: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  project_id: string;
  messages: ConversationMessage[];
  updated_at: Date;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tool_calls?: ToolCallResult[];
}

export interface ToolCallResult {
  type: "chat" | "file" | "preview" | "plan";
  path?: string;
  content: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  file_tree: Record<string, string>;
  tags: string[];
}

export type FileTree = Record<string, string>;
```

- [ ] **Step 2: Write schema with migrations**

`packages/server/src/db/schema.ts`:
```typescript
import postgres from "postgres";

export function createDb(connectionString: string) {
  return postgres(connectionString);
}

export async function migrate(sql: postgres.Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      sharering_address TEXT NOT NULL UNIQUE,
      developer_mode_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
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
      tags TEXT[] DEFAULT '{}'
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      messages JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id)`;
}
```

- [ ] **Step 3: Write failing tests for query functions**

`packages/server/src/db/__tests__/queries.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createDb, migrate } from "../schema.js";
import * as queries from "../queries.js";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/memodule_test";

let sql: ReturnType<typeof createDb>;

beforeAll(async () => {
  sql = createDb(TEST_DB_URL);
  await migrate(sql);
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await sql`DELETE FROM conversations`;
  await sql`DELETE FROM projects`;
  await sql`DELETE FROM users`;
});

describe("users", () => {
  it("creates and retrieves a user", async () => {
    const user = await queries.upsertUser(sql, {
      id: "user-1",
      sharering_address: "shareledger1abc",
    });
    expect(user.id).toBe("user-1");
    expect(user.sharering_address).toBe("shareledger1abc");

    const found = await queries.getUserById(sql, "user-1");
    expect(found).not.toBeNull();
    expect(found!.sharering_address).toBe("shareledger1abc");
  });
});

describe("projects", () => {
  it("creates a project for a user", async () => {
    await queries.upsertUser(sql, { id: "user-1", sharering_address: "shareledger1abc" });
    const project = await queries.createProject(sql, {
      user_id: "user-1",
      name: "Test Module",
      file_tree: { "manifest.json": '{"version":"0.0.1"}' },
    });
    expect(project.name).toBe("Test Module");
    expect(project.status).toBe("draft");
  });

  it("lists projects for a user", async () => {
    await queries.upsertUser(sql, { id: "user-1", sharering_address: "shareledger1abc" });
    await queries.createProject(sql, { user_id: "user-1", name: "P1", file_tree: {} });
    await queries.createProject(sql, { user_id: "user-1", name: "P2", file_tree: {} });
    const list = await queries.listProjects(sql, "user-1");
    expect(list).toHaveLength(2);
  });

  it("updates a single file in file_tree", async () => {
    await queries.upsertUser(sql, { id: "user-1", sharering_address: "shareledger1abc" });
    const project = await queries.createProject(sql, {
      user_id: "user-1",
      name: "Test",
      file_tree: { "src/App.tsx": "old content" },
    });
    await queries.updateFile(sql, project.id, "src/App.tsx", "new content");
    const updated = await queries.getProject(sql, project.id);
    expect(updated!.file_tree["src/App.tsx"]).toBe("new content");
  });

  it("deletes a file from file_tree", async () => {
    await queries.upsertUser(sql, { id: "user-1", sharering_address: "shareledger1abc" });
    const project = await queries.createProject(sql, {
      user_id: "user-1",
      name: "Test",
      file_tree: { "a.ts": "a", "b.ts": "b" },
    });
    await queries.deleteFile(sql, project.id, "a.ts");
    const updated = await queries.getProject(sql, project.id);
    expect(updated!.file_tree["a.ts"]).toBeUndefined();
    expect(updated!.file_tree["b.ts"]).toBe("b");
  });
});

describe("conversations", () => {
  it("creates and appends messages", async () => {
    await queries.upsertUser(sql, { id: "user-1", sharering_address: "shareledger1abc" });
    const project = await queries.createProject(sql, { user_id: "user-1", name: "Test", file_tree: {} });
    const convo = await queries.createConversation(sql, project.id);
    expect(convo.messages).toEqual([]);

    await queries.appendMessage(sql, convo.id, {
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
    });
    const updated = await queries.getConversation(sql, convo.id);
    expect(updated!.messages).toHaveLength(1);
    expect(updated!.messages[0].content).toBe("Hello");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/db/__tests__/queries.test.ts
```

Expected: FAIL — `queries.js` module not found. (Note: `schema.ts` and `types.ts` must already exist from Steps 1-2 for the test file to compile.)

- [ ] **Step 5: Implement query functions**

`packages/server/src/db/queries.ts`:
```typescript
import type postgres from "postgres";
import type { Project, Conversation, ConversationMessage } from "../lib/types.js";

export async function upsertUser(
  sql: postgres.Sql,
  data: { id: string; sharering_address: string }
) {
  const [user] = await sql`
    INSERT INTO users (id, sharering_address)
    VALUES (${data.id}, ${data.sharering_address})
    ON CONFLICT (id) DO UPDATE SET sharering_address = ${data.sharering_address}
    RETURNING *
  `;
  return user;
}

export async function getUserById(sql: postgres.Sql, id: string) {
  const [user] = await sql`SELECT * FROM users WHERE id = ${id}`;
  return user ?? null;
}

export async function createProject(
  sql: postgres.Sql,
  data: { user_id: string; name: string; description?: string; template_id?: string; file_tree: Record<string, string> }
) {
  const [project] = await sql`
    INSERT INTO projects (user_id, name, description, template_id, file_tree)
    VALUES (${data.user_id}, ${data.name}, ${data.description ?? null}, ${data.template_id ?? null}, ${JSON.stringify(data.file_tree)})
    RETURNING *, file_tree::text as file_tree_raw
  `;
  return { ...project, file_tree: JSON.parse(project.file_tree_raw) } as Project;
}

export async function getProject(sql: postgres.Sql, id: string) {
  const [project] = await sql`
    SELECT *, file_tree::text as file_tree_raw FROM projects WHERE id = ${id}
  `;
  if (!project) return null;
  return { ...project, file_tree: JSON.parse(project.file_tree_raw) } as Project;
}

export async function listProjects(sql: postgres.Sql, userId: string) {
  const rows = await sql`
    SELECT id, name, description, status, template_id, created_at, updated_at
    FROM projects WHERE user_id = ${userId} ORDER BY updated_at DESC
  `;
  return rows;
}

export async function updateProject(
  sql: postgres.Sql,
  id: string,
  data: { name?: string; description?: string; status?: string }
) {
  const [project] = await sql`
    UPDATE projects SET
      name = COALESCE(${data.name ?? null}, name),
      description = COALESCE(${data.description ?? null}, description),
      status = COALESCE(${data.status ?? null}, status),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return project;
}

export async function deleteProject(sql: postgres.Sql, id: string) {
  await sql`DELETE FROM projects WHERE id = ${id}`;
}

export async function updateFile(sql: postgres.Sql, projectId: string, path: string, content: string) {
  // Use || operator for flat keys containing "/" (jsonb_set treats "/" as nested path separator)
  await sql`
    UPDATE projects
    SET file_tree = file_tree || jsonb_build_object(${path}, ${content}::text),
        updated_at = NOW()
    WHERE id = ${projectId}
  `;
}

export async function createFile(sql: postgres.Sql, projectId: string, path: string, content: string) {
  await sql`
    UPDATE projects
    SET file_tree = file_tree || jsonb_build_object(${path}, ${content}::text),
        updated_at = NOW()
    WHERE id = ${projectId}
  `;
}

export async function deleteFile(sql: postgres.Sql, projectId: string, path: string) {
  await sql`
    UPDATE projects
    SET file_tree = file_tree - ${path},
        updated_at = NOW()
    WHERE id = ${projectId}
  `;
}

export async function createConversation(sql: postgres.Sql, projectId: string) {
  const [convo] = await sql`
    INSERT INTO conversations (project_id, messages)
    VALUES (${projectId}, '[]'::jsonb)
    RETURNING *, messages::text as messages_raw
  `;
  return { ...convo, messages: JSON.parse(convo.messages_raw) } as Conversation;
}

export async function getConversation(sql: postgres.Sql, id: string) {
  const [convo] = await sql`
    SELECT *, messages::text as messages_raw FROM conversations WHERE id = ${id}
  `;
  if (!convo) return null;
  return { ...convo, messages: JSON.parse(convo.messages_raw) } as Conversation;
}

export async function getConversationByProjectId(sql: postgres.Sql, projectId: string) {
  const [convo] = await sql`
    SELECT *, messages::text as messages_raw FROM conversations WHERE project_id = ${projectId}
  `;
  if (!convo) return null;
  return { ...convo, messages: JSON.parse(convo.messages_raw) } as Conversation;
}

export async function appendMessage(sql: postgres.Sql, conversationId: string, message: ConversationMessage) {
  await sql`
    UPDATE conversations
    SET messages = messages || ${JSON.stringify(message)}::jsonb,
        updated_at = NOW()
    WHERE id = ${conversationId}
  `;
}

export async function listTemplates(sql: postgres.Sql, category?: string) {
  if (category) {
    return sql`SELECT * FROM templates WHERE category = ${category} ORDER BY name`;
  }
  return sql`SELECT * FROM templates ORDER BY name`;
}

export async function getTemplate(sql: postgres.Sql, id: string) {
  const [template] = await sql`
    SELECT *, file_tree::text as file_tree_raw FROM templates WHERE id = ${id}
  `;
  if (!template) return null;
  return { ...template, file_tree: JSON.parse(template.file_tree_raw) };
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd packages/server && npx vitest run src/db/__tests__/queries.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/db packages/server/src/lib/types.ts
git commit -m "feat: add database schema, migrations, and query functions with tests"
```

---

### Task 3: Hono Server + REST Routes

**Files:**
- Create: `packages/server/src/app.ts`
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/routes/projects.ts`
- Create: `packages/server/src/routes/files.ts`
- Create: `packages/server/src/routes/templates.ts`
- Create: `packages/server/src/routes/export.ts`
- Create: `packages/server/src/routes/health.ts`
- Create: `packages/server/src/lib/errors.ts`
- Test: `packages/server/src/routes/__tests__/projects.test.ts`

- [ ] **Step 1: Write error classes**

`packages/server/src/lib/errors.ts`:
```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, "Forbidden");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}
```

- [ ] **Step 2: Write Hono app with middleware**

`packages/server/src/app.ts`:
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type postgres from "postgres";
import { AppError } from "./lib/errors.js";
import { projectRoutes } from "./routes/projects.js";
import { fileRoutes } from "./routes/files.js";
import { templateRoutes } from "./routes/templates.js";
import { exportRoutes } from "./routes/export.js";
import { healthRoutes } from "./routes/health.js";

export type AppEnv = {
  Variables: {
    sql: postgres.Sql;
    userId: string;
  };
};

export function createApp(sql: postgres.Sql) {
  const app = new Hono<AppEnv>();

  app.use("*", cors());
  app.use("*", logger());

  // Inject DB into context
  app.use("*", async (c, next) => {
    c.set("sql", sql);
    await next();
  });

  // Auth middleware for /api routes (except health)
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/health") return next();
    // PLACEHOLDER: replaced with JWT auth in Chunk 2 (Task 4: Auth)
    // Using header-based mock for initial development
    const userId = c.req.header("x-user-id");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("userId", userId);
    await next();
  });

  // Error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.route("/api", healthRoutes());
  app.route("/api", projectRoutes());
  app.route("/api", fileRoutes());
  app.route("/api", templateRoutes());
  app.route("/api", exportRoutes());

  return app;
}
```

- [ ] **Step 3: Write health route**

`packages/server/src/routes/health.ts`:
```typescript
import { Hono } from "hono";

export function healthRoutes() {
  const router = new Hono();
  router.get("/health", (c) => c.json({ status: "ok" }));
  return router;
}
```

- [ ] **Step 4: Write project routes**

`packages/server/src/routes/projects.ts`:
```typescript
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import * as queries from "../db/queries.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../lib/errors.js";

export function projectRoutes() {
  const router = new Hono<AppEnv>();

  router.get("/projects", async (c) => {
    const sql = c.get("sql");
    const userId = c.get("userId");
    const projects = await queries.listProjects(sql, userId);
    return c.json(projects);
  });

  router.post("/projects", async (c) => {
    const sql = c.get("sql");
    const userId = c.get("userId");
    const body = await c.req.json<{ name: string; description?: string; template_id?: string }>();

    if (!body.name) throw new ValidationError("name is required");

    let fileTree: Record<string, string> = {};
    if (body.template_id) {
      const template = await queries.getTemplate(sql, body.template_id);
      if (!template) throw new NotFoundError("Template");
      fileTree = template.file_tree;
    }

    const project = await queries.createProject(sql, {
      user_id: userId,
      name: body.name,
      description: body.description,
      template_id: body.template_id,
      file_tree: fileTree,
    });

    // Create conversation for the project
    await queries.createConversation(sql, project.id);

    return c.json(project, 201);
  });

  router.get("/projects/:id", async (c) => {
    const sql = c.get("sql");
    const userId = c.get("userId");
    const project = await queries.getProject(sql, c.req.param("id"));
    if (!project) throw new NotFoundError("Project");
    if (project.user_id !== userId) throw new ForbiddenError();
    return c.json(project);
  });

  router.put("/projects/:id", async (c) => {
    const sql = c.get("sql");
    const userId = c.get("userId");
    const project = await queries.getProject(sql, c.req.param("id"));
    if (!project) throw new NotFoundError("Project");
    if (project.user_id !== userId) throw new ForbiddenError();

    const body = await c.req.json<{ name?: string; description?: string; status?: string }>();
    const updated = await queries.updateProject(sql, project.id, body);
    return c.json(updated);
  });

  router.delete("/projects/:id", async (c) => {
    const sql = c.get("sql");
    const userId = c.get("userId");
    const project = await queries.getProject(sql, c.req.param("id"));
    if (!project) throw new NotFoundError("Project");
    if (project.user_id !== userId) throw new ForbiddenError();

    await queries.deleteProject(sql, project.id);
    return c.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 5: Write file routes**

`packages/server/src/routes/files.ts`:
```typescript
import { Hono, type Context } from "hono";
import type { AppEnv } from "../app.js";
import * as queries from "../db/queries.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../lib/errors.js";

export function fileRoutes() {
  const router = new Hono<AppEnv>();

  async function getAuthorizedProject(c: Context<AppEnv>) {
    const sql = c.get("sql");
    const userId = c.get("userId");
    const project = await queries.getProject(sql, c.req.param("id"));
    if (!project) throw new NotFoundError("Project");
    if (project.user_id !== userId) throw new ForbiddenError();
    return { sql, project };
  }

  router.get("/projects/:id/files", async (c) => {
    const { project } = await getAuthorizedProject(c);
    return c.json(project.file_tree);
  });

  router.get("/projects/:id/files/*", async (c) => {
    const { project } = await getAuthorizedProject(c);
    const path = c.req.path.replace(/^\/api\/projects\/[^/]+\/files\//, "");
    const content = project.file_tree[path];
    if (content === undefined) throw new NotFoundError("File");
    return c.json({ path, content });
  });

  router.put("/projects/:id/files/*", async (c) => {
    const { sql, project } = await getAuthorizedProject(c);
    const path = c.req.path.replace(/^\/api\/projects\/[^/]+\/files\//, "");
    const body = await c.req.json<{ content: string }>();
    if (typeof body.content !== "string") throw new ValidationError("content must be a string");
    if (body.content.length > 500 * 1024) throw new ValidationError("File exceeds 500KB limit");

    await queries.updateFile(sql, project.id, path, body.content);
    return c.json({ ok: true });
  });

  router.post("/projects/:id/files/*", async (c) => {
    const { sql, project } = await getAuthorizedProject(c);
    const path = c.req.path.replace(/^\/api\/projects\/[^/]+\/files\//, "");
    const body = await c.req.json<{ content: string }>();
    if (typeof body.content !== "string") throw new ValidationError("content must be a string");

    const fileCount = Object.keys(project.file_tree).length;
    if (fileCount >= 100) throw new ValidationError("Project exceeds 100 file limit");

    await queries.createFile(sql, project.id, path, body.content);
    return c.json({ ok: true }, 201);
  });

  router.delete("/projects/:id/files/*", async (c) => {
    const { sql, project } = await getAuthorizedProject(c);
    const path = c.req.path.replace(/^\/api\/projects\/[^/]+\/files\//, "");
    if (project.file_tree[path] === undefined) throw new NotFoundError("File");

    await queries.deleteFile(sql, project.id, path);
    return c.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 6: Write template routes**

`packages/server/src/routes/templates.ts`:
```typescript
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import * as queries from "../db/queries.js";
import { NotFoundError } from "../lib/errors.js";

export function templateRoutes() {
  const router = new Hono<AppEnv>();

  router.get("/templates", async (c) => {
    const sql = c.get("sql");
    const category = c.req.query("category");
    const templates = await queries.listTemplates(sql, category);
    return c.json(templates);
  });

  router.get("/templates/:id", async (c) => {
    const sql = c.get("sql");
    const template = await queries.getTemplate(sql, c.req.param("id"));
    if (!template) throw new NotFoundError("Template");
    return c.json(template);
  });

  return router;
}
```

- [ ] **Step 7: Write export scaffolding templates**

`packages/server/src/routes/export-templates.ts`:
```typescript
export const packageJsonTemplate = (name: string) => JSON.stringify({
  name: name.toLowerCase().replace(/\s+/g, "-"),
  private: true,
  type: "module",
  scripts: {
    dev: "vite",
    build: "tsc -b && vite build",
    preview: "vite preview",
  },
  dependencies: {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.1.5",
    zustand: "^5.0.11",
  },
  devDependencies: {
    "@vitejs/plugin-react": "^4.3.4",
    vite: "^6.1.0",
    tailwindcss: "^4.1.18",
    "@tailwindcss/vite": "^4.1.18",
    typescript: "^5.7.3",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
  },
}, null, 2);

export const viteConfigTemplate = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
});
`;

export const tsconfigTemplate = JSON.stringify({
  compilerOptions: {
    target: "ES2020",
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    lib: ["ES2020", "DOM", "DOM.Iterable"],
  },
  include: ["src"],
}, null, 2);

export const readmeTemplate = (name: string) => `# ${name}

A ShareRing Me Module built with MeModule Developer.

## Setup

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build for production

\`\`\`bash
npm run build
\`\`\`

Deploy the \`dist/\` folder to any static hosting provider.
The module must be served from a dedicated domain/subdomain root.
`;
```

- [ ] **Step 8: Write export route**

`packages/server/src/routes/export.ts`:
```typescript
import { Hono } from "hono";
import archiver from "archiver";
import type { AppEnv } from "../app.js";
import * as queries from "../db/queries.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import { packageJsonTemplate, viteConfigTemplate, tsconfigTemplate, readmeTemplate } from "./export-templates.js";

export function exportRoutes() {
  const router = new Hono<AppEnv>();

  router.post("/projects/:id/export", async (c) => {
    const sql = c.get("sql");
    const userId = c.get("userId");
    const project = await queries.getProject(sql, c.req.param("id"));
    if (!project) throw new NotFoundError("Project");
    if (project.user_id !== userId) throw new ForbiddenError();

    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Uint8Array[] = [];

    archive.on("data", (chunk) => chunks.push(chunk));

    for (const [path, content] of Object.entries(project.file_tree)) {
      if (path === "manifest.json" || path === "index.html") {
        archive.append(content, { name: path });
      } else {
        archive.append(content, { name: path.startsWith("src/") ? path : `src/${path}` });
      }
    }

    archive.append(packageJsonTemplate(project.name), { name: "package.json" });
    archive.append(viteConfigTemplate, { name: "vite.config.ts" });
    archive.append(tsconfigTemplate, { name: "tsconfig.json" });
    archive.append(readmeTemplate(project.name), { name: "README.md" });

    await archive.finalize();

    const buffer = Buffer.concat(chunks);
    const filename = `${project.name.toLowerCase().replace(/\s+/g, "-")}.zip`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });

  return router;
}
```

- [ ] **Step 8: Write server entry point**

`packages/server/src/index.ts`:
```typescript
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb, migrate } from "./db/schema.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/memodule_dev";
const PORT = Number(process.env.PORT ?? 3001);

async function main() {
  const sql = createDb(DATABASE_URL);
  await migrate(sql);
  console.log("Database migrated");

  const app = createApp(sql);

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
}

main().catch(console.error);
```

- [ ] **Step 9: Write verification tests for REST routes**

`packages/server/src/routes/__tests__/projects.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createApp } from "../../app.js";
import { createDb, migrate } from "../../db/schema.js";
import * as queries from "../../db/queries.js";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/memodule_test";

let sql: ReturnType<typeof createDb>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  sql = createDb(TEST_DB_URL);
  await migrate(sql);
  app = createApp(sql);
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await sql`DELETE FROM conversations`;
  await sql`DELETE FROM projects`;
  await sql`DELETE FROM users`;
  await queries.upsertUser(sql, { id: "test-user", sharering_address: "shareledger1test" });
});

describe("GET /api/projects", () => {
  it("returns empty list for new user", async () => {
    const res = await app.request("/api/projects", {
      headers: { "x-user-id": "test-user" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/projects");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/projects", () => {
  it("creates a project", async () => {
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "x-user-id": "test-user", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Module" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("My Module");
    expect(body.status).toBe("draft");
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes a project owned by user", async () => {
    const createRes = await app.request("/api/projects", {
      method: "POST",
      headers: { "x-user-id": "test-user", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "To Delete" }),
    });
    const project = await createRes.json();

    const res = await app.request(`/api/projects/${project.id}`, {
      method: "DELETE",
      headers: { "x-user-id": "test-user" },
    });
    expect(res.status).toBe(200);
  });

  it("returns 403 for other user's project", async () => {
    await queries.upsertUser(sql, { id: "other-user", sharering_address: "shareledger1other" });
    const createRes = await app.request("/api/projects", {
      method: "POST",
      headers: { "x-user-id": "test-user", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Private" }),
    });
    const project = await createRes.json();

    const res = await app.request(`/api/projects/${project.id}`, {
      method: "DELETE",
      headers: { "x-user-id": "other-user" },
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
cd packages/server && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/server/src
git commit -m "feat: add Hono server with REST routes for projects, files, templates, and export"
```

---

## Chunk 2: Auth + AI Engine

### Task 4: JWT Auth + WebSocket Tickets

**Files:**
- Create: `packages/server/src/auth/jwt.ts`
- Create: `packages/server/src/auth/ws-ticket.ts`
- Create: `packages/server/src/routes/auth.ts`
- Modify: `packages/server/src/app.ts` (replace placeholder auth middleware)
- Test: `packages/server/src/auth/__tests__/jwt.test.ts`

- [ ] **Step 1: Write failing JWT tests**

`packages/server/src/auth/__tests__/jwt.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { createToken, verifyToken } from "../jwt.js";

describe("JWT", () => {
  const secret = "test-secret-key-at-least-32-chars-long!!";

  it("creates and verifies a token", async () => {
    const token = await createToken({ userId: "user-1", address: "shareledger1abc" }, secret);
    expect(typeof token).toBe("string");

    const payload = await verifyToken(token, secret);
    expect(payload.userId).toBe("user-1");
    expect(payload.address).toBe("shareledger1abc");
  });

  it("rejects expired tokens", async () => {
    const token = await createToken({ userId: "user-1", address: "shareledger1abc" }, secret, "0s");
    await expect(verifyToken(token, secret)).rejects.toThrow();
  });

  it("rejects tampered tokens", async () => {
    const token = await createToken({ userId: "user-1", address: "shareledger1abc" }, secret);
    const tampered = token.slice(0, -5) + "XXXXX";
    await expect(verifyToken(tampered, secret)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/auth/__tests__/jwt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement JWT functions**

`packages/server/src/auth/jwt.ts`:
```typescript
import * as jose from "jose";

export interface TokenPayload {
  userId: string;
  address: string;
}

export async function createToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string = "7d"
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, key);
  return payload as unknown as TokenPayload;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/server && npx vitest run src/auth/__tests__/jwt.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Implement WebSocket ticket system**

`packages/server/src/auth/ws-ticket.ts`:
```typescript
const tickets = new Map<string, { userId: string; projectId: string; expiresAt: number }>();

export function issueTicket(userId: string, projectId: string): string {
  const ticket = crypto.randomUUID();
  tickets.set(ticket, {
    userId,
    projectId,
    expiresAt: Date.now() + 30_000, // 30 second expiry
  });
  return ticket;
}

export function consumeTicket(ticket: string): { userId: string; projectId: string } | null {
  const entry = tickets.get(ticket);
  if (!entry) return null;
  tickets.delete(ticket);
  if (Date.now() > entry.expiresAt) return null;
  return { userId: entry.userId, projectId: entry.projectId };
}

// Clean expired tickets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of tickets) {
    if (now > val.expiresAt) tickets.delete(key);
  }
}, 60_000);
```

- [ ] **Step 6: Write auth route**

`packages/server/src/routes/auth.ts`:
```typescript
import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import * as queries from "../db/queries.js";
import { createToken } from "../auth/jwt.js";
import { issueTicket } from "../auth/ws-ticket.js";
import { ValidationError } from "../lib/errors.js";

export function authRoutes(jwtSecret: string) {
  const router = new Hono<AppEnv>();

  // ShareRing SSO callback — receives verified identity
  // For v1, accepts address directly (SSO integration is decision-deferred per spec)
  router.post("/auth/sharering", async (c) => {
    const sql = c.get("sql");
    const body = await c.req.json<{ id: string; sharering_address: string }>();
    if (!body.id || !body.sharering_address) {
      throw new ValidationError("id and sharering_address required");
    }

    const user = await queries.upsertUser(sql, {
      id: body.id,
      sharering_address: body.sharering_address,
    });

    const token = await createToken(
      { userId: user.id, address: user.sharering_address },
      jwtSecret
    );

    return c.json({ token, user });
  });

  // Issue a short-lived WebSocket ticket
  router.post("/auth/ws-ticket", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json<{ projectId: string }>();
    if (!body.projectId) throw new ValidationError("projectId required");

    const ticket = issueTicket(userId, body.projectId);
    return c.json({ ticket });
  });

  return router;
}
```

- [ ] **Step 7: Update app.ts to use real JWT auth**

Replace the placeholder auth middleware in `packages/server/src/app.ts`:

```typescript
import { verifyToken } from "./auth/jwt.js";
import { authRoutes } from "./routes/auth.js";

// In createApp(sql, jwtSecret):
// Change signature to accept jwtSecret
export function createApp(sql: postgres.Sql, jwtSecret: string) {
  // ...

  // Auth middleware — skip for /auth and /health
  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/auth") || c.req.path === "/api/health") {
      return next();
    }
    const authHeader = c.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    try {
      const payload = await verifyToken(authHeader.slice(7), jwtSecret);
      c.set("userId", payload.userId);
    } catch {
      return c.json({ error: "Invalid token" }, 401);
    }
    await next();
  });

  // Add auth routes (before other /api routes)
  app.route("/api", authRoutes(jwtSecret));
  // ... rest of routes
}
```

- [ ] **Step 8: Update index.ts to pass JWT secret**

```typescript
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production-at-least-32-chars";
const app = createApp(sql, JWT_SECRET);
```

- [ ] **Step 9: Update existing tests to use JWT auth**

Update all test files that use the `x-user-id` header to use `Authorization: Bearer <token>` instead:

- `packages/server/src/routes/__tests__/projects.test.ts`

In each test's `beforeAll`, create a token:
```typescript
import { createToken } from "../../auth/jwt.js";

const JWT_SECRET = "test-secret-key-at-least-32-chars-long!!";
let authHeader: string;

beforeAll(async () => {
  // ... existing setup ...
  app = createApp(sql, JWT_SECRET);
  const token = await createToken({ userId: "test-user", address: "shareledger1test" }, JWT_SECRET);
  authHeader = `Bearer ${token}`;
});
```

Replace all `headers: { "x-user-id": "test-user" }` with `headers: { Authorization: authHeader }`.

For the 403 test (other user's project), create a second token:
```typescript
const otherToken = await createToken({ userId: "other-user", address: "shareledger1other" }, JWT_SECRET);
// Use: headers: { Authorization: `Bearer ${otherToken}` }
```

- [ ] **Step 10: Run all tests**

```bash
cd packages/server && npx vitest run
```

Expected: All PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/server/src
git commit -m "feat: add JWT auth, WebSocket tickets, and auth route"
```

---

### Task 5: AI Engine — Tool Definitions + System Prompt

**Files:**
- Create: `packages/server/src/ai/tool-definitions.ts`
- Create: `packages/server/src/ai/system-prompt.ts`
- Test: `packages/server/src/ai/__tests__/system-prompt.test.ts`

- [ ] **Step 1: Write Claude tool definitions**

`packages/server/src/ai/tool-definitions.ts`:
```typescript
import type Anthropic from "@anthropic-ai/sdk";

export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "chat",
    description: "Send a message to the user in the chat panel. Use this to ask questions, explain your plan, or provide guidance.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The message text to display to the user",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "write_file",
    description: "Create or update a file in the MeModule project. Use this to generate source code, configuration, and other project files.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to project root (e.g., 'src/App.tsx', 'manifest.json')",
        },
        content: {
          type: "string",
          description: "The complete file content",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "show_preview",
    description: "Show an HTML wireframe or mockup in the preview panel. Use during planning to show the user what screens will look like before generating code.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "Complete HTML content for the preview (rendered in an iframe)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "show_plan",
    description: "Show an HTML diagram or plan in the plan panel. Use to display screen flow diagrams, architecture overviews, or feature breakdowns.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "HTML content for the plan view (use inline CSS for layout)",
        },
      },
      required: ["content"],
    },
  },
];
```

- [ ] **Step 2: Write failing system prompt tests**

`packages/server/src/ai/__tests__/system-prompt.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt.js";

describe("buildSystemPrompt", () => {
  it("includes base MeModule knowledge", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("ShareRing Me Module");
    expect(prompt).toContain("createShareRingMeBridge");
    expect(prompt).toContain("hash routing");
    expect(prompt).toContain("manifest.json");
  });

  it("includes template context when provided", () => {
    const prompt = buildSystemPrompt({
      templateName: "Loyalty Card",
      templateFileTree: { "src/App.tsx": "export function App() {}" },
    });
    expect(prompt).toContain("Loyalty Card");
    expect(prompt).toContain("src/App.tsx");
  });

  it("includes project file tree when provided", () => {
    const prompt = buildSystemPrompt({
      fileTree: { "src/App.tsx": "import React from 'react'" },
    });
    expect(prompt).toContain("src/App.tsx");
  });

  it("does not exceed reasonable length", () => {
    const prompt = buildSystemPrompt({});
    // Base prompt should be under 15000 chars
    expect(prompt.length).toBeLessThan(15000);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/ai/__tests__/system-prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement system prompt builder**

`packages/server/src/ai/system-prompt.ts`:
```typescript
import type { FileTree } from "../lib/types.js";

interface PromptContext {
  templateName?: string;
  templateFileTree?: FileTree;
  fileTree?: FileTree;
}

const BASE_PROMPT = `You are an expert MeModule developer assistant. You help users build ShareRing Me Modules — web applications that run inside the ShareRing Me mobile app as embedded WebViews.

## Your Capabilities
You can:
- Ask clarifying questions about what the user wants to build (use the chat tool)
- Show wireframes and mockups before writing code (use show_preview tool)
- Show architecture plans and screen flows (use show_plan tool)
- Generate complete MeModule projects with all necessary files (use write_file tool)
- Modify existing project files based on user requests

## MeModule Technical Requirements

### Stack (always use this exact stack)
- React 18 + TypeScript
- Vite with \`base: "./"\` config
- Zustand for state management
- TailwindCSS for styling
- React Router with hash routing (\`createHashRouter\`)
- ShareRing Me bridge helper for native app communication

### Manifest (manifest.json at project root)
Every module needs a manifest.json:
\`\`\`json
{
  "version": "0.0.1",
  "offline_mode": false,
  "isMaintenance": false,
  "enable_secure_screen": false
}
\`\`\`

### ShareRing Me Bridge
Modules communicate with the native app via postMessage. The bridge helper handles request/response queuing:

\`\`\`typescript
// Bridge helper — always include as src/services/me-bridge.ts
export function createShareRingMeBridge() {
  let pending: { resolve: (v: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const queue: Array<{ type: string; payload?: unknown; timeout: number; resolve: (v: any) => void; reject: (e: any) => void }> = [];

  function processNext() {
    if (pending || queue.length === 0) return;
    const { type, payload, timeout, resolve, reject } = queue.shift()!;
    const timer = setTimeout(() => { pending = null; reject(new Error(\`Bridge timeout: \${type}\`)); processNext(); }, timeout);
    pending = { resolve, reject, timer };
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: type.toUpperCase(), payload }));
  }

  window.addEventListener("message", (event) => {
    if (!pending) return;
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data.error) { pending.reject(new Error(String(data.error))); }
      else { pending.resolve(data.payload); }
    } catch { return; }
    clearTimeout(pending.timer);
    pending = null;
    processNext();
  }, true);

  return {
    send(type: string, payload?: unknown, timeout = 30000): Promise<any> {
      return new Promise((resolve, reject) => {
        queue.push({ type, payload, timeout, resolve, reject });
        processNext();
      });
    },
  };
}
\`\`\`

### Available Bridge Events
- COMMON: APP_INFO, DEVICE_INFO, STATUS_BAR_DIMENSIONS, SET_STATUS_BAR_STYLE, COPY_TO_CLIPBOARD, OPEN_BROWSER, READ_ASYNC_STORAGE, WRITE_ASYNC_STORAGE
- NAVIGATION: NAVIGATE_TO, NAVIGATE_BACK, NAVIGATE_IS_FOCUSED, NAVIGATE_OPEN_DEVICE_SETTINGS, NAVIGATE_OPEN_LINK
- VAULT: VAULT_DOCUMENTS, VAULT_EMAIL, VAULT_AVATAR, VAULT_ADD_DOCUMENT, VAULT_ADD_CUSTOM_VALUE, VAULT_EXEC_QUERY, VAULT_EXEC_QUERY_SILENT
- WALLET: WALLET_MAIN_ACCOUNT, WALLET_CURRENT_ACCOUNT, WALLET_BALANCE, WALLET_ACCOUNTS, WALLET_SWITCH_ACCOUNT, WALLET_SIGN_TRANSACTION, WALLET_SIGN_AND_BROADCAST_TRANSACTION, WALLET_SWAP_ACCOUNT
- NFT: NFT_NFTS
- CRYPTO: CRYPTO_ENCRYPT, CRYPTO_DECRYPT, CRYPTO_SIGN, CRYPTO_VERIFY
- GOOGLE_WALLET: GOOGLE_WALLET_CAN_ADD_PASSES, GOOGLE_WALLET_ADD_PASS
- APPLE_WALLET: APPLE_WALLET_CAN_ADD_PASSES, APPLE_WALLET_ADD_PASS, APPLE_WALLET_HAS_PASS, APPLE_WALLET_REMOVE_PASS, APPLE_WALLET_VIEW_PASS

### Critical Rules
1. Always use hash routing (createHashRouter), never path-based routing
2. All asset paths must be relative (base: "./" in vite config)
3. Bridge event types must be UPPERCASE
4. One bridge request at a time (queue-based)
5. PIN-gated operations (WALLET_SIGN_*, CRYPTO_DECRYPT, CRYPTO_SIGN) need 60s timeout
6. Mobile-first responsive design
7. Use env(safe-area-inset-*) for notch handling
8. Always include manifest.json

## Workflow
1. When the user describes a new module, ask 2-3 clarifying questions first
2. Show a plan with screen flow diagram (use show_plan tool)
3. Show wireframes for key screens (use show_preview tool)
4. Once the user approves, generate all project files
5. Always generate: manifest.json, src/App.tsx, src/main.tsx, src/router.tsx, src/store/app-store.ts, src/services/me-bridge.ts, index.html
6. When the user requests changes, modify only the affected files`;

export function buildSystemPrompt(context: PromptContext): string {
  const parts = [BASE_PROMPT];

  if (context.templateName && context.templateFileTree) {
    parts.push(`\n## Template Context\nThis project started from the "${context.templateName}" template. Here are the template files:\n`);
    for (const [path, content] of Object.entries(context.templateFileTree)) {
      parts.push(`### ${path}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  if (context.fileTree && Object.keys(context.fileTree).length > 0) {
    parts.push(`\n## Current Project Files\nThe project currently contains these files:\n`);
    for (const [path, content] of Object.entries(context.fileTree)) {
      parts.push(`### ${path}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  return parts.join("\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/server && npx vitest run src/ai/__tests__/system-prompt.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/ai
git commit -m "feat: add AI tool definitions and system prompt builder"
```

---

### Task 6: AI Stream Processor + WebSocket Chat Route

**Files:**
- Create: `packages/server/src/ai/stream-processor.ts`
- Create: `packages/server/src/ai/context-manager.ts`
- Create: `packages/server/src/routes/ws-chat.ts`
- Modify: `packages/server/src/index.ts` (add WebSocket upgrade handling)
- Test: `packages/server/src/ai/__tests__/stream-processor.test.ts`

- [ ] **Step 1: Write failing stream processor tests**

`packages/server/src/ai/__tests__/stream-processor.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { processToolCall } from "../stream-processor.js";

describe("processToolCall", () => {
  it("converts chat tool call to chat message", () => {
    const result = processToolCall("chat", { content: "Hello!" });
    expect(result).toEqual({ type: "chat", content: "Hello!" });
  });

  it("converts write_file tool call to file message", () => {
    const result = processToolCall("write_file", {
      path: "src/App.tsx",
      content: "export function App() {}",
    });
    expect(result).toEqual({
      type: "file",
      path: "src/App.tsx",
      content: "export function App() {}",
    });
  });

  it("converts show_preview tool call to preview message", () => {
    const result = processToolCall("show_preview", { content: "<div>Preview</div>" });
    expect(result).toEqual({ type: "preview", content: "<div>Preview</div>" });
  });

  it("converts show_plan tool call to plan message", () => {
    const result = processToolCall("show_plan", { content: "<div>Plan</div>" });
    expect(result).toEqual({ type: "plan", content: "<div>Plan</div>" });
  });

  it("returns null for unknown tool", () => {
    const result = processToolCall("unknown", {});
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/ai/__tests__/stream-processor.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement stream processor**

`packages/server/src/ai/stream-processor.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { WebSocket } from "ws";
import type { ToolCallResult } from "../lib/types.js";

export interface WsMessage {
  seq: number;
  type: string;
  [key: string]: unknown;
}

export function processToolCall(
  toolName: string,
  input: Record<string, unknown>
): ToolCallResult | null {
  switch (toolName) {
    case "chat":
      return { type: "chat", content: input.content as string };
    case "write_file":
      return { type: "file", path: input.path as string, content: input.content as string };
    case "show_preview":
      return { type: "preview", content: input.content as string };
    case "show_plan":
      return { type: "plan", content: input.content as string };
    default:
      return null;
  }
}

export async function streamAiResponse(params: {
  client: Anthropic;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  ws: WebSocket;
  seqCounter: { value: number };
  abortSignal?: AbortSignal;
  onFileWrite: (path: string, content: string) => Promise<void>;
  onChatMessage: (content: string) => Promise<void>;
}) {
  const { client, systemPrompt, messages, tools, ws, seqCounter, abortSignal, onFileWrite, onChatMessage } = params;

  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
  const stream = client.messages.stream({
    model,
    max_tokens: 16384,
    system: systemPrompt,
    messages,
    tools,
  });

  let currentToolName = "";
  let currentToolInput = "";
  let currentTextContent = "";

  for await (const event of stream) {
    if (abortSignal?.aborted) {
      stream.abort();
      break;
    }
    if (event.type === "content_block_start") {
      if (event.content_block.type === "tool_use") {
        currentToolName = event.content_block.name;
        currentToolInput = "";
      } else if (event.content_block.type === "text") {
        // Text blocks outside tool calls — stream as chat
        // (Claude may include thinking text outside tool calls)
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "input_json_delta") {
        currentToolInput += event.delta.partial_json;
      } else if (event.delta.type === "text_delta") {
        // Stream text as chat content and accumulate for history
        currentTextContent += event.delta.text;
        const msg: WsMessage = {
          seq: seqCounter.value++,
          type: "chat",
          content: event.delta.text,
          streaming: true,
        };
        ws.send(JSON.stringify(msg));
      }
    } else if (event.type === "content_block_stop") {
      // If we were accumulating text content, finalize it
      if (currentTextContent) {
        const finalMsg: WsMessage = {
          seq: seqCounter.value++,
          type: "chat",
          content: currentTextContent,
          streaming: false,
        };
        ws.send(JSON.stringify(finalMsg));
        await onChatMessage(currentTextContent);
        currentTextContent = "";
      }
      if (currentToolName) {
        try {
          const input = JSON.parse(currentToolInput);
          const result = processToolCall(currentToolName, input);
          if (result) {
            const msg: WsMessage = {
              seq: seqCounter.value++,
              type: result.type,
              ...(result.path ? { path: result.path } : {}),
              content: result.content,
            };
            ws.send(JSON.stringify(msg));

            // Side effects
            if (result.type === "file" && result.path) {
              await onFileWrite(result.path, result.content);
            } else if (result.type === "chat") {
              await onChatMessage(result.content);
            }
          }
        } catch (e) {
          console.error("Failed to parse tool input:", e);
        }
        currentToolName = "";
        currentToolInput = "";
      }
    }
  }

  // Send generation complete
  const doneMsg: WsMessage = {
    seq: seqCounter.value++,
    type: "generation_complete",
  };
  ws.send(JSON.stringify(doneMsg));
}
```

- [ ] **Step 4: Implement context manager**

`packages/server/src/ai/context-manager.ts`:
```typescript
import type Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage } from "../lib/types.js";

const MAX_RECENT_MESSAGES = 20;

// Future enhancement: summarize evicted messages into a condensed context block
// per spec section 6.4, rather than silently dropping them.

export function buildMessageHistory(
  messages: ConversationMessage[]
): Anthropic.MessageParam[] {
  // Take the most recent N messages (older ones are dropped for now)
  const recent = messages.slice(-MAX_RECENT_MESSAGES);

  return recent.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/server && npx vitest run src/ai/__tests__/stream-processor.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Implement WebSocket chat route**

`packages/server/src/routes/ws-chat.ts`:
```typescript
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type postgres from "postgres";
import Anthropic from "@anthropic-ai/sdk";
import { consumeTicket } from "../auth/ws-ticket.js";
import * as queries from "../db/queries.js";
import { buildSystemPrompt } from "../ai/system-prompt.js";
import { AI_TOOLS } from "../ai/tool-definitions.js";
import { streamAiResponse, type WsMessage } from "../ai/stream-processor.js";
import { buildMessageHistory } from "../ai/context-manager.js";

export function setupWebSocket(server: Server, sql: postgres.Sql) {
  const anthropic = new Anthropic();
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);

    if (!url.pathname.startsWith("/ws/projects/")) {
      socket.destroy();
      return;
    }

    const pathParts = url.pathname.split("/");
    const projectId = pathParts[3];
    const ticket = url.searchParams.get("ticket");

    if (!ticket) {
      socket.destroy();
      return;
    }

    const auth = consumeTicket(ticket);
    if (!auth || auth.projectId !== projectId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, auth.userId, projectId);
    });
  });

  wss.on("connection", (ws: WebSocket, userId: string, projectId: string) => {
    const seqCounter = { value: 1 };
    let isGenerating = false;
    let abortController: AbortController | null = null;

    // Send connected message
    const connMsg: WsMessage = {
      seq: seqCounter.value++,
      type: "connected",
      projectId,
    };
    ws.send(JSON.stringify(connMsg));

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "user_message") {
          if (isGenerating) {
            ws.send(JSON.stringify({
              seq: seqCounter.value++,
              type: "error",
              code: "busy",
              message: "AI is still generating. Please wait or cancel.",
            }));
            return;
          }

          isGenerating = true;
          abortController = new AbortController();

          // Get project and conversation
          const project = await queries.getProject(sql, projectId);
          if (!project || project.user_id !== userId) {
            ws.send(JSON.stringify({
              seq: seqCounter.value++,
              type: "error",
              code: "not_found",
              message: "Project not found",
            }));
            isGenerating = false;
            return;
          }

          let conversation = await queries.getConversationByProjectId(sql, projectId);
          if (!conversation) {
            conversation = await queries.createConversation(sql, projectId);
          }

          // Append user message
          const userMsg = {
            role: "user" as const,
            content: msg.content,
            timestamp: new Date().toISOString(),
          };
          await queries.appendMessage(sql, conversation.id, userMsg);

          // Build AI context
          const systemPrompt = buildSystemPrompt({ fileTree: project.file_tree });
          const allMessages = [...conversation.messages, userMsg];
          const messageHistory = buildMessageHistory(allMessages);

          try {
            const assistantParts: string[] = [];

            await streamAiResponse({
              client: anthropic,
              systemPrompt,
              messages: messageHistory,
              tools: AI_TOOLS,
              ws,
              seqCounter,
              abortSignal: abortController!.signal,
              onFileWrite: async (path, content) => {
                await queries.updateFile(sql, projectId, path, content);
              },
              onChatMessage: async (content) => {
                assistantParts.push(content);
              },
            });

            // Save assistant message to conversation
            if (assistantParts.length > 0) {
              await queries.appendMessage(sql, conversation.id, {
                role: "assistant",
                content: assistantParts.join(""),
                timestamp: new Date().toISOString(),
              });
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "AI error";
            ws.send(JSON.stringify({
              seq: seqCounter.value++,
              type: "error",
              code: "ai_error",
              message: errorMsg,
            }));
          } finally {
            isGenerating = false;
          }
        } else if (msg.type === "cancel") {
          abortController?.abort();
          isGenerating = false;
        } else if (msg.type === "file_edited") {
          // User edited a file in the code editor
          await queries.updateFile(sql, projectId, msg.path, msg.content);
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    });
  });
}
```

- [ ] **Step 7: Update server entry to use WebSocket**

Modify `packages/server/src/index.ts`:
```typescript
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb, migrate } from "./db/schema.js";
import { setupWebSocket } from "./routes/ws-chat.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/memodule_dev";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production-at-least-32-chars";
const PORT = Number(process.env.PORT ?? 3001);

async function main() {
  const sql = createDb(DATABASE_URL);
  await migrate(sql);
  console.log("Database migrated");

  const app = createApp(sql, JWT_SECRET);

  const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });

  setupWebSocket(server, sql);
  console.log("WebSocket ready");
}

main().catch(console.error);
```

- [ ] **Step 8: Add ws dependency**

```bash
cd packages/server && npm install ws && npm install -D @types/ws
```

- [ ] **Step 9: Run all server tests**

```bash
cd packages/server && npx vitest run
```

Expected: All PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/server
git commit -m "feat: add AI stream processor, context manager, and WebSocket chat route"
```

---

## Chunk 3: Frontend — App Shell, Stores, and API Client

### Task 7: Frontend App Shell + Routing

**Files:**
- Create: `packages/frontend/src/main.tsx`
- Create: `packages/frontend/src/App.tsx`
- Create: `packages/frontend/src/index.css`
- Create: `packages/frontend/src/lib/types.ts`
- Create: `packages/frontend/src/lib/auth.ts`
- Create: `packages/frontend/src/pages/Login.tsx`
- Create: `packages/frontend/src/pages/Dashboard.tsx`
- Create: `packages/frontend/src/pages/Workspace.tsx`

- [ ] **Step 1: Write frontend types**

`packages/frontend/src/lib/types.ts`:
```typescript
export interface User {
  id: string;
  sharering_address: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "building" | "ready";
  template_id: string | null;
  file_tree: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  tags: string[];
}

export interface WsMessage {
  seq: number;
  type: "connected" | "chat" | "file" | "preview" | "plan" | "generation_complete" | "error";
  content?: string;
  path?: string;
  streaming?: boolean;
  code?: string;
  message?: string;
  projectId?: string;
}
```

- [ ] **Step 2: Write auth helper**

`packages/frontend/src/lib/auth.ts`:
```typescript
const TOKEN_KEY = "memodule_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
```

- [ ] **Step 3: Write index.css with TailwindCSS**

`packages/frontend/src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Write main entry point**

`packages/frontend/src/main.tsx`:
```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Write App with routing**

`packages/frontend/src/App.tsx`:
```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Workspace } from "./pages/Workspace";
import { isAuthenticated } from "./lib/auth";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id"
          element={
            <ProtectedRoute>
              <Workspace />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Write placeholder pages**

`packages/frontend/src/pages/Login.tsx`:
```typescript
import { useNavigate } from "react-router-dom";
import { setToken } from "../lib/auth";

export function Login() {
  const navigate = useNavigate();

  // Dev mode: mock login for now (ShareRing SSO integration is decision-deferred)
  async function handleLogin() {
    const res = await fetch("/api/auth/sharering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "dev-user",
        sharering_address: "shareledger1devuser",
      }),
    });
    const data = await res.json();
    setToken(data.token);
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-white mb-2">MeModule Developer</h1>
        <p className="text-slate-400 mb-6">
          Build ShareRing Me Modules with AI assistance
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Login with ShareRing Me
        </button>
      </div>
    </div>
  );
}
```

`packages/frontend/src/pages/Dashboard.tsx`:
```typescript
export function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <p className="text-slate-400">Dashboard will be implemented in Task 10.</p>
    </div>
  );
}
```

`packages/frontend/src/pages/Workspace.tsx`:
```typescript
export function Workspace() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Workspace</h1>
      <p className="text-slate-400">Workspace will be implemented in Task 11.</p>
    </div>
  );
}
```

- [ ] **Step 7: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add frontend app shell with routing, auth, and placeholder pages"
```

---

### Task 8: API Client + WebSocket Client

**Files:**
- Create: `packages/frontend/src/lib/api-client.ts`
- Create: `packages/frontend/src/lib/ws-client.ts`

- [ ] **Step 1: Write REST API client**

`packages/frontend/src/lib/api-client.ts`:
```typescript
import { getToken } from "./auth";

const BASE_URL = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json();
  }
  return res as unknown as T;
}

export const api = {
  // Projects
  listProjects: () => request<any[]>("/projects"),
  createProject: (data: { name: string; description?: string; template_id?: string }) =>
    request<any>("/projects", { method: "POST", body: JSON.stringify(data) }),
  getProject: (id: string) => request<any>(`/projects/${id}`),
  updateProject: (id: string, data: { name?: string; description?: string }) =>
    request<any>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<any>(`/projects/${id}`, { method: "DELETE" }),

  // Files
  getFiles: (projectId: string) => request<Record<string, string>>(`/projects/${projectId}/files`),
  updateFile: (projectId: string, path: string, content: string) =>
    request<any>(`/projects/${projectId}/files/${path}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  // Templates
  listTemplates: (category?: string) =>
    request<any[]>(`/templates${category ? `?category=${category}` : ""}`),

  // Export
  exportProject: async (projectId: string): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/projects/${projectId}/export`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    return res.blob();
  },

  // Auth
  getWsTicket: (projectId: string) =>
    request<{ ticket: string }>("/auth/ws-ticket", {
      method: "POST",
      body: JSON.stringify({ projectId }),
    }),
};
```

- [ ] **Step 2: Write WebSocket client with reconnection**

`packages/frontend/src/lib/ws-client.ts`:
```typescript
import type { WsMessage } from "./types";
import { api } from "./api-client";

export type WsMessageHandler = (msg: WsMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private projectId: string;
  private handlers: WsMessageHandler[] = [];
  private lastSeq = 0;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  onMessage(handler: WsMessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    const { ticket } = await api.getWsTicket(this.projectId);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/projects/${this.projectId}/chat?ticket=${ticket}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Send resume if reconnecting with a known lastSeq
      if (this.lastSeq > 0) {
        this.ws!.send(JSON.stringify({ type: "resume", lastSeq: this.lastSeq }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.lastSeq = msg.seq;
        this.reconnectDelay = 1000; // Reset on successful message
        for (const handler of this.handlers) {
          handler(msg);
        }
      } catch (e) {
        console.error("Failed to parse WS message:", e);
      }
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        setTimeout(() => this.reconnect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private async reconnect(): Promise<void> {
    if (!this.shouldReconnect) return;
    try {
      await this.connect();
    } catch {
      setTimeout(() => this.reconnect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }
  }

  send(msg: { type: string; [key: string]: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendMessage(content: string): void {
    this.send({ type: "user_message", content });
  }

  sendFileEdit(path: string, content: string): void {
    this.send({ type: "file_edited", path, content });
  }

  sendCancel(): void {
    this.send({ type: "cancel", reason: "user_cancelled" });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/lib
git commit -m "feat: add REST API client and WebSocket client with reconnection"
```

---

### Task 9: Zustand Stores

**Files:**
- Create: `packages/frontend/src/store/auth-store.ts`
- Create: `packages/frontend/src/store/project-store.ts`
- Create: `packages/frontend/src/store/chat-store.ts`
- Create: `packages/frontend/src/store/workspace-store.ts`

- [ ] **Step 1: Write auth store**

`packages/frontend/src/store/auth-store.ts`:
```typescript
import { create } from "zustand";
import { getToken, setToken, clearToken } from "../lib/auth";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  restore: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isAuthenticated: getToken() !== null,

  login: (token, user) => {
    setToken(token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, isAuthenticated: false });
  },

  restore: () => {
    const token = getToken();
    set({ token, isAuthenticated: token !== null });
  },
}));
```

- [ ] **Step 2: Write project store**

`packages/frontend/src/store/project-store.ts`:
```typescript
import { create } from "zustand";
import { api } from "../lib/api-client";
import type { Project, Template } from "../lib/types";

interface ProjectState {
  projects: Project[];
  templates: Template[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  createProject: (name: string, templateId?: string) => Promise<Project>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateFileTree: (fileTree: Record<string, string>) => void;
  updateFile: (path: string, content: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  templates: [],
  currentProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await api.listProjects();
      set({ projects, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await api.listTemplates();
      set({ templates });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  createProject: async (name, templateId) => {
    const project = await api.createProject({ name, template_id: templateId });
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  loadProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const project = await api.getProject(id);
      set({ currentProject: project, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  updateFileTree: (fileTree) => {
    set((s) => s.currentProject ? { currentProject: { ...s.currentProject, file_tree: fileTree } } : {});
  },

  updateFile: (path, content) => {
    set((s) => {
      if (!s.currentProject) return {};
      return {
        currentProject: {
          ...s.currentProject,
          file_tree: { ...s.currentProject.file_tree, [path]: content },
        },
      };
    });
  },
}));
```

- [ ] **Step 3: Write chat store**

`packages/frontend/src/store/chat-store.ts`:
```typescript
import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;

  addUserMessage: (content: string) => void;
  appendStreamContent: (content: string) => void;
  finalizeStream: () => void;
  startStreaming: () => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streamingContent: "",
  isStreaming: false,
  error: null,

  addUserMessage: (content) => {
    const msg: ChatMessage = {
      id: `msg-${++msgCounter}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, msg], error: null }));
  },

  startStreaming: () => {
    set({ isStreaming: true, streamingContent: "", error: null });
  },

  appendStreamContent: (content) => {
    set((s) => ({ streamingContent: s.streamingContent + content }));
  },

  finalizeStream: () => {
    const { streamingContent, messages } = get();
    if (streamingContent) {
      const msg: ChatMessage = {
        id: `msg-${++msgCounter}`,
        role: "assistant",
        content: streamingContent,
        timestamp: new Date().toISOString(),
      };
      set({ messages: [...messages, msg], streamingContent: "", isStreaming: false });
    } else {
      set({ isStreaming: false, streamingContent: "" });
    }
  },

  setError: (error) => set({ error, isStreaming: false }),
  clearMessages: () => set({ messages: [], streamingContent: "", isStreaming: false, error: null }),
}));
```

- [ ] **Step 4: Write workspace store**

`packages/frontend/src/store/workspace-store.ts`:
```typescript
import { create } from "zustand";

export type TabId = "plan" | "code" | "preview";

interface WorkspaceState {
  activeTab: TabId;
  selectedFile: string | null;
  openFiles: string[];
  planContent: string;
  previewContent: string;

  setActiveTab: (tab: TabId) => void;
  selectFile: (path: string) => void;
  closeFile: (path: string) => void;
  setPlanContent: (content: string) => void;
  setPreviewContent: (content: string) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeTab: "plan",
  selectedFile: null,
  openFiles: [],
  planContent: "",
  previewContent: "",

  setActiveTab: (tab) => set({ activeTab: tab }),

  selectFile: (path) =>
    set((s) => ({
      selectedFile: path,
      activeTab: "code",
      openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
    })),

  closeFile: (path) =>
    set((s) => {
      const openFiles = s.openFiles.filter((f) => f !== path);
      return {
        openFiles,
        selectedFile: s.selectedFile === path ? (openFiles[0] ?? null) : s.selectedFile,
      };
    }),

  setPlanContent: (content) => set({ planContent: content, activeTab: "plan" }),
  setPreviewContent: (content) => set({ previewContent: content, activeTab: "preview" }),
  reset: () => set({ activeTab: "plan", selectedFile: null, openFiles: [], planContent: "", previewContent: "" }),
}));
```

- [ ] **Step 5: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/store
git commit -m "feat: add Zustand stores for auth, projects, chat, and workspace state"
```

---

## Chunk 4: Frontend — Dashboard + Workspace UI

### Task 10: Dashboard Page

**Files:**
- Modify: `packages/frontend/src/pages/Dashboard.tsx`
- Create: `packages/frontend/src/components/dashboard/ProjectCard.tsx`
- Create: `packages/frontend/src/components/dashboard/TemplateCard.tsx`

- [ ] **Step 1: Write ProjectCard component**

`packages/frontend/src/components/dashboard/ProjectCard.tsx`:
```typescript
import { useNavigate } from "react-router-dom";
import type { Project } from "../../lib/types";

interface Props {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: Props) {
  const navigate = useNavigate();

  return (
    <div
      className="bg-slate-800 rounded-lg p-4 cursor-pointer hover:bg-slate-750 transition-colors border border-slate-700 hover:border-slate-600"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-white font-medium truncate">{project.name}</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
          {project.status}
        </span>
      </div>
      {project.description && (
        <p className="text-slate-400 text-sm mb-3 line-clamp-2">{project.description}</p>
      )}
      <div className="flex justify-between items-center">
        <span className="text-slate-500 text-xs">
          {new Date(project.updated_at).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
          className="text-slate-500 hover:text-red-400 text-xs"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write TemplateCard component**

`packages/frontend/src/components/dashboard/TemplateCard.tsx`:
```typescript
import type { Template } from "../../lib/types";

interface Props {
  template: Template;
  onUse: (id: string) => void;
}

export function TemplateCard({ template, onUse }: Props) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="mb-2">
        <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300">
          {template.category}
        </span>
      </div>
      <h3 className="text-white font-medium mb-1">{template.name}</h3>
      <p className="text-slate-400 text-sm mb-3">{template.description}</p>
      <button
        onClick={() => onUse(template.id)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg transition-colors"
      >
        Use Template
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Implement Dashboard page**

Replace `packages/frontend/src/pages/Dashboard.tsx`:
```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "../store/project-store";
import { useAuthStore } from "../store/auth-store";
import { ProjectCard } from "../components/dashboard/ProjectCard";
import { TemplateCard } from "../components/dashboard/TemplateCard";

export function Dashboard() {
  const navigate = useNavigate();
  const { projects, templates, fetchProjects, fetchTemplates, createProject, deleteProject } = useProjectStore();
  const { logout } = useAuthStore();
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchTemplates();
  }, [fetchProjects, fetchTemplates]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const project = await createProject(newName.trim());
    navigate(`/project/${project.id}`);
  }

  async function handleUseTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    const name = template ? `${template.name} Module` : "New Module";
    const project = await createProject(name, templateId);
    navigate(`/project/${project.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">MeModule Developer</h1>
        <button onClick={logout} className="text-slate-400 hover:text-white text-sm">
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Create New */}
        <section className="mb-10">
          {showCreate ? (
            <div className="flex gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Module name..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                Create
              </button>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white px-4">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg"
            >
              + Create New Module
            </button>
          )}
        </section>

        {/* Templates */}
        {templates.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Start from Template</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={handleUseTemplate} />
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        <section>
          <h2 className="text-lg font-semibold mb-4">My Projects</h2>
          {projects.length === 0 ? (
            <p className="text-slate-500">No projects yet. Create one or start from a template.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={deleteProject} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add Dashboard page with project list and template gallery"
```

---

### Task 11: Workspace — Chat Panel + Tab Bar

**Files:**
- Modify: `packages/frontend/src/pages/Workspace.tsx`
- Create: `packages/frontend/src/components/chat/ChatPanel.tsx`
- Create: `packages/frontend/src/components/chat/ChatMessage.tsx`
- Create: `packages/frontend/src/components/tabs/TabBar.tsx`
- Create: `packages/frontend/src/components/tabs/PlanTab.tsx`

- [ ] **Step 1: Write ChatMessage component**

`packages/frontend/src/components/chat/ChatMessage.tsx`:
```typescript
import type { ChatMessage as ChatMessageType } from "../../store/chat-store";

interface Props {
  message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`px-4 py-3 ${isUser ? "" : "bg-slate-800/50"}`}>
      <div className="max-w-prose">
        <div className={`text-xs font-medium mb-1 ${isUser ? "text-blue-400" : "text-emerald-400"}`}>
          {isUser ? "You" : "AI Assistant"}
        </div>
        <div className="text-slate-200 text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write ChatPanel component**

`packages/frontend/src/components/chat/ChatPanel.tsx`:
```typescript
import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../../store/chat-store";
import { ChatMessage } from "./ChatMessage";

interface Props {
  onSend: (content: string) => void;
  isConnected: boolean;
}

export function ChatPanel({ onSend, isConnected }: Props) {
  const { messages, streamingContent, isStreaming } = useChatStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-white">AI Chat</h2>
        <div className={`text-xs ${isConnected ? "text-emerald-400" : "text-red-400"}`}>
          {isConnected ? "Connected" : "Reconnecting..."}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isStreaming && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            Describe the MeModule you want to build, or ask for help getting started.
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isStreaming && streamingContent && (
          <div className="px-4 py-3 bg-slate-800/50">
            <div className="max-w-prose">
              <div className="text-xs font-medium mb-1 text-emerald-400">AI Assistant</div>
              <div className="text-slate-200 text-sm whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? "AI is responding..." : "Describe your module..."}
            disabled={isStreaming || !isConnected}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim() || !isConnected}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write TabBar component**

`packages/frontend/src/components/tabs/TabBar.tsx`:
```typescript
import { useWorkspaceStore, type TabId } from "../../store/workspace-store";

const TABS: { id: TabId; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "code", label: "Code" },
  { id: "preview", label: "Preview" },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useWorkspaceStore();

  return (
    <div className="flex border-b border-slate-700">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write PlanTab component**

`packages/frontend/src/components/tabs/PlanTab.tsx`:
```typescript
import { useWorkspaceStore } from "../../store/workspace-store";

export function PlanTab() {
  const { planContent } = useWorkspaceStore();

  if (!planContent) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Start a conversation to see your module plan here.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: planContent }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Implement Workspace page with two-panel layout**

Replace `packages/frontend/src/pages/Workspace.tsx`:
```typescript
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "../store/project-store";
import { useChatStore } from "../store/chat-store";
import { useWorkspaceStore } from "../store/workspace-store";
import { WsClient } from "../lib/ws-client";
import { ChatPanel } from "../components/chat/ChatPanel";
import { TabBar } from "../components/tabs/TabBar";
import { PlanTab } from "../components/tabs/PlanTab";
import type { WsMessage } from "../lib/types";

export function Workspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadProject, currentProject, updateFile } = useProjectStore();
  const { addUserMessage, appendStreamContent, finalizeStream, startStreaming, setError } = useChatStore();
  const { activeTab, setPlanContent, setPreviewContent, reset } = useWorkspaceStore();
  const [wsClient, setWsClient] = useState<WsClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadProject(id);
    reset();

    const client = new WsClient(id);
    setWsClient(client);

    const unsub = client.onMessage((msg: WsMessage) => {
      switch (msg.type) {
        case "connected":
          setIsConnected(true);
          break;
        case "chat":
          if (msg.streaming) {
            appendStreamContent(msg.content ?? "");
          }
          // streaming: false is the finalized message — handled by generation_complete
          break;
        case "file":
          if (msg.path && msg.content !== undefined) {
            updateFile(msg.path, msg.content);
          }
          break;
        case "preview":
          if (msg.content) setPreviewContent(msg.content);
          break;
        case "plan":
          if (msg.content) setPlanContent(msg.content);
          break;
        case "generation_complete":
          finalizeStream();
          break;
        case "error":
          setError(msg.message ?? "An error occurred");
          break;
      }
    });

    client.connect().catch(console.error);

    return () => {
      unsub();
      client.disconnect();
    };
  }, [id]);

  const handleSend = useCallback((content: string) => {
    if (!wsClient) return;
    addUserMessage(content);
    startStreaming();
    wsClient.sendMessage(content);
  }, [wsClient, addUserMessage, startStreaming]);

  if (!id) {
    navigate("/");
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-white text-sm">
            &larr; Back
          </button>
          <h1 className="text-white font-medium text-sm">{currentProject?.name ?? "Loading..."}</h1>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="w-[35%] min-w-[300px] border-r border-slate-800">
          <ChatPanel onSend={handleSend} isConnected={isConnected} />
        </div>

        {/* Right: Tabbed panel */}
        <div className="flex-1 flex flex-col">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            {activeTab === "plan" && <PlanTab />}
            {activeTab === "code" && (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                Code editor (Task 12)
              </div>
            )}
            {activeTab === "preview" && (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                Preview (Task 13)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add Workspace page with chat panel, tab bar, and two-panel layout"
```

---

## Chunk 5: Code Editor, Preview Engine, and Templates

### Task 12: Code Editor (Monaco)

**Files:**
- Create: `packages/frontend/src/components/code/FileTree.tsx`
- Create: `packages/frontend/src/components/code/MonacoEditor.tsx`
- Create: `packages/frontend/src/components/tabs/CodeTab.tsx`
- Modify: `packages/frontend/src/pages/Workspace.tsx` (replace code placeholder)

- [ ] **Step 1: Write FileTree component**

`packages/frontend/src/components/code/FileTree.tsx`:
```typescript
import { useWorkspaceStore } from "../../store/workspace-store";

interface Props {
  files: Record<string, string>;
}

export function FileTree({ files }: Props) {
  const { selectedFile, selectFile } = useWorkspaceStore();
  const paths = Object.keys(files).sort();

  return (
    <div className="w-48 border-r border-slate-700 overflow-y-auto text-xs">
      <div className="px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider">Files</div>
      {paths.map((path) => (
        <button
          key={path}
          onClick={() => selectFile(path)}
          className={`w-full text-left px-3 py-1.5 truncate hover:bg-slate-800 ${
            selectedFile === path ? "bg-slate-800 text-blue-400" : "text-slate-300"
          }`}
          title={path}
        >
          {path.split("/").pop()}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write MonacoEditor wrapper**

`packages/frontend/src/components/code/MonacoEditor.tsx`:
```typescript
import Editor from "@monaco-editor/react";

interface Props {
  path: string;
  content: string;
  onChange: (content: string) => void;
}

function getLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  return "plaintext";
}

export function MonacoEditor({ path, content, onChange }: Props) {
  return (
    <Editor
      height="100%"
      language={getLanguage(path)}
      value={content}
      onChange={(value) => onChange(value ?? "")}
      theme="vs-dark"
      options={{
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
```

- [ ] **Step 3: Write CodeTab component**

`packages/frontend/src/components/tabs/CodeTab.tsx`:
```typescript
import { useProjectStore } from "../../store/project-store";
import { useWorkspaceStore } from "../../store/workspace-store";
import { FileTree } from "../code/FileTree";
import { MonacoEditor } from "../code/MonacoEditor";

interface Props {
  onFileEdit: (path: string, content: string) => void;
}

export function CodeTab({ onFileEdit }: Props) {
  const { currentProject, updateFile } = useProjectStore();
  const { selectedFile, openFiles, closeFile } = useWorkspaceStore();

  if (!currentProject) return null;

  const fileTree = currentProject.file_tree;
  const content = selectedFile ? fileTree[selectedFile] ?? "" : "";

  function handleChange(newContent: string) {
    if (!selectedFile) return;
    updateFile(selectedFile, newContent);
    onFileEdit(selectedFile, newContent);
  }

  return (
    <div className="flex h-full">
      <FileTree files={fileTree} />
      <div className="flex-1 flex flex-col">
        {/* Open file tabs */}
        {openFiles.length > 0 && (
          <div className="flex border-b border-slate-700 bg-slate-900">
            {openFiles.map((path) => (
              <div
                key={path}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-slate-700 ${
                  path === selectedFile ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:bg-slate-800"
                }`}
                onClick={() => useWorkspaceStore.getState().selectFile(path)}
              >
                <span>{path.split("/").pop()}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeFile(path); }}
                  className="hover:text-red-400 ml-1"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1">
          {selectedFile ? (
            <MonacoEditor path={selectedFile} content={content} onChange={handleChange} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Select a file from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update Workspace to use CodeTab**

In `packages/frontend/src/pages/Workspace.tsx`, replace the code placeholder:
```typescript
import { CodeTab } from "../components/tabs/CodeTab";

// In the tabbed panel section, replace the code placeholder with:
{activeTab === "code" && (
  <CodeTab onFileEdit={(path, content) => wsClient?.sendFileEdit(path, content)} />
)}
```

- [ ] **Step 5: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add Monaco code editor with file tree and tab management"
```

---

### Task 13: Preview Engine (esbuild-wasm)

**Files:**
- Create: `packages/frontend/src/components/preview/PreviewEngine.ts`
- Create: `packages/frontend/src/components/preview/MockBridge.ts`
- Create: `packages/frontend/src/components/preview/PreviewFrame.tsx`
- Create: `packages/frontend/src/components/preview/ErrorOverlay.tsx`
- Create: `packages/frontend/src/components/tabs/PreviewTab.tsx`
- Create: `packages/frontend/src/preview-iframe/index.html`
- Modify: `packages/frontend/src/pages/Workspace.tsx` (replace preview placeholder)

- [ ] **Step 1: Write MockBridge for preview**

`packages/frontend/src/components/preview/MockBridge.ts`:
```typescript
// Mock ShareRing Me bridge for preview iframe
// Returns realistic test data so modules are interactive in preview

const storage = new Map<string, string>();

export const MOCK_BRIDGE_SCRIPT = `
(function() {
  const storage = {};

  window.ReactNativeWebView = {
    postMessage: function(data) {
      try {
        const msg = JSON.parse(data);
        let response = { type: msg.type, payload: null };

        switch (msg.type) {
          case 'WALLET_CURRENT_ACCOUNT':
          case 'WALLET_MAIN_ACCOUNT':
            response.payload = {
              address: 'shareledger1mock7x2kqe9q5jk8z3mdt8v6s',
              pubKey: 'mock_pub_key_base64'
            };
            break;
          case 'WALLET_BALANCE':
            response.payload = [{ amount: '1000000000', denom: 'nshr' }];
            break;
          case 'COMMON_APP_INFO':
            response.payload = { language: 'en', darkMode: true, version: '1.0.0', appId: 'preview' };
            break;
          case 'COMMON_DEVICE_INFO':
            response.payload = { brand: 'Preview', model: 'Browser', os: 'web', country: 'US' };
            break;
          case 'COMMON_READ_ASYNC_STORAGE':
            response.payload = storage[msg.payload?.key] ?? null;
            break;
          case 'COMMON_WRITE_ASYNC_STORAGE':
            storage[msg.payload?.key] = msg.payload?.value;
            response.payload = true;
            break;
          case 'VAULT_EMAIL':
            response.payload = 'user@example.com';
            break;
          case 'VAULT_DOCUMENTS':
            response.payload = [{ id: 'doc-1', type: 'passport', name: 'Sample Passport' }];
            break;
          case 'CRYPTO_ENCRYPT':
            response.payload = btoa(msg.payload?.data ?? '');
            break;
          case 'CRYPTO_DECRYPT':
            response.payload = atob(msg.payload?.data ?? '');
            break;
          default:
            response.payload = null;
        }

        setTimeout(() => {
          window.postMessage(JSON.stringify(response), '*');
        }, 100);
      } catch(e) { console.error('Mock bridge error:', e); }
    }
  };
})();
`;
```

- [ ] **Step 2: Write PreviewEngine (esbuild-wasm transpilation)**

`packages/frontend/src/components/preview/PreviewEngine.ts`:
```typescript
import * as esbuild from "esbuild-wasm";

let initialized = false;

export async function initEsbuild() {
  if (initialized) return;
  await esbuild.initialize({
    wasmURL: "https://unpkg.com/esbuild-wasm@0.25.0/esbuild.wasm",
  });
  initialized = true;
}

export async function transpileFile(
  path: string,
  content: string
): Promise<{ code: string; error: string | null }> {
  try {
    await initEsbuild();
    const result = await esbuild.transform(content, {
      loader: path.endsWith(".tsx") ? "tsx" : path.endsWith(".ts") ? "ts" : "jsx",
      jsx: "automatic",
      jsxImportSource: "react",
      format: "esm",
      target: "es2020",
    });
    return { code: result.code, error: null };
  } catch (e) {
    return { code: "", error: (e as Error).message };
  }
}

export function generatePreviewHtml(
  fileTree: Record<string, string>,
  transpiledFiles: Map<string, string>
): string {
  // Build import map: bare imports → CDN, project files → blob URLs
  const importMap: Record<string, string> = {
    react: "https://esm.sh/react@18.3.1",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
    "react-router-dom": "https://esm.sh/react-router-dom@7.1.5",
    zustand: "https://esm.sh/zustand@5.0.11",
    "zustand/middleware": "https://esm.sh/zustand@5.0.11/middleware",
  };

  // Create blob URLs for transpiled project files
  // First pass: create blob URLs for all files
  const blobUrls = new Map<string, string>();
  for (const [path, code] of transpiledFiles) {
    const blob = new Blob([code], { type: "text/javascript" });
    blobUrls.set(path, URL.createObjectURL(blob));
  }

  // Add all possible import path forms to the import map
  // esbuild emits relative imports based on the importing file's location,
  // so we need to map all the ways a file can be referenced
  for (const [path, url] of blobUrls) {
    // Full path from root: "./src/screens/Home"
    const fromRoot = "./" + path.replace(/\.tsx?$/, "");
    importMap[fromRoot] = url;

    // Without src/ prefix: "./screens/Home" (when imported from src/App.tsx)
    const withoutSrc = "./" + path.replace(/^src\//, "").replace(/\.tsx?$/, "");
    importMap[withoutSrc] = url;

    // With various extensions
    for (const variant of [fromRoot, withoutSrc]) {
      importMap[variant + ".js"] = url;
      importMap[variant + ".ts"] = url;
      importMap[variant + ".tsx"] = url;
      importMap[variant + ".jsx"] = url;
    }

    // Also map the bare path without "./" for subdir imports
    // e.g., "../store/app-store" from screens/Home.tsx
    // Import maps don't resolve ".." so we normalize all imports via esbuild
  }

  // Also add non-TS files (CSS, JSON) as data URLs
  for (const [path, content] of Object.entries(fileTree)) {
    if (path.endsWith(".css")) {
      const encoded = encodeURIComponent(content);
      const url = `data:text/css,${encoded}`;
      importMap["./" + path] = url;
      importMap["./" + path.replace(/^src\//, "")] = url;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">
  ${JSON.stringify({ imports: importMap }, null, 2)}
  </script>
  <style>
    body { margin: 0; background: #0f172a; color: white; font-family: system-ui, sans-serif; }
    #preview-error { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); color: #f87171; padding: 20px; font-family: monospace; font-size: 14px; white-space: pre-wrap; z-index: 9999; }
    #preview-error button { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 12px; font-family: system-ui; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="preview-error"></div>
  <script type="module">
    // Error handling
    window.onerror = function(msg, src, line, col, err) {
      const el = document.getElementById('preview-error');
      el.style.display = 'block';
      el.innerHTML = '<strong>Runtime Error</strong>\\n\\n' + msg + '\\n\\nLine: ' + line + ', Col: ' + col;
      const btn = document.createElement('button');
      btn.textContent = 'Fix with AI';
      btn.onclick = () => window.parent.postMessage({ type: 'preview-error', error: msg }, '*');
      el.appendChild(btn);
    };

    try {
      const React = await import('react');
      const { createRoot } = await import('react-dom/client');
      const { App } = await import('./src/App');
      const root = createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } catch(e) {
      const el = document.getElementById('preview-error');
      el.style.display = 'block';
      el.innerHTML = '<strong>Module Error</strong>\\n\\n' + e.message;
      const btn = document.createElement('button');
      btn.textContent = 'Fix with AI';
      btn.onclick = () => window.parent.postMessage({ type: 'preview-error', error: e.message }, '*');
      el.appendChild(btn);
    }
  </script>
</body>
</html>`;
}
```

- [ ] **Step 3: Write ErrorOverlay component**

`packages/frontend/src/components/preview/ErrorOverlay.tsx`:
```typescript
interface Props {
  error: string;
  onFixWithAi: (error: string) => void;
}

export function ErrorOverlay({ error, onFixWithAi }: Props) {
  return (
    <div className="absolute inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-10">
      <div className="bg-slate-900 border border-red-500/30 rounded-lg p-6 max-w-lg w-full">
        <h3 className="text-red-400 font-semibold mb-2">Preview Error</h3>
        <pre className="text-red-300 text-xs bg-slate-950 p-3 rounded overflow-auto max-h-40 mb-4">
          {error}
        </pre>
        <button
          onClick={() => onFixWithAi(error)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          Fix with AI
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write PreviewFrame component**

`packages/frontend/src/components/preview/PreviewFrame.tsx`:
```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "../../store/project-store";
import { transpileFile, generatePreviewHtml, initEsbuild } from "./PreviewEngine";
import { MOCK_BRIDGE_SCRIPT } from "./MockBridge";
import { ErrorOverlay } from "./ErrorOverlay";

interface Props {
  onFixWithAi: (error: string) => void;
}

export function PreviewFrame({ onFixWithAi }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { currentProject } = useProjectStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updatePreview = useCallback(async () => {
    if (!currentProject?.file_tree || Object.keys(currentProject.file_tree).length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await initEsbuild();

      const transpiledFiles = new Map<string, string>();
      for (const [path, content] of Object.entries(currentProject.file_tree)) {
        if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".jsx")) {
          const result = await transpileFile(path, content);
          if (result.error) {
            setError(`${path}: ${result.error}`);
            setIsLoading(false);
            return;
          }
          transpiledFiles.set(path, result.code);
        }
      }

      const html = generatePreviewHtml(currentProject.file_tree, transpiledFiles);
      // Inject mock bridge before the closing </head>
      const htmlWithBridge = html.replace("</head>", `<script>${MOCK_BRIDGE_SCRIPT}</script></head>`);

      const blob = new Blob([htmlWithBridge], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      if (iframeRef.current) {
        iframeRef.current.src = url;
      }

      // Clean up blob URL after load
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.file_tree]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Listen for errors from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "preview-error") {
        setError(event.data.error);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="relative h-full bg-slate-950 flex items-center justify-center">
      {error && <ErrorOverlay error={error} onFixWithAi={onFixWithAi} />}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-950">
          <div className="text-slate-400 text-sm">Loading preview...</div>
        </div>
      )}

      {/* Mobile phone frame */}
      <div className="bg-slate-900 rounded-[2rem] p-2 shadow-2xl border border-slate-700">
        <div className="bg-black rounded-[1.5rem] overflow-hidden" style={{ width: 375, height: 667 }}>
          <iframe
            ref={iframeRef}
            sandbox="allow-scripts"
            className="w-full h-full border-0"
            title="Module Preview"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write PreviewTab component**

`packages/frontend/src/components/tabs/PreviewTab.tsx`:
```typescript
import { useWorkspaceStore } from "../../store/workspace-store";
import { PreviewFrame } from "../preview/PreviewFrame";

interface Props {
  onFixWithAi: (error: string) => void;
}

export function PreviewTab({ onFixWithAi }: Props) {
  const { previewContent } = useWorkspaceStore();

  // If there's AI-generated preview HTML (wireframes), show it directly
  if (previewContent) {
    return (
      <div className="h-full overflow-auto p-4 flex justify-center">
        <div className="bg-slate-900 rounded-[2rem] p-2 shadow-2xl border border-slate-700">
          <div className="bg-black rounded-[1.5rem] overflow-hidden" style={{ width: 375, height: 667 }}>
            <iframe
              srcDoc={previewContent}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
              title="Wireframe Preview"
            />
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show the live code preview
  return <PreviewFrame onFixWithAi={onFixWithAi} />;
}
```

- [ ] **Step 6: Update Workspace to use PreviewTab**

In `packages/frontend/src/pages/Workspace.tsx`, replace the preview placeholder:
```typescript
import { PreviewTab } from "../components/tabs/PreviewTab";

// Replace the preview placeholder with:
{activeTab === "preview" && (
  <PreviewTab onFixWithAi={(error) => {
    handleSend(`Fix this error in the preview:\n\n${error}`);
  }} />
)}
```

- [ ] **Step 7: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add live preview engine with esbuild-wasm transpilation and mock bridge"
```

---

### Task 14: Seed Templates

**Files:**
- Create: `packages/server/src/db/seed-templates.ts`
- Modify: `packages/server/src/index.ts` (run seed on startup)

- [ ] **Step 1: Write blank template file tree**

`packages/server/src/db/seed-templates.ts`:
```typescript
import type postgres from "postgres";

const BLANK_TEMPLATE = {
  name: "Blank",
  description: "Minimal scaffold with app shell, router, and store",
  category: "starter",
  file_tree: {
    "manifest.json": JSON.stringify({ version: "0.0.1", offline_mode: false, isMaintenance: false, enable_secure_screen: false }, null, 2),
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><title>My Module</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`,
    "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);`,
    "src/App.tsx": `import { createHashRouter, RouterProvider } from "react-router-dom";
import { Home } from "./screens/Home";

const router = createHashRouter([{ path: "/", element: <Home /> }]);

export function App() {
  return <RouterProvider router={router} />;
}`,
    "src/screens/Home.tsx": `export function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h1>My Module</h1>
      <p>Start building your MeModule!</p>
    </div>
  );
}`,
    "src/store/app-store.ts": `import { create } from "zustand";

interface AppState {
  initialized: boolean;
  init: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  init: () => set({ initialized: true }),
}));`,
    "src/services/me-bridge.ts": `export function createShareRingMeBridge() {
  let pending: { resolve: (v: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const queue: Array<{ type: string; payload?: unknown; timeout: number; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  function processNext() {
    if (pending || queue.length === 0) return;
    const { type, payload, timeout, resolve, reject } = queue.shift()!;
    const timer = setTimeout(() => { pending = null; reject(new Error("Bridge timeout: " + type)); processNext(); }, timeout);
    pending = { resolve, reject, timer };
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: type.toUpperCase(), payload }));
  }
  window.addEventListener("message", (event) => {
    if (!pending) return;
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data.error) { pending.reject(new Error(String(data.error))); }
      else { pending.resolve(data.payload); }
    } catch { return; }
    clearTimeout(pending.timer);
    pending = null;
    processNext();
  }, true);
  return {
    send(type: string, payload?: unknown, timeout = 30000): Promise<any> {
      return new Promise((resolve, reject) => { queue.push({ type, payload, timeout, resolve, reject }); processNext(); });
    },
  };
}

declare global { interface Window { ReactNativeWebView?: { postMessage: (data: string) => void }; } }`,
  },
  tags: ["starter", "blank"],
};

// The remaining 5 templates (Loyalty Card, Event Check-in, Survey/Form, Payment,
// Info/Content) require significant file trees. They are defined in separate
// seed files and added incrementally. This file seeds the Blank template as
// the foundation. Follow-up task: create seed-templates-extended.ts with the
// remaining 5 templates per spec Section 8.2.

const TEMPLATES = [BLANK_TEMPLATE];

export async function seedTemplates(sql: postgres.Sql) {
  for (const t of TEMPLATES) {
    const existing = await sql\`SELECT id FROM templates WHERE name = \${t.name}\`;
    if (existing.length === 0) {
      await sql\`
        INSERT INTO templates (name, description, category, file_tree, tags)
        VALUES (\${t.name}, \${t.description}, \${t.category}, \${JSON.stringify(t.file_tree)}, \${t.tags})
      \`;
      console.log(\`Seeded template: \${t.name}\`);
    }
  }
}
```

- [ ] **Step 2: Update server entry to seed templates**

Add to `packages/server/src/index.ts` after `migrate(sql)`:
```typescript
import { seedTemplates } from "./db/seed-templates.js";

// After migrate:
await seedTemplates(sql);
```

- [ ] **Step 3: Run server and verify template is seeded**

```bash
cd packages/server && npm run dev
```

Expected: Console shows "Seeded template: Blank".

- [ ] **Step 4: Commit**

```bash
git add packages/server/src
git commit -m "feat: add template seeding with blank starter template"
```

---

### Task 15: Integration Test — End-to-End Flow

**Files:**
- No new files — manual verification

- [ ] **Step 1: Start the full dev environment**

```bash
npm run dev:all
```

- [ ] **Step 2: Verify the following flows work:**

1. Open http://localhost:5173 → Login page shows
2. Click "Login with ShareRing Me" → redirects to Dashboard
3. Dashboard shows "Create New Module" button and Blank template
4. Click "Create New Module" → enter name → opens Workspace
5. Chat panel shows on left, tabbed panel on right
6. Type a message in chat → AI responds with streaming text
7. AI generates files → appear in Code tab file tree
8. Click a file → Monaco editor opens with content
9. Edit code → file_edited sent to server
10. Preview tab → esbuild transpiles code → renders in mobile frame
11. Plan tab → shows AI-generated plan HTML

- [ ] **Step 3: Fix any integration issues found**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```

---

### Task 16: Seed Remaining 5 Templates

**Files:**
- Create: `packages/server/src/db/seed-templates-extended.ts`
- Modify: `packages/server/src/index.ts` (call extended seed)

Each template requires a complete file tree with screens, store, services, and bridge integration per spec Section 8.2. Due to the size of these templates (each is ~500-800 lines of code across multiple files), they should be generated using the AI engine itself:

- [ ] **Step 1: Use the running platform to generate each template**

For each of the 5 remaining templates (Loyalty Card, Event Check-in, Survey/Form, Payment, Info/Content):
1. Open the platform and create a new project
2. Describe the template to the AI (e.g., "Create a loyalty card module with stamp tracking and reward redemption, using WALLET_CURRENT_ACCOUNT and COMMON_ASYNC_STORAGE")
3. Let the AI generate the complete module
4. Export the file tree from the database
5. Save it as a template seed

- [ ] **Step 2: Write seed-templates-extended.ts**

`packages/server/src/db/seed-templates-extended.ts`:
```typescript
import type postgres from "postgres";

// Template file trees generated using the MeModule Developer platform itself
// Each template is a complete, working MeModule

const LOYALTY_CARD = {
  name: "Loyalty Card",
  description: "Stamp tracking and reward redemption for businesses",
  category: "loyalty",
  tags: ["loyalty", "stamps", "rewards"],
  file_tree: {} as Record<string, string>, // Generated file tree pasted here
};

const EVENT_CHECKIN = {
  name: "Event Check-in",
  description: "QR scanning, attendee list, and check-in tracking",
  category: "events",
  tags: ["events", "checkin", "qr"],
  file_tree: {} as Record<string, string>,
};

const SURVEY_FORM = {
  name: "Survey / Form",
  description: "Multi-step form builder with results collection",
  category: "surveys",
  tags: ["survey", "form", "data"],
  file_tree: {} as Record<string, string>,
};

const PAYMENT = {
  name: "Payment",
  description: "Simple SHR payment flow with wallet integration",
  category: "payments",
  tags: ["payment", "shr", "wallet"],
  file_tree: {} as Record<string, string>,
};

const INFO_CONTENT = {
  name: "Info / Content",
  description: "Static content pages with navigation",
  category: "content",
  tags: ["info", "content", "pages"],
  file_tree: {} as Record<string, string>,
};

const EXTENDED_TEMPLATES = [LOYALTY_CARD, EVENT_CHECKIN, SURVEY_FORM, PAYMENT, INFO_CONTENT];

export async function seedExtendedTemplates(sql: postgres.Sql) {
  for (const t of EXTENDED_TEMPLATES) {
    if (Object.keys(t.file_tree).length === 0) {
      console.log(`Skipping template "${t.name}" — file tree not yet generated`);
      continue;
    }
    const existing = await sql`SELECT id FROM templates WHERE name = ${t.name}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO templates (name, description, category, file_tree, tags)
        VALUES (${t.name}, ${t.description}, ${t.category}, ${JSON.stringify(t.file_tree)}, ${t.tags})
      `;
      console.log(`Seeded template: ${t.name}`);
    }
  }
}
```

- [ ] **Step 3: Generate and fill in template file trees**

Use the AI chat to generate each template, then copy the file trees into the seed file. Each template should include:
- `manifest.json`
- `index.html`
- `src/main.tsx`, `src/App.tsx`
- `src/screens/*.tsx` (template-specific screens)
- `src/store/app-store.ts`
- `src/services/me-bridge.ts`
- Template-specific services if needed

- [ ] **Step 4: Update index.ts to call extended seed**

```typescript
import { seedExtendedTemplates } from "./db/seed-templates-extended.js";
// After seedTemplates:
await seedExtendedTemplates(sql);
```

- [ ] **Step 5: Verify all 6 templates appear in dashboard**

```bash
npm run dev:all
```

Expected: Dashboard shows 6 template cards.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src
git commit -m "feat: add remaining 5 starter templates (loyalty, event, survey, payment, info)"
```

---
