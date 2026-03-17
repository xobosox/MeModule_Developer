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

  const fileCount = (fileTree: Record<string, string>) =>
    Object.keys(fileTree).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(10, 10, 15, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)" }}
            />
            <span className="text-sm font-bold tracking-tight">MeModule Developer</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--bg-surface-active)", color: "var(--text-secondary)" }}
            >
              D
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{ padding: "6px 14px", fontSize: "13px" }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero / Welcome */}
        <section className="mb-12">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            What will you build today?
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Create a new Me Module from scratch, or start from a template to hit the ground running.
          </p>

          {!showCreate ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="8" y1="3" x2="8" y2="13" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                </svg>
                Create New Module
              </button>
              {templates.length > 0 && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  or start from a template below
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Module name..."
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="input-field"
                style={{ width: "320px" }}
              />
              <button
                onClick={handleCreate}
                disabled={isLoading || !newName.trim()}
                className="btn-primary"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* Templates */}
        {templates.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-bold">Templates</h2>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                }}
              >
                {templates.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={handleUseTemplate} />
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold">My Projects</h2>
            {projects.length > 0 && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                }}
              >
                {projects.length}
              </span>
            )}
          </div>

          {isLoading && projects.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div
                className="animate-spin w-5 h-5 border-2 rounded-full mx-auto mb-3"
                style={{
                  borderColor: "var(--border)",
                  borderTopColor: "var(--accent)",
                }}
              />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Loading projects...
              </p>
            </div>
          ) : projects.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <div className="text-4xl mb-4">
                <span role="img" aria-label="folder">
                  {"\u{1F4C2}"}
                </span>
              </div>
              <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                Your projects will appear here.
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Create one above or start from a template.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onDelete={deleteProject}
                  fileCount={fileCount(p.file_tree)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
