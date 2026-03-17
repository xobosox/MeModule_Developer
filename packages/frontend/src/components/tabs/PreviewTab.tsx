import PreviewFrame from "../preview/PreviewFrame";

interface PreviewTabProps {
  onFixWithAi: (error: string) => void;
}

export default function PreviewTab({ onFixWithAi }: PreviewTabProps) {
  // This tab ONLY shows the live code preview (esbuild-wasm transpiled)
  // Designer mockups are in the Design tab
  return <PreviewFrame onFixWithAi={onFixWithAi} />;
}
