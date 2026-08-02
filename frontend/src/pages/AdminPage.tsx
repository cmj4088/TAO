import React, { useEffect, useState } from "react"
import { Plus, Trash2, Zap, Shield, Key } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import client from "@/api/client"
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
  const { user } = useAuthStore()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
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

  const loadLlmConfig = async () => {
    try {
      const res = await client.get("/api/auth/llm-config")
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
      await client.put("/api/auth/llm-config", {
        url: llmUrl,
        key: editingKey ? newKey.trim() : "",
        model: llmModel,
        key_changed: editingKey && !!newKey.trim(),
      })
      if (editingKey) {
        setEditingKey(false)
        setNewKey("")
      }
      toast.success("大模型配置已保存")
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
                <TableRow key={u.id}>
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
          <CardTitle className="text-lg">大模型配置（当前用户）</CardTitle>
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