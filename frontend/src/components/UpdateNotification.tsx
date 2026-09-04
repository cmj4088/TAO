import React, { useEffect, useState, useCallback } from "react"
import { Download, CheckCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface UpdateInfo {
  type: "available" | "progress" | "downloaded"
  version?: string
  percent?: number
}

const electronAPI = (window as any).electronAPI

const UpdateNotification: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [version, setVersion] = useState("")
  const [percent, setPercent] = useState(0)

  const handleUpdate = useCallback((data: UpdateInfo) => {
    switch (data.type) {
      case "available":
        setVersion(data.version || "")
        setOpen(true)
        break
      case "progress":
        setDownloading(true)
        setPercent(data.percent || 0)
        break
      case "downloaded":
        setDownloading(false)
        setDownloaded(true)
        break
    }
  }, [])

  useEffect(() => {
    if (electronAPI?.onUpdateStatus) {
      electronAPI.onUpdateStatus(handleUpdate)
    }
  }, [handleUpdate])

  const startDownload = () => {
    setDownloading(true)
    electronAPI?.downloadUpdate?.()
  }

  const installNow = () => {
    electronAPI?.quitAndInstall?.()
  }

  if (!electronAPI) return null

  return (
    <Dialog open={open} onOpenChange={downloading ? undefined : setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>软件更新</DialogTitle>
        </DialogHeader>

        {!downloading && !downloaded && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              发现新版本 <strong className="text-foreground">v{version}</strong>，是否下载更新？
            </p>
            <div className="flex gap-2">
              <Button onClick={startDownload}>
                <Download className="mr-2 h-4 w-4" />
                立即更新
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>稍后提醒</Button>
            </div>
          </div>
        )}

        {downloading && (
          <div className="space-y-4">
            <p className="text-sm">正在下载更新...</p>
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground text-right">{percent}%</p>
          </div>
        )}

        {downloaded && (
          <div className="space-y-4">
            <p className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              更新已下载完成，重启后生效。
            </p>
            <Button onClick={installNow}>立即重启</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default UpdateNotification