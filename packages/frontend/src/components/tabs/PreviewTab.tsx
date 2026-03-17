import { useWorkspaceStore } from "../../store/workspace-store";
import PreviewFrame from "../preview/PreviewFrame";

interface PreviewTabProps {
  onFixWithAi: (error: string) => void;
}

export default function PreviewTab({ onFixWithAi }: PreviewTabProps) {
  const { previewContent } = useWorkspaceStore();

  // If there is AI-generated wireframe/preview content, show it in an iframe
  if (previewContent) {
    return (
      <div
        className="relative flex items-center justify-center h-full p-6"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* Phone frame */}
        <div
          className="relative rounded-[3rem] p-3 shadow-2xl"
          style={{
            width: 375 + 24,
            height: 667 + 24,
            background: "#1a1a24",
            border: "1px solid var(--border)",
          }}
        >
          {/* Notch */}
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full z-10"
            style={{
              width: "100px",
              height: "28px",
              background: "#1a1a24",
              borderBottomLeftRadius: "14px",
              borderBottomRightRadius: "14px",
            }}
          />
          {/* Screen */}
          <div className="w-full h-full rounded-[2.25rem] overflow-hidden bg-white relative">
            {/* Status bar */}
            <div
              className="absolute top-0 left-0 right-0 h-11 flex items-center justify-between px-6 z-10"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="text-xs font-semibold text-gray-900">9:41</span>
              <div className="flex items-center gap-1">
                <svg width="16" height="12" viewBox="0 0 16 12" fill="#1a1a24">
                  <rect x="0" y="7" width="3" height="5" rx="0.5" />
                  <rect x="4.5" y="4.5" width="3" height="7.5" rx="0.5" />
                  <rect x="9" y="2" width="3" height="10" rx="0.5" />
                  <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.3" />
                </svg>
                <svg width="20" height="12" viewBox="0 0 20 12" fill="#1a1a24">
                  <rect x="0" y="1" width="16" height="10" rx="2" stroke="#1a1a24" strokeWidth="1" fill="none" />
                  <rect x="1.5" y="2.5" width="11" height="7" rx="1" />
                  <rect x="17" y="4" width="2" height="4" rx="0.5" />
                </svg>
              </div>
            </div>
            <iframe
              srcDoc={previewContent}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
              title="AI Preview"
            />
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

  // Otherwise show the live code preview
  return <PreviewFrame onFixWithAi={onFixWithAi} />;
}
