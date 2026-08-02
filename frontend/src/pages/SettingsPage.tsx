import React, { useEffect, useState } from "react"
import { Sun, Moon, Zap, Eye, EyeOff, BarChart3, Lock, Info, Shield, Trash2, User as UserIcon, Mail, Clock } from "lucide-react"
import { useSettingsStore } from "@/stores/settingsStore"
import { useThemeStore, type ThemeColor } from "@/stores/themeStore"
import { useAuthStore } from "@/stores/authStore"
import client from "@/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
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
import { toast } from "sonner"
import ProviderQuickSelect, { type ProviderInfo } from "@/components/ProviderQuickSelect"
import { cn } from "@/lib/utils"

const COLOR_OPTIONS: { value: ThemeColor; label: string; color: string }[] = [
  { value: "blue", label: "经典蓝", color: "bg-blue-500" },
  { value: "purple", label: "暗夜紫", color: "bg-purple-500" },
  { value: "cyan", label: "翡翠青", color: "bg-cyan-500" },
  { value: "amber", label: "琥珀橙", color: "bg-amber-500" },
  { value: "rose", label: "玫瑰粉", color: "bg-rose-500" },
]

const SettingsPage: React.FC = () => {
  const { app02AiConcurrency, setApp02AiConcurrency, loadApp02Settings, saveApp02Settings } = useSettingsStore()
  const { color, mode, setColor, setMode } = useThemeStore()
  const { user } = useAuthStore()

  // LLM 配置
  const [llmUrl, setLlmUrl] = useState("")
  const [llmKey, setLlmKey] = useState("")
  const [llmModel, setLlmModel] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [llmSaving, setLlmSaving] = useState(false)
  const [editingKey, setEditingKey] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [providerModalOpen, setProviderModalOpen] = useState(false)

  // 修改密码
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPw, setChangingPw] = useState(false)

  // 通知设置
  const [notifyReviewComplete, setNotifyReviewComplete] = useState(true)
  const [notifyUpdate, setNotifyUpdate] = useState(true)

  // LLM 连接测试
  const [testingLlm, setTestingLlm] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "fail" | null>(null)

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
    loadApp02Settings()
    loadLlmConfig()
  }, [])

  const handleSaveAi = async () => {
    try {
      await saveApp02Settings()
      toast.success("AI 设置已保存")
    } catch {
      toast.error("保存失败")
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
        const trimmedKey = newKey.trim()
        if (!trimmedKey) {
          toast.warning("API Key 不能为空，已取消修改")
          setEditingKey(false)
          setNewKey("")
          setLlmSaving(false)
          return
        }
        setEditingKey(false)
        setNewKey("")
      }
      toast.success("大模型配置已保存")
      await loadLlmConfig()
    } catch {
      toast.error("保存失败，请检查后端是否启动")
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

  // 修改密码
  const handleChangePassword = async () => {
    if (!oldPassword) {
      toast.error("请输入旧密码")
      return
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("新密码至少 8 位")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致")
      return
    }
    setChangingPw(true)
    try {
      await client.put("/api/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      })
      toast.success("密码修改成功，所有设备已登出，请重新登录")
      setChangePwOpen(false)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "修改失败"
      toast.error(msg)
    } finally {
      setChangingPw(false)
    }
  }

  // 测试 LLM 连接
  const handleTestLlm = async () => {
    setTestingLlm(true)
    setTestResult(null)
    try {
      // 使用后端代理测试连接
      await client.post("/api/auth/llm-test", {
        url: llmUrl,
        key: editingKey ? newKey.trim() : "",
        model: llmModel,
      })
      setTestResult("success")
      toast.success("连接测试成功，API 响应正常")
    } catch {
      setTestResult("fail")
      toast.error("连接测试失败，请检查 API 地址和密钥")
    } finally {
      setTestingLlm(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <h1 className="text-2xl font-bold">设置</h1>

      {/* 主题设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">主题设置</CardTitle>
          <CardDescription>自定义界面配色和外观</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 色系选择 */}
          <div className="space-y-2">
            <Label>配色方案</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setColor(opt.value)}
                  className={cn(
                    "relative w-10 h-10 rounded-full transition-all hover:scale-110",
                    opt.color,
                    color === opt.value && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110",
                  )}
                  title={opt.label}
                >
                  {color === opt.value && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 暗色/亮色切换 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>显示模式</Label>
              <p className="text-sm text-muted-foreground">
                {mode === "dark" ? "暗色模式" : "亮色模式"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            >
              {mode === "dark" ? (
                <><Sun className="mr-2 h-4 w-4" /> 切换亮色</>
              ) : (
                <><Moon className="mr-2 h-4 w-4" /> 切换暗色</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 账号信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            账号信息
          </CardTitle>
          <CardDescription>查看和修改你的账号设置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">邮箱</Label>
              <p className="text-sm flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {user?.email || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">显示名称</Label>
              <p className="text-sm flex items-center gap-2">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {user?.display_name || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">角色</Label>
              <p className="text-sm flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant={user?.role === "admin" ? "destructive" : "secondary"} className="text-xs">
                  {user?.role === "admin" ? "管理员" : "教师"}
                </Badge>
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">注册时间</Label>
              <p className="text-sm flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {user?.created_at || "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>登录密码</Label>
              <p className="text-sm text-muted-foreground">定期更换密码可以提高账号安全性</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setChangePwOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              修改密码
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 通知设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">通知设置</CardTitle>
          <CardDescription>管理应用通知和提醒</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>审查完成通知</Label>
              <p className="text-sm text-muted-foreground">AI 文件审查完成后发送通知</p>
            </div>
            <Switch
              checked={notifyReviewComplete}
              onCheckedChange={setNotifyReviewComplete}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>更新提醒</Label>
              <p className="text-sm text-muted-foreground">有新版本时提醒更新</p>
            </div>
            <Switch
              checked={notifyUpdate}
              onCheckedChange={setNotifyUpdate}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI 审查设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI 审查设置</CardTitle>
          <CardDescription>调整 AI 审查并发数（1-10），数值越大越快但可能触发 API 限流</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>并发数</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={app02AiConcurrency}
              onChange={(e) => setApp02AiConcurrency(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <Button onClick={handleSaveAi}>保存 AI 设置</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* 大模型配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">大模型配置</CardTitle>
          <CardDescription>配置 AI 审查使用的 API 地址和密钥</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 快捷配置 */}
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setProviderModalOpen(true)}
          >
            <Zap className="mr-2 h-4 w-4" />
            快捷配置 — 选择 AI 供应商自动填入地址
          </Button>

          {/* API URL */}
          <div className="space-y-2">
            <Label>大模型 API URL</Label>
            <Input
              placeholder="https://ark.cn-beijing.volces.com/api/v3/chat/completions"
              value={llmUrl}
              onChange={(e) => setLlmUrl(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key</Label>
            {editingKey ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="输入新的 API Key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    autoFocus
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" onClick={() => { setEditingKey(false); setNewKey(""); }}>
                  取消
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={hasKey ? llmKey : ""}
                    placeholder={hasKey ? undefined : "未配置 API Key"}
                    disabled
                    className="pr-10"
                  />
                  {hasKey && (
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setEditingKey(true)}>
                  {hasKey ? "修改" : "设置"}
                </Button>
                {hasKey ? <Badge variant="default">已配置</Badge> : <Badge variant="destructive">未配置</Badge>}
              </div>
            )}
          </div>

          {/* 模型名称 */}
          <div className="space-y-2">
            <Label>模型名称</Label>
            <Input
              placeholder="deepseek-v4-pro-260425"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
            />
          </div>

          <Button onClick={handleSaveLlm} disabled={llmSaving}>
            {llmSaving ? "保存中..." : "保存大模型配置"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestLlm}
            disabled={testingLlm}
            className="ml-2"
          >
            {testingLlm ? (
              <><div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />测试中...</>
            ) : testResult === "success" ? (
              <><span className="text-emerald-500 mr-2">✓</span>连接正常</>
            ) : testResult === "fail" ? (
              <><span className="text-destructive mr-2">✗</span>连接失败</>
            ) : (
              "测试连接"
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* 数据统计（占位） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            数据统计
          </CardTitle>
          <CardDescription>AI 用量、审查结果、监考工作量等数据分析</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ai-usage">
            <TabsList>
              <TabsTrigger value="ai-usage">AI 用量</TabsTrigger>
              <TabsTrigger value="review-stats">审查统计</TabsTrigger>
              <TabsTrigger value="invigilation">监考工作量</TabsTrigger>
            </TabsList>
            <TabsContent value="ai-usage" className="mt-4">
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">暂无 AI 用量数据</p>
                    <p className="text-xs mt-1 opacity-60">使用文件审查功能后将自动生成统计</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="review-stats" className="mt-4">
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">暂无审查统计数据</p>
                    <p className="text-xs mt-1 opacity-60">提交文件审查后将自动生成统计</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="invigilation" className="mt-4">
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">暂无监考工作量数据</p>
                    <p className="text-xs mt-1 opacity-60">完成监考分配后将自动生成统计</p>
                  </div>
                </div>
              </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 关于系统 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            关于系统
          </CardTitle>
          <CardDescription>教务办·智能体 — 教学管理辅助平台</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">系统版本</Label>
              <p>v0.2.1</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">前端框架</Label>
              <p>React + shadcn/ui</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">后端框架</Label>
              <p>FastAPI (Python)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">AI 模型</Label>
              <p>DeepSeek V4</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>清除缓存</Label>
              <p className="text-sm text-muted-foreground">清除本地存储的临时数据和缓存</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  清除缓存
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认清除缓存？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将会清除本地存储的主题设置等缓存数据，你需要重新登录。此操作不会影响服务器数据。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {
                    localStorage.clear()
                    toast.success("缓存已清除")
                    window.location.href = "/login"
                  }}>
                    确认清除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* 修改密码弹窗 */}
      <Dialog open={changePwOpen} onOpenChange={setChangePwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old-password">旧密码</Label>
              <Input
                id="old-password"
                type="password"
                placeholder="输入当前密码"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少 8 位"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChangePwOpen(false)
              setOldPassword("")
              setNewPassword("")
              setConfirmPassword("")
            }}>取消</Button>
            <Button onClick={handleChangePassword} disabled={changingPw}>
              {changingPw ? "修改中..." : "确认修改"}
            </Button>
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

export default SettingsPage