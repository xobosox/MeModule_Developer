import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";
import { useProjectStore } from "../store/project-store";
import ProjectCard from "../components/dashboard/ProjectCard";
import TemplateCard from "../components/dashboard/TemplateCard";
import type { Template } from "../lib/types";

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const {
    projects,
    templates,
    isLoading,
    fetchProjects,
    fetchTemplates,
    createProject,
    deleteProject,
  } = useProjectStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchProjects();
    fetchTemplates();
  }, [fetchProjects, fetchTemplates]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const project = await createProject(trimmed);
      setNewName("");
      setShowCreate(false);
      navigate(`/project/${project.id}`);
    } catch {
      // error is set in store
    }
  };

  const handleUseTemplate = async (template: Template) => {
    try {
      const project = await createProject(template.name, template.id);
      navigate(`/project/${project.id}`);
    } catch {
      // error is set in store
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">MeModule Developer</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Create New Module */}
        <div className="mb-10">
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm transition-colors"
            >
              + Create New Module
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Module name..."
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500 w-64"
              />
              <button
                onClick={handleCreate}
                disabled={isLoading || !newName.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
                className="text-slate-400 hover:text-white text-sm px-3 py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Templates */}
        {templates.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={handleUseTemplate} />
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        <div>
          <h2 className="text-lg font-semibold mb-4">My Projects</h2>
          {isLoading && projects.length === 0 ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : projects.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No projects yet. Create one to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={deleteProject} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
