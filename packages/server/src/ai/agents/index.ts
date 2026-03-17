import type Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions } from "../tool-definitions.js";
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

export const agents: Record<string, AgentDefinition> = {
  planner: plannerAgent,
  designer: designerAgent,
  generator: generatorAgent,
  iterator: iteratorAgent,
  reviewer: reviewerAgent,
  explainer: explainerAgent,
};

export function getAgent(id: string): AgentDefinition | undefined {
  return agents[id];
}

export function getAgentsForPhase(phase: string): AgentDefinition[] {
  return Object.values(agents).filter((agent) =>
    agent.allowedPhases.includes(phase),
  );
}

export function filterTools(agentTools: string[]): Anthropic.Tool[] {
  return toolDefinitions.filter((tool) => agentTools.includes(tool.name));
}
