import type { CoreSkill, SkillContext } from "./index.js";

export const reviewSkill: CoreSkill = {
  id: "core-review",
  agentId: "reviewer",

  buildPrompt(context: SkillContext): string {
    const fileList = Object.keys(context.fileTree).join("\n  - ");

    return `## MeModule Constraint Checklist (16 Rules)

Review EVERY file in the project against these rules. Check each rule systematically.

**Project files to review:**
  - ${fileList || "(no files found)"}

### Rule 1: Hash Routing
- MUST use \`createHashRouter\` from react-router-dom
- MUST NOT use \`createBrowserRouter\`, \`BrowserRouter\`, or \`HashRouter\` component wrapper
- Check: router.tsx, App.tsx, or any file with router setup

### Rule 2: Manifest Schema Valid
- manifest.json MUST contain \`version\` (string, semver format)
- manifest.json MUST contain \`offline_mode\` (boolean)
- manifest.json MUST contain \`isMaintenance\` (boolean)
- Check: manifest.json

### Rule 3: Bridge Event Names UPPERCASE and Correct
- All event name strings passed to bridge functions must be UPPERCASE
- Examples: \`WALLET_BALANCE\`, \`NAVIGATE_TO\`, \`VAULT_DOCUMENTS\`, \`COMMON_APP_INFO\`
- NOT: \`getWalletBalance\`, \`GET_WALLET_BALANCE\`, \`GET_VAULT_DOCUMENT\`, \`navigate_to\`
- Check: all files that call bridge/sendBridgeEvent functions

### Rule 4: All Paths Relative
- No absolute URLs in imports or asset references
- No leading \`/\` in paths (e.g., \`/src/App.tsx\` is wrong, \`./src/App.tsx\` is correct)
- No \`src="/\` or \`href="/\` patterns
- Check: all .tsx, .ts, .html files

### Rule 5: Vite Base Configuration
- If vite.config.ts exists, it MUST have \`base: "./"\`
- If no vite config exists, this rule passes automatically
- Check: vite.config.ts

### Rule 6: Mobile-First Responsive
- Layouts should target 375px width
- Should use max-width patterns (max-w-[430px] or similar)
- No fixed desktop widths (e.g., \`width: 1200px\`)
- Check: all screen/component .tsx files

### Rule 7: Safe Area Handling
- Must use \`env(safe-area-inset-top)\` or equivalent TailwindCSS classes for top spacing
- Must use \`env(safe-area-inset-bottom)\` or equivalent for bottom spacing
- At minimum, the root layout or main screens must account for safe areas
- Check: App.tsx, layout components, screen files

### Rule 8: Zustand Store Properly Structured
- Store must use \`create<StateType>\` with a typed interface
- State and actions must be in the same store definition
- Must export a typed hook (e.g., \`useAppStore\`)
- Check: store/*.ts files

### Rule 9: No Hardcoded URLs
- No \`http://\` or \`https://\` URLs in component/screen code
- API base URLs should come from config or bridge, not hardcoded
- CDN links in index.html (e.g., TailwindCSS) are acceptable
- Check: all .tsx, .ts files (exclude index.html)

### Rule 10: Bridge Timeout Handling
- Every bridge call must have a timeout mechanism
- Should handle the timeout error case (show error message, retry option, etc.)
- Check: me-bridge.ts, any file calling bridge functions

### Rule 11: Queue-Based Bridge Communication
- Bridge requests must be queued (one at a time)
- Must NOT fire multiple bridge requests in parallel (no Promise.all with bridge calls)
- Check: me-bridge.ts, any file calling bridge functions

### Rule 12: PIN-Gated Operations Timeout
- Operations that require a PIN (signing, sensitive actions) must use 60-second timeout
- Regular bridge operations use standard timeout (10 seconds)
- Check: me-bridge.ts, bridge helper functions

### Rule 13: index.html Exists with Root Div
- index.html must exist in project root
- Must contain \`<div id="root"></div>\` or equivalent
- Must have proper viewport meta tag with \`viewport-fit=cover\`
- Check: index.html

### Rule 14: me-bridge.ts Complete
- Must include the bridge helper function for sending events
- Must include the message event listener for receiving responses
- Must include request ID tracking for matching responses
- Must include the queue mechanism (Rule 11)
- Must include timeout handling (Rule 10)
- Check: src/services/me-bridge.ts

### Rule 15: Bridge Uses ReactNativeWebView.postMessage
- Bridge MUST send messages via \`window.ReactNativeWebView?.postMessage(JSON.stringify({ type, payload }))\`
- MUST NOT use \`window.parent.postMessage\`, \`window.MeBridge\`, \`window.webkit.messageHandlers\`, or \`window.MeModuleBridge\`
- Response listener uses \`window.addEventListener("message", handler, true)\` and parses \`event.data\` as JSON
- Check: src/services/me-bridge.ts, any bridge helper files

### Rule 16: PIN-Gated Operations Have Extended Timeout
- These operations require PIN confirmation and MUST use 60-second timeout:
  CRYPTO_DECRYPT, CRYPTO_SIGN, WALLET_SIGN_TRANSACTION, WALLET_SIGN_AND_BROADCAST_TRANSACTION, VAULT_EXEC_QUERY_SILENT
- Regular bridge operations use standard timeout (10 seconds)
- Check: me-bridge.ts, bridge helper functions

## Output Format

After reviewing all files against all 16 rules, output your result as:

\`\`\`json
{"passed": true, "issues": []}
\`\`\`

or if issues are found:

\`\`\`json
{"passed": false, "issues": ["Rule N: Specific description of the issue in filename.ext"]}
\`\`\`

Be specific. Include the rule number, the file name, and what exactly is wrong.`;
  },
};
