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
  type:
    | "connected"
    | "chat"
    | "file"
    | "preview"
    | "plan"
    | "generation_complete"
    | "error"
    | "phase_changed"
    | "review_started"
    | "review_complete"
    | "generation_cancelled"
    | "resume_ack"
    | string;
  content?: string;
  path?: string;
  streaming?: boolean;
  code?: string;
  message?: string;
  projectId?: string;
  phase?: string;
  agent?: string;
  passed?: boolean;
  issues?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}
