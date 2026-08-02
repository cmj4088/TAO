import React, { Suspense, lazy, useState, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  Calendar,
  FileSearch,
  Settings,
  User,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAppStore } from "@/stores/appStore"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const App01 = lazy(() => import("@/apps/app01"))
const App02 = lazy(() => import("@/apps/app02"))
const HomePage = lazy(() => import("@/pages/HomePage"))

const ICON_MAP: Record<string, React.ReactNode> = {
  Calendar: <Calendar className="h-5 w-5" />,
  FileSearch: <FileSearch className="h-5 w-5" />,
}

const Loading = () => (
  <div className="flex items-center justify-center p-20 text-muted-foreground">
    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
    加载中...
  </div>
)

const ConsoleLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { apps, activeAppId, setActiveApp } = useAppStore()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(true)
  const [hovering, setHovering] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // 侧边栏展开条件：手动展开 / hover 展开 / 用户菜单打开时保持展开
  const isExpanded = !collapsed || hovering || dropdownOpen

  const isHome = location.pathname === "/home"

  const handleNavigate = useCallback(
    (appId: string) => {
      setActiveApp(appId)
      navigate(`/app/${appId}`)
    },
    [setActiveApp, navigate],
  )

  const handleLogout = useCallback(async () => {
    await logout()
    navigate("/login")
  }, [logout, navigate])

  // 获取用户名称首字母
  const userInitial = (user?.display_name || user?.email || "U")[0].toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* VS Code 风格侧边栏 */}
      <div
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out relative z-20",
          isExpanded ? "w-[220px]" : "w-[56px]",
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { if (!dropdownOpen) setHovering(false) }}
      >
        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute -right-3 top-8 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-all",
            !isExpanded && "opacity-0 group-hover:opacity-100",
          )}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* 标题区域 */}
        <div className={cn(
          "flex items-center border-b border-border h-12 overflow-hidden",
          isExpanded ? "px-4" : "justify-center",
        )}>
          {isExpanded ? (
            <span className="font-semibold text-sm text-foreground whitespace-nowrap">
              教务办·智能体
            </span>
          ) : (
            <span className="font-bold text-lg text-primary">TA</span>
          )}
        </div>

        {/* 导航菜单 */}
        <div className="flex-1 py-2 space-y-1 px-2">
          {/* 首页 */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/home")}
                className={cn(
                  "flex items-center w-full rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                  isExpanded ? "px-3 py-2" : "justify-center py-2",
                  isHome && "bg-accent text-accent-foreground",
                )}
              >
                <Calendar className="h-5 w-5 shrink-0" />
                {isExpanded && <span className="ml-3 text-sm whitespace-nowrap">首页</span>}
              </button>
            </TooltipTrigger>
            {!isExpanded && <TooltipContent side="right">首页</TooltipContent>}
          </Tooltip>

          {/* 应用列表 */}
          {apps.map((app) => (
            <Tooltip key={app.id} delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavigate(app.id)}
                  className={cn(
                    "flex items-center w-full rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                    isExpanded ? "px-3 py-2" : "justify-center py-2",
                    activeAppId === app.id && !isHome && "bg-accent text-accent-foreground",
                  )}
                >
                  {ICON_MAP[app.icon] || <FileSearch className="h-5 w-5" />}
                  {isExpanded && (
                    <div className="ml-3 flex flex-col overflow-hidden">
                      <span className="text-sm whitespace-nowrap">{app.name}</span>
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              {!isExpanded && <TooltipContent side="right">{app.name}</TooltipContent>}
            </Tooltip>
          ))}
        </div>

        {/* 底部用户区域 */}
        <div className="border-t border-border p-2">
          <DropdownMenu onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center w-full rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                  isExpanded ? "px-3 py-2" : "justify-center py-2",
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                {isExpanded && (
                  <div className="ml-3 flex flex-col overflow-hidden text-left">
                    <span className="text-sm font-medium whitespace-nowrap">
                      {user?.display_name || user?.email || "用户"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user?.role === "admin" ? "管理员" : "教师"}
                    </span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                设置
              </DropdownMenuItem>
              {user?.role === "admin" && (
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Shield className="mr-2 h-4 w-4" />
                  管理后台
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部 Header */}
        <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            {isHome && <span className="text-sm font-medium text-foreground">快捷入口</span>}
            {activeAppId === "app01" && !isHome && <span className="text-sm font-medium text-foreground">监考分配</span>}
            {activeAppId === "app02" && !isHome && <span className="text-sm font-medium text-foreground">文件审查</span>}
          </div>
          <div className="flex items-center gap-2">
            {/* VersionBadge 占位 - 后续替换 */}
          </div>
        </header>

        {/* 内容区域 */}
        <main className="flex-1 overflow-auto p-6">
          {isHome ? (
            <Suspense fallback={<Loading />}>
              <HomePage />
            </Suspense>
          ) : (
            <Suspense fallback={<Loading />}>
              <div className={activeAppId === "app01" ? "block" : "hidden"}>
                <App01 />
              </div>
              <div className={activeAppId === "app02" ? "block" : "hidden"}>
                <App02 />
              </div>
            </Suspense>
          )}
        </main>
      </div>
    </div>
  )
}

export default ConsoleLayout