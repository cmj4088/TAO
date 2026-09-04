import React, { useEffect, useState } from "react"
import { Download } from "lucide-react"
import client from "@/api/client"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function getLocalVersion(): string {
  const api = (window as any).electronAPI
  return api?.version || "0.1.3"
}

const VersionBadge: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await client.get("/api/version")
        const remote = res.data.version
        const local = getLocalVersion()
        if (remote && remote !== local) {
          setHasUpdate(true)
        }
      } catch {
        // 后端未启动时静默忽略
      }
    }
    check()
  }, [])

  if (!hasUpdate) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="cursor-pointer gap-1 bg-amber-500/10 text-amber-500 border-amber-500/30">
          <Download className="h-3 w-3" />
          新版本
        </Badge>
      </TooltipTrigger>
      <TooltipContent>有新版本可下载</TooltipContent>
    </Tooltip>
  )
}

export default VersionBadge