import { getToken } from "./auth";
import type { Project, Template } from "./types";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function requestBlob(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.blob();
}

export const api = {
  listProjects() {
    return request<Project[]>("/api/projects");
  },

  createProject(data: { name: string; template_id?: string }) {
    return request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getProject(id: string) {
    return request<Project>(`/api/projects/${id}`);
  },

  updateProject(id: string, data: Partial<Project>) {
    return request<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteProject(id: string) {
    return request<void>(`/api/projects/${id}`, { method: "DELETE" });
  },

  getFiles(projectId: string) {
    return request<Record<string, string>>(`/api/projects/${projectId}/files`);
  },

  updateFile(projectId: string, path: string, content: string) {
    return request<void>(`/api/projects/${projectId}/files`, {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    });
  },

  listTemplates(category?: string) {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    return request<Template[]>(`/api/templates${query}`);
  },

  exportProject(projectId: string) {
    return requestBlob(`/api/projects/${projectId}/export`);
  },

  getWsTicket(projectId: string) {
    return request<{ ticket: string }>(
      `/api/projects/${projectId}/ws-ticket`,
      { method: "POST" },
    );
  },
};
