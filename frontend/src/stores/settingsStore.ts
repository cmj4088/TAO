import { create } from "zustand";
import client from "@/api/client";

type ThemeMode = "light" | "dark";

interface SettingsState {
  theme: ThemeMode;
  apiBase: string;
  llmUrl: string;
  llmKey: string;
  loading: boolean;
  setTheme: (t: ThemeMode) => void;
  setLlmConfig: (url: string, key: string) => void;
  saveLlmConfig: () => Promise<void>;
  loadFromServer: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: "light",
  apiBase: "http://localhost:8000",
  llmUrl: "",
  llmKey: "",
  loading: false,

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
}));
