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
      <div className="relative flex items-center justify-center h-full bg-slate-900 p-4">
        <div
          className="relative bg-black rounded-[2.5rem] p-3 shadow-2xl"
          style={{ width: 375 + 24, height: 667 + 24 }}
        >
          <div className="w-full h-full rounded-[2rem] overflow-hidden bg-white">
            <iframe
              srcDoc={previewContent}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
              title="AI Preview"
            />
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show the live code preview
  return <PreviewFrame onFixWithAi={onFixWithAi} />;
}
