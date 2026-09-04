import React, { useEffect, useState, useRef } from "react"
import { Wifi, RefreshCw } from "lucide-react"
import client, { API_BASE } from "@/api/client"

/** 连接状态检查组件 —— 启动时 ping 后端，失败则在页面顶部显示警告横幅 */
const ConnectionBanner: React.FC = () => {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [retrying, setRetrying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const ping = async () => {
    try {
      await client.get("/api/version", { timeout: 5000 })
      if (mountedRef.current) {
        setConnected(true)
        setRetrying(false)
      }
    } catch {
      if (mountedRef.current) {
        setConnected(false)
        setRetrying(false)
      }
    }
  }

  const startPolling = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      ping()
    }, 30_000)
  }

  useEffect(() => {
    mountedRef.current = true
    ping().then(() => {
      if (mountedRef.current) startPolling()
    })
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleRetry = () => {
    setRetrying(true)
    ping()
  }

  if (connected === null || connected === true) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-b-lg shadow-lg shadow-destructive/10 max-w-lg">
        <Wifi className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-sm font-medium text-destructive">
          未连接到服务器（{API_BASE}）
        </span>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline whitespace-nowrap cursor-pointer"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
          {retrying ? "检测中..." : "重试"}
        </button>
      </div>
    </div>
  )
}

// inline cn for simplicity
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

export default ConnectionBanner