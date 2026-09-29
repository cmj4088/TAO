import React, { useEffect, useRef, useState } from "react"
import { Plus, Trash2, Zap, Shield, Key, ArrowLeft, HardDriveDownload, HardDriveUpload } from "lucide-react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { useAuthStore } from "@/stores/authStore"
import client, { API_BASE } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ProviderQuickSelect, { type ProviderInfo, ProviderMatchIndicator } from "@/components/ProviderQuickSelect"
import { toast } from "sonner"

interface UserItem {
  id: string
  email: string
  display_name: string
  role: string
  created_at: string
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  // 当前选中用户（用于编辑其 LLM 配置）
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createDisplayName, setCreateDisplayName] = useState("")
  const [createRole, setCreateRole] = useState("teacher")
  // 重置密码
  const [resetPwOpen, setResetPwOpen] = useState(false)
  const [resetPwUserId, setResetPwUserId] = useState("")
  const [resetPwEmail, setResetPwEmail] = useState("")
  const [resetPwNew, setResetPwNew] = useState("")

  // LLM 配置
  const [llmUrl, setLlmUrl] = useState("")
  const [llmKey, setLlmKey] = useState("")
  const [llmModel, setLlmModel] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [llmSaving, setLlmSaving] = useState(false)
  const [editingKey, setEditingKey] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [providerModalOpen, setProviderModalOpen] = useState(false)

  // 数据备份与恢复
  const backupFileRef = useRef<HTMLInputElement>(null)
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // 带 Bearer 的独立 axios 调用（下载/上传走长超时，不走通用 client 的 JSON 头）
  const authedConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    timeout: 120000,
  })

  const handleExportBackup = async () => {
    setExporting(true)
    try {
      const res = await axios.get(`${API_BASE}/api/admin/backup/export`, {
        ...authedConfig(),
        responseType: "blob",
      })
      // 从 Content-Disposition 取后端生成的文件名
      const disposition = (res.headers["content-disposition"] as string) || ""
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : "tao_backup.db"
      const url = URL.createObjectURL(res.data)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`备份已导出：${filename}`)
    } catch {
      toast.error("导出备份失败")
    } finally {
      setExporting(false)
    }
  }

  const handleRestoreBackup = async () => {
    if (!pendingRestoreFile) return
    setRestoring(true)
    try {
      const form = new FormData()
      form.append("file", pendingRestoreFile)
      // 用裸 axios 发 multipart（通用 client 的 JSON Content-Type 会破坏 boundary）
      await axios.post(`${API_BASE}/api/admin/backup/restore`, form, authedConfig())
      toast.success("数据库已恢复，请重新登录")
      // 恢复替换了整库，旧会话已失效 → 清除本地凭据回到登录页
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      navigate("/login")
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.data?.detail) {
        toast.error(`恢复失败：${e.response.data.detail}`)
      } else {
        toast.error("恢复失败，请确认上传的是有效的 .db 备份文件")
      }
    } finally {
      setRestoring(false)
      setPendingRestoreFile(null)
      if (backupFileRef.current) backupFileRef.current.value = ""
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await client.get("/api/auth/users")
      setUsers(res.data.data)
    } catch {
      toast.error("加载用户列表失败")
    } finally {
      setLoading(false)
    }
  }

  const loadLlmConfig = async (userId?: string) => {
    try {
      const targetId = userId || selectedUser?.id
      const url = targetId ? `/api/auth/users/${targetId}/llm-config` : "/api/auth/llm-config"
      const res = await client.get(url)
      const data = res.data.data
      setLlmUrl(data.url || "")
      setLlmKey(data.key || "")
      setLlmModel(data.model || "")
      setHasKey(data.has_key || false)
    } catch {
      // 保持默认
    }
  }

  useEffect(() => {
    loadUsers()
    loadLlmConfig()
  }, [])

  const handleCreateUser = async () => {
    if (!createEmail || !createPassword) {
      toast.error("请填写邮箱和密码")
      return
    }
    if (createEmail.length > 255) {
      toast.error("邮箱不能超过 255 个字符")
      return
    }
    if (createDisplayName.length > 50) {
      toast.error("显示名称不能超过 50 个字符")
      return
    }
    try {
      await client.post("/api/auth/users", {
        email: createEmail,
        password: createPassword,
        display_name: createDisplayName,
        role: createRole,
      })
      toast.success("用户创建成功")
      setCreateModalOpen(false)
      setCreateEmail("")
      setCreatePassword("")
      setCreateDisplayName("")
      setCreateRole("teacher")
      loadUsers()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "创建失败"
      toast.error(msg)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await client.delete(`/api/auth/users/${userId}`)
      toast.success("用户已删除")
      loadUsers()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "删除失败"
      toast.error(msg)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPwNew || resetPwNew.length < 8) {
      toast.error("密码至少 8 位")
      return
    }
    try {
      await client.put(`/api/auth/users/${resetPwUserId}/reset-password`, {
        new_password: resetPwNew,
      })
      toast.success("密码已重置")
      setResetPwOpen(false)
      setResetPwNew("")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "重置失败")
    }
  }

  const handleSaveLlm = async () => {
    setLlmSaving(true)
    try {
      const targetId = selectedUser?.id
      const url = targetId ? `/api/auth/users/${targetId}/llm-config` : "/api/auth/llm-config"
      await client.put(url, {
        url: llmUrl,
        key: editingKey ? newKey.trim() : "",
        model: llmModel,
        key_changed: editingKey && !!newKey.trim(),
      })
      if (editingKey) {
        setEditingKey(false)
        setNewKey("")
      }
      toast.success(`${selectedUser ? selectedUser.display_name : "当前用户"} 的大模型配置已保存`)
      await loadLlmConfig()
    } catch {
      toast.error("保存失败")
    } finally {
      setLlmSaving(false)
    }
  }

  const handleProviderSelect = (provider: ProviderInfo) => {
    setLlmUrl(provider.apiUrl)
    setLlmModel(provider.defaultModel)
    setEditingKey(true)
    setNewKey("")
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate("/home")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="h-6 w-6" />
        管理后台
      </h1>

      {/* 用户管理 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">用户管理</CardTitle>
            <CardDescription>管理系统中的所有用户账号</CardDescription>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            创建用户
          </Button>
        </CardHeader>
        <CardContent>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">邮箱</TableHead>
                <TableHead className="w-[20%]">显示名称</TableHead>
                <TableHead className="w-[12%]">角色</TableHead>
                <TableHead className="w-[22%]">创建时间</TableHead>
                <TableHead className="w-[18%]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  className={`cursor-pointer transition-colors ${selectedUser?.id === u.id ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted"}`}
                  onClick={() => {
                    setSelectedUser(u)
                    loadLlmConfig(u.id)
                  }}
                >
                  <TableCell className="font-medium truncate max-w-0" title={u.email}>{u.email}</TableCell>
                  <TableCell className="truncate max-w-0" title={u.display_name}>{u.display_name}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "destructive" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.created_at}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setResetPwUserId(u.id)
                          setResetPwEmail(u.email)
                          setResetPwNew("")
                          setResetPwOpen(true)
                        }}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={u.id === user?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除此用户？</AlertDialogTitle>
                          <AlertDialogDescription className="break-all">
                            此操作不可撤销，将永久删除用户 {u.email}。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteUser(u.id)}>
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {loading ? "加载中..." : "暂无用户"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* LLM 配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            大模型配置
            {selectedUser ? (
              <span className="text-muted-foreground font-normal">
                （{selectedUser.display_name} — {selectedUser.email}）
              </span>
            ) : (
              <span className="text-muted-foreground font-normal">（点击上方用户以编辑其配置）</span>
            )}
          </CardTitle>
          <CardDescription>配置 AI 审查使用的 API 地址和密钥</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setProviderModalOpen(true)}
          >
            <Zap className="mr-2 h-4 w-4" />
            快捷配置 — 选择 AI 供应商自动填入地址
          </Button>

          <div className="space-y-2">
            <Label>大模型 API URL</Label>
            <Input
              placeholder="https://ark.cn-beijing.volces.com/api/v3/chat/completions"
              value={llmUrl}
              onChange={(e) => setLlmUrl(e.target.value)}
            />
            <ProviderMatchIndicator url={llmUrl} />
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            {editingKey ? (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="输入新的 API Key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  autoFocus
                  className="flex-1"
                />
                <Button variant="outline" onClick={() => { setEditingKey(false); setNewKey(""); }}>
                  取消
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <Input
                  type="password"
                  value={hasKey ? llmKey : ""}
                  placeholder={hasKey ? undefined : "未配置 API Key"}
                  disabled
                  className="flex-1"
                />
                <Button variant="outline" onClick={() => setEditingKey(true)}>
                  {hasKey ? "修改" : "设置"}
                </Button>
                {hasKey ? <Badge variant="default">已配置</Badge> : <Badge variant="destructive">未配置</Badge>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>模型名称</Label>
            <Input
              placeholder="deepseek-v4-pro-260425"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
            />
          </div>

          <Button onClick={handleSaveLlm} disabled={llmSaving}>
            {llmSaving ? "保存中..." : "保存配置"}
          </Button>
        </CardContent>
      </Card>

      {/* 数据备份与迁移 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">数据备份与迁移</CardTitle>
          <CardDescription>
            导出全库备份（含全部账号、配置与数据）；换机或重装时上传恢复。
            恢复会覆盖当前全部数据，且所有用户需重新登录。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExportBackup} disabled={exporting}>
            <HardDriveDownload className="mr-2 h-4 w-4" />
            {exporting ? "导出中..." : "导出备份"}
          </Button>

          {/* 隐藏文件选择器，选中后弹确认框 */}
          <input
            ref={backupFileRef}
            type="file"
            accept=".db"
            className="hidden"
            onChange={(e) => setPendingRestoreFile(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            onClick={() => backupFileRef.current?.click()}
            disabled={restoring}
          >
            <HardDriveUpload className="mr-2 h-4 w-4" />
            {restoring ? "恢复中..." : "导入恢复"}
          </Button>

          {/* 恢复二次确认（覆盖全库，不可撤销） */}
          <AlertDialog
            open={!!pendingRestoreFile}
            onOpenChange={(open) => !open && setPendingRestoreFile(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认恢复数据库？</AlertDialogTitle>
                <AlertDialogDescription className="break-all">
                  将使用 <b>{pendingRestoreFile?.name}</b> 覆盖当前全部数据（账号、配置、历史记录），
                  此操作不可撤销。恢复成功后所有用户需重新登录。系统会先自动备份当前数据。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestoreBackup}>
                  确认恢复
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* 创建用户弹窗 */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">邮箱</Label>
              <Input
                id="new-email"
                placeholder="user@example.com"
                maxLength={255}
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">密码</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少 8 位密码"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-display-name">显示名称（可选，最多 50 字）</Label>
              <Input
                id="new-display-name"
                placeholder="可选"
                maxLength={50}
                value={createDisplayName}
                onChange={(e) => setCreateDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">{createDisplayName.length}/50</p>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">教师 (teacher)</SelectItem>
                  <SelectItem value="admin">管理员 (admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>取消</Button>
            <Button onClick={handleCreateUser}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码弹窗 */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户邮箱</Label>
              <Input value={resetPwEmail} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-new-password">新密码</Label>
              <Input
                id="reset-new-password"
                type="password"
                placeholder="至少 8 位密码"
                value={resetPwNew}
                onChange={(e) => setResetPwNew(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwOpen(false)}>取消</Button>
            <Button onClick={handleResetPassword}>确认重置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 供应商快捷选择弹窗 */}
      <ProviderQuickSelect
        open={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        onSelect={handleProviderSelect}
      />
    </div>
  )
}

export default AdminPage