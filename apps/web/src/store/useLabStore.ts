import { create } from "zustand";
import type { LabEvent, Run } from "../lib/api";

interface LabStore {
  // Active run state
  activeRunId: string | null;
  activeEvents: LabEvent[];
  isRunning: boolean;
  activeProxy: string;
  activeBackend: string;
  hardened: boolean;

  // UI state
  sidebarCollapsed: boolean;
  theme: "light" | "dark";
  commandPaletteOpen: boolean;

  // Actions
  setActiveRun: (id: string | null) => void;
  pushEvent: (e: LabEvent) => void;
  clearEvents: () => void;
  setRunning: (v: boolean) => void;
  setProxy: (p: string) => void;
  setBackend: (b: string) => void;
  setHardened: (v: boolean) => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setCommandPalette: (v: boolean) => void;
  reset: () => void;
}

export const useLabStore = create<LabStore>((set) => ({
  activeRunId: null,
  activeEvents: [],
  isRunning: false,
  activeProxy: "nginx",
  activeBackend: "flask",
  hardened: false,
  sidebarCollapsed: false,
  theme: "dark",
  commandPaletteOpen: false,

  setActiveRun: (id) => set({ activeRunId: id }),
  pushEvent: (e) => set((s) => ({ activeEvents: [...s.activeEvents, e] })),
  clearEvents: () => set({ activeEvents: [] }),
  setRunning: (v) => set({ isRunning: v }),
  setProxy: (p) => set({ activeProxy: p }),
  setBackend: (b) => set({ activeBackend: b }),
  setHardened: (v) => set({ hardened: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      return { theme: next };
    }),
  setCommandPalette: (v) => set({ commandPaletteOpen: v }),
  reset: () => set({ activeRunId: null, activeEvents: [], isRunning: false }),
}));
