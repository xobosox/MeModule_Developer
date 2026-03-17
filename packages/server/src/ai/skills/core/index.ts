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

export function getCoreSkill(id: string): CoreSkill | undefined {
  return coreSkills[id];
}
