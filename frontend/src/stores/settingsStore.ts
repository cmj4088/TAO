import { create } from "zustand";
import client from "@/api/client";

type ThemeMode = "light" | "dark";

interface SettingsState {
  theme: ThemeMode;
  apiBase: string;
  llmUrl: string;
  llmKey: string;       // 前端始终存储脱敏版本，如 ark-00ec****b92c
  llmModel: string;
  hasKey: boolean;        // 是否已配置 API Key
  loading: boolean;
  error: string | null;   // 加载错误信息（null = 无错误）
  app02AiConcurrency: number;
  setTheme: (t: ThemeMode) => void;
  setLlmConfig: (url: string, key: string, model: string) => void;
  /** 保存 LLM 配置：传入 newKey 时更新 key，不传则只更新 URL/Model */
  saveLlmConfig: (newKey?: string) => Promise<void>;
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
  hasKey: false,
  loading: false,
  error: null,
  app02AiConcurrency: 1,

  setTheme: (theme) => set({ theme }),

  setLlmConfig: (url, key, model) => set({ llmUrl: url, llmKey: key, llmModel: model }),

  saveLlmConfig: async (newKey?: string) => {
    const { llmUrl, llmModel } = get();
    const keyToSend = newKey ?? "";
    await client.put("/api/admin/llm", {
      url: llmUrl,
      key: keyToSend,
      model: llmModel,
      key_changed: !!newKey,  // 明确的协议字段，替代 "****" 字符串判断
    });
    // 保存成功后重新加载，获取脱敏版本
    await get().loadFromServer();
  },

  loadFromServer: async () => {
    set({ loading: true, error: null });
    try {
      const res = await client.get("/api/admin/llm");
      set({
        llmUrl: res.data.url,
        llmKey: res.data.key,       // 后端返回脱敏版本
        llmModel: res.data.model,
        hasKey: res.data.has_key ?? false,
        loading: false,
        error: null,
      });
    } catch {
      set({ loading: false, error: "加载配置失败，请检查后端是否启动" });
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