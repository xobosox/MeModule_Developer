# MeModule Developer — Skills & Agents Architecture

**Date:** 2026-03-17
**Status:** Draft
**Author:** Tim + Claude
**Depends on:** `2026-03-17-memodule-developer-design.md` (base platform spec)

## 1. Overview

This spec extends the MeModule Developer platform with a skills and agents architecture that maximizes AI generation quality and predictability. Instead of a single monolithic AI prompt, the system uses specialized agents with focused prompts, a state machine for workflow management, and a reusable skills library for domain-specific recipes.

### 1.1 Goals

- Improve AI output quality by giving each agent a focused role and optimized prompt
- Provide predictable, structured workflows (plan → design → generate → iterate)
- Enable progressive disclosure: simple guided flow for beginners, `/commands` for power users
- Make the system extensible via data-driven domain skills without code changes
- Reduce AI errors through automatic review after code generation

### 1.2 Scope

**In scope:**
- Orchestrator with intent classification and agent routing
- 6 specialist agents (Planner, Designer, Generator, Iterator, Reviewer, Explainer)
- Project phase state machine (planning, designing, generating, iterating)
- Core skills (hardcoded workflow logic per agent)
- Domain skills (data-driven, stored in DB, trigger-matched or `/command` invoked)
- 8 starter domain skills
- Frontend phase indicator and `/command` support
- Skill admin (seed + DB management)

**Out of scope:**
- User-created custom skills (future)
- Community skill marketplace (future)
- Multi-agent parallel execution (agents run sequentially)

## 2. Architecture

### 2.1 Three-Layer System

```
┌──────────────────────────────────────────────┐
│  Orchestrator                                 │
│  - Reads project phase + user intent          │
│  - Routes to the right agent                  │
│  - Manages phase transitions                  │
│  - Handles /command skill invocations         │
└──────────────┬───────────────────────────────┘
               │ selects
┌──────────────▼───────────────────────────────┐
│  Agents (6 specialists)                       │
│  ┌─────────┬──────────┬───────────┐          │
│  │ Planner │ Designer │ Generator │          │
│  ├─────────┼──────────┼───────────┤          │
│  │Iterator │ Reviewer │ Explainer │          │
│  └─────────┴──────────┴───────────┘          │
│  Each has: focused system prompt, allowed     │
│  tools subset, phase restrictions             │
└──────────────┬───────────────────────────────┘
               │ can invoke
┌──────────────▼───────────────────────────────┐
│  Skills (reusable recipes)                    │
│  ┌────────────────┬─────────────────────┐    │
│  │ Core (hardcoded)│ Domain (data-driven)│    │
│  │ - plan          │ - add-wallet        │    │
│  │ - design        │ - add-screen        │    │
│  │ - generate      │ - add-vault         │    │
│  │ - review        │ - add-storage       │    │
│  │ - iterate       │ - add-form          │    │
│  │                 │ - style-guide       │    │
│  └────────────────┴─────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 2.2 Request Flow

Every user message flows through:
1. **Orchestrator** — lightweight classification (Haiku) determines intent, agent, phase transition, and skills
2. **Agent** — focused specialist prompt (Sonnet 4.6) with relevant skills injected
3. **Side effects** — file writes to DB, phase updates, review triggers

### 2.3 Model Selection

| Component | Model | Rationale |
|-----------|-------|-----------|
| Orchestrator (intent classification) | claude-haiku-4-5 | Fast, cheap, simple routing task |
| Planner Agent | claude-sonnet-4-6 | Needs strong reasoning for requirements |
| Designer Agent | claude-sonnet-4-6 | Needs creative + technical HTML/CSS |
| Generator Agent | claude-sonnet-4-6 | Needs strong code generation |
| Iterator Agent | claude-sonnet-4-6 | Needs code understanding + targeted edits |
| Reviewer Agent | claude-sonnet-4-6 | Needs thorough validation logic |
| Explainer Agent | claude-sonnet-4-6 | Needs clear communication |

## 3. Project Phase State Machine

### 3.1 Phases

Each project has a `phase` field stored in the `projects` table:

```
planning → designing → generating → iterating
    ↑          ↑           ↑            │
    └──────────┴───────────┴────────────┘
                (user can go back)
```

| Phase | Description | Primary Agent | Allowed Agents |
|-------|-------------|---------------|----------------|
| `planning` | Understanding requirements, asking questions, producing screen flows | Planner | Planner, Explainer |
| `designing` | UI/UX mockups, wireframes, visual style, component layouts | Designer | Designer, Planner, Explainer |
| `generating` | Writing the actual MeModule code from approved plan + design | Generator | Generator, Reviewer, Explainer |
| `iterating` | Module exists, user is refining — changing code, fixing bugs, adding features | Iterator | Iterator, Designer, Generator, Reviewer, Explainer |

### 3.2 Phase Transitions

**AI-detected transitions** (orchestrator classifies from user message):
- `planning → designing` — User approves the plan ("looks good", "let's design it", "move on")
- `designing → generating` — User approves the design ("build it", "generate the code", "looks great")
- `generating → iterating` — Code generation completes (automatic, no user action needed)
- Any phase → `planning` — User wants to restart ("let's rethink this", "start over")
- Any phase → `iterating` — User edits code directly in the editor (automatic on `file_edited` message)

**Explicit transitions** via `/commands`:
- `/plan` → sets phase to `planning`
- `/design` → sets phase to `designing`
- `/build` → sets phase to `generating`

### 3.3 Database Changes

Add `phase` column to the existing `migrate()` function in `schema.ts` (idempotent pattern, matching existing codebase conventions):

```sql
-- Added to migrate() alongside existing CREATE TABLE IF NOT EXISTS statements
ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'planning';
```

Add `plan_content` and `design_content` columns to persist agent outputs for cross-phase context:

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_content TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_content TEXT;
```

- `plan_content` — Stores the Planner agent's approved plan (HTML from `show_plan`)
- `design_content` — Stores the Designer agent's approved mockups (HTML from `show_preview`)

These are saved automatically when `show_plan` or `show_preview` tool calls are made, in addition to being sent to the frontend. This allows the Generator agent to reference the approved plan and design.

Valid phase values: `planning`, `designing`, `generating`, `iterating`.

## 4. Agent Definitions

### 4.1 Agent Structure

Each agent is defined as:

```typescript
interface AgentDefinition {
  id: string;                    // "planner", "designer", etc.
  name: string;                  // "Planner Agent"
  description: string;           // User-facing description
  systemPrompt: string;          // Focused prompt for this role
  tools: string[];               // Subset of tool names from tool-definitions.ts
  allowedPhases: string[];       // Which phases can use this agent
  coreSkill: string;             // Which core skill to always inject
}
```

**Tool filtering:** The `tools` array contains tool name strings (e.g., `["chat", "show_plan"]`). When building the Claude API request, the orchestrator filters the shared `toolDefinitions` array to include only the tools listed in the selected agent's definition. This means all tool schemas are defined once in `tool-definitions.ts` and agents reference them by name.

### 4.2 Planner Agent

**System prompt focus:** Product design expert for mobile modules. Asks clarifying questions one at a time. Produces structured plans with screen flows, data models, and bridge API requirements.

**Tools:** `chat`, `show_plan`

**Behavioral rules:**
- Never generate code or UI mockups
- Ask ONE question at a time (never dump a list)
- After 2-3 questions, propose a plan via `show_plan`
- Plan output format: screens list, data flow, bridge APIs needed, navigation structure
- Wait for user approval before allowing phase transition

### 4.3 Designer Agent

**System prompt focus:** UI/UX expert for mobile-first modules. Creates wireframes and styled mockups using HTML with TailwindCSS. Defines visual identity (colors, typography, spacing).

**Tools:** `chat`, `show_preview`, `show_plan`

**Behavioral rules:**
- Never write project files
- Produce mockups as HTML in `show_preview` (rendered in mobile frame)
- Use `show_plan` for layout comparisons and component breakdowns
- Consider: safe areas, dark/light mode, 375px width, touch targets
- Define a style guide (colors, fonts, spacing) that the Generator will follow
- Wait for user approval before allowing phase transition

### 4.4 Code Generator Agent

**System prompt focus:** Expert React/TypeScript developer specializing in ShareRing MeModules. Generates complete, working module code following the approved plan and design.

**Tools:** `chat`, `write_file`

**Behavioral rules:**
- Generate ALL required files (manifest, index.html, main.tsx, App.tsx, router, store, screens, services, bridge)
- Follow the Designer's style guide exactly (colors, spacing, component patterns)
- Include the plan context and design mockups in the prompt so it matches
- After generating, the Reviewer agent is called automatically (not user-triggered)
- If Reviewer finds issues, Generator is called again with the issues to fix

### 4.5 Iterator Agent

**System prompt focus:** Expert at modifying existing MeModule code. Makes targeted changes, preserves what's working, understands the full file tree.

**Tools:** `chat`, `write_file`

**Behavioral rules:**
- Read the full file tree before making changes
- Modify ONLY the files that need to change
- When adding new features, can invoke domain skills for recipes
- If the change is substantial (new screen, major rework), suggest going back to planning/design phase

### 4.6 Reviewer Agent

**System prompt focus:** MeModule quality assurance specialist. Validates code against all MeModule constraints and best practices.

**Tools:** `chat`

**Behavioral rules:**
- Called automatically after Code Generator completes (not user-facing)
- Checks against a comprehensive constraint checklist:
  - Hash routing (not browser history)
  - Manifest schema valid
  - Bridge event names uppercase
  - All paths relative, base: "./" in vite config
  - Mobile-first responsive (max 430px)
  - Safe area handling
  - Zustand store properly structured
  - No hardcoded URLs
  - Error handling for bridge timeouts
- Returns structured results: `{ passed: boolean, issues: string[] }`
- If issues found, Generator/Iterator is called again with the issues

### 4.7 Explainer Agent

**System prompt focus:** Patient, clear teacher who explains MeModule concepts, bridge APIs, code patterns, and architecture without modifying anything.

**Tools:** `chat`

**Behavioral rules:**
- Never modify files
- Available in any phase
- Good for non-technical users asking "what does this do?" or "how does the wallet work?"
- References specific lines in the user's project files when explaining

## 5. Skills System

### 5.1 Core Skills (Hardcoded)

Core skills are TypeScript modules that return prompt text and optional configuration. They encode the workflow logic for each agent.

```typescript
interface CoreSkill {
  id: string;
  agentId: string;
  buildPrompt(context: SkillContext): string;
}

interface SkillContext {
  projectPhase: string;
  fileTree: Record<string, string>;
  planContent?: string;      // From planner output (stored in projects.plan_content)
  designContent?: string;    // From designer output (stored in projects.design_content)
}
```

| Skill ID | Agent | What it injects |
|----------|-------|-----------------|
| `core-plan` | Planner | Questioning framework, plan output format template, screen flow diagram HTML template |
| `core-design` | Designer | Mobile-first guidelines, TailwindCSS utility patterns, mockup HTML boilerplate, safe area rules |
| `core-generate` | Generator | Required files checklist, file generation order, code patterns, the approved plan + design |
| `core-review` | Reviewer | Full MeModule constraint checklist (14 rules), common mistakes database, pass/fail format |
| `core-iterate` | Iterator | Diff-aware instructions, "change only what's needed" rules, skill invocation guidance |

### 5.2 Domain Skills (Data-Driven)

Domain skills are stored in the database and loaded dynamically based on trigger word matching or explicit `/command` invocation.

**Database schema:**

```sql
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
);
```

**Fields:**
- `name` — Unique identifier, used in `/commands` (e.g., "add-wallet")
- `display_name` — User-facing name (e.g., "Wallet Integration")
- `description` — What the skill does (shown in help)
- `triggers` — Array of keywords that trigger this skill (e.g., ["wallet", "payment", "balance", "SHR"])
- `agent_types` — Which agents can use this skill (e.g., ["generator", "iterator"])
- `prompt` — The recipe text injected into the agent's system prompt
- `code_snippets` — Optional JSON map of ready-to-use code patterns

### 5.3 Skill Matching

Skills are cached in memory at server start and refreshed every 5 minutes (or on admin changes). Matching happens in application code, not SQL:

When a user message arrives:

1. **Explicit match:** Message starts with `/skill-name` → load that skill directly
2. **Trigger match:** Scan message text (lowercased, split on word boundaries) against all cached skill `triggers` arrays. Score each skill by number of matching trigger words. Load skills with score >= 1, ordered by score descending, max 3 skills per request.
3. **Agent filter:** Only load skills where `agent_types` includes the selected agent's ID.

The skill list for the orchestrator classification prompt is formatted as: `"add-wallet (wallet, payment, balance, SHR), add-screen (screen, page, view, route), ..."`

### 5.4 Starter Domain Skills (8)

| Name | Display Name | Triggers | Agent Types | Description |
|------|-------------|----------|-------------|-------------|
| `add-wallet` | Wallet Integration | wallet, payment, balance, SHR, send, transaction, sign | generator, iterator | Balance display, transaction signing, payment flow patterns |
| `add-screen` | New Screen | screen, page, view, route, navigate | generator, iterator | Screen scaffold, route registration, navigation setup |
| `add-vault` | Vault Integration | vault, document, identity, KYC, passport, verify | generator, iterator | Vault bridge queries, document display, verification flows |
| `add-storage` | Async Storage | storage, save, persist, remember, cache, local | generator, iterator | Read/write async storage helpers with bridge |
| `add-navigation` | Navigation | link, navigate, back, external, deep link, open | generator, iterator | NAVIGATE_TO, NAVIGATE_BACK, OPEN_BROWSER bridge patterns |
| `style-guide` | Style Guide | brand, color, theme, style, dark mode, light mode | designer, generator, iterator | Color palette definition, typography, spacing consistency |
| `add-form` | Form Builder | form, input, survey, field, validate, submit | generator, iterator | Multi-step form scaffold with validation and submission |
| `add-list` | List & Grid | list, grid, card, table, items, collection, display | generator, iterator | Responsive list/grid components with loading and empty states |

Each skill's `prompt` field contains:
- A description of the pattern being implemented
- Bridge API specifics (which events to use, expected payloads)
- Code patterns (TypeScript/React examples using the standardized stack)
- Common pitfalls and how to avoid them

Each skill's `code_snippets` field contains ready-to-use code blocks:
- Store slice for the feature
- Bridge helper functions
- Component templates

## 6. Orchestrator

### 6.1 Intent Classification

The orchestrator uses a lightweight Claude Haiku call to classify the user's intent:

**Classification prompt:**

```
You are a routing assistant for a MeModule development platform.
Given the user's message and the current project phase, decide:
1. Which specialist agent should handle this request
2. Whether the project should transition to a new phase
3. Which domain skills (if any) are relevant

Current phase: {phase}
Available agents for this phase: {allowed_agents}
Available skills: {skill_names_and_triggers}

User message: "{message}"

Respond with JSON only:
{
  "agent": "planner|designer|generator|iterator|reviewer|explainer",
  "phase_transition": null | "planning|designing|generating|iterating",
  "skills": ["skill-name", ...]
}
```

**Performance:** Haiku classification adds ~100-200ms latency. The main agent call (Sonnet 4.6) follows immediately after.

### 6.2 Command Handling

Before intent classification, the orchestrator checks for explicit `/commands`:

| Command | Action |
|---------|--------|
| `/plan` | Set phase=planning, agent=planner |
| `/design` | Set phase=designing, agent=designer |
| `/build` | Set phase=generating, agent=generator |
| `/explain` | Agent=explainer (no phase change) |
| `/review` | Agent=reviewer (no phase change) |
| `/add-wallet` (etc.) | Load named skill, use current phase's primary agent |
| `/help` | List available commands and skills |

Commands are stripped from the message before passing to the agent. E.g., `/add-wallet to the payment screen` becomes `to the payment screen` with the add-wallet skill loaded.

### 6.3 Orchestrator Flow

```
User message arrives via WebSocket
         │
         ▼
┌─ Check for /command ─────────────────────┐
│  If found: resolve agent, phase, skills  │
│  If not: run intent classification       │
└──────────────────────────────────────────┘
         │
         ▼
┌─ Apply phase transition (if any) ────────┐
│  Update project.phase in DB              │
│  Send {"type":"phase_changed"} to WS     │
└──────────────────────────────────────────┘
         │
         ▼
┌─ Load skills ────────────────────────────┐
│  Load core skill for the selected agent  │
│  Load matched domain skills from DB      │
│  Filter by agent_types                   │
│  Max 3 domain skills per request         │
└──────────────────────────────────────────┘
         │
         ▼
┌─ Build agent prompt ─────────────────────┐
│  = Agent base prompt                     │
│  + Core skill prompt                     │
│  + Domain skill prompts (if any)         │
│  + MeModule base knowledge (bridge APIs, │
│    manifest, critical rules)             │
│  + Project file tree contents            │
│  + Plan/design context (if available)    │
│  + Conversation history (last 20 msgs)   │
└──────────────────────────────────────────┘
         │
         ▼
┌─ Call Claude Sonnet 4.6 ─────────────────┐
│  Stream response via existing            │
│  stream-processor → WebSocket pipeline   │
└──────────────────────────────────────────┘
         │
         ▼
┌─ Post-processing ────────────────────────┐
│  If agent=generator and files written:   │
│    Auto-trigger reviewer agent           │
│  If reviewer finds issues:               │
│    Auto-trigger generator with fixes     │
│  Save assistant message to conversation  │
└──────────────────────────────────────────┘
```

### 6.4 Auto-Review Loop

After the Generator agent produces code, the Reviewer agent is called automatically. This uses an internal dispatch function (not the WebSocket message handler) that bypasses the `isGenerating` guard:

```typescript
// Internal function in orchestrator, called after generator completes
async function runReviewLoop(projectId, ws, sql): Promise<void>
```

Flow:
1. Generator finishes → files written to DB, `generation_complete` NOT yet sent
2. Send `{"type": "review_started"}` to frontend
3. Orchestrator calls `runReviewLoop()` which:
   a. Builds Reviewer agent prompt with the current file tree
   b. Calls Claude (Reviewer) — response is chat-only (no file writes)
   c. Parses Reviewer output for `{ passed: boolean, issues: string[] }`
4. If **passed**: Send `{"type": "review_complete", "passed": true}` then `generation_complete`
5. If **issues found** (max 2 retry cycles):
   a. Build Generator agent prompt with issues list
   b. Call Claude (Generator) — writes fixed files
   c. Loop back to step 3
6. After 2 retries with remaining issues: Send `{"type": "review_complete", "passed": false, "issues": [...]}` then `generation_complete`

The `isGenerating` flag remains true throughout the review loop. The user sees streaming messages from the review process ("Reviewing your module...", "Found 2 issues, fixing...", "Your module is ready!").

## 7. Frontend Changes

### 7.1 Phase Indicator

The workspace header shows the current phase as a subtle status bar:

```
[Planning...] → [Designing...] → [Generating...] → [Ready to iterate]
```

Non-technical users see this as a progress indicator. The active phase is highlighted.

### 7.2 New WebSocket Message Types

All new message types include `seq` fields consistent with the base spec's WS protocol (Section 6.5) for reconnection replay:

```json
{"seq": N, "type": "phase_changed", "phase": "designing", "agent": "designer"}
{"seq": N, "type": "review_started"}
{"seq": N, "type": "review_complete", "passed": true, "issues": []}
```

### 7.3 Command Input

The chat input recognizes `/` prefix and shows an autocomplete dropdown with available commands and skills. This is only shown when the user types `/` — non-technical users never see it unless they discover it.

### 7.4 Workspace Store Changes

Add to workspace store:
```typescript
phase: "planning" | "designing" | "generating" | "iterating";
activeAgent: string | null;
setPhase: (phase) => void;
setActiveAgent: (agent) => void;
```

## 8. Server File Structure

New and modified files:

```
packages/server/src/
  ai/
    orchestrator.ts          # Intent classification + routing logic
    agents/
      index.ts               # Agent registry and definitions
      planner.ts             # Planner agent prompt builder
      designer.ts            # Designer agent prompt builder
      generator.ts           # Generator agent prompt builder
      iterator.ts            # Iterator agent prompt builder
      reviewer.ts            # Reviewer agent prompt builder
      explainer.ts           # Explainer agent prompt builder
    skills/
      core/
        index.ts             # Core skill registry
        plan-skill.ts        # Planning workflow skill
        design-skill.ts      # Design workflow skill
        generate-skill.ts    # Generation workflow skill
        review-skill.ts      # Review constraint checklist
        iterate-skill.ts     # Iteration workflow skill
      domain/
        loader.ts            # Load domain skills from DB
        matcher.ts           # Trigger word matching logic
    system-prompt.ts         # MODIFIED: base MeModule knowledge only (agents handle role-specific prompts)
    tool-definitions.ts      # UNCHANGED
    stream-processor.ts      # UNCHANGED
    context-manager.ts       # MODIFIED: include plan/design context
  db/
    schema.ts                # MODIFIED: add phase column, skills table
    queries.ts               # MODIFIED: add skill queries, phase updates
    seed-skills.ts           # NEW: seed 8 starter domain skills
  routes/
    ws-chat.ts               # MODIFIED: use orchestrator instead of direct Claude call
```

## 9. Migration Path

This is an enhancement to the existing platform, not a rewrite. The changes are:

1. **Database:** Add `phase` column to projects, add `skills` table, seed domain skills
2. **Server AI layer:** Refactor `ws-chat.ts` to use orchestrator, split system prompt into agent-specific prompts + shared base, add skill loading
3. **Frontend:** Add phase indicator to workspace, add `/command` autocomplete to chat input, add new WS message handlers

The existing tool definitions, stream processor, preview engine, Monaco editor, and all REST routes remain unchanged.
