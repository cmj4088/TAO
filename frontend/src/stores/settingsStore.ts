import { create } from "zustand";
import client from "@/api/client";

type ThemeMode = "light" | "dark";

interface SettingsState {
  theme: ThemeMode;
  apiBase: string;
  llmUrl: string;
  llmKey: string;
  llmModel: string;
  loading: boolean;
  app02AiConcurrency: number;
  setTheme: (t: ThemeMode) => void;
  setLlmConfig: (url: string, key: string, model: string) => void;
  saveLlmConfig: () => Promise<void>;
  loadFromServer: () => Promise<void>;
  setApp02AiConcurrency: (n: number) => void;
  saveApp02Settings: () => Promise<void>;
  loadApp02Settings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: "light",
  apiBase: "http://10.50.150.176:8006",
  llmUrl: "",
  llmKey: "",
  llmModel: "",
  loading: false,
  app02AiConcurrency: 1,

  setTheme: (theme) => set({ theme }),

  setLlmConfig: (url, key, model) => set({ llmUrl: url, llmKey: key, llmModel: model }),

  saveLlmConfig: async () => {
    const { llmUrl, llmKey, llmModel } = get();
    await client.put("/api/admin/llm", { url: llmUrl, key: llmKey, model: llmModel });
  },

  loadFromServer: async () => {
    set({ loading: true });
    try {
      const res = await client.get("/api/admin/llm");
      set({ llmUrl: res.data.url, llmKey: res.data.key, llmModel: res.data.model, loading: false });
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
