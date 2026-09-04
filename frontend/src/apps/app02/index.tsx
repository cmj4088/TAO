import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import {
  FileText, FileSearch, Inbox, Download, CheckCircle2, XCircle, AlertTriangle,
  Bot, Loader2, Plus, RotateCcw, Copy
} from "lucide-react"
import client, { API_BASE } from "@/api/client"
import type {
  FileReviewResult, ReviewResponse, UploadedFileInfo, AiReviewFindingApp02, StickerType,
} from "@/types"
import { useAiReviewStream } from "./hooks/useAiReviewStream"
import { computeSticker, getStickerCounts } from "./utils/stickers"
import StreamingText from "./components/StreamingText"
import StickerIndicator from "./components/StickerIndicator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const RULE_LABEL: Record<string, string> = {
  school_name_error: "学校名称错误",
  teacher_mismatch: "教师信息不匹配",
  typo: "错别字",
  hour_calculation_error: "课时计算错误",
  hour_inconsistency: "课时不一致",
  format_issue: "格式问题",
}

// 文件类型颜色映射
const typeColorMap: Record<string, string> = {
  "课程标准": "bg-blue-500/10 text-blue-500 border-blue-500/30",
  "授课计划": "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  "教案": "bg-orange-500/10 text-orange-500 border-orange-500/30",
}

const typeDefaultColor = "bg-muted text-muted-foreground"

const App02: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([])
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiReviewPhase, setAiReviewPhase] = useState<"idle" | "reviewing" | "done">("idle")
  const [previewFileId, setPreviewFileId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // AI 审查 SSE 流式
  const [aiTaskId, setAiTaskId] = useState<string | null>(null)
  const [aiFindings, setAiFindings] = useState<AiReviewFindingApp02[]>([])
  const [aiReviewing, setAiReviewing] = useState(false)
  const {
    streamReasonings, streamFindings, streamExtractedInfo, streamStatus, streamPhase,
    allDone, reset: resetStream,
  } = useAiReviewStream(aiTaskId)

  useEffect(() => {
    if (allDone) {
      const all: AiReviewFindingApp02[] = []
      for (const findings of Object.values(streamFindings)) all.push(...findings)
      setAiFindings(all)
      setAiReviewing(false)
      setAiReviewPhase("done")
    }
  }, [allDone, streamFindings])

  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(new Set())
  const [stickerFilter, setStickerFilter] = useState<StickerType | "all">("fail")
  const [ignoredIssueKeys, setIgnoredIssueKeys] = useState<Set<string>>(new Set())
  const hasReviewedOnce = useRef(false)

  useEffect(() => {
    if (aiFindings.length > 0) {
      const ids = [...new Set(aiFindings.map((f) => f.file_id))]
      setExpandedRowKeys((prev) => [...new Set([...prev, ...ids])])
    }
  }, [aiFindings])

  const toggleStreamExpand = useCallback((fileId: string) => {
    setExpandedStreams((prev) => {
      const next = new Set(prev)
      next.has(fileId) ? next.delete(fileId) : next.add(fileId)
      return next
    })
  }, [])

  const doUpload = useCallback(async (fileList: File[]) => {
    if (fileList.length === 0) return
    setLoading(true)
    const formData = new FormData()
    for (const f of fileList) formData.append("files", f)
    try {
      const res = await client.post("/api/app02/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setUploadedFiles((prev) => [...prev, ...res.data.files])
      toast.success(`已接收 ${res.data.files.length} 个文件`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "上传失败")
    } finally { setLoading(false) }
  }, [])

  const doReview = useCallback(async () => {
    if (uploadedFiles.length === 0) { toast.warning("请先上传文件"); return }
    setLoading(true)
    try {
      const res = await client.post<ReviewResponse>("/api/app02/review")
      setReviewResult(res.data)
      hasReviewedOnce.current = true
      toast.success(res.data.summary)
      if (res.data.ai_task_id) {
        resetStream(); setAiFindings([]); setAiReviewing(true)
        setAiReviewPhase("reviewing"); setAiTaskId(res.data.ai_task_id)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "审查失败")
    } finally { setLoading(false) }
  }, [uploadedFiles, resetStream])

  const doClearAll = useCallback(async () => {
    try { await client.post("/api/app02/reset") } catch {}
    setUploadedFiles([]); setReviewResult(null); setPreviewFileId(null)
    setAiFindings([]); setAiTaskId(null); setAiReviewing(false)
    setAiReviewPhase("idle"); resetStream(); setIgnoredIssueKeys(new Set())
    hasReviewedOnce.current = false
  }, [resetStream])

  const doExport = useCallback(async () => {
    if (!reviewResult) { toast.warning("请先执行审查"); return }
    try {
      const res = await client.get("/api/app02/export", { responseType: "blob" })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement("a"); a.href = url
      a.download = "文件审查结果.xlsx"; document.body.appendChild(a)
      a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
      toast.success("导出成功")
    } catch (err: any) { toast.error("导出失败：" + (err?.message || "未知错误")) }
  }, [reviewResult])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => {
      const name = f.name.toLowerCase()
      return name.endsWith(".doc") || name.endsWith(".docx")
    })
    if (files.length === 0) { toast.warning("未找到 .doc 或 .docx 文件"); e.target.value = ""; return }
    doUpload(files); e.target.value = ""
  }, [doUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const items = e.dataTransfer.items
    if (!items) return
    const docFiles: File[] = []
    const readEntry = (entry: FileSystemEntry): Promise<void> => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file((f) => {
            if (f.name.toLowerCase().match(/\.(doc|docx)$/)) docFiles.push(f)
            resolve()
          })
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader()
          reader.readEntries((entries) => Promise.all(entries.map(readEntry)).then(() => resolve()))
        } else resolve()
      })
    }
    const entries: FileSystemEntry[] = []
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry()
      if (entry) entries.push(entry)
    }
    Promise.all(entries.map(readEntry)).then(() => {
      if (docFiles.length === 0) toast.warning("未找到 .doc 或 .docx 文件")
      else doUpload(docFiles)
    })
  }, [doUpload])

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const getFileAiFindings = useCallback((fileId: string): AiReviewFindingApp02[] => {
    if (streamFindings[fileId]) return streamFindings[fileId]
    return aiFindings.filter((f) => f.file_id === fileId)
  }, [streamFindings, aiFindings])

  const filteredResults = useMemo(() => {
    if (!reviewResult) return []
    if (stickerFilter === "all") return reviewResult.results
    return reviewResult.results.filter((r) => computeSticker(r, getFileAiFindings(r.file_id)) === stickerFilter)
  }, [reviewResult, stickerFilter, getFileAiFindings])

  const stickerCounts = useMemo(() => {
    if (!reviewResult) return { pass: 0, fail: 0, ambiguous: 0 }
    const map: Record<string, AiReviewFindingApp02[]> = {}
    for (const r of reviewResult.results) map[r.file_id] = getFileAiFindings(r.file_id)
    return getStickerCounts(reviewResult.results, map)
  }, [reviewResult, getFileAiFindings])

  const toggleIgnoreIssue = useCallback((key: string) => {
    setIgnoredIssueKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <FileSearch className="h-6 w-6" />
        文件审查
      </h2>

      {/* 上传区域 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer bg-muted/30 hover:border-primary/50 transition-colors"
          >
            <Inbox className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">点击或拖拽文件/文件夹到此处</p>
            <p className="text-xs text-muted-foreground">支持 .doc / .docx，可多次导入累加</p>
            <div className="flex gap-2 justify-center mt-3">
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                选择文件
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click() }}>
                选择文件夹
              </Button>
            </div>
          </div>

          {/* 已导入文件 */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((f) => (
                <Badge key={f.file_id} variant="outline" className={cn("gap-1 text-xs py-1", typeColorMap[f.file_type] || typeDefaultColor)}>
                  <FileText className="h-3 w-3" />
                  {f.filename}{f.is_doc && " (.doc→.docx)"}
                </Badge>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          {uploadedFiles.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={doReview} disabled={loading && !aiReviewing}>
                {hasReviewedOnce.current ? <Plus className="mr-1 h-4 w-4" /> : <FileSearch className="mr-1 h-4 w-4" />}
                {hasReviewedOnce.current ? "审批新增" : "开始审查"}
              </Button>
              {aiReviewing && (
                <Button disabled variant="outline">
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  AI分析中（{Object.values(streamStatus).filter((s) => s === "done").length}/{reviewResult?.results.length || 0}）
                </Button>
              )}
              <Button variant="outline" onClick={doClearAll}>
                <RotateCcw className="mr-1 h-4 w-4" />清除全部
              </Button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple className="hidden" onChange={handleFileSelect} />
          <input ref={folderInputRef} type="file" {...({ webkitdirectory: "" } as any)} multiple className="hidden" onChange={handleFileSelect} />
        </CardContent>
      </Card>

      {/* AI 审查中 */}
      {aiReviewPhase === "reviewing" && reviewResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-normal">
              AI 正在审查（{Object.values(streamStatus).filter((s) => s === "done").length}/{reviewResult.results.length}）
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-420px)] overflow-auto">
            {(() => {
              const sorted = [...reviewResult.results].sort((a, b) => {
                const order: Record<string, number> = { reasoning: 0, answering: 1, undefined: 2, waiting: 2, done: 3, error: 3 }
                return (order[streamPhase[a.file_id] || "waiting"] ?? 2) - (order[streamPhase[b.file_id] || "waiting"] ?? 2)
              })
              const active = sorted.filter((r) => { const p = streamPhase[r.file_id]; return p !== "done" && p !== "error" })
              const finished = sorted.filter((r) => { const p = streamPhase[r.file_id]; return p === "done" || p === "error" })

              const renderFileRow = (result: FileReviewResult, isFinished: boolean) => {
                const phase = streamPhase[result.file_id]
                const reasoningText = streamReasonings[result.file_id] || ""
                const isThinking = phase === "reasoning"
                return (
                  <div key={result.file_id} className="mb-2.5 p-2.5 border border-border rounded-md bg-muted/30">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium flex-1">{result.filename}</span>
                      <Badge variant="outline" className={cn("text-xs", typeColorMap[result.file_type] || typeDefaultColor)}>{result.file_type || "未知"}</Badge>
                      {isThinking && <Badge variant="outline" className="text-xs">🧠 思考中</Badge>}
                      {isFinished && <Badge variant="outline" className="text-xs border-green-500/50 text-green-500">✅ 完成</Badge>}
                      {!phase && <span className="text-xs text-muted-foreground">排队中</span>}
                      {phase === "error" && <Badge variant="destructive" className="text-xs">出错</Badge>}
                    </div>
                    {reasoningText && (
                      <StreamingText text={reasoningText} expanded={isThinking || expandedStreams.has(result.file_id + "-reasoning")}
                        onToggleExpand={() => toggleStreamExpand(result.file_id + "-reasoning")} isStreaming={isThinking}
                        label={isThinking ? "🧠 思考中..." : "🧠 思考过程（点击展开）"} variant="reasoning" />
                    )}
                    {!reasoningText && !isFinished && phase !== "error" && (
                      <div className="mt-1.5 px-2.5 py-1.5 bg-muted/20 rounded-md border border-border">
                        <span className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1.5" />{phase ? "等待 AI 响应..." : "排队等待中..."}</span>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div>
                  {active.map((r) => renderFileRow(r, false))}
                  {finished.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-1.5 cursor-pointer mb-2 select-none" onClick={() => {
                        setExpandedStreams((prev) => {
                          const next = new Set(prev)
                          next.has("__done_section") ? next.delete("__done_section") : next.add("__done_section")
                          return next
                        })
                      }}>
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-sm text-success">已完成（{finished.length}）</span>
                        <span className="text-xs text-muted-foreground">{expandedStreams.has("__done_section") ? "收起 ▲" : "展开 ▼"}</span>
                      </div>
                      {expandedStreams.has("__done_section") && finished.map((r) => renderFileRow(r, true))}
                      {!expandedStreams.has("__done_section") && (
                        <span className="text-xs text-muted-foreground ml-5">
                          {finished.slice(0, 3).map((r) => r.filename.length > 18 ? r.filename.slice(0, 18) + "..." : r.filename).join("、")}
                          {finished.length > 3 ? ` 等 ${finished.length} 个` : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* AI 审查完成 */}
      {aiReviewPhase === "done" && reviewResult && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">审查结果</CardTitle>
            {reviewResult.mode === "batch" && (
              <Button variant="outline" size="sm" onClick={doExport}>
                <Download className="mr-1 h-4 w-4" />导出 Excel
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={stickerCounts.fail > 0 ? "destructive" : "default"}>
              <AlertDescription>
                {`共 ${reviewResult.results.length} 个文件：❌ ${stickerCounts.fail} 个关键问题，⚠ ${stickerCounts.ambiguous} 个仅有提醒，✅ ${stickerCounts.pass} 个通过`}
              </AlertDescription>
            </Alert>

            <ToggleGroup type="single" value={stickerFilter} onValueChange={(v) => v && setStickerFilter(v as StickerType | "all")}>
              <ToggleGroupItem value="fail" className="text-xs">❌ 关键问题（{stickerCounts.fail}）</ToggleGroupItem>
              <ToggleGroupItem value="ambiguous" className="text-xs">⚠ 仅有提醒（{stickerCounts.ambiguous}）</ToggleGroupItem>
              <ToggleGroupItem value="pass" className="text-xs">✅ 通过（{stickerCounts.pass}）</ToggleGroupItem>
              <ToggleGroupItem value="all" className="text-xs">全部（{reviewResult.results.length}）</ToggleGroupItem>
            </ToggleGroup>

            <div className="max-h-[calc(100vh-500px)] overflow-auto space-y-1.5">
              {filteredResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {stickerFilter === "fail" ? "所有文件都没有关键问题" :
                   stickerFilter === "ambiguous" ? "所有文件都没有仅提醒项" :
                   stickerFilter === "pass" ? "没有完全通过的文件" : "暂无文件"}
                </div>
              ) : (
                filteredResults.map((result) => {
                  const fileAiFindings = getFileAiFindings(result.file_id)
                  const aiErrors = fileAiFindings.filter((f) => f.severity === "error")
                  const aiWarnings = fileAiFindings.filter((f) => f.severity === "warning")
                  const extractedInfo = streamExtractedInfo[result.file_id]
                  const isExpanded = expandedRowKeys.includes(result.file_id)

                  return (
                    <div key={result.file_id}>
                      <div
                        className={cn(
                          "flex items-center px-3.5 py-2.5 border border-border rounded-lg cursor-pointer transition-colors",
                          isExpanded ? "bg-muted/30" : "bg-card hover:bg-muted/20",
                        )}
                        onClick={() => setExpandedRowKeys((prev) =>
                          prev.includes(result.file_id) ? prev.filter((id) => id !== result.file_id) : [...prev, result.file_id]
                        )}
                      >
                        <div className="w-9 shrink-0">
                          <StickerIndicator result={result} aiFindings={fileAiFindings} streamStatus={streamStatus[result.file_id]} aiReviewing={false} />
                        </div>
                        <FileText className="h-4 w-4 text-primary mr-2" />
                        <span className="text-sm font-medium flex-1">{result.filename}</span>
                        <Badge variant="outline" className={cn("text-xs mr-2", typeColorMap[result.file_type] || typeDefaultColor)}>{result.file_type || "未知"}</Badge>
                        {extractedInfo?.teacher && <span className="text-xs text-muted-foreground mr-2">👤 {extractedInfo.teacher}</span>}
                        {aiErrors.length > 0 && <Badge variant="destructive" className="text-xs mr-1">{aiErrors.length} 错误</Badge>}
                        {aiWarnings.length > 0 && <Badge variant="secondary" className="text-xs mr-1">{aiWarnings.length} 提醒</Badge>}
                        {aiErrors.length === 0 && aiWarnings.length === 0 && <Badge variant="outline" className="text-xs border-green-500/50 text-green-500 mr-1">通过</Badge>}
                        <Button variant="link" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setPreviewFileId(result.file_id); }}>
                          查看原文
                        </Button>
                        <span className="text-xs text-muted-foreground">{isExpanded ? "收起 ▲" : "展开 ▼"}</span>
                      </div>

                      {isExpanded && (
                        <div className="mb-3 ml-11 p-3 bg-muted/20 rounded-lg border border-border">
                          {extractedInfo && (extractedInfo.teacher || extractedInfo.course) && (
                            <div className="grid grid-cols-3 gap-4 mb-3 p-2 bg-muted/30 rounded text-xs">
                              {extractedInfo.teacher && <div><span className="text-muted-foreground">教师：</span>{extractedInfo.teacher}</div>}
                              {extractedInfo.course && <div><span className="text-muted-foreground">课程：</span>{extractedInfo.course}</div>}
                              {extractedInfo.class_name && <div><span className="text-muted-foreground">班级：</span>{extractedInfo.class_name}</div>}
                            </div>
                          )}
                          {(() => {
                            const errors = fileAiFindings.filter((i) => i.severity === "error")
                            const warnings = fileAiFindings.filter((i) => i.severity === "warning")
                            const sorted = [...errors, ...warnings]
                            if (sorted.length === 0) return <Alert><AlertDescription>未发现任何问题</AlertDescription></Alert>
                            return sorted.map((f, idx) => {
                              const key = `ai-${result.file_id}-${idx}`
                              const isIgnored = ignoredIssueKeys.has(key)
                              const isError = f.severity === "error"
                              return (
                                <div key={key} className={cn(
                                  "mb-2 px-3 py-2 border-l-[3px] rounded",
                                  isIgnored ? "bg-muted/30 border-muted-foreground/30 opacity-55 line-through" :
                                  isError ? "bg-destructive/5 border-destructive" : "bg-warning/5 border-warning",
                                )}>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex gap-1 mb-0.5">
                                        <Badge variant={isError && !isIgnored ? "destructive" : "secondary"} className="text-xs">
                                          {RULE_LABEL[f.rule] || f.rule}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-500">AI</Badge>
                                        {isIgnored && <span className="text-xs text-muted-foreground">已忽略</span>}
                                      </div>
                                      <p className={cn("text-sm", isIgnored ? "text-muted-foreground" : isError ? "text-destructive" : "")}>
                                        {f.description}
                                      </p>
                                      {f.location && <p className="text-xs text-muted-foreground mt-0.5">位置：{f.location}</p>}
                                      {f.suggestion && <p className="text-xs text-success mt-0.5">建议：{f.suggestion}</p>}
                                    </div>
                                    {isError && (
                                      <Button size="sm" variant={isIgnored ? "outline" : "ghost"}
                                        className={cn("text-xs shrink-0 ml-2", !isIgnored && "text-destructive")}
                                        onClick={(e) => { e.stopPropagation(); toggleIgnoreIssue(key); }}>
                                        {isIgnored ? "取消忽略" : "忽略"}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!reviewResult && uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <p className="mb-4">点击「开始审查」检查文件</p>
            <Button onClick={doReview} disabled={loading}>开始审查</Button>
          </CardContent>
        </Card>
      )}

      {/* 文件预览弹窗 */}
      {previewFileId && reviewResult && (
        <Dialog open onOpenChange={() => setPreviewFileId(null)}>
          <DialogContent className="max-w-[90vw] h-[calc(100vh-200px)] min-h-[500px]">
            <DialogHeader>
              <DialogTitle>{reviewResult.results.find((r) => r.file_id === previewFileId)?.filename || "文件预览"}</DialogTitle>
            </DialogHeader>
            <div className="flex gap-4 flex-1 min-h-0">
              <div className="flex-1 border border-border rounded-lg overflow-hidden">
                <iframe src={`${API_BASE}/api/app02/preview/${previewFileId}`} className="w-full h-full border-0" />
              </div>
              <div className="w-[360px] overflow-auto border border-border rounded-lg p-4 shrink-0">
                {(() => {
                  const r = reviewResult.results.find((x) => x.file_id === previewFileId)
                  if (!r) return null
                  const fileAiFindings = getFileAiFindings(r.file_id)
                  const aiErrors = fileAiFindings.filter((f) => f.severity === "error")
                  const aiWarnings = fileAiFindings.filter((f) => f.severity === "warning")
                  const extractedInfo = streamExtractedInfo[r.file_id]
                  return (
                    <>
                      <div className="mb-4">
                        {aiErrors.length === 0 && aiWarnings.length === 0 ? (
                          <Badge variant="outline" className="text-base border-green-500/50 text-green-500">审查通过</Badge>
                        ) : aiErrors.length === 0 ? (
                          <Badge variant="secondary" className="text-base">通过（{aiWarnings.length} 条建议）</Badge>
                        ) : (
                          <div className="flex gap-1">
                            <Badge variant="destructive" className="text-base">{aiErrors.length} 个错误</Badge>
                            {aiWarnings.length > 0 && <Badge variant="secondary" className="text-base">{aiWarnings.length} 条提醒</Badge>}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 mb-4 text-sm">
                        <div><span className="text-muted-foreground">文件类型：</span>{r.file_type || "未知"}</div>
                        <div><span className="text-muted-foreground">老师：</span>{extractedInfo?.teacher || r.teacher}</div>
                        {extractedInfo?.course && <div><span className="text-muted-foreground">课程：</span>{extractedInfo.course}</div>}
                        {extractedInfo?.class_name && <div><span className="text-muted-foreground">班级：</span>{extractedInfo.class_name}</div>}
                      </div>
                      {fileAiFindings.length === 0 ? (
                        <Alert><AlertDescription>未发现任何问题</AlertDescription></Alert>
                      ) : (
                        <>
                          {aiErrors.map((f, idx) => (
                            <div key={`err-${idx}`} className="mb-3 p-3 bg-destructive/5 border-l-4 border-destructive rounded">
                              <div className="flex gap-1 mb-1">
                                <Badge variant="destructive" className="text-xs">{RULE_LABEL[f.rule] || f.rule}</Badge>
                                <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-500">AI</Badge>
                              </div>
                              <p className="text-sm text-destructive">{f.description}</p>
                              {f.location && <p className="text-xs text-muted-foreground mt-1">位置：{f.location}</p>}
                              {f.suggestion && <p className="text-xs text-success mt-1">建议：{f.suggestion}</p>}
                            </div>
                          ))}
                          {aiWarnings.map((f, idx) => (
                            <div key={`warn-${idx}`} className="mb-3 p-3 bg-warning/5 border-l-4 border-warning rounded">
                              <div className="flex gap-1 mb-1">
                                <Badge variant="secondary" className="text-xs">{RULE_LABEL[f.rule] || f.rule}</Badge>
                                <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-500">AI</Badge>
                              </div>
                              <p className="text-sm">{f.description}</p>
                              {f.location && <p className="text-xs text-muted-foreground mt-1">位置：{f.location}</p>}
                              {f.suggestion && <p className="text-xs text-success mt-1">建议：{f.suggestion}</p>}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default App02