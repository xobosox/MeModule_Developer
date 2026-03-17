import { useNavigate } from "react-router-dom";
import type { Project } from "../../lib/types";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
  fileCount?: number;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  planning: { bg: "rgba(245, 158, 11, 0.1)", text: "#f59e0b" },
  designing: { bg: "rgba(168, 85, 247, 0.1)", text: "#a855f7" },
  generating: { bg: "rgba(6, 182, 212, 0.1)", text: "#06b6d4" },
  iterating: { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981" },
};

export default function ProjectCard({ project, onDelete, fileCount }: ProjectCardProps) {
  const navigate = useNavigate();
  const status = statusColors[project.status] || {
    bg: "var(--accent-subtle)",
    text: "var(--text-secondary)",
  };

  return (
    <div
      className="glass-card p-5 cursor-pointer group relative"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <h3
          className="font-semibold text-sm truncate pr-2"
          style={{ color: "var(--text-primary)" }}
        >
          {project.name}
        </h3>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
          style={{ background: status.bg, color: status.text }}
        >
          {project.status}
        </span>
      </div>

      {/* Description */}
      <p
        className="text-xs leading-relaxed line-clamp-2 mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        {project.description || "No description"}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {new Date(project.updated_at).toLocaleDateString()}
          </span>
          {fileCount !== undefined && fileCount > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {fileCount} {fileCount === 1 ? "file" : "files"}
            </span>
          )}
        </div>
        <button
          className="text-[11px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all"
          style={{
            color: "var(--error)",
            background: "rgba(239, 68, 68, 0.08)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.id);
          }}
        >
          Delete
        </button>
      </div>

      {/* Hover "Open" overlay hint */}
      <div
        className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: "rgba(10, 10, 15, 0.5)" }}
      >
        <span
          className="text-xs font-semibold px-3 py-1.5 rounded-md"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          Open
        </span>
      </div>
    </div>
  );
}
