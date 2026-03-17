import * as esbuild from "esbuild-wasm";

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize esbuild-wasm. Safe to call multiple times;
 * only the first call actually loads the WASM binary.
 */
export async function initEsbuild(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = esbuild
    .initialize({
      wasmURL: `https://unpkg.com/esbuild-wasm@${esbuild.version}/esbuild.wasm`,
    })
    .then(() => {
      initialized = true;
    });

  return initPromise;
}

/**
 * Transpile a single file's content using esbuild.
 */
export async function transpileFile(
  path: string,
  content: string,
): Promise<{ code: string; error: string | null }> {
  try {
    await initEsbuild();

    const ext = path.split(".").pop()?.toLowerCase() || "tsx";
    let loader: esbuild.Loader = "tsx";
    if (ext === "ts") loader = "ts";
    else if (ext === "jsx") loader = "jsx";
    else if (ext === "js") loader = "js";

    const result = await esbuild.transform(content, {
      loader,
      jsx: "automatic",
      jsxImportSource: "react",
      format: "esm",
      target: "es2020",
    });

    return { code: result.code, error: null };
  } catch (err) {
    return {
      code: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Build a complete preview HTML page from a file tree and transpiled code map.
 *
 * The import map maps:
 * - bare npm specifiers to esm.sh CDN
 * - project-relative paths (multiple forms) to blob URLs
 */
export function generatePreviewHtml(
  fileTree: Record<string, string>,
  transpiledFiles: Record<string, string>,
): string {
  // --- Build blob URLs for each transpiled file ---
  const blobEntries: Record<string, string> = {};

  for (const [filePath, code] of Object.entries(transpiledFiles)) {
    if (!code) continue;

    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    // Normalise path: remove leading "./" or "/"
    const clean = filePath.replace(/^\.?\//, "");

    // Generate multiple path variants for import map resolution
    const variants: string[] = [];

    // With leading ./
    variants.push(`./${clean}`);

    // Without src/ prefix
    if (clean.startsWith("src/")) {
      variants.push(`./${clean.slice(4)}`);
    }

    // Extensionless variants
    const withoutExt = clean.replace(/\.(tsx?|jsx?)$/, "");
    variants.push(`./${withoutExt}`);
    if (clean.startsWith("src/")) {
      variants.push(`./${withoutExt.slice(4)}`);
    }

    // .js variant (esbuild emits .js imports)
    variants.push(`./${withoutExt}.js`);
    if (clean.startsWith("src/")) {
      variants.push(`./${withoutExt.slice(4)}.js`);
    }

    // .ts / .tsx / .jsx variants
    for (const ext of [".ts", ".tsx", ".jsx"]) {
      variants.push(`./${withoutExt}${ext}`);
      if (clean.startsWith("src/")) {
        variants.push(`./${withoutExt.slice(4)}${ext}`);
      }
    }

    for (const v of variants) {
      blobEntries[v] = url;
    }
  }

  const importMap = {
    imports: {
      react: "https://esm.sh/react@18.3.1",
      "react/": "https://esm.sh/react@18.3.1/",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/": "https://esm.sh/react-dom@18.3.1/",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
      "react-router-dom": "https://esm.sh/react-router-dom@7.1.5?external=react,react-dom",
      zustand: "https://esm.sh/zustand@5.0.11?external=react",
      ...blobEntries,
    },
  };

  // Determine App entry blob URL
  const appUrl =
    blobEntries["./src/App.js"] ||
    blobEntries["./App.js"] ||
    blobEntries["./src/App.tsx"] ||
    blobEntries["./App.tsx"] ||
    blobEntries["./src/App"] ||
    blobEntries["./App"] ||
    null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script type="importmap">${JSON.stringify(importMap)}<\/script>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #preview-error-overlay {
      display: none;
      position: fixed; inset: 0;
      background: rgba(15,23,42,0.95);
      color: #f87171;
      padding: 24px;
      z-index: 99999;
      overflow: auto;
    }
    #preview-error-overlay pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.5;
    }
    #preview-error-overlay button {
      margin-top: 16px;
      padding: 8px 16px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="preview-error-overlay">
    <h3 style="margin:0 0 12px 0;font-size:16px;">Runtime Error</h3>
    <pre id="preview-error-message"></pre>
    <button id="preview-fix-btn">Fix with AI</button>
  </div>

  <script>
    function showError(msg) {
      var overlay = document.getElementById('preview-error-overlay');
      var pre = document.getElementById('preview-error-message');
      overlay.style.display = 'block';
      pre.textContent = msg;
    }

    window.onerror = function(message, source, lineno, colno, error) {
      var full = message + (source ? '\\nat ' + source + ':' + lineno + ':' + colno : '');
      showError(full);
      window.parent.postMessage({ type: 'preview-error', error: full }, '*');
      return true;
    };

    window.addEventListener('unhandledrejection', function(e) {
      var msg = e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'Unhandled promise rejection';
      showError(msg);
      window.parent.postMessage({ type: 'preview-error', error: msg }, '*');
    });

    document.getElementById('preview-fix-btn').addEventListener('click', function() {
      var msg = document.getElementById('preview-error-message').textContent;
      window.parent.postMessage({ type: 'preview-fix-with-ai', error: msg }, '*');
    });
  <\/script>

  <script type="module">
    ${appUrl ? `
    try {
      const React = await import('react');
      const ReactDOM = await import('react-dom/client');
      const AppModule = await import('${appUrl}');
      const App = AppModule.default || AppModule.App || Object.values(AppModule)[0];

      if (typeof App === 'function' || typeof App === 'object') {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App));
      } else {
        showError('Could not find a valid React component exported from App.');
      }
    } catch (err) {
      showError(err.stack || err.message || String(err));
      window.parent.postMessage({ type: 'preview-error', error: err.stack || err.message || String(err) }, '*');
    }
    ` : `
    document.getElementById('root').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#94a3b8;font-size:14px;">No App entry point found. Create src/App.tsx to get started.</div>';
    `}
  <\/script>
</body>
</html>`;
}
