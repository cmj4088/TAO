import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { User, Lock } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login, loading } = useAuthStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("请输入邮箱和密码")
      return
    }
    setSubmitting(true)
    try {
      await login(email, password)
      toast.success("登录成功")
      navigate("/home")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "登录失败"
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

      {/* 登录卡片 */}
      <Card className="relative w-full max-w-sm mx-4 glass border-border/50 shadow-2xl animate-fade-in">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold">教务办·智能体</CardTitle>
          <CardDescription>登录以继续使用</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@tao.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || loading}
            >
              {(submitting || loading) ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  登录中...
                </>
              ) : (
                "登录"
              )}
            </Button>
          </form>

          {/* 注册入口 */}
          <div className="mt-4 text-center">
            <Link
              to="/register"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              没有账号？立即注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginPage