import { create } from "zustand";

type ActiveTab = "plan" | "design" | "code" | "preview";
type Phase = "planning" | "designing" | "generating" | "iterating";

interface WorkspaceState {
  activeTab: ActiveTab;
  selectedFile: string | null;
  openFiles: string[];
  planContent: string;
  designContent: string;
  phase: Phase;
  activeAgent: string | null;
  setActiveTab: (tab: ActiveTab) => void;
  selectFile: (path: string) => void;
  closeFile: (path: string) => void;
  setPlanContent: (content: string) => void;
  setDesignContent: (content: string) => void;
  setPhase: (phase: Phase) => void;
  setActiveAgent: (agent: string | null) => void;
  reset: () => void;
}

const initialState = {
  activeTab: "plan" as ActiveTab,
  selectedFile: null as string | null,
  openFiles: [] as string[],
  planContent: "",
  designContent: "",
  phase: "planning" as Phase,
  activeAgent: null as string | null,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialState,

  setActiveTab: (tab: ActiveTab) => {
    set({ activeTab: tab });
  },

  selectFile: (path: string) => {
    set((state) => ({
      selectedFile: path,
      activeTab: "code",
      openFiles: state.openFiles.includes(path)
        ? state.openFiles
        : [...state.openFiles, path],
    }));
  },

  closeFile: (path: string) => {
    set((state) => {
      const openFiles = state.openFiles.filter((f) => f !== path);
      const selectedFile =
        state.selectedFile === path
          ? openFiles[openFiles.length - 1] || null
          : state.selectedFile;
      return { openFiles, selectedFile };
    });
  },

  setPlanContent: (content: string) => {
    set({ planContent: content, activeTab: "plan" });
  },

  setDesignContent: (content: string) => {
    set({ designContent: content, activeTab: "design" });
  },

  setPhase: (phase: Phase) => {
    set({ phase });
  },

  setActiveAgent: (agent: string | null) => {
    set({ activeAgent: agent });
  },

  reset: () => {
    set(initialState);
  },
}));
