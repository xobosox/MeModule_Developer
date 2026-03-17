import { create } from "zustand";
import type { ChatMessage } from "../lib/types";

interface ChatState {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;
  addUserMessage: (content: string) => void;
  startStreaming: () => void;
  appendStreamContent: (content: string) => void;
  finalizeStream: () => void;
  setError: (error: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streamingContent: "",
  isStreaming: false,
  error: null,

  addUserMessage: (content: string) => {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message], error: null }));
  },

  startStreaming: () => {
    set({ isStreaming: true, streamingContent: "", error: null });
  },

  appendStreamContent: (content: string) => {
    set((state) => ({
      streamingContent: state.streamingContent + content,
    }));
  },

  finalizeStream: () => {
    const { streamingContent } = get();
    if (streamingContent) {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: streamingContent,
        timestamp: Date.now(),
      };
      set((state) => ({
        messages: [...state.messages, message],
        streamingContent: "",
        isStreaming: false,
      }));
    } else {
      set({ isStreaming: false, streamingContent: "" });
    }
  },

  setError: (error: string) => {
    set({ error, isStreaming: false, streamingContent: "" });
  },

  clearMessages: () => {
    set({ messages: [], streamingContent: "", isStreaming: false, error: null });
  },
}));
