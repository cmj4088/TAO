import React, { useState, useEffect, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { User, Lock, Mail, ArrowLeft } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { register, sendVerifyCode } = useAuthStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // 验证码倒计时
  const [countdown, setCountdown] = useState(0)
  const [sendingCode, setSendingCode] = useState(false)

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleSendCode = useCallback(async () => {
    if (!email) {
      toast.error("请先输入邮箱地址")
      return
    }
    if (countdown > 0) return
    setSendingCode(true)
    try {
      await sendVerifyCode(email)
      toast.success("验证码已发送，请查收邮件")
      setCountdown(60)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "发送失败"
      toast.error(msg)
    } finally {
      setSendingCode(false)
    }
  }, [email, countdown, sendVerifyCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !code) {
      toast.error("请填写邮箱、密码和验证码")
      return
    }
    if (password.length < 8) {
      toast.error("密码至少 8 位")
      return
    }
    if (code.length !== 6) {
      toast.error("请输入 6 位验证码")
      return
    }
    setSubmitting(true)
    try {
      await register(email, password, displayName, code)
      toast.success("注册成功")
      navigate("/home")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "注册失败"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative h-screen flex items-center justify-center bg-background overflow-hidden">
      {/* 背景光晕 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* 注册卡片 */}
      <Card className="relative w-full max-w-sm mx-4 glass border-border/50 shadow-2xl animate-fade-in">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold">创建账号</CardTitle>
          <CardDescription>注册后即可使用教务办·智能体</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 */}
            <div className="space-y-2">
              <Label htmlFor="reg-email">邮箱</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="user@example.com"
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <Label htmlFor="reg-password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="至少 8 位密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 显示名称 */}
            <div className="space-y-2">
              <Label htmlFor="reg-display-name">显示名称（可选，最多 50 字）</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reg-display-name"
                  placeholder="可选"
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{displayName.length}/50</p>
            </div>

            {/* 验证码 */}
            <div className="space-y-2">
              <Label htmlFor="reg-code">邮箱验证码</Label>
              <div className="flex gap-2">
                <Input
                  id="reg-code"
                  placeholder="6 位数字"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={countdown > 0 || sendingCode}
                  onClick={handleSendCode}
                >
                  {sendingCode ? (
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : (
                    "发送验证码"
                  )}
                </Button>
              </div>
            </div>

            {/* 注册按钮 */}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  注册中...
                </>
              ) : (
                "注册"
              )}
            </Button>
          </form>

          {/* 返回登录 */}
          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              已有账号？返回登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegisterPage