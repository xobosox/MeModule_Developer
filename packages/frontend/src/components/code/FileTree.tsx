import { useWorkspaceStore } from "../../store/workspace-store";

interface FileTreeProps {
  fileTree: Record<string, string>;
}

export default function FileTree({ fileTree }: FileTreeProps) {
  const { selectedFile, selectFile } = useWorkspaceStore();

  const paths = Object.keys(fileTree).sort();

  return (
    <div className="w-48 border-r border-slate-800 overflow-y-auto text-sm">
      {paths.map((path) => {
        const filename = path.split("/").pop() || path;
        const isSelected = selectedFile === path;

        return (
          <button
            key={path}
            title={path}
            onClick={() => selectFile(path)}
            className={`block w-full text-left px-3 py-1.5 truncate transition-colors ${
              isSelected
                ? "bg-slate-800 text-blue-400"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            {filename}
          </button>
        );
      })}
    </div>
  );
}
