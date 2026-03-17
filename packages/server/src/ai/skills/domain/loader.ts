import type postgres from "postgres";
import { listSkills, type SkillRow } from "../../../db/queries.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedSkills: SkillRow[] | null = null;
let cacheTimestamp = 0;

export async function loadSkills(sql: postgres.Sql): Promise<SkillRow[]> {
  const now = Date.now();
  if (cachedSkills && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSkills;
  }
  cachedSkills = await listSkills(sql);
  cacheTimestamp = now;
  return cachedSkills;
}

export function invalidateSkillCache(): void {
  cachedSkills = null;
  cacheTimestamp = 0;
}

/**
 * Format skills for classification prompt injection.
 * Returns a string like: "add-wallet (wallet, payment, balance, SHR), add-screen (screen, page, view, route), ..."
 */
export function formatSkillsForClassification(skills: SkillRow[]): string {
  return skills
    .map((s) => `${s.name} (${s.triggers.join(", ")})`)
    .join(", ");
}
