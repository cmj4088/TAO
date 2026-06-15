import { create } from "zustand";
import type { AppModule } from "@/types";

interface AppState {
  apps: AppModule[];
  activeAppId: string;
  setActiveApp: (id: string) => void;
  registerApp: (app: AppModule) => void;
}

const DEFAULT_APPS: AppModule[] = [
  { id: "app01", name: "监考分配", description: "自动分配监考员，支持拖拽调整", icon: "ScheduleOutlined" },
  { id: "app02", name: "文件审查", description: "审查教学文件格式与内容错误", icon: "FileSearchOutlined" },
];

export const useAppStore = create<AppState>((set) => ({
  apps: DEFAULT_APPS,
  activeAppId: "app01",
  setActiveApp: (id) => set({ activeAppId: id }),
  registerApp: (app) => set((s) => ({ apps: [...s.apps, app] })),
}));
