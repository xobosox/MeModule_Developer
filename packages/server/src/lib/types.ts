export interface User {
  id: string;
  sharering_address: string;
  developer_mode_enabled: boolean;
  created_at: Date;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  status: "draft" | "building" | "ready";
  phase: "planning" | "designing" | "generating" | "iterating";
  plan_content: string | null;
  design_content: string | null;
  file_tree: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  project_id: string;
  messages: ConversationMessage[];
  updated_at: Date;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tool_calls?: ToolCallResult[];
}

export interface ToolCallResult {
  type: "chat" | "file" | "preview" | "plan";
  path?: string;
  content: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  file_tree: Record<string, string>;
  tags: string[];
}

export type FileTree = Record<string, string>;

export type AppEnv = {
  Variables: {
    sql: import("postgres").Sql;
    userId: string;
  };
};
