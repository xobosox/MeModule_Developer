import type postgres from "postgres";

const blankTemplate = {
  name: "Blank",
  description: "Minimal scaffold with app shell, router, and store",
  category: "starter",
  tags: ["starter", "blank"],
  file_tree: {
    "manifest.json": JSON.stringify(
      {
        version: "0.0.1",
        offline_mode: false,
        isMaintenance: false,
        enable_secure_screen: false,
      },
      null,
      2,
    ),

    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Module</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

    "src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);`,

    "src/App.tsx": `import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Home from "./screens/Home";

const router = createHashRouter([
  {
    path: "/",
    element: <Home />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}`,

    "src/screens/Home.tsx": `import React from "react";

export default function Home() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>My Module</h1>
      <p>Start building your MeModule here.</p>
    </div>
  );
}`,

    "src/store/app-store.ts": `import { create } from "zustand";

interface AppState {
  initialized: boolean;
  setInitialized: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  setInitialized: (value: boolean) => set({ initialized: value }),
}));`,

    "src/services/me-bridge.ts": `declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

interface BridgeMessage {
  type: string;
  payload?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT = 30_000;

export function createShareRingMeBridge() {
  const queue: Array<() => void> = [];
  let processing = false;
  const pending = new Map<string, PendingRequest>();

  function generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function processQueue() {
    if (processing) return;
    processing = true;
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) await next();
    }
    processing = false;
  }

  function send(
    type: string,
    payload?: unknown,
    timeout: number = DEFAULT_TIMEOUT,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        return new Promise<void>((done) => {
          const id = generateId();
          const upperType = type.toUpperCase();

          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(\`Bridge message "\${upperType}" timed out after \${timeout}ms\`));
            done();
          }, timeout);

          pending.set(id, {
            resolve: (value: unknown) => {
              clearTimeout(timer);
              pending.delete(id);
              resolve(value);
              done();
            },
            reject: (reason: unknown) => {
              clearTimeout(timer);
              pending.delete(id);
              reject(reason);
              done();
            },
            timer,
          });

          const message: BridgeMessage & { id: string } = {
            id,
            type: upperType,
            payload,
          };

          window.ReactNativeWebView?.postMessage(JSON.stringify(message));
        });
      });
      processQueue();
    });
  }

  function receive(id: string, payload: unknown) {
    const request = pending.get(id);
    if (request) {
      request.resolve(payload);
    }
  }

  return { send, receive };
}`,
  },
};

export async function seedTemplates(sql: postgres.Sql) {
  const { name, description, category, tags, file_tree } = blankTemplate;

  await sql`
    INSERT INTO templates (name, description, category, tags, file_tree)
    SELECT ${name}, ${description}, ${category}, ${sql.array(tags)}, ${sql.json(file_tree)}
    WHERE NOT EXISTS (
      SELECT 1 FROM templates WHERE name = ${name}
    )
  `;

  console.log("Template seeding complete.");
}
