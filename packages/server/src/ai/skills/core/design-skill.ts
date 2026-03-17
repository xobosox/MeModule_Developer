import type { CoreSkill, SkillContext } from "./index.js";

export const designSkill: CoreSkill = {
  id: "core-design",
  agentId: "designer",

  buildPrompt(_context: SkillContext): string {
    return `## Mobile-First Design Guidelines

- **Viewport:** 375px width (iPhone SE/standard). Max content width: 430px.
- **Safe areas:** Always apply \`env(safe-area-inset-top)\` to headers and \`env(safe-area-inset-bottom)\` to bottom navigation/actions. In mockups, add 44px top padding and 34px bottom padding to simulate safe areas.
- **Touch targets:** Minimum 44x44px for all tappable elements. Buttons should be at least 44px tall with generous horizontal padding.
- **Thumb zones:** Place primary actions in the bottom 40% of the screen (easy thumb reach). Avoid critical actions in the top corners.
- **Text sizes:** Minimum 14px for body text, 12px for captions. Headings: 24-28px for h1, 18-20px for h2.
- **Spacing:** Use 16px as the base unit. Content padding: 16px horizontal. Vertical rhythm: 8px, 12px, 16px, 24px, 32px.

## TailwindCSS Dark Theme Patterns

Use these as the default color scheme:

- **Backgrounds:** \`bg-slate-950\` (page), \`bg-slate-900\` (cards/sections), \`bg-slate-800\` (elevated elements/inputs)
- **Text:** \`text-white\` (headings), \`text-slate-200\` (body), \`text-slate-400\` (secondary/captions)
- **Borders:** \`border-slate-700\` (subtle), \`border-slate-800\` (very subtle)
- **Accent:** \`bg-blue-600\` (primary buttons), \`bg-blue-500\` (hover), \`text-blue-400\` (links/highlights)
- **Success:** \`text-emerald-400\`, \`bg-emerald-600\`
- **Warning:** \`text-amber-400\`, \`bg-amber-600\`
- **Error:** \`text-red-400\`, \`bg-red-600\`

Light mode overrides (use \`dark:\` prefix pattern in actual code):
- **Backgrounds:** \`bg-white\` (page), \`bg-slate-50\` (cards), \`bg-slate-100\` (elevated)
- **Text:** \`text-slate-900\` (headings), \`text-slate-700\` (body), \`text-slate-500\` (secondary)
- **Borders:** \`border-slate-200\`, \`border-slate-300\`

## Mockup HTML Boilerplate

Use this wrapper for all \`show_preview\` mockups to simulate a mobile device frame:

\`\`\`html
<div style="width: 375px; margin: 0 auto; background: #020617; min-height: 667px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; position: relative; overflow: hidden; border-radius: 20px; border: 1px solid #1e293b;">
  <!-- Status bar spacer (safe area top) -->
  <div style="height: 44px; background: #020617;"></div>

  <!-- Screen content goes here -->
  <div style="padding: 0 16px 34px 16px;">
    <!-- Your mockup content -->
  </div>

  <!-- Bottom safe area spacer (if using bottom nav) -->
  <!-- <div style="height: 34px; background: #020617;"></div> -->
</div>
\`\`\`

## Accessibility Rules

- **Color contrast:** Ensure at least 4.5:1 contrast ratio for body text, 3:1 for large text and UI components.
- **Focus indicators:** Interactive elements should have visible focus states (ring-2 ring-blue-500).
- **Icons with labels:** Don't rely on icons alone. Always pair icons with text labels or provide aria-labels.
- **Loading states:** Always show a visual loading indicator during async operations. Never leave the user staring at a blank screen.
- **Error states:** Error messages should be near the element that caused them, in red/error color, with clear instructions.
- **Empty states:** Every list or data display needs an empty state with a helpful message and optionally a call to action.`;
  },
};
