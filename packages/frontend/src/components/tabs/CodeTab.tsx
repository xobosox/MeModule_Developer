import { useProjectStore } from "../../store/project-store";
import { useWorkspaceStore } from "../../store/workspace-store";
import FileTree from "../code/FileTree";
import MonacoEditor from "../code/MonacoEditor";

interface CodeTabProps {
  onFileEdit: (path: string, content: string) => void;
}

export default function CodeTab({ onFileEdit }: CodeTabProps) {
  const { currentProject, updateFile } = useProjectStore();
  const { selectedFile, openFiles, selectFile, closeFile } = useWorkspaceStore();

  const fileTree = currentProject?.file_tree ?? {};
  const fileContent = selectedFile ? fileTree[selectedFile] ?? "" : "";

  const handleChange = (value: string) => {
    if (!selectedFile) return;
    updateFile(selectedFile, value);
    onFileEdit(selectedFile, value);
  };

  return (
    <div className="flex h-full">
      <FileTree fileTree={fileTree} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* File tabs bar */}
        {openFiles.length > 0 && (
          <div className="flex overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
            {openFiles.map((path) => {
              const filename = path.split("/").pop() || path;
              const isActive = selectedFile === path;

              return (
                <div
                  key={path}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer shrink-0"
                  style={{
                    borderRight: "1px solid var(--border)",
                    background: isActive ? "var(--bg-surface-active)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                  onClick={() => selectFile(path)}
                >
                  <span className="truncate max-w-[120px]">{filename}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(path);
                    }}
                    className="ml-1 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Editor or empty state */}
        <div className="flex-1 overflow-hidden">
          {selectedFile ? (
            <MonacoEditor
              key={selectedFile}
              path={selectedFile}
              content={fileContent}
              onChange={handleChange}
            />
          ) : (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: "var(--text-muted)" }}
            >
              Select a file to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
