export interface User {
  id: string;
  sharering_address: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  template_id: string | null;
  file_tree: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url: string;
  tags: string[];
}

export interface WsMessage {
  seq: number;
  type: string;
  content?: string;
  path?: string;
  streaming?: boolean;
  code?: string;
  message?: string;
  projectId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}
