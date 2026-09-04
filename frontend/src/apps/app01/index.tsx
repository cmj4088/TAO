import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import {
  Play, Undo2, Download, Inbox, FileSpreadsheet, Trash2, Bot, Loader2,
} from "lucide-react"
import client, { API_BASE } from "@/api/client"
import type { ExamRow, TeacherInfo, AllocateResponse, ValidationError } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// @dnd-kit
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"

// TanStack Table
import {
  useReactTable, getCoreRowModel, flexRender,
  type ColumnDef,
} from "@tanstack/react-table"

// ===== 可拖拽教师标签 =====
interface DraggableTeacherProps {
  teacher: string
  rowIndex: number
  field: "监考1" | "监考2"
  actual: number
  target: number
  isError: boolean
  tooltipText?: string
}

const DraggableTeacher: React.FC<DraggableTeacherProps> = ({
  teacher, rowIndex, field, actual, target, isError, tooltipText,
}) => {
  const dragId = `cell-${rowIndex}-${field}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { type: "cell-teacher", rowIndex, field, teacher },
  })

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : undefined,
  } : undefined

  let variant: "default" | "destructive" | "secondary" = "default"
  if (isError) variant = "destructive"
  else if (actual !== target) variant = "secondary"

  const label = `${teacher}(${actual}/${target})`
  const badge = (
    <span ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Badge
        variant={variant}
        className="cursor-grab active:cursor-grabbing text-xs select-none touch-none"
      >
        {label}
      </Badge>
    </span>
  )

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    )
  }
  return badge
}

// ===== 可放置单元格 =====
interface DroppableCellProps {
  rowIndex: number
  field: "监考1" | "监考2"
  children: React.ReactNode
  isEmpty: boolean
}

const DroppableCell: React.FC<DroppableCellProps> = ({ rowIndex, field, children, isEmpty }) => {
  const dropId = `drop-${rowIndex}-${field}`
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "cell", rowIndex, field },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[28px] flex items-center rounded transition-colors",
        isOver && "bg-primary/10 ring-1 ring-primary/30",
        isEmpty && !isOver && "border border-dashed border-border rounded px-2 py-0.5"
      )}
    >
      {isEmpty && !isOver ? (
        <span className="text-xs text-muted-foreground">拖入</span>
      ) : (
        children
      )}
    </div>
  )
}

// ===== 可拖拽贴纸（预备框） =====
interface DraggableStickerProps {
  teacher: string
  current: number
  target: number
}

const DraggableSticker: React.FC<DraggableStickerProps> = ({ teacher, current, target }) => {
  const dragId = `sticker-${teacher}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { type: "sticker", teacher },
  })

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    opacity: isDragging ? 0.3 : 1,
  } : undefined

  const isFull = current >= target
  return (
    <span ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Badge
        variant={isFull ? "default" : "secondary"}
        className="cursor-grab active:cursor-grabbing text-xs select-none touch-none"
      >
        {teacher}（{current}/{target}）
      </Badge>
    </span>
  )
}

// ===== 可放置预备框 =====
const DroppableStickerArea: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: "sticker-area",
    data: { type: "sticker-area" },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-3 p-2.5 rounded-md border border-dashed border-border bg-muted/20 transition-all",
        isOver && "bg-primary/5 border-primary/50"
      )}
    >
      <span className="text-xs text-muted-foreground mr-2">预备框（拖入清空 / 拖出填充）：</span>
      {children}
    </div>
  )
}

// ===== TanStack Table 列定义辅助 =====

// ===== 主组件 =====
const App01: React.FC = () => {
  const [examRows, setExamRows] = useState<ExamRow[]>([])
  const [teachers, setTeachers] = useState<TeacherInfo[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [teacherLoads, setTeacherLoads] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("")
  const [viewMode, setViewMode] = useState<"date" | "teacher">("date")
  const [undoStack, setUndoStack] = useState<ExamRow[][]>([])
  const undoStackRef = useRef(undoStack); undoStackRef.current = undoStack
  const teachersRef = useRef(teachers); teachersRef.current = teachers
  const examRowsRef = useRef(examRows); examRowsRef.current = examRows
  const activeTabRef = useRef(activeTab); activeTabRef.current = activeTab
  const versionRef = useRef(0)

  // @dnd-kit 拖拽状态
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragData, setActiveDragData] = useState<{
    type: "cell-teacher" | "sticker"
    rowIndex?: number
    field?: string
    teacher: string
  } | null>(null)
  const [overTab, setOverTab] = useState<string | null>(null)
  const tabHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 传感器：8px 移动阈值防止误触
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  // AI 审查
  const [aiReviewOpen, setAiReviewOpen] = useState(false)
  const [aiReviewing, setAiReviewing] = useState(false)
  const [aiStreamText, setAiStreamText] = useState("")
  const [aiFindings, setAiFindings] = useState<{ severity: string; description: string; suggestion: string }[]>([])
  const [aiSummary, setAiSummary] = useState("")
  const [aiError, setAiError] = useState("")
  const aiEventSourceRef = useRef<EventSource | null>(null)

  const [examFile, setExamFile] = useState<File | null>(null)
  const [contactFile, setContactFile] = useState<File | null>(null)
  const [examDragOver, setExamDragOver] = useState(false)
  const [contactDragOver, setContactDragOver] = useState(false)
  const examInputRef = useRef<HTMLInputElement>(null)
  const contactInputRef = useRef<HTMLInputElement>(null)

  // ===== 文件上传逻辑（不变） =====
  const handleFileDrop = useCallback((file: File, target: "exam" | "contact") => {
    if (!file.name.endsWith(".xlsx")) { toast.warning("只接受 .xlsx 文件"); return }
    target === "exam" ? setExamFile(file) : setContactFile(file)
  }, [])

  const handleDragEvent = useCallback((e: React.DragEvent, target: "exam" | "contact", over: boolean) => {
    e.preventDefault(); e.stopPropagation()
    if (over && (e.dataTransfer.items.length !== 1 || e.dataTransfer.items[0].kind !== "file")) return
    target === "exam" ? setExamDragOver(over) : setContactDragOver(over)
  }, [])

  const handleZoneDrop = useCallback((e: React.DragEvent, target: "exam" | "contact") => {
    e.preventDefault(); e.stopPropagation()
    setExamDragOver(false); setContactDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 1) { toast.warning("每次只能拖入 1 个文件"); return }
    if (files.length === 0) return
    handleFileDrop(files[0], target)
  }, [handleFileDrop])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, target: "exam" | "contact") => {
    const files = Array.from(e.target.files || [])
    if (files.length > 1) { toast.warning("每次只能选择 1 个文件"); e.target.value = ""; return }
    if (files.length === 0) return
    handleFileDrop(files[0], target)
    e.target.value = ""
  }, [handleFileDrop])

  const renderDropZone = (target: "exam" | "contact", file: File | null, dragOver: boolean, label: string, description: string) => {
    const inputRef = target === "exam" ? examInputRef : contactInputRef
    const borderColor = dragOver ? "border-primary" : file ? "border-success" : "border-border"
    const bgColor = dragOver ? "bg-primary/5" : file ? "bg-success/5" : "bg-muted/20"
    return (
      <div
        onDrop={(e) => handleZoneDrop(e, target)}
        onDragOver={(e) => handleDragEvent(e, target, true)}
        onDragLeave={(e) => handleDragEvent(e, target, false)}
        onClick={() => inputRef.current?.click()}
        className={cn("flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all flex items-center justify-center min-h-[80px]", borderColor, bgColor)}
      >
        {file ? (
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-success" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); target === "exam" ? setExamFile(null) : setContactFile(null) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div>
            <Inbox className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => handleFileSelect(e, target)} />
      </div>
    )
  }

  // ===== 业务逻辑 =====
  const doUploadBoth = useCallback(async () => {
    if (!examFile || !contactFile) { toast.warning("请先选择考试安排表和通讯录"); return }
    setLoading(true)
    const formData = new FormData(); formData.append("exam_file", examFile); formData.append("contact_file", contactFile)
    try {
      const res = await client.post("/api/app01/upload", formData, { headers: { "Content-Type": "multipart/form-data" } })
      setExamRows(res.data.exam_rows); setTeachers(res.data.teachers); setWarnings([]); setErrors([])
      toast.success(`解析完成：${res.data.exam_rows.length} 条考试安排，${res.data.teachers.length} 位教师`)
    } catch (err: any) { toast.error(err?.response?.data?.detail || "上传失败") }
    finally { setLoading(false) }
  }, [examFile, contactFile])

  const doAllocate = useCallback(async () => {
    if (examRows.length === 0) { toast.warning("请先上传文件"); return }
    versionRef.current += 1; const myVersion = versionRef.current
    setUndoStack((prev) => { const next = [...prev, JSON.parse(JSON.stringify(examRowsRef.current))]; if (next.length > 50) next.shift(); return next })
    setLoading(true)
    try {
      const allocateRes = await client.post<AllocateResponse>("/api/app01/allocate", { exam_rows: examRowsRef.current, teachers: teachersRef.current })
      if (myVersion !== versionRef.current) return
      setExamRows(allocateRes.data.exam_rows); setWarnings(allocateRes.data.warnings)
      setTeacherLoads(allocateRes.data.teacher_loads || {})
      try {
        const validateRes = await client.post("/api/app01/validate", { exam_rows: allocateRes.data.exam_rows, teachers: teachersRef.current })
        if (myVersion === versionRef.current) {
          setErrors(validateRes.data.errors)
          const criticalCount = validateRes.data.errors.filter((e: ValidationError) => e.priority !== 2).length
          const fieldCount = validateRes.data.errors.filter((e: ValidationError) => e.priority === 2).length
          if (criticalCount > 0) toast.warning(`发现 ${criticalCount} 个严重违规${fieldCount > 0 ? `，另有 ${fieldCount} 个场次偏差` : ""}`, { duration: 5000 })
          else if (fieldCount > 0) toast.info(`${fieldCount} 个场次偏差，拖拽调整即可`)
          else if (allocateRes.data.warnings.length > 0) toast.warning(`分配完成，但有 ${allocateRes.data.warnings.length} 条警告`)
          else toast.success("分配完成，无违规")
        }
      } catch {
        if (myVersion !== versionRef.current) return; setErrors([])
        if (allocateRes.data.warnings.length > 0) toast.warning(`分配完成，但有 ${allocateRes.data.warnings.length} 条警告`)
        else toast.success("分配完成，无警告")
      }
    } catch (err: any) { if (myVersion !== versionRef.current) return; toast.error(err?.response?.data?.detail || "分配失败") }
    finally { if (myVersion === versionRef.current) setLoading(false) }
  }, [examRows])

  const doReplace = useCallback(async (rowIndex: number, field: "监考1" | "监考2", newTeacher: string) => {
    versionRef.current += 1; const myVersion = versionRef.current
    setUndoStack((prev) => { const next = [...prev, JSON.parse(JSON.stringify(examRowsRef.current))]; if (next.length > 50) next.shift(); return next })
    const newRows = examRowsRef.current.map((r) => ({ ...r }))
    const tgtRow = newRows.find((r) => r.index === rowIndex)
    if (!tgtRow) return; tgtRow[field] = newTeacher || null
    setExamRows(newRows)
    try {
      await client.post("/api/app01/replace", { row_index: rowIndex, position: field, new_teacher: newTeacher })
      const newLoadMap = new Map<string, number>()
      for (const r of newRows) { if (r.监考1) newLoadMap.set(r.监考1, (newLoadMap.get(r.监考1) || 0) + 1); if (r.监考2) newLoadMap.set(r.监考2, (newLoadMap.get(r.监考2) || 0) + 1) }
      setTeacherLoads(Object.fromEntries(newLoadMap))
      const validateRes = await client.post("/api/app01/validate", { exam_rows: newRows, teachers: teachersRef.current })
      if (myVersion === versionRef.current) setErrors(validateRes.data.errors)
      toast.success("替换成功")
    } catch {
      if (myVersion !== versionRef.current) return
      toast.warning("同步失败，导出结果可能与预览不一致")
      try { const validateRes = await client.post("/api/app01/validate", { exam_rows: newRows, teachers: teachersRef.current }); if (myVersion === versionRef.current) setErrors(validateRes.data.errors) } catch {}
    }
  }, [teachers])

  // ===== @dnd-kit 拖拽处理 =====
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    setActiveDragId(active.id as string)
    const data = active.data.current
    if (data?.type === "cell-teacher") {
      setActiveDragData({ type: "cell-teacher", rowIndex: data.rowIndex, field: data.field, teacher: data.teacher })
    } else if (data?.type === "sticker") {
      setActiveDragData({ type: "sticker", teacher: data.teacher })
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverTab(null); return }
    const overData = over.data.current
    // 检测是否悬停在 Tab 日期标签上
    if (overData?.tabDate && overData.tabDate !== activeTabRef.current) {
      if (!tabHoverTimer.current) {
        setOverTab(overData.tabDate)
        tabHoverTimer.current = setTimeout(() => {
          setActiveTab(overData.tabDate)
          setOverTab(null)
          tabHoverTimer.current = null
        }, 600)
      }
    } else {
      if (tabHoverTimer.current && overData?.tabDate !== overTab) {
        clearTimeout(tabHoverTimer.current)
        tabHoverTimer.current = null
        setOverTab(null)
      }
    }
  }, [overTab])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    setActiveDragData(null)
    if (tabHoverTimer.current) { clearTimeout(tabHoverTimer.current); tabHoverTimer.current = null }
    setOverTab(null)

    const activeData = active.data.current
    if (!activeData) return

    const sourceTeacher: string = activeData.teacher

    // 没有放置目标 = 清空源单元格
    if (!over) {
      if (activeData.type === "cell-teacher") {
        await doReplace(activeData.rowIndex, activeData.field, "")
      }
      return
    }

    const overData = over.data.current
    const overId = over.id as string

    // 放置到预备框 = 清空源单元格
    if (overData?.type === "sticker-area" || overId === "sticker-area") {
      if (activeData.type === "cell-teacher") {
        await doReplace(activeData.rowIndex, activeData.field, "")
      }
      return
    }

    // 放置到单元格
    if (overData?.type === "cell") {
      const targetRowIndex = overData.rowIndex as number
      const targetField = overData.field as "监考1" | "监考2"

      if (activeData.type === "sticker") {
        // 从贴纸拖到单元格 = 分配
        await doReplace(targetRowIndex, targetField, sourceTeacher)
        return
      }

      if (activeData.type === "cell-teacher") {
        const sourceRowIndex = activeData.rowIndex as number
        const sourceField = activeData.field as "监考1" | "监考2"

        // 同一单元格 = 无操作
        if (sourceRowIndex === targetRowIndex && sourceField === targetField) return

        // 交换两个单元格的老师
        versionRef.current += 1; const myVersion = versionRef.current
        setUndoStack((prev) => { const next = [...prev, JSON.parse(JSON.stringify(examRowsRef.current))]; if (next.length > 50) next.shift(); return next })
        const newRows = examRowsRef.current.map((r) => ({ ...r }))
        const srcRow = newRows.find((r) => r.index === sourceRowIndex)
        const tgtRow = newRows.find((r) => r.index === targetRowIndex)
        if (!srcRow || !tgtRow) return
        const tmp = srcRow[sourceField]
        srcRow[sourceField] = tgtRow[targetField]
        tgtRow[targetField] = tmp
        setExamRows(newRows)
        try {
          await client.post("/api/app01/swap", {
            source_row_index: sourceRowIndex,
            source_position: sourceField,
            target_row_index: targetRowIndex,
            target_position: targetField,
          })
          const newLoadMap = new Map<string, number>()
          for (const r of newRows) { if (r.监考1) newLoadMap.set(r.监考1, (newLoadMap.get(r.监考1) || 0) + 1); if (r.监考2) newLoadMap.set(r.监考2, (newLoadMap.get(r.监考2) || 0) + 1) }
          setTeacherLoads(Object.fromEntries(newLoadMap))
          const validateRes = await client.post("/api/app01/validate", { exam_rows: newRows, teachers: teachersRef.current })
          if (myVersion === versionRef.current) setErrors(validateRes.data.errors)
        } catch {
          if (myVersion !== versionRef.current) return
          toast.warning("同步失败")
          try { const validateRes = await client.post("/api/app01/validate", { exam_rows: newRows, teachers: teachersRef.current }); if (myVersion === versionRef.current) setErrors(validateRes.data.errors) } catch {}
        }
      }
    }
  }, [doReplace, teachers])

  // ===== 其他逻辑 =====
  const doValidate = useCallback(async () => {
    if (examRows.length === 0) { toast.warning("请先执行分配"); return }
    setLoading(true)
    try {
      const res = await client.post("/api/app01/validate", { exam_rows: examRows, teachers })
      setErrors(res.data.errors)
      if (res.data.errors.length === 0) toast.success("校验通过")
      else toast.warning(`发现 ${res.data.errors.length} 个违规项`)
    } catch (err: any) { toast.error(err?.response?.data?.detail || "校验失败") }
    finally { setLoading(false) }
  }, [examRows, teachers])

  const doExport = useCallback(async () => {
    if (examRows.length === 0) { toast.warning("请先执行分配"); return }
    if (errors.length > 0) {
      if (!window.confirm(`当前有 ${errors.length} 个违规项尚未处理，确定要导出吗？`)) return
    }
    try {
      await client.post("/api/app01/set-rows", { exam_rows: examRowsRef.current })
      const res = await client.get("/api/app01/export", { responseType: "blob" })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement("a"); a.href = url; a.download = "监考安排结果.xlsx"
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
      toast.success("导出成功")
    } catch (err: any) { toast.error("导出失败：" + (err?.response?.data?.detail || err?.message || "未知错误")) }
  }, [examRows, errors])

  const doUndo = useCallback(async () => {
    if (undoStackRef.current.length === 0) return
    versionRef.current += 1; const myVersion = versionRef.current
    const snapshot = undoStackRef.current[undoStackRef.current.length - 1]
    setUndoStack((prev) => prev.slice(0, -1)); setExamRows(snapshot)
    const newLoadMap = new Map<string, number>()
    for (const r of snapshot) { if (r.监考1) newLoadMap.set(r.监考1, (newLoadMap.get(r.监考1) || 0) + 1); if (r.监考2) newLoadMap.set(r.监考2, (newLoadMap.get(r.监考2) || 0) + 1) }
    setTeacherLoads(Object.fromEntries(newLoadMap))
    try {
      await client.post("/api/app01/set-rows", { exam_rows: snapshot })
      const validateRes = await client.post("/api/app01/validate", { exam_rows: snapshot, teachers: teachersRef.current })
      if (myVersion === versionRef.current) { setErrors(validateRes.data.errors || []); toast.info(`已撤销（剩余 ${undoStackRef.current.length - 1} 步）`) }
    } catch { if (myVersion !== versionRef.current) return; toast.warning("撤销同步失败") }
  }, [])

  // AI 审查
  const doAiReview = useCallback(async () => {
    if (examRows.length === 0) { toast.warning("请先执行分配"); return }
    setAiReviewOpen(true); setAiReviewing(true); setAiStreamText(""); setAiFindings([]); setAiSummary(""); setAiError("")
    try {
      const res = await client.post("/api/app01/ai-review"); const taskId = res.data.task_id
      const baseUrl = client.defaults.baseURL || API_BASE
      const es = new EventSource(`${baseUrl}/api/app01/ai-review/stream/${taskId}`); aiEventSourceRef.current = es
      es.addEventListener("reasoning", (e: MessageEvent) => { setAiStreamText((prev) => prev + JSON.parse(e.data).content) })
      es.addEventListener("token", (e: MessageEvent) => { setAiStreamText((prev) => prev + JSON.parse(e.data).content) })
      es.addEventListener("done", (e: MessageEvent) => { const data = JSON.parse(e.data); setAiFindings(data.findings || []); setAiSummary(data.summary || ""); setAiReviewing(false); es.close() })
      es.addEventListener("review_error", (e: MessageEvent) => { setAiError(JSON.parse(e.data).error || "AI 审查出错"); setAiReviewing(false); es.close() })
      es.addEventListener("error", () => { if (aiEventSourceRef.current) { setAiReviewing(false); es.close() } })
      es.addEventListener("task_done", () => es.close())
    } catch (err: any) { toast.error(err?.response?.data?.detail || "AI审查启动失败"); setAiReviewing(false) }
  }, [examRows])

  const closeAiReview = useCallback(() => { if (aiEventSourceRef.current) aiEventSourceRef.current.close(); setAiReviewOpen(false) }, [])

  const jumpToError = useCallback((rowIndex: number) => {
    const row = examRows.find((r) => r.index === rowIndex); if (!row) return
    const m = row.考试时间.match(/^(\d{4}-\d{2}-\d{2})/); const date = m ? m[1] : row.考试时间
    setViewMode("date"); setActiveTab(date)
    let attempts = 0
    const tryScroll = () => {
      const el = document.querySelector(`[data-row-key="${rowIndex}"]`)
      if (el && (el as HTMLElement).offsetParent !== null) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement).style.transition = "background 0.3s";
        (el as HTMLElement).style.background = "hsl(var(--destructive) / 0.1)"
        setTimeout(() => { (el as HTMLElement).style.background = "" }, 2000)
      } else if (attempts < 20) { attempts++; setTimeout(tryScroll, 150) }
    }
    setTimeout(tryScroll, 100)
  }, [examRows])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z" && !e.repeat) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return
        e.preventDefault(); doUndo()
      }
    }
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler)
  }, [doUndo])

  // ===== 数据派生 =====
  const extractDate = (time: string) => { const m = time.match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : time }

  const dateGroups: { date: string; rows: ExamRow[] }[] = useMemo(() => {
    const dateMap = new Map<string, ExamRow[]>()
    for (const r of examRows) { const d = extractDate(r.考试时间); if (!dateMap.has(d)) dateMap.set(d, []); dateMap.get(d)!.push(r) }
    const groups = Array.from(dateMap.entries()).map(([date, rows]) => ({ date, rows }))
    groups.sort((a, b) => a.date.localeCompare(b.date))
    return groups
  }, [examRows])

  const loadMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of examRows) { if (r.监考1) map.set(r.监考1, (map.get(r.监考1) || 0) + 1); if (r.监考2) map.set(r.监考2, (map.get(r.监考2) || 0) + 1) }
    return map
  }, [examRows])

  const teacherInfoMap = useMemo(() => new Map(teachers.map((t) => [t.name, t])), [teachers])
  const teacherSlotsMap = useMemo(() => new Map(teachers.map((t) => [t.name, t.slots])), [teachers])

  const errorMap = useMemo(() => {
    const map = new Map<string, ValidationError[]>()
    for (const e of errors) { const key = `${e.row_index}-${e.field}`; if (!map.has(key)) map.set(key, []); map.get(key)!.push(e) }
    return map
  }, [errors])

  const teacherSummaries = useMemo(() => {
    interface TeacherSession { date: string; time: string; location: string; className: string; courseName: string; sessionName: string; type: string }
    const summaryMap = new Map<string, TeacherSession[]>()
    for (const r of examRows) {
      const date = extractDate(r.考试时间); const base = { date, time: r.考试时间, location: r.考试地点, className: r.班级名称, courseName: r.教学班级名称, sessionName: r.场次 }
      if (r.监考1) { if (!summaryMap.has(r.监考1)) summaryMap.set(r.监考1, []); summaryMap.get(r.监考1)!.push({ ...base, type: "监考1" }) }
      if (r.监考2) { if (!summaryMap.has(r.监考2)) summaryMap.set(r.监考2, []); summaryMap.get(r.监考2)!.push({ ...base, type: "监考2" }) }
    }
    return Array.from(summaryMap.entries()).map(([name, sessions]) => {
      const info = teacherInfoMap.get(name)
      return { name, department: info?.department || "", slots: info?.slots || 0, group: info?.group || "", count: sessions.length, sessions }
    }).sort((a, b) => a.name.localeCompare(b.name, "zh"))
  }, [examRows, teacherInfoMap])

  // ===== TanStack Table 列定义 =====
  const tableColumns = useMemo<ColumnDef<ExamRow>[]>(() => [
    { id: "index", header: "序号", accessorKey: "index", size: 55 },
    { id: "场次", header: "场次", accessorKey: "场次", size: 55 },
    { id: "班级名称", header: "班级", accessorKey: "班级名称", size: 160,
      cell: ({ getValue }) => <span className="truncate block max-w-[160px]">{getValue() as string}</span>
    },
    { id: "教学班级名称", header: "教学班级", accessorKey: "教学班级名称", size: 200,
      cell: ({ getValue }) => <span className="truncate block max-w-[200px]">{getValue() as string}</span>
    },
    { id: "任课教师", header: "任课教师", accessorKey: "任课教师", size: 120,
      cell: ({ getValue }) => {
        const teachers = getValue() as string[]
        return <>{teachers.map((t: string) => <Badge key={t} variant="outline" className="text-xs mr-1">{t}</Badge>)}</>
      }
    },
    { id: "考试时间", header: "时间", accessorKey: "考试时间", size: 180 },
    { id: "考试地点", header: "地点", accessorKey: "考试地点", size: 110,
      cell: ({ getValue }) => <span className="truncate block max-w-[110px]">{getValue() as string}</span>
    },
    { id: "人数", header: "人数", accessorKey: "人数", size: 50 },
    { id: "监考1", header: "监考1", size: 110,
      cell: ({ row }) => {
        const r = row.original
        const val = r.监考1
        const cellErrors = errorMap.get(`${r.index}-监考1`)
        const isError = cellErrors && cellErrors.length > 0
        const actual = val ? (loadMap.get(val) || 0) : 0
        const target = val ? (teacherSlotsMap.get(val) || 0) : 0
        const tooltipText = cellErrors?.map((e) => e.reason).join("；")
        return (
          <DroppableCell rowIndex={r.index} field="监考1" isEmpty={!val}>
            {val && (
              <DraggableTeacher
                teacher={val} rowIndex={r.index} field="监考1"
                actual={actual} target={target} isError={!!isError}
                tooltipText={tooltipText}
              />
            )}
          </DroppableCell>
        )
      }
    },
    { id: "监考2", header: "监考2", size: 110,
      cell: ({ row }) => {
        const r = row.original
        const val = r.监考2
        const cellErrors = errorMap.get(`${r.index}-监考2`)
        const isError = cellErrors && cellErrors.length > 0
        const actual = val ? (loadMap.get(val) || 0) : 0
        const target = val ? (teacherSlotsMap.get(val) || 0) : 0
        const tooltipText = cellErrors?.map((e) => e.reason).join("；")
        return (
          <DroppableCell rowIndex={r.index} field="监考2" isEmpty={!val}>
            {val && (
              <DraggableTeacher
                teacher={val} rowIndex={r.index} field="监考2"
                actual={actual} target={target} isError={!!isError}
                tooltipText={tooltipText}
              />
            )}
          </DroppableCell>
        )
      }
    },
  ], [errorMap, loadMap, teacherSlotsMap])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">监考分配</h2>

      {/* 第一步：上传文件 */}
      <Card>
        <CardHeader><CardTitle className="text-base">第一步：上传文件</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4">
            {renderDropZone("exam", examFile, examDragOver, "考试安排表", "拖入或点击选择 .xlsx 文件")}
            {renderDropZone("contact", contactFile, contactDragOver, "教师通讯录", "拖入或点击选择 .xlsx 文件")}
          </div>
          <Button onClick={doUploadBoth} disabled={!examFile || !contactFile || loading}>
            {loading ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />解析中...</> : "解析文件"}
          </Button>
        </CardContent>
      </Card>

      {/* 第二步：预览与调整 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">第二步：预览与调整</CardTitle>
          {examRows.length > 0 && <span className="text-xs text-muted-foreground">共 {examRows.length} 条记录，{dateGroups.length} 个考试日</span>}
        </CardHeader>
        <CardContent>
          {examRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-4" /><br />请先上传文件并点击"解析文件"
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button onClick={doAllocate} disabled={loading}><Play className="mr-1 h-4 w-4" />执行分配</Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={doUndo} disabled={undoStack.length === 0}>
                      <Undo2 className="mr-1 h-4 w-4" />撤销{undoStack.length > 0 ? `（${undoStack.length}）` : ""}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>撤销上一步（Ctrl+Z）</TooltipContent>
                </Tooltip>
                <Button variant="outline" onClick={doExport}><Download className="mr-1 h-4 w-4" />导出 Excel</Button>
                <Button variant="outline" onClick={doAiReview} disabled={aiReviewing}>
                  {aiReviewing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bot className="mr-1 h-4 w-4" />}AI 审查
                </Button>
              </div>

              {warnings.length > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    <ul className="list-disc pl-5 text-sm">
                      {warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                      {warnings.length > 5 && <li>...共 {warnings.length} 条</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {(() => {
                const criticalErrors = errors.filter((e) => e.priority !== 2)
                const fieldErrors = errors.filter((e) => e.priority === 2)
                return (
                  <>
                    {criticalErrors.length > 0 && (
                      <div className="mb-4">
                        <Alert variant="destructive" className="mb-2">
                          <AlertDescription>{`${criticalErrors.length} 个严重违规项${fieldErrors.length > 0 ? `，另有 ${fieldErrors.length} 个场次偏差` : ""}`}</AlertDescription>
                        </Alert>
                        <div className="max-h-60 overflow-auto border border-destructive/30 rounded-lg p-2 bg-card">
                          {criticalErrors.slice(0, 30).map((e, i) => (
                            <div key={i} className="flex items-center gap-1.5 py-1.5 border-b border-destructive/10 last:border-0 text-sm">
                              <Badge variant={e.priority === 1 ? "destructive" : "secondary"} className="text-xs shrink-0">{e.field || "全局"}</Badge>
                              <span className="flex-1 break-all">
                                {e.row_index > 0 && <span className="text-muted-foreground">第{e.row_index}行 </span>}
                                {e.teacher ? `${e.teacher}：` : ""}{e.reason}
                              </span>
                              {e.row_index > 0 && <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => jumpToError(e.row_index)}>跳转 →</Button>}
                            </div>
                          ))}
                          {criticalErrors.length > 30 && <div className="py-1.5 text-center text-xs text-muted-foreground">...还有 {criticalErrors.length - 30} 个违规项</div>}
                        </div>
                      </div>
                    )}
                    {criticalErrors.length === 0 && fieldErrors.length > 0 && (
                      <Alert className="mb-4">
                        <AlertDescription>{`${fieldErrors.length} 个场次偏差，已在单元格标记颜色`}</AlertDescription>
                      </Alert>
                    )}
                  </>
                )
              })()}

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "date" | "teacher")}>
                <TabsList>
                  <TabsTrigger value="date">按日期查看</TabsTrigger>
                  <TabsTrigger value="teacher">按老师查看</TabsTrigger>
                </TabsList>
                <TabsContent value="date">
                  <Tabs value={activeTab || dateGroups[0]?.date} onValueChange={setActiveTab}>
                    <TabsList className="flex-wrap">
                      {dateGroups.map((g) => (
                        <TabsTrigger key={g.date} value={g.date} className="text-xs">
                          {g.date}（{g.rows.length}场）
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* @dnd-kit 拖拽上下文 */}
                    <DndContext
                      sensors={sensors}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                    >
                      {dateGroups.map((g) => {
                        // 贴纸数据
                        const stickers: { name: string; current: number; target: number }[] = []
                        for (const [name, info] of teacherInfoMap) {
                          if (info.slots === 0) continue
                          const current = loadMap.get(name) || 0
                          const daySlots = new Set<string>()
                          for (const r of g.rows) { if (r.监考1 === name || r.监考2 === name) daySlots.add(r.考试时间) }
                          const allDaySlots = new Set(g.rows.map((r) => r.考试时间))
                          if (!Array.from(allDaySlots).some((s) => !daySlots.has(s)) && daySlots.size > 0) continue
                          stickers.push({ name, current, target: info.slots })
                        }
                        stickers.sort((a, b) => (b.target - b.current) - (a.target - a.current) || a.name.localeCompare(b.name, "zh"))

                        // 为每个日期组创建 TanStack Table 实例
                        const TableContent: React.FC<{ rows: ExamRow[]; stickers: typeof stickers }> = ({ rows, stickers: stks }) => {
                          const table = useReactTable({
                            data: rows,
                            columns: tableColumns,
                            getCoreRowModel: getCoreRowModel(),
                            getRowId: (row) => String(row.index),
                          })

                          return (
                            <>
                              <Table>
                                <TableHeader>
                                  {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                      {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} style={{ width: header.getSize() }}>
                                          {flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableHeader>
                                <TableBody>
                                  {table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id} data-row-key={row.original.index}>
                                      {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>

                              {/* 预备框 */}
                              <DroppableStickerArea>
                                {stks.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {stks.map((s) => (
                                      <DraggableSticker key={s.name} teacher={s.name} current={s.current} target={s.target} />
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">拖拽单元格老师到此处清空</span>
                                )}
                              </DroppableStickerArea>
                            </>
                          )
                        }

                        return (
                          <TabsContent key={g.date} value={g.date}>
                            <TableContent rows={g.rows} stickers={stickers} />
                          </TabsContent>
                        )
                      })}

                      {/* 拖拽预览浮层 */}
                      <DragOverlay dropAnimation={null}>
                        {activeDragData ? (
                          <Badge variant="default" className="text-xs shadow-lg opacity-90">
                            {activeDragData.teacher}
                          </Badge>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  </Tabs>
                </TabsContent>
                <TabsContent value="teacher">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">教师姓名</TableHead>
                        <TableHead className="w-[160px]">部门/岗位</TableHead>
                        <TableHead className="w-[80px]">分组</TableHead>
                        <TableHead className="w-[90px]">目标场次</TableHead>
                        <TableHead className="w-[150px]">已排/目标</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherSummaries.map((t) => (
                        <TableRow key={t.name}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{t.department || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{t.group || "无"}</Badge></TableCell>
                          <TableCell>{t.slots} 场</TableCell>
                          <TableCell>
                            <Badge variant={t.count !== t.slots ? "secondary" : "default"} className="text-xs">{t.count} / {t.slots} 场</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI 审查弹窗 */}
      <Dialog open={aiReviewOpen} onOpenChange={closeAiReview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />AI 审查结果</DialogTitle>
          </DialogHeader>
          {aiReviewing && (
            <div>
              <div className="text-center py-6">
                <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">AI 正在分析监考安排...</p>
              </div>
              {aiStreamText && (
                <div className="max-h-[300px] overflow-auto p-4 bg-muted/30 rounded-md whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {aiStreamText}
                </div>
              )}
            </div>
          )}
          {!aiReviewing && aiError && <Alert variant="destructive"><AlertDescription>{aiError}</AlertDescription></Alert>}
          {!aiReviewing && !aiError && aiFindings.length === 0 && <Alert><AlertDescription>未发现问题，安排合理</AlertDescription></Alert>}
          {!aiReviewing && aiFindings.length > 0 && (
            <div>
              {aiSummary && (
                <Alert variant={aiFindings.some((f) => f.severity === "error") ? "destructive" : "default"} className="mb-4">
                  <AlertDescription>{aiSummary}</AlertDescription>
                </Alert>
              )}
              {aiFindings.map((f, i) => (
                <div key={i} className={cn("mb-3 p-3 border-l-4 rounded", f.severity === "error" ? "bg-destructive/5 border-destructive" : "bg-warning/5 border-warning")}>
                  <div className="mb-1 flex gap-1">
                    <Badge variant={f.severity === "error" ? "destructive" : "secondary"} className="text-xs">{f.severity === "error" ? "错误" : "提醒"}</Badge>
                  </div>
                  <p className={cn("text-sm", f.severity === "error" && "text-destructive")}>{f.description}</p>
                  {f.suggestion && <p className="text-xs text-success mt-1">建议：{f.suggestion}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App01