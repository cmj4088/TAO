import { create } from "zustand";
import client from "@/api/client";

type ThemeMode = "light" | "dark";

interface SettingsState {
  theme: ThemeMode;
  apiBase: string;
  llmUrl: string;
  llmKey: string;
  loading: boolean;
  app02AiConcurrency: number;
  setTheme: (t: ThemeMode) => void;
  setLlmConfig: (url: string, key: string) => void;
  saveLlmConfig: () => Promise<void>;
  loadFromServer: () => Promise<void>;
  setApp02AiConcurrency: (n: number) => void;
  saveApp02Settings: () => Promise<void>;
  loadApp02Settings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: "light",
  apiBase: "http://localhost:8002",
  llmUrl: "",
  llmKey: "",
  loading: false,
  app02AiConcurrency: 1,

  setTheme: (theme) => set({ theme }),

  setLlmConfig: (url, key) => set({ llmUrl: url, llmKey: key }),

  saveLlmConfig: async () => {
    const { llmUrl, llmKey } = get();
    await client.put("/api/admin/llm", { url: llmUrl, key: llmKey });
  },

  loadFromServer: async () => {
    set({ loading: true });
    try {
      const res = await client.get("/api/admin/llm");
      set({ llmUrl: res.data.url, llmKey: res.data.key, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setApp02AiConcurrency: (n) => set({ app02AiConcurrency: Math.max(1, Math.min(10, n)) }),

  saveApp02Settings: async () => {
    const { app02AiConcurrency } = get();
    await client.put("/api/app02/settings", { ai_concurrency: app02AiConcurrency });
  },

  loadApp02Settings: async () => {
    try {
      const res = await client.get("/api/app02/settings");
      set({ app02AiConcurrency: res.data.ai_concurrency });
    } catch {
      // 保持默认值
    }
  },
}));
