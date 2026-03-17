import { create } from "zustand";
import type { Project, Template } from "../lib/types";
import { api } from "../lib/api-client";

interface ProjectState {
  projects: Project[];
  templates: Template[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  createProject: (name: string, templateId?: string) => Promise<Project>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateFileTree: (fileTree: Record<string, string>) => void;
  updateFile: (path: string, content: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  templates: [],
  currentProject: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await api.listProjects();
      set({ projects, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch projects",
        isLoading: false,
      });
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await api.listTemplates();
      set({ templates });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to fetch templates",
      });
    }
  },

  createProject: async (name: string, templateId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await api.createProject({
        name,
        template_id: templateId,
      });
      set((state) => ({
        projects: [...state.projects, project],
        isLoading: false,
      }));
      return project;
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to create project",
        isLoading: false,
      });
      throw err;
    }
  },

  loadProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await api.getProject(id);
      set({ currentProject: project, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load project",
        isLoading: false,
      });
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject:
          state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
      }));
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to delete project",
        isLoading: false,
      });
    }
  },

  updateFileTree: (fileTree: Record<string, string>) => {
    const current = get().currentProject;
    if (current) {
      set({ currentProject: { ...current, file_tree: fileTree } });
    }
  },

  updateFile: (path: string, content: string) => {
    const current = get().currentProject;
    if (current) {
      set({
        currentProject: {
          ...current,
          file_tree: { ...current.file_tree, [path]: content },
        },
      });
    }
  },
}));
