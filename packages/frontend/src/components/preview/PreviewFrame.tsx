import { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "../../store/project-store";
import { initEsbuild, transpileFile, generatePreviewHtml } from "./PreviewEngine";
import { MOCK_BRIDGE_SCRIPT } from "./MockBridge";
import ErrorOverlay from "./ErrorOverlay";

interface PreviewFrameProps {
  onFixWithAi: (error: string) => void;
}

export default function PreviewFrame({ onFixWithAi }: PreviewFrameProps) {
  const { currentProject } = useProjectStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  const buildPreview = useCallback(async (fileTree: Record<string, string>) => {
    setIsLoading(true);
    setError(null);

    try {
      await initEsbuild();

      // Transpile all TS/TSX/JSX files
      const transpiledFiles: Record<string, string> = {};
      const transpilePromises: Promise<void>[] = [];

      for (const [path, content] of Object.entries(fileTree)) {
        if (/\.(tsx?|jsx)$/.test(path)) {
          transpilePromises.push(
            transpileFile(path, content).then((result) => {
              if (result.error) {
                setError(result.error);
              }
              if (result.code) {
                transpiledFiles[path] = result.code;
              }
            }),
          );
        }
      }

      await Promise.all(transpilePromises);

      // Generate HTML with mock bridge injected
      let html = generatePreviewHtml(fileTree, transpiledFiles);

      // Inject mock bridge script right after <body>
      html = html.replace(
        "<body>",
        `<body><script>${MOCK_BRIDGE_SCRIPT}<\/script>`,
      );

      // Create blob URL
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      // Revoke previous blob URL
      if (prevBlobUrl.current) {
        URL.revokeObjectURL(prevBlobUrl.current);
      }
      prevBlobUrl.current = url;

      setBlobUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Build preview when file tree changes
  useEffect(() => {
    const fileTree = currentProject?.file_tree;
    if (!fileTree || Object.keys(fileTree).length === 0) return;
    buildPreview(fileTree);
  }, [currentProject?.file_tree, buildPreview]);

  // Listen for messages from preview iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "preview-error") {
        setError(event.data.error);
      }
      if (event.data?.type === "preview-fix-with-ai") {
        onFixWithAi(event.data.error);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onFixWithAi]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrl.current) {
        URL.revokeObjectURL(prevBlobUrl.current);
      }
    };
  }, []);

  return (
    <div
      className="relative flex items-center justify-center h-full p-6"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Mobile phone frame */}
      <div
        className="relative rounded-[3rem] p-3 shadow-2xl"
        style={{
          width: 375 + 24,
          height: 667 + 24,
          background: "var(--surface-light)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Notch */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full z-10"
          style={{
            width: "100px",
            height: "28px",
            background: "var(--surface-light)",
            borderBottomLeftRadius: "14px",
            borderBottomRightRadius: "14px",
          }}
        />

        <div className="w-full h-full rounded-[2.25rem] overflow-hidden bg-white relative">
          {/* Status bar */}
          <div
            className="absolute top-0 left-0 right-0 h-11 flex items-center justify-between px-6 z-10"
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span className="text-xs font-semibold" style={{ color: "#1a1a40" }}>9:41</span>
            <div className="flex items-center gap-1">
              <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
                <rect x="0" y="7" width="3" height="5" rx="0.5" />
                <rect x="4.5" y="4.5" width="3" height="7.5" rx="0.5" />
                <rect x="9" y="2" width="3" height="10" rx="0.5" />
                <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.3" />
              </svg>
              <svg width="20" height="12" viewBox="0 0 20 12" fill="currentColor">
                <rect x="0" y="1" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1" fill="none" />
                <rect x="1.5" y="2.5" width="11" height="7" rx="1" />
                <rect x="17" y="4" width="2" height="4" rx="0.5" />
              </svg>
            </div>
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div
              className="absolute inset-0 z-40 flex flex-col gap-4 p-6 pt-16"
              style={{ background: "var(--bg-primary)" }}
            >
              <div className="skeleton-pulse h-6 w-3/4 rounded-lg" style={{ background: "var(--bg-surface-hover)" }} />
              <div className="skeleton-pulse h-4 w-full rounded-lg" style={{ background: "var(--bg-surface-hover)", animationDelay: "0.1s" }} />
              <div className="skeleton-pulse h-4 w-5/6 rounded-lg" style={{ background: "var(--bg-surface-hover)", animationDelay: "0.2s" }} />
              <div className="skeleton-pulse h-32 w-full rounded-xl mt-2" style={{ background: "var(--bg-surface-hover)", animationDelay: "0.3s" }} />
              <div className="skeleton-pulse h-4 w-2/3 rounded-lg" style={{ background: "var(--bg-surface-hover)", animationDelay: "0.4s" }} />
              <div className="skeleton-pulse h-10 w-full rounded-xl mt-auto" style={{ background: "var(--bg-surface-hover)", animationDelay: "0.5s" }} />
            </div>
          )}

          {error && <ErrorOverlay error={error} onFixWithAi={onFixWithAi} />}

          {blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
              title="Preview"
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center h-full gap-3"
              style={{ background: "var(--bg-primary)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <path d="M12 18h.01" />
              </svg>
              <span
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {currentProject?.file_tree
                  ? "Building preview..."
                  : "No files to preview"}
              </span>
            </div>
          )}

          {/* Home bar */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <div
              className="rounded-full"
              style={{
                width: "134px",
                height: "5px",
                background: "rgba(0, 0, 0, 0.2)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
