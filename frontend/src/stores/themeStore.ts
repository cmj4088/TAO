import { create } from "zustand"
import { persist } from "zustand/middleware"

/** 预设色系 */
export type ThemeColor = "blue" | "purple" | "cyan" | "amber" | "rose"

/** 主题模式 */
export type ThemeMode = "dark" | "light"

interface ThemeState {
  /** 当前色系 */
  color: ThemeColor
  /** 主题模式 */
  mode: ThemeMode
  /** 切换色系 */
  setColor: (color: ThemeColor) => void
  /** 切换模式 */
  setMode: (mode: ThemeMode) => void
  /** 切换暗色/亮色 */
  toggleMode: () => void
}

/** 色系 → data-theme 属性值映射 */
const COLOR_ATTR_MAP: Record<ThemeColor, string | null> = {
  blue: null, // 默认，不需要 data-theme
  purple: "purple",
  cyan: "cyan",
  amber: "amber",
  rose: "rose",
}

/** 应用主题到 DOM */
function applyTheme(color: ThemeColor, mode: ThemeMode) {
  const root = document.documentElement

  // 色系
  root.removeAttribute("data-theme")
  const attr = COLOR_ATTR_MAP[color]
  if (attr) {
    root.setAttribute("data-theme", attr)
  }

  // 暗色/亮色
  root.classList.remove("light", "dark")
  root.classList.add(mode)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      color: "blue",
      mode: "dark",

      setColor: (color) => {
        set({ color })
        applyTheme(color, get().mode)
      },

      setMode: (mode) => {
        set({ mode })
        applyTheme(get().color, mode)
      },

      toggleMode: () => {
        const next = get().mode === "dark" ? "light" : "dark"
        set({ mode: next })
        applyTheme(get().color, next)
      },
    }),
    {
      name: "theme-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.color, state.mode)
        }
      },
    },
  ),
)