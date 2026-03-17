import { useNavigate } from "react-router-dom";
import type { Project } from "../../lib/types";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="bg-slate-800 rounded-lg p-4 cursor-pointer hover:bg-slate-700 transition-colors"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold truncate">{project.name}</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 whitespace-nowrap ml-2">
          {project.status}
        </span>
      </div>
      <p className="text-slate-400 text-sm line-clamp-2 mb-3">
        {project.description || "No description"}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Updated {new Date(project.updated_at).toLocaleDateString()}
        </span>
        <button
          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.id);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
