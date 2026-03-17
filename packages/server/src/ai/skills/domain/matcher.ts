import type { SkillRow } from "../../../db/queries.js";

/**
 * Score and match skills against a user message.
 * Splits the message on word boundaries, scores each skill by trigger hits,
 * filters by agent_types, and returns the top N.
 */
export function matchSkills(
  message: string,
  skills: SkillRow[],
  agentId: string,
  maxSkills = 3
): SkillRow[] {
  const words = message.toLowerCase().split(/\W+/).filter(Boolean);

  const scored: { skill: SkillRow; score: number }[] = [];

  for (const skill of skills) {
    // Filter by agent type if the skill specifies agent_types
    if (
      skill.agent_types.length > 0 &&
      !skill.agent_types.includes(agentId)
    ) {
      continue;
    }

    let score = 0;
    for (const trigger of skill.triggers) {
      const triggerLower = trigger.toLowerCase();
      for (const word of words) {
        if (word === triggerLower) {
          score++;
        }
      }
    }

    if (score > 0) {
      scored.push({ skill, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxSkills).map((s) => s.skill);
}

/**
 * Find a skill by exact command name (e.g., "add-wallet").
 */
export function findSkillByCommand(
  command: string,
  skills: SkillRow[]
): SkillRow | null {
  const normalized = command.toLowerCase().trim();
  return skills.find((s) => s.name === normalized) ?? null;
}
