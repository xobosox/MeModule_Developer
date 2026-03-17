# Skills & Agents Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the AI engine with specialized agents, a project phase state machine, an orchestrator with intent classification, and a reusable skills library.

**Architecture:** Refactor the monolithic AI prompt into a 3-layer system (Orchestrator → Agents → Skills). The orchestrator uses Haiku for fast intent classification, then dispatches to one of 6 specialist agents (Sonnet 4.6) with relevant skills injected. Projects have a phase state machine (planning → designing → generating → iterating) that constrains which agents are available.

**Tech Stack:** Anthropic SDK (claude-haiku-4-5 + claude-sonnet-4-6), PostgreSQL (skills table, phase column), existing Hono/WebSocket infrastructure

**Spec:** `docs/superpowers/specs/2026-03-17-skills-agents-design.md`

---

## File Structure

### New Files
```
packages/server/src/
  ai/
    orchestrator.ts              # Intent classification + command parsing + agent routing
    agents/
      index.ts                   # AgentDefinition interface, agent registry, getAgent(), filterTools()
      planner.ts                 # Planner agent system prompt
      designer.ts                # Designer agent system prompt
      generator.ts               # Generator agent system prompt
      iterator.ts                # Iterator agent system prompt
      reviewer.ts                # Reviewer agent system prompt + result parser
      explainer.ts               # Explainer agent system prompt
    skills/
      core/
        index.ts                 # CoreSkill interface, core skill registry
        plan-skill.ts            # Planning workflow prompt injection
        design-skill.ts          # Design workflow prompt injection
        generate-skill.ts        # Generation workflow prompt injection
        review-skill.ts          # Review checklist prompt injection
        iterate-skill.ts         # Iteration workflow prompt injection
      domain/
        loader.ts                # Load + cache skills from DB, refresh timer
        matcher.ts               # Trigger word matching + scoring
  db/
    seed-skills.ts               # Seed 8 starter domain skills

packages/frontend/src/
  components/
    chat/
      CommandAutocomplete.tsx     # /command dropdown for chat input
    workspace/
      PhaseIndicator.tsx          # Phase progress bar in workspace header
```

### Modified Files
```
packages/server/src/
  ai/
    system-prompt.ts             # Extract base MeModule knowledge (shared across agents)
    context-manager.ts           # Add plan/design context to message building
  db/
    schema.ts                    # Add phase column, plan_content, design_content, skills table
    queries.ts                   # Add skill CRUD, phase update, plan/design content queries
  routes/
    ws-chat.ts                   # Use orchestrator instead of direct Claude call

packages/frontend/src/
  components/chat/ChatPanel.tsx  # Add CommandAutocomplete integration
  pages/Workspace.tsx            # Add PhaseIndicator, handle new WS message types
  store/workspace-store.ts       # Add phase + activeAgent state
  lib/types.ts                   # Add phase/agent to WsMessage type
```

---

## Chunk 1: Database + Agent Definitions

### Task 1: Database Schema Changes

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/db/queries.ts`

- [ ] **Step 1: Add phase and content columns to schema.ts migration**

In `packages/server/src/db/schema.ts`, add after existing table creation statements:

```typescript
// Phase state machine + plan/design persistence
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'planning'`;
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_content TEXT`;
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_content TEXT`;

// Skills table for domain-specific recipes
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
```

- [ ] **Step 2: Add query functions for phase, plan/design content, and skills**

In `packages/server/src/db/queries.ts`, add:

```typescript
// ── Phase management ─────────────────────────────────────────────────────────

export async function updateProjectPhase(
  sql: postgres.Sql,
  projectId: string,
  phase: string
): Promise<void> {
  await sql`UPDATE projects SET phase = ${phase}, updated_at = now() WHERE id = ${projectId}`;
}

export async function updatePlanContent(
  sql: postgres.Sql,
  projectId: string,
  content: string
): Promise<void> {
  await sql`UPDATE projects SET plan_content = ${content}, updated_at = now() WHERE id = ${projectId}`;
}

export async function updateDesignContent(
  sql: postgres.Sql,
  projectId: string,
  content: string
): Promise<void> {
  await sql`UPDATE projects SET design_content = ${content}, updated_at = now() WHERE id = ${projectId}`;
}

// ── Skills ───────────────────────────────────────────────────────────────────

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

export async function listSkills(sql: postgres.Sql): Promise<SkillRow[]> {
  const rows = await sql`SELECT *, code_snippets::text AS code_snippets_raw FROM skills ORDER BY name`;
  return rows.map((row) => ({
    ...row,
    code_snippets: typeof row.code_snippets_raw === "string"
      ? JSON.parse(row.code_snippets_raw)
      : row.code_snippets ?? {},
  })) as unknown as SkillRow[];
}

export async function getSkillByName(sql: postgres.Sql, name: string): Promise<SkillRow | null> {
  const rows = await sql`SELECT *, code_snippets::text AS code_snippets_raw FROM skills WHERE name = ${name}`;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    code_snippets: typeof row.code_snippets_raw === "string"
      ? JSON.parse(row.code_snippets_raw)
      : row.code_snippets ?? {},
  } as unknown as SkillRow;
}
```

Also update the `parseProject` function to include the new columns:
```typescript
// In parseProject, add:
phase: row.phase as string,
plan_content: row.plan_content as string | null,
design_content: row.design_content as string | null,
```

And update the `Project` type in `packages/server/src/lib/types.ts`:
```typescript
// Add to Project interface:
phase: "planning" | "designing" | "generating" | "iterating";
plan_content: string | null;
design_content: string | null;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db packages/server/src/lib/types.ts
git commit -m "feat: add phase column, plan/design content, and skills table to database"
```

---

### Task 2: Agent Registry + Definitions

**Files:**
- Create: `packages/server/src/ai/agents/index.ts`
- Create: `packages/server/src/ai/agents/planner.ts`
- Create: `packages/server/src/ai/agents/designer.ts`
- Create: `packages/server/src/ai/agents/generator.ts`
- Create: `packages/server/src/ai/agents/iterator.ts`
- Create: `packages/server/src/ai/agents/reviewer.ts`
- Create: `packages/server/src/ai/agents/explainer.ts`

- [ ] **Step 1: Create agent registry with interface and lookup**

`packages/server/src/ai/agents/index.ts`:
```typescript
import { toolDefinitions } from "../tool-definitions.js";
import type Anthropic from "@anthropic-ai/sdk";
import { plannerAgent } from "./planner.js";
import { designerAgent } from "./designer.js";
import { generatorAgent } from "./generator.js";
import { iteratorAgent } from "./iterator.js";
import { reviewerAgent } from "./reviewer.js";
import { explainerAgent } from "./explainer.js";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  allowedPhases: string[];
  coreSkill: string;
}

const agents: Record<string, AgentDefinition> = {
  planner: plannerAgent,
  designer: designerAgent,
  generator: generatorAgent,
  iterator: iteratorAgent,
  reviewer: reviewerAgent,
  explainer: explainerAgent,
};

export function getAgent(id: string): AgentDefinition | null {
  return agents[id] ?? null;
}

export function getAgentsForPhase(phase: string): AgentDefinition[] {
  return Object.values(agents).filter((a) => a.allowedPhases.includes(phase));
}

export function filterTools(agentTools: string[]): Anthropic.Tool[] {
  return toolDefinitions.filter((t) => agentTools.includes(t.name));
}

export { agents };
```

- [ ] **Step 2: Create each agent definition file**

Each agent file exports an `AgentDefinition` object with a focused system prompt. The prompt should be 200-500 words, specific to the agent's role. Include behavioral rules directly in the prompt. Read the spec (Section 4.2-4.7) for the exact behavioral rules each agent must follow.

**Reference example — planner.ts:**
```typescript
import type { AgentDefinition } from "./index.js";

export const plannerAgent: AgentDefinition = {
  id: "planner",
  name: "Planner Agent",
  description: "Plans your MeModule by understanding requirements and designing screen flows",
  tools: ["chat", "show_plan"],
  allowedPhases: ["planning", "designing"],
  coreSkill: "core-plan",
  systemPrompt: `You are a product design expert specializing in ShareRing Me Modules — mobile web apps that run inside the ShareRing Me app.

Your job is to understand what the user wants to build and create a clear plan before any code is written.

## How You Work
1. Ask ONE clarifying question at a time. Never dump a list of questions.
2. Prefer multiple-choice questions when possible — they're easier to answer.
3. After 2-3 questions, propose a plan using the show_plan tool.
4. Wait for the user to approve the plan before moving forward.

## Plan Output Format
When you use show_plan, generate an HTML document that includes:
- **Screens**: List each screen with its purpose and key UI elements
- **Navigation**: How screens connect (use a visual flow diagram with boxes and arrows)
- **Data Flow**: What data each screen needs, where it comes from
- **Bridge APIs**: Which ShareRing Me bridge events are needed and why
- **Store Structure**: What state needs to be managed

## Rules
- NEVER generate code or write project files
- NEVER create UI mockups (that's the Designer's job)
- Focus on WHAT the module does, not HOW it looks
- Keep plans concise — one page, not a novel
- If the user's idea is vague, help them narrow scope`,
};
```

Follow this same structure for the remaining 5 agents:

`packages/server/src/ai/agents/planner.ts` — Focus: product design expert for mobile modules, asks ONE question at a time, produces screen flow plans via show_plan, never generates code. Tools: chat, show_plan. Phases: planning, designing.

`packages/server/src/ai/agents/designer.ts` — Focus: UI/UX expert, creates wireframes and styled mockups via show_preview, defines visual identity (colors, typography, spacing), mobile-first (375px, safe areas). Tools: chat, show_preview, show_plan. Phases: designing, iterating.

`packages/server/src/ai/agents/generator.ts` — Focus: expert React/TS developer for MeModules, generates complete working module code, follows approved plan and design exactly. Tools: chat, write_file. Phases: generating, iterating.

`packages/server/src/ai/agents/iterator.ts` — Focus: targeted code modifications, reads full file tree, changes only affected files, suggests planning phase for major reworks. Tools: chat, write_file. Phases: iterating.

`packages/server/src/ai/agents/reviewer.ts` — Focus: MeModule QA specialist, validates against constraint checklist (14 rules from spec 4.6), returns structured JSON `{passed, issues}`. Tools: chat. Phases: generating, iterating.

`packages/server/src/ai/agents/explainer.ts` — Focus: patient teacher, explains concepts and code without modifying anything, references specific project files. Tools: chat. Phases: all (planning, designing, generating, iterating).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/ai/agents
git commit -m "feat: add 6 specialist agent definitions with focused prompts"
```

---

### Task 3: Core Skills

**Files:**
- Create: `packages/server/src/ai/skills/core/index.ts`
- Create: `packages/server/src/ai/skills/core/plan-skill.ts`
- Create: `packages/server/src/ai/skills/core/design-skill.ts`
- Create: `packages/server/src/ai/skills/core/generate-skill.ts`
- Create: `packages/server/src/ai/skills/core/review-skill.ts`
- Create: `packages/server/src/ai/skills/core/iterate-skill.ts`

- [ ] **Step 1: Create core skill interface and registry**

`packages/server/src/ai/skills/core/index.ts`:
```typescript
import { planSkill } from "./plan-skill.js";
import { designSkill } from "./design-skill.js";
import { generateSkill } from "./generate-skill.js";
import { reviewSkill } from "./review-skill.js";
import { iterateSkill } from "./iterate-skill.js";

export interface SkillContext {
  projectPhase: string;
  fileTree: Record<string, string>;
  planContent?: string;
  designContent?: string;
}

export interface CoreSkill {
  id: string;
  agentId: string;
  buildPrompt(context: SkillContext): string;
}

const coreSkills: Record<string, CoreSkill> = {
  "core-plan": planSkill,
  "core-design": designSkill,
  "core-generate": generateSkill,
  "core-review": reviewSkill,
  "core-iterate": iterateSkill,
};

export function getCoreSkill(id: string): CoreSkill | null {
  return coreSkills[id] ?? null;
}
```

- [ ] **Step 2: Create each core skill**

Each skill exports a `CoreSkill` object whose `buildPrompt()` returns context-aware prompt text.

`plan-skill.ts` — Injects: questioning framework (ask one question, prefer multiple choice), plan output format template (screens, data flow, bridge APIs, navigation), screen flow HTML template for show_plan tool.

`design-skill.ts` — Injects: mobile-first guidelines (375px width, safe areas, touch targets >= 44px), TailwindCSS dark theme patterns (bg-slate-900/950, text colors), mockup HTML boilerplate for show_preview, accessibility rules.

`generate-skill.ts` — Injects: required files checklist (manifest.json, index.html, main.tsx, App.tsx, router, store, screens, bridge), file generation order, the approved plan content (from context.planContent), the approved design content (from context.designContent), code patterns (hash router setup, Zustand store, bridge usage).

`review-skill.ts` — Injects: full 14-rule MeModule constraint checklist, common mistakes (browser routing, absolute paths, lowercase events, missing manifest fields), output format requirement (`{passed: boolean, issues: string[]}`).

`iterate-skill.ts` — Injects: diff-aware instructions ("change only what's needed"), full file tree context, guidance on when to suggest going back to planning phase, skill invocation hints.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/ai/skills/core
git commit -m "feat: add 5 core skills for agent workflow injection"
```

---

## Chunk 2: Domain Skills + Orchestrator

### Task 4: Domain Skill Loader + Matcher

**Files:**
- Create: `packages/server/src/ai/skills/domain/loader.ts`
- Create: `packages/server/src/ai/skills/domain/matcher.ts`
- Create: `packages/server/src/db/seed-skills.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Create skill loader with caching**

`packages/server/src/ai/skills/domain/loader.ts`:
```typescript
import type postgres from "postgres";
import { listSkills, type SkillRow } from "../../db/queries.js";

let cachedSkills: SkillRow[] = [];
let lastRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function loadSkills(sql: postgres.Sql): Promise<SkillRow[]> {
  const now = Date.now();
  if (now - lastRefresh > CACHE_TTL || cachedSkills.length === 0) {
    cachedSkills = await listSkills(sql);
    lastRefresh = now;
  }
  return cachedSkills;
}

export function invalidateSkillCache(): void {
  lastRefresh = 0;
}

export function formatSkillsForClassification(skills: SkillRow[]): string {
  return skills.map((s) => `${s.name} (${s.triggers.join(", ")})`).join(", ");
}
```

- [ ] **Step 2: Create trigger word matcher**

`packages/server/src/ai/skills/domain/matcher.ts`:
```typescript
import type { SkillRow } from "../../db/queries.js";

interface MatchedSkill {
  skill: SkillRow;
  score: number;
}

export function matchSkills(
  message: string,
  skills: SkillRow[],
  agentId: string,
  maxSkills: number = 3
): SkillRow[] {
  const words = new Set(message.toLowerCase().split(/\W+/).filter(Boolean));

  const matches: MatchedSkill[] = [];
  for (const skill of skills) {
    if (!skill.agent_types.includes(agentId)) continue;
    const score = skill.triggers.filter((t) => words.has(t.toLowerCase())).length;
    if (score > 0) {
      matches.push({ skill, score });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSkills)
    .map((m) => m.skill);
}

export function findSkillByCommand(
  command: string,
  skills: SkillRow[]
): SkillRow | null {
  return skills.find((s) => s.name === command) ?? null;
}
```

- [ ] **Step 3: Create seed-skills.ts with 8 starter skills**

`packages/server/src/db/seed-skills.ts` — Export `seedSkills(sql)` that inserts 8 domain skills using INSERT ... ON CONFLICT (name) DO NOTHING.

Each skill needs a `prompt` field (200-400 words) with:
- Pattern description and when to use it
- Bridge API specifics (event names, payloads, response types)
- TypeScript/React code patterns using the standardized stack
- Common pitfalls

And a `code_snippets` field with ready-to-use code blocks.

The 8 skills: add-wallet, add-screen, add-vault, add-storage, add-navigation, style-guide, add-form, add-list (per spec Section 5.4).

- [ ] **Step 4: Update index.ts to seed skills**

Add to `packages/server/src/index.ts` after template seeding:
```typescript
import { seedSkills } from "./db/seed-skills.js";
// After seedExtendedTemplates:
await seedSkills(sql);
```

- [ ] **Step 5: Verify TypeScript compiles and server starts**

```bash
cd packages/server && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/ai/skills/domain packages/server/src/db/seed-skills.ts packages/server/src/index.ts
git commit -m "feat: add domain skill loader, matcher, and 8 starter skills"
```

---

### Task 5: Orchestrator

**Files:**
- Create: `packages/server/src/ai/orchestrator.ts`
- Modify: `packages/server/src/ai/system-prompt.ts`
- Modify: `packages/server/src/ai/context-manager.ts`

- [ ] **Step 1: Refactor system-prompt.ts to be base knowledge only**

Read existing `packages/server/src/ai/system-prompt.ts`. Modify it:

**What STAYS in system-prompt.ts (shared base knowledge):**
- Technical stack requirements (React, TS, Vite, Zustand, TailwindCSS, hash routing)
- Complete bridge API reference (all 64 events by category)
- Manifest schema
- Critical rules (9 rules: hash routing, relative paths, uppercase events, etc.)
- Bridge helper code (`createShareRingMeBridge()`)

**What MOVES OUT (now handled by agent-specific prompts):**
- "You are an expert MeModule developer assistant" role description → each agent has its own role
- "Your Capabilities" section → each agent's prompt defines its specific capabilities
- "Workflow" section (clarify → plan → wireframes → generate → iterate) → orchestrator manages this

**New export:**
- `buildBaseKnowledge(): string` — returns the shared technical knowledge
- Keep `buildSystemPrompt()` calling `buildBaseKnowledge()` for backward compatibility

- [ ] **Step 2: Update context-manager.ts to include plan/design context**

Add to `packages/server/src/ai/context-manager.ts`:

```typescript
export interface ProjectContext {
  fileTree: Record<string, string>;
  planContent?: string | null;
  designContent?: string | null;
}

export function buildProjectContext(context: ProjectContext): string {
  const parts: string[] = [];

  if (context.planContent) {
    parts.push(`## Approved Plan\n${context.planContent}`);
  }

  if (context.designContent) {
    parts.push(`## Approved Design\n${context.designContent}`);
  }

  if (Object.keys(context.fileTree).length > 0) {
    parts.push("## Current Project Files");
    for (const [path, content] of Object.entries(context.fileTree)) {
      parts.push(`### ${path}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  return parts.join("\n\n");
}
```

- [ ] **Step 3: Create orchestrator.ts**

`packages/server/src/ai/orchestrator.ts`:

Main exports:
- `parseCommand(message)` → `{ command: string | null, remainingMessage: string }`
- `classifyIntent(params)` → `{ agent: string, phaseTransition: string | null, skills: string[] }`
- `resolveCommand(command, phase, skills)` → `{ agent: string, phaseTransition: string | null, skills: string[] }`
- `buildAgentSystemPrompt(params)` → full system prompt string for the selected agent
- `runReviewLoop(params)` → runs reviewer + generator fix cycle

`parseCommand`: Checks if message starts with `/`, extracts command name, returns remainder.

`resolveCommand`: Maps known commands to agent + phase transitions per spec Section 6.2 table. For skill commands (e.g., `/add-wallet`), looks up the skill by name and returns the current phase's primary agent with that skill loaded. Unknown commands return null.

Primary agent per phase (used for fallbacks and skill commands):
- planning → planner
- designing → designer
- generating → generator
- iterating → iterator

`classifyIntent`: Makes a Claude Haiku API call with the classification prompt from spec Section 6.1. Parses JSON response. Falls back to phase's primary agent (per mapping above) if classification fails or returns an agent not allowed for the current phase.

`buildAgentSystemPrompt`: Combines agent base prompt + core skill output + domain skill prompts + base MeModule knowledge + project context (files, plan, design).

`runReviewLoop`: Internal function that calls Reviewer agent, parses `{passed, issues}` from response, calls Generator to fix if needed, max 2 retry cycles.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/server && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/ai
git commit -m "feat: add orchestrator with intent classification and agent routing"
```

---

### Task 6: Refactor ws-chat.ts to Use Orchestrator

**Files:**
- Modify: `packages/server/src/routes/ws-chat.ts`

- [ ] **Step 1: Refactor the user_message handler**

Replace the current direct Claude API call in the `user_message` case with the orchestrator flow:

```typescript
import { parseCommand, classifyIntent, resolveCommand, buildAgentSystemPrompt, runReviewLoop } from "../ai/orchestrator.js";
import { getAgent, filterTools } from "../ai/agents/index.js";
import { loadSkills } from "../ai/skills/domain/loader.js";
import { updateProjectPhase, updatePlanContent, updateDesignContent } from "../db/queries.js";

// In the user_message handler:

// 1. Parse commands
const { command, remainingMessage } = parseCommand(msg.content!);

// 2. Load skills from cache
const allSkills = await loadSkills(sql);

// 3. Classify intent (or resolve command)
let routing;
if (command) {
  routing = resolveCommand(command, project.phase, allSkills);
} else {
  routing = await classifyIntent({
    message: remainingMessage,
    phase: project.phase,
    allSkills,
  });
}

// 4. Apply phase transition
if (routing.phaseTransition) {
  await updateProjectPhase(sql, auth.projectId, routing.phaseTransition);
  wsSend(ws, { type: "phase_changed", phase: routing.phaseTransition, agent: routing.agent });
}

// 5. Build agent prompt
const agent = getAgent(routing.agent);
const systemPrompt = buildAgentSystemPrompt({
  agent,
  project,
  allSkills,
  matchedSkillNames: routing.skills,
});

// 6. Call Claude with agent's filtered tools
const tools = filterTools(agent.tools);
// ... stream response using existing streamAiResponse()

// 7. Post-processing: save plan/design content, auto-review
```

- [ ] **Step 2: Add plan/design content persistence in tool call handler**

When the orchestrator detects `show_plan` or `show_preview` tool calls, save the content to the project:

```typescript
onToolCall: async (result) => {
  if (result.type === "plan") {
    await updatePlanContent(sql, auth.projectId, result.content);
  } else if (result.type === "preview") {
    await updateDesignContent(sql, auth.projectId, result.content);
  } else if (result.type === "file" && result.path) {
    await updateFile(sql, auth.projectId, result.path, result.content);
  }
}
```

- [ ] **Step 3: Add auto-review after generation**

After the generator agent completes (agent.id === "generator" and file writes happened):

```typescript
if (routing.agent === "generator" && toolCalls.some(t => t.type === "file")) {
  await runReviewLoop({ projectId: auth.projectId, ws, sql });
}
```

- [ ] **Step 4: Handle file_edited phase transition**

When `file_edited` message arrives and project is not in `iterating` phase, auto-transition:

```typescript
case "file_edited": {
  const project = await getProject(sql, auth.projectId);
  if (project && project.phase !== "iterating") {
    await updateProjectPhase(sql, auth.projectId, "iterating");
    wsSend(ws, { type: "phase_changed", phase: "iterating", agent: "iterator" });
  }
  if (msg.path && msg.content !== undefined) {
    await updateFile(sql, auth.projectId, msg.path, msg.content);
  }
  break;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd packages/server && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/ws-chat.ts
git commit -m "feat: refactor WebSocket chat to use orchestrator with agent routing"
```

---

## Chunk 3: Frontend Integration

### Task 7: Frontend Store + Type Updates

**Files:**
- Modify: `packages/frontend/src/lib/types.ts`
- Modify: `packages/frontend/src/store/workspace-store.ts`

- [ ] **Step 1: Update WsMessage type**

Add to `packages/frontend/src/lib/types.ts`:

```typescript
// Add to WsMessage type union:
| "phase_changed"
| "review_started"
| "review_complete"
| "generation_cancelled"
| "resume_ack"

// Add fields to WsMessage (all messages already include seq per base spec):
phase?: string;
agent?: string;
passed?: boolean;
issues?: string[];
```

Note: The server must include `seq` on all new message types (phase_changed, review_started, review_complete) — this is already handled by the existing `wsSend` infrastructure if a seq counter is threaded through. Ensure the orchestrator's `wsSend` calls for these new types include the seq counter.

- [ ] **Step 2: Update workspace store**

Add to `packages/frontend/src/store/workspace-store.ts`:

```typescript
// Add to state:
phase: "planning" | "designing" | "generating" | "iterating";
activeAgent: string | null;

// Add actions:
setPhase: (phase: WorkspaceState["phase"]) => void;
setActiveAgent: (agent: string | null) => void;

// In create():
phase: "planning",
activeAgent: null,
setPhase: (phase) => set({ phase }),
setActiveAgent: (agent) => set({ activeAgent: agent }),

// Update reset():
reset: () => set({ ..., phase: "planning", activeAgent: null }),
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/lib/types.ts packages/frontend/src/store/workspace-store.ts
git commit -m "feat: add phase and agent state to frontend stores"
```

---

### Task 8: Phase Indicator Component

**Files:**
- Create: `packages/frontend/src/components/workspace/PhaseIndicator.tsx`
- Modify: `packages/frontend/src/pages/Workspace.tsx`

- [ ] **Step 1: Create PhaseIndicator component**

`packages/frontend/src/components/workspace/PhaseIndicator.tsx`:

A horizontal step indicator showing: Planning → Designing → Generating → Iterating. Current phase is highlighted (text-blue-400), completed phases are dimmed (text-slate-500), future phases are gray (text-slate-600). Shows active agent name below the current phase (small text, slate-400).

- [ ] **Step 2: Update Workspace to show PhaseIndicator and handle new WS messages**

Read existing `Workspace.tsx`. Add:
- Import PhaseIndicator
- Place PhaseIndicator in the header bar
- Add WS message handlers for: `phase_changed`, `review_started`, `review_complete`
- On `phase_changed`: update workspace store phase + activeAgent
- On `review_started`: show "Reviewing..." status
- On `review_complete`: show result message

- [ ] **Step 3: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add phase indicator and new WS message handlers to workspace"
```

---

### Task 9: Command Autocomplete

**Files:**
- Create: `packages/frontend/src/components/chat/CommandAutocomplete.tsx`
- Modify: `packages/frontend/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Create CommandAutocomplete component**

`packages/frontend/src/components/chat/CommandAutocomplete.tsx`:

Props: `input: string, onSelect: (command: string) => void, visible: boolean`

Shows a dropdown of available commands when the user types `/` in the chat input. Hardcoded command list:
- `/plan` — Start planning phase
- `/design` — Start design phase
- `/build` — Generate code
- `/explain` — Explain code or concepts
- `/review` — Review current code
- `/help` — Show available commands
- `/add-wallet` — Add wallet integration
- `/add-screen` — Add a new screen
- `/add-vault` — Add vault integration
- `/add-storage` — Add async storage
- `/add-navigation` — Add navigation
- `/style-guide` — Apply style guide
- `/add-form` — Add a form
- `/add-list` — Add a list/grid

Filters as user types. Arrow keys to navigate, Enter to select, Escape to dismiss.

- [ ] **Step 2: Integrate into ChatPanel**

Read existing `ChatPanel.tsx`. Add:
- Track whether input starts with `/`
- Show CommandAutocomplete when `/` detected
- On select: replace input with selected command + space
- Dismiss on blur or Escape

- [ ] **Step 3: Verify frontend builds**

```bash
cd packages/frontend && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/chat
git commit -m "feat: add /command autocomplete to chat input"
```

---

### Task 10: Integration Test

**Files:** No new files — manual verification

- [ ] **Step 1: Start the full dev environment**

```bash
ANTHROPIC_API_KEY=your-key npm run dev:all
```

- [ ] **Step 2: Verify the following flows:**

1. Create a new project → phase starts at "planning", phase indicator shows
2. Send a message → orchestrator classifies, routes to Planner agent
3. Planner asks clarifying questions one at a time
4. Approve plan → phase transitions to "designing"
5. Designer produces mockups via show_preview
6. Approve design → phase transitions to "generating"
7. Generator produces code → files appear in editor
8. Reviewer auto-runs → review_started/review_complete messages
9. Phase auto-transitions to "iterating"
10. Type `/add-wallet` → skill loaded, Iterator handles request
11. Edit code in Monaco → phase transitions to "iterating" if not already
12. Type `/explain` → Explainer agent responds without modifying files
13. `/help` → shows command list
14. Command autocomplete works when typing `/`

- [ ] **Step 3: Fix any integration issues found**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for skills and agents architecture"
```

---
