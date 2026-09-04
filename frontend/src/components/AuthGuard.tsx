import React, { useEffect } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"

interface AuthGuardProps {
  children: React.ReactNode
  /** 需要的最小权限，不传则只要登录即可 */
  requiredPermission?: string
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requiredPermission }) => {
  const { isAuthenticated, accessToken, loading, loadUser, user, hasPermission } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (accessToken && !user) {
      loadUser()
    }
  }, [accessToken, user, loadUser])

  // 正在加载
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-muted-foreground">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-sm">加载中...</span>
      </div>
    )
  }

  // 未登录
  if (!isAuthenticated && !accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 有 token 但用户信息还在加载
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  // 权限检查
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        无权访问此页面
      </div>
    )
  }

  return <>{children}</>
}

export default AuthGuard