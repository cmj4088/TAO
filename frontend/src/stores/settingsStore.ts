import { create } from "zustand"
import client from "@/api/client"

interface SettingsState {
  app02AiConcurrency: number
  loading: boolean
  error: string | null

  setApp02AiConcurrency: (n: number) => void
  saveApp02Settings: () => Promise<void>
  loadApp02Settings: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  app02AiConcurrency: 1,
  loading: false,
  error: null,

  setApp02AiConcurrency: (n) => set({ app02AiConcurrency: Math.max(1, Math.min(10, n)) }),

  saveApp02Settings: async () => {
    const { app02AiConcurrency } = get()
    await client.put("/api/app02/settings", { ai_concurrency: app02AiConcurrency })
  },

  loadApp02Settings: async () => {
    try {
      const res = await client.get("/api/app02/settings")
      set({ app02AiConcurrency: res.data.ai_concurrency })
    } catch {
      // 保持默认值
    }
  },
}))