import type { CoreSkill, SkillContext } from "./index.js";

export const iterateSkill: CoreSkill = {
  id: "core-iterate",
  agentId: "iterator",

  buildPrompt(context: SkillContext): string {
    const fileList = Object.keys(context.fileTree)
      .map((path) => `  - ${path}`)
      .join("\n");

    let prompt = `## Change Only What's Needed

You have the complete file tree for this project. Before making any change, follow this process:

1. **Identify affected files.** Read the user's request and determine which files need to change. List them explicitly before writing any code.
2. **Check dependencies.** If you change a store interface, find all components that import from that store. If you rename a route, find all navigation calls. Trace the dependency graph.
3. **Preserve unchanged files.** Do NOT rewrite files that don't need changes. If a file is fine as-is, leave it alone.
4. **Match existing patterns.** Look at the existing code style — naming conventions, import patterns, component structure, TailwindCSS class ordering — and follow the same patterns in your changes.

## Current Project File Tree

${fileList || "(no files in project)"}

## When to Suggest Going Back to Planning

Some changes are too large for iteration. Suggest going back to an earlier phase when:

- **Adding 3 or more new screens** — This is a significant scope change. The plan and navigation structure need to be rethought. Suggest: "This is a big addition. I'd recommend going back to the planning phase to map out the new screens and their data flow. You can type /plan to restart planning."

- **Changing core architecture** — Switching routing strategies, replacing Zustand with a different state manager, fundamentally restructuring the bridge service. Suggest: "This changes the core architecture. Let's go back to planning to make sure the new approach is solid. Type /plan to restart."

- **Removing major features that affect multiple screens** — If removing a feature touches 3+ files and changes navigation flow. Suggest: "Removing this feature affects several screens. Going back to planning will help ensure nothing breaks. Type /plan to restart."

- **Complete visual redesign** — If the user wants a totally different look and feel across all screens. Suggest: "A full redesign is best handled in the design phase where we can iterate on mockups before changing code. Type /design to switch to designing."

In all these cases, explain WHY going back produces better results, but respect the user's decision if they insist on iterating.

## Iteration Best Practices

- **Explain before writing.** Tell the user what you'll change and why before using \`write_file\`.
- **One logical change per iteration.** Don't bundle unrelated changes. If the user asks for two things, address them one at a time.
- **Test your mental model.** After writing changes, mentally walk through the affected user flows. Would the app still work end-to-end?
- **Maintain all constraints.** Every change must still comply with the 14-rule MeModule checklist: hash routing, relative paths, uppercase bridge events, safe areas, etc.`;

    if (context.planContent) {
      prompt += `

## Original Plan Context

The module was built from this plan — use it to understand the intended architecture:

${context.planContent}`;
    }

    if (context.designContent) {
      prompt += `

## Original Design Context

The module's visual design was based on these mockups — maintain visual consistency:

${context.designContent}`;
    }

    return prompt;
  },
};
