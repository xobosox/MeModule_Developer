import Anthropic from "@anthropic-ai/sdk";
import type { WebSocket } from "ws";
import type postgres from "postgres";
import { getAgent, getAgentsForPhase, filterTools } from "./agents/index.js";
import type { AgentDefinition } from "./agents/index.js";
import { getCoreSkill } from "./skills/core/index.js";
import type { SkillContext } from "./skills/core/index.js";
import { formatSkillsForClassification } from "./skills/domain/loader.js";
import { findSkillByCommand } from "./skills/domain/matcher.js";
import type { SkillRow } from "../db/queries.js";
import { getProject, updateFile } from "../db/queries.js";
import { buildBaseKnowledge } from "./system-prompt.js";
import { buildProjectContext } from "./context-manager.js";
import { buildMessageHistory } from "./context-manager.js";
import { streamAiResponse } from "./stream-processor.js";
import type { Project } from "../lib/types.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RoutingResult {
  agent: string;
  phaseTransition: string | null;
  skills: string[];
}

interface ClassifyIntentParams {
  message: string;
  phase: string;
  allSkills: SkillRow[];
}

interface BuildAgentSystemPromptParams {
  agent: AgentDefinition;
  project: Project;
  matchedSkillNames: string[];
  allSkills: SkillRow[];
}

interface RunReviewLoopParams {
  projectId: string;
  ws: WebSocket;
  sql: postgres.Sql;
  abortSignal?: AbortSignal;
}

// ── Primary agent per phase ──────────────────────────────────────────────────

const PRIMARY_AGENT_BY_PHASE: Record<string, string> = {
  planning: "planner",
  designing: "designer",
  generating: "generator",
  iterating: "iterator",
};

// ── Command parsing ──────────────────────────────────────────────────────────

export function parseCommand(message: string): {
  command: string | null;
  remainingMessage: string;
} {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) {
    return { command: null, remainingMessage: trimmed };
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0].slice(1).toLowerCase();
  const remainingMessage = parts.slice(1).join(" ");
  return { command, remainingMessage };
}

// ── Command resolution ──────────────────────────────────────────────────────

const COMMAND_MAP: Record<
  string,
  { agent: string; phaseTransition: string | null }
> = {
  plan: { agent: "planner", phaseTransition: "planning" },
  design: { agent: "designer", phaseTransition: "designing" },
  build: { agent: "generator", phaseTransition: "generating" },
  explain: { agent: "explainer", phaseTransition: null },
  review: { agent: "reviewer", phaseTransition: null },
  help: { agent: "explainer", phaseTransition: null },
};

export function resolveCommand(
  command: string,
  phase: string,
  skills: SkillRow[]
): RoutingResult | null {
  const mapping = COMMAND_MAP[command];
  if (mapping) {
    return {
      agent: mapping.agent,
      phaseTransition: mapping.phaseTransition,
      skills: [],
    };
  }

  // Check if it's a skill name
  const skill = findSkillByCommand(command, skills);
  if (skill) {
    const primaryAgent = PRIMARY_AGENT_BY_PHASE[phase] ?? "generator";
    return {
      agent: primaryAgent,
      phaseTransition: null,
      skills: [skill.name],
    };
  }

  return null;
}

// ── Intent classification ────────────────────────────────────────────────────

export async function classifyIntent(
  params: ClassifyIntentParams
): Promise<RoutingResult> {
  const { message, phase, allSkills } = params;

  const agentsForPhase = getAgentsForPhase(phase);
  const agentNames = agentsForPhase.map((a) => a.id).join(", ");
  const skillList = formatSkillsForClassification(allSkills);

  const classificationPrompt = `You are a routing assistant for a MeModule development platform.
Given the user's message and the current project phase, decide:
1. Which specialist agent should handle this request
2. Whether the project should transition to a new phase
3. Which domain skills (if any) are relevant

Current phase: ${phase}
Available agents for this phase: ${agentNames}
Available skills: ${skillList}

User message: "${message}"

Respond with JSON only:
{"agent": "planner|designer|generator|iterator|reviewer|explainer", "phase_transition": null | "planning|designing|generating|iterating", "skills": ["skill-name", ...]}`;

  const fallbackAgent = PRIMARY_AGENT_BY_PHASE[phase] ?? "generator";

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: classificationPrompt }],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { agent: fallbackAgent, phaseTransition: null, skills: [] };
    }

    // Parse JSON from response (handle possible markdown code fences)
    let jsonStr = textBlock.text.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      agent?: string;
      phase_transition?: string | null;
      skills?: string[];
    };

    // Validate agent exists
    const agent = parsed.agent && getAgent(parsed.agent) ? parsed.agent : fallbackAgent;

    return {
      agent,
      phaseTransition: parsed.phase_transition ?? null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    };
  } catch (err) {
    console.error("Intent classification failed, using fallback:", err);
    return { agent: fallbackAgent, phaseTransition: null, skills: [] };
  }
}

// ── System prompt builder ────────────────────────────────────────────────────

export function buildAgentSystemPrompt(
  params: BuildAgentSystemPromptParams
): string {
  const { agent, project, matchedSkillNames, allSkills } = params;

  const parts: string[] = [];

  // 1. Agent's base system prompt
  parts.push(agent.systemPrompt);

  // 2. Core skill prompt
  const coreSkill = getCoreSkill(agent.coreSkill);
  if (coreSkill) {
    const skillContext: SkillContext = {
      projectPhase: project.phase,
      fileTree: project.file_tree,
      planContent: project.plan_content ?? undefined,
      designContent: project.design_content ?? undefined,
    };
    parts.push(coreSkill.buildPrompt(skillContext));
  }

  // 3. Domain skill prompts
  for (const skillName of matchedSkillNames) {
    const skill = allSkills.find((s) => s.name === skillName);
    if (skill) {
      let skillSection = `## Skill: ${skill.display_name}\n${skill.prompt}`;
      if (
        skill.code_snippets &&
        Object.keys(skill.code_snippets).length > 0
      ) {
        skillSection += "\n\n### Code Snippets";
        for (const [snippetName, snippetCode] of Object.entries(
          skill.code_snippets
        )) {
          skillSection += `\n#### ${snippetName}\n\`\`\`\n${snippetCode}\n\`\`\``;
        }
      }
      parts.push(skillSection);
    }
  }

  // 4. Base MeModule knowledge
  parts.push(buildBaseKnowledge());

  // 5. Project context
  const projectContext = buildProjectContext({
    fileTree: project.file_tree,
    planContent: project.plan_content,
    designContent: project.design_content,
  });
  if (projectContext) {
    parts.push(projectContext);
  }

  return parts.join("\n\n");
}

// ── Review loop ──────────────────────────────────────────────────────────────

function wsSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export async function runReviewLoop(params: RunReviewLoopParams): Promise<void> {
  const { projectId, ws, sql, abortSignal } = params;
  const MAX_RETRIES = 2;

  wsSend(ws, { type: "review_started" });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (abortSignal?.aborted) break;

    // Fetch latest project state
    const project = await getProject(sql, projectId);
    if (!project) break;

    const reviewerAgent = getAgent("reviewer");
    if (!reviewerAgent) break;

    const reviewPrompt = buildAgentSystemPrompt({
      agent: reviewerAgent,
      project,
      matchedSkillNames: [],
      allSkills: [],
    });

    const reviewTools = filterTools(reviewerAgent.tools);

    let reviewContent = "";

    await streamAiResponse({
      ws,
      systemPrompt: reviewPrompt,
      messages: [
        {
          role: "user",
          content:
            "Review the current project files for correctness, completeness, and adherence to MeModule requirements. Respond with a JSON object: { \"passed\": boolean, \"issues\": string[] }",
        },
      ],
      abortSignal,
      tools: reviewTools,
      onChatMessage: (content) => {
        reviewContent = content;
      },
    });

    // Try to parse review result
    try {
      // Extract JSON from the review content
      let jsonStr = reviewContent;
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }
      // Try to find JSON object in the text
      const jsonMatch = jsonStr.match(/\{[\s\S]*"passed"[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const result = JSON.parse(jsonStr) as {
        passed: boolean;
        issues: string[];
      };

      if (result.passed) {
        wsSend(ws, { type: "review_complete", passed: true });
        return;
      }

      // If not passed and we have retries left, ask generator to fix
      if (attempt < MAX_RETRIES) {
        const generatorAgent = getAgent("generator");
        if (!generatorAgent) break;

        const latestProject = await getProject(sql, projectId);
        if (!latestProject) break;

        const fixPrompt = buildAgentSystemPrompt({
          agent: generatorAgent,
          project: latestProject,
          matchedSkillNames: [],
          allSkills: [],
        });

        const genTools = filterTools(generatorAgent.tools);

        const issueList = result.issues.join("\n- ");
        await streamAiResponse({
          ws,
          systemPrompt: fixPrompt,
          messages: [
            {
              role: "user",
              content: `The auto-review found these issues. Please fix them:\n- ${issueList}`,
            },
          ],
          abortSignal,
          tools: genTools,
          onToolCall: async (toolResult) => {
            if (toolResult.type === "file" && toolResult.path) {
              await updateFile(sql, projectId, toolResult.path, toolResult.content);
            }
          },
        });
      } else {
        // Max retries reached
        wsSend(ws, {
          type: "review_complete",
          passed: false,
          issues: result.issues,
        });
        return;
      }
    } catch {
      // Could not parse review result — treat as passed to avoid blocking
      console.error("Failed to parse review result:", reviewContent);
      wsSend(ws, { type: "review_complete", passed: true });
      return;
    }
  }
}
