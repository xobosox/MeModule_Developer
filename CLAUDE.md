# MeModule Developer

AI-powered platform for building ShareRing Me Modules. Monorepo with two packages:

- **packages/server** — Hono + PostgreSQL + Anthropic SDK + WebSocket
- **packages/frontend** — React 18 + TypeScript + Vite + TailwindCSS + Monaco Editor + esbuild-wasm

## Architecture

- **AI Engine**: Orchestrator routes user intent to 6 specialist agents (planner, designer, generator, iterator, reviewer, explainer)
- **Skills System**: 5 core skills (workflow prompts) + 8 domain skills (bridge API recipes) loaded from DB
- **Phase State Machine**: planning → designing → generating → iterating
- **Auth**: JWT + WebSocket tickets
- **Models**: Claude Sonnet 4.6 for agents, Claude Haiku 4.5 for intent classification

## Key Files

| Purpose | Path |
|---------|------|
| Server entry | packages/server/src/index.ts |
| Orchestrator | packages/server/src/ai/orchestrator.ts |
| Agent definitions | packages/server/src/ai/agents/*.ts |
| Core skills | packages/server/src/ai/skills/core/*.ts |
| Domain skills (seed) | packages/server/src/db/seed-skills.ts |
| WebSocket chat | packages/server/src/routes/ws-chat.ts |
| Frontend workspace | packages/frontend/src/pages/Workspace.tsx |
| Chat panel | packages/frontend/src/components/chat/ChatPanel.tsx |
| Preview engine | packages/frontend/src/components/preview/PreviewEngine.ts |

## Development Commands

```bash
npm run dev:all        # Start both server and frontend
npm run dev:server     # Server only (port 3001)
npm run dev            # Frontend only (port 5173)
npm run build          # Build both packages
npm run lint           # TypeScript check both packages
```

## Database

- PostgreSQL: `memodule_dev` database
- Unix socket auth (no password needed locally)
- Tables: users, projects, conversations, templates, skills

## Conventions

- Server uses Hono framework with typed `AppEnv`
- Frontend uses Zustand for state management
- CSS uses custom properties (`var(--xxx)`) defined in index.css
- All bridge API event names are UPPERCASE
- Hash routing only for generated MeModules
- MeModules communicate via `ReactNativeWebView.postMessage`

## Testing

- Run `npx tsc --noEmit` in packages/server or packages/frontend to type-check
- No test suite yet — verify manually

## When Modifying AI Agents/Skills

- **Agent definitions**: packages/server/src/ai/agents/ — each has a focused system prompt
- **Core skills**: packages/server/src/ai/skills/core/ — workflow prompts injected into agents
- **Domain skills**: packages/server/src/db/seed-skills.ts — bridge API recipes stored in DB
- **Bridge API reference**: ../sharering-documentation/Developer_Guides/me-module-developer-guide.md
- Always verify bridge event names, payload shapes, and response types against the official docs
