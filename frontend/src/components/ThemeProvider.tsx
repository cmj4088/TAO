import { useEffect } from "react"
import { useThemeStore } from "@/stores/themeStore"

/** 主题初始化 — 在应用启动时应用持久化的主题设置 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { color, mode } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement

    // 色系
    const colorMap: Record<string, string | null> = {
      blue: null,
      purple: "purple",
      cyan: "cyan",
      amber: "amber",
      rose: "rose",
    }
    root.removeAttribute("data-theme")
    const attr = colorMap[color]
    if (attr) {
      root.setAttribute("data-theme", attr)
    }

    // 暗色/亮色
    root.classList.remove("light", "dark")
    root.classList.add(mode)
  }, [color, mode])

  return <>{children}</>
}