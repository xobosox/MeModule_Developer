import type { CoreSkill, SkillContext } from "./index.js";

export const generateSkill: CoreSkill = {
  id: "core-generate",
  agentId: "generator",

  buildPrompt(context: SkillContext): string {
    let prompt = `## Required Files Checklist

Every MeModule MUST have these files. Generate all of them:

1. **manifest.json** — Module metadata
   \`\`\`json
   {
     "name": "Module Name",
     "version": "1.0.0",
     "description": "Short description",
     "offline_mode": false,
     "isMaintenance": false
   }
   \`\`\`

2. **index.html** — Entry point
   \`\`\`html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
     <title>Module Name</title>
   </head>
   <body>
     <div id="root"></div>
     <script type="module" src="./src/main.tsx"></script>
   </body>
   </html>
   \`\`\`

3. **src/main.tsx** — React entry point
   \`\`\`tsx
   import React from "react";
   import ReactDOM from "react-dom/client";
   import App from "./App";

   ReactDOM.createRoot(document.getElementById("root")!).render(
     <React.StrictMode>
       <App />
     </React.StrictMode>
   );
   \`\`\`

4. **src/App.tsx** — Root component with router
5. **src/router.tsx** — Hash router configuration (or inline in App.tsx for simple modules)
6. **src/store/app-store.ts** — Zustand state store
7. **src/services/me-bridge.ts** — Bridge communication service
8. **src/screens/*.tsx** — One file per screen

## File Generation Order

Generate files in this order to ensure consistency:
1. manifest.json
2. index.html
3. src/services/me-bridge.ts
4. src/store/app-store.ts
5. src/screens/*.tsx (one at a time)
6. src/router.tsx
7. src/App.tsx
8. src/main.tsx

## Code Patterns

### Hash Router Setup
\`\`\`tsx
import { createHashRouter, RouterProvider } from "react-router-dom";

const router = createHashRouter([
  { path: "/", element: <HomeScreen /> },
  { path: "/detail/:id", element: <DetailScreen /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
\`\`\`

### Zustand Store Template
\`\`\`tsx
import { create } from "zustand";

interface AppState {
  // State
  loading: boolean;
  error: string | null;
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
\`\`\`

### Bridge Service Pattern
\`\`\`tsx
type BridgeCallback = (response: unknown) => void;

const pendingRequests = new Map<string, BridgeCallback>();
let requestQueue: Array<() => void> = [];
let isProcessing = false;

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;
  const next = requestQueue.shift()!;
  next();
}

export function sendBridgeEvent(event: string, data?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const execute = () => {
      const id = crypto.randomUUID();
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        isProcessing = false;
        processQueue();
        reject(new Error(\`Bridge timeout: \${event}\`));
      }, event.includes("PIN") ? 60000 : 10000);

      pendingRequests.set(id, (response) => {
        clearTimeout(timeout);
        pendingRequests.delete(id);
        isProcessing = false;
        processQueue();
        resolve(response);
      });

      window.parent.postMessage({ id, event, data }, "*");
    };

    requestQueue.push(execute);
    processQueue();
  });
}

window.addEventListener("message", (e) => {
  const { id, data } = e.data || {};
  if (id && pendingRequests.has(id)) {
    pendingRequests.get(id)!(data);
  }
});
\`\`\``;

    if (context.planContent) {
      prompt += `

## Approved Plan

The following plan has been approved by the user. Follow it exactly:

${context.planContent}`;
    }

    if (context.designContent) {
      prompt += `

## Approved Design

The following design mockups have been approved by the user. Match the visual style exactly:

${context.designContent}`;
    }

    return prompt;
  },
};
