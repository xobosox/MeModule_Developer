import { useWorkspaceStore } from "../../store/workspace-store";

interface FileTreeProps {
  fileTree: Record<string, string>;
}

export default function FileTree({ fileTree }: FileTreeProps) {
  const { selectedFile, selectFile } = useWorkspaceStore();

  const paths = Object.keys(fileTree).sort();

  return (
    <div
      className="w-48 overflow-y-auto text-sm"
      style={{ borderRight: "1px solid var(--border)" }}
    >
      {paths.map((path) => {
        const filename = path.split("/").pop() || path;
        const isSelected = selectedFile === path;

        return (
          <button
            key={path}
            title={path}
            onClick={() => selectFile(path)}
            className="block w-full text-left px-3 py-1.5 truncate transition-colors"
            style={{
              background: isSelected ? "var(--bg-surface-active)" : "transparent",
              color: isSelected ? "var(--accent-secondary)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = "var(--bg-surface-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            {filename}
          </button>
        );
      })}
    </div>
  );
}
