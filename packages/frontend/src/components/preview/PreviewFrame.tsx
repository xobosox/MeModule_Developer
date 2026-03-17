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
    <div className="relative flex items-center justify-center h-full bg-slate-900 p-4">
      {/* Mobile phone frame */}
      <div
        className="relative bg-black rounded-[2.5rem] p-3 shadow-2xl"
        style={{ width: 375 + 24, height: 667 + 24 }}
      >
        <div className="w-full h-full rounded-[2rem] overflow-hidden bg-white relative">
          {isLoading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-300">Transpiling...</span>
              </div>
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
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              {currentProject?.file_tree
                ? "Building preview..."
                : "No files to preview"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
