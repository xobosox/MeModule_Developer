import type { CoreSkill, SkillContext } from "./index.js";

export const planSkill: CoreSkill = {
  id: "core-plan",
  agentId: "planner",

  buildPrompt(_context: SkillContext): string {
    return `## Questioning Framework

When gathering requirements from the user, follow this structured approach:

1. **Start with the core concept.** Your first question should be: "What should your MeModule do in one sentence?" or if they've already said, ask about the primary user action.

2. **Then explore one dimension at a time:**
   - What data does the module need? (wallet balance, vault documents, stored preferences)
   - How many screens does it need? (single view, 2-3 screens, multi-step flow)
   - Does it need user input? (forms, selections, confirmations)
   - Does it interact with external services via the bridge? (payments, identity, navigation)

3. **Prefer multiple choice questions.** Format like:
   "How should the main screen be organized?
   A) A single scrollable list
   B) Tab-based sections
   C) Card grid layout
   D) Something else — describe it"

4. **After 2-3 questions, propose the plan.** Don't over-interview.

## Plan Output Format

When you have enough information, use the \`show_plan\` tool with HTML content in this structure:

\`\`\`html
<div style="font-family: system-ui, sans-serif; color: #e2e8f0; padding: 16px;">
  <h2 style="color: #60a5fa; margin-bottom: 16px;">Module Plan: [Name]</h2>

  <h3 style="color: #93c5fd; margin-top: 20px;">Screens</h3>
  <div style="margin-left: 12px;">
    <div style="background: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
      <strong style="color: #f8fafc;">[Screen Name]</strong>
      <p style="color: #94a3b8; margin: 4px 0 0;">Purpose and key UI elements</p>
    </div>
    <!-- Repeat for each screen -->
  </div>

  <h3 style="color: #93c5fd; margin-top: 20px;">Data Flow</h3>
  <ul style="color: #cbd5e1; margin-left: 16px;">
    <li>What data is fetched from the bridge</li>
    <li>What data is stored locally (Zustand / AsyncStorage)</li>
    <li>What data flows between screens</li>
  </ul>

  <h3 style="color: #93c5fd; margin-top: 20px;">Bridge APIs Required</h3>
  <ul style="color: #cbd5e1; margin-left: 16px;">
    <li><code style="background: #334155; padding: 2px 6px; border-radius: 4px;">EVENT_NAME</code> — Description of when/why it's used</li>
  </ul>

  <h3 style="color: #93c5fd; margin-top: 20px;">Navigation</h3>
  <p style="color: #cbd5e1;">Entry point: [screen] → [flow description]</p>
</div>
\`\`\`

## Screen Flow Diagram

For modules with multiple screens, include a visual flow diagram using inline CSS flexbox:

\`\`\`html
<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px;">
  <div style="background: #1e293b; border: 2px solid #3b82f6; border-radius: 12px; padding: 16px; min-width: 120px; text-align: center;">
    <div style="color: #60a5fa; font-weight: bold; font-size: 14px;">Home</div>
    <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Entry point</div>
  </div>
  <div style="color: #475569; font-size: 24px;">→</div>
  <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; min-width: 120px; text-align: center;">
    <div style="color: #e2e8f0; font-weight: bold; font-size: 14px;">Detail</div>
    <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">View item</div>
  </div>
  <div style="color: #475569; font-size: 24px;">→</div>
  <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; min-width: 120px; text-align: center;">
    <div style="color: #e2e8f0; font-weight: bold; font-size: 14px;">Confirm</div>
    <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Submit action</div>
  </div>
</div>
\`\`\`

Adapt the number of boxes and arrows to match the actual module screens. Use the blue border for the entry point screen.`;
  },
};
