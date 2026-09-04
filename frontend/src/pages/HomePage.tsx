import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Calendar, FileSearch, ArrowRight, Zap, Sparkles, BarChart3, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAppStore } from "@/stores/appStore"
import { useAuthStore } from "@/stores/authStore"
import client from "@/api/client"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { setActiveApp } = useAppStore()
  const { user } = useAuthStore()
  const [version, setVersion] = useState("")

  useEffect(() => {
    client.get("/api/version").then(res => {
      setVersion(res.data.version)
    }).catch(() => {})
  }, [])

  const apps = [
    {
      id: "app01",
      name: "监考分配",
      description: "智能监考自动分配与手动调整，支持拖拽互换、AI 审查",
      icon: Calendar,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      gradient: "from-blue-500/5 to-blue-500/0",
      features: ["拖拽分配", "智能排考", "AI 审查"],
    },
    {
      id: "app02",
      name: "文件审查",
      description: "AI 辅助教学文件审查，支持 .doc/.docx 批量上传与分析",
      icon: FileSearch,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      gradient: "from-emerald-500/5 to-emerald-500/0",
      features: ["批量上传", "AI 分析", "格式检查"],
    },
  ]

  const handleEnter = (appId: string) => {
    setActiveApp(appId)
    navigate(`/app/${appId}`)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 animate-fade-in">
      {/* 欢迎区域 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <Sparkles className="h-3 w-3" />
          教务办·智能体
          {version && <span className="ml-1 opacity-60">v{version}</span>}
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          欢迎回来，{user?.display_name || user?.email?.split("@")[0] || "用户"}
        </h1>
        <p className="text-muted-foreground">选择要使用的功能模块开始工作</p>
      </div>

      {/* 应用入口卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {apps.map((app) => {
          const Icon = app.icon
          return (
            <Card
              key={app.id}
              className={`group cursor-pointer border-border hover:${app.borderColor} transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 bg-gradient-to-br ${app.gradient}`}
              onClick={() => handleEnter(app.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl ${app.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-6 w-6 ${app.color}`} />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-lg">{app.name}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1.5 flex-wrap">
                  {app.features.map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs">
                      {f}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 快捷信息和统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">AI 驱动</p>
              <p className="text-xs text-muted-foreground">DeepSeek V4 大模型</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium">数据统计</p>
              <p className="text-xs text-muted-foreground">前往设置页查看</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium">多用户协作</p>
              <p className="text-xs text-muted-foreground">独立配置互不干扰</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 使用提示 */}
      <div className="mt-8">
        <Separator className="mb-6" />
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            提示：可以通过左侧导航栏在各个应用之间快速切换
          </p>
        </div>
      </div>
    </div>
  )
}

export default HomePage