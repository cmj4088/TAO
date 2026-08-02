import React, { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ThemeProvider from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import ConsoleLayout from "@/components/Layout/ConsoleLayout"
import AuthGuard from "@/components/AuthGuard"
import ConnectionBanner from "@/components/ConnectionBanner"
import UpdateNotification from "@/components/UpdateNotification"

const LoginPage = lazy(() => import("@/pages/LoginPage"))
const RegisterPage = lazy(() => import("@/pages/RegisterPage"))
const HomePage = lazy(() => import("@/pages/HomePage"))
const SettingsPage = lazy(() => import("@/pages/SettingsPage"))
const AdminPage = lazy(() => import("@/pages/AdminPage"))

const Loading = () => (
  <div className="flex items-center justify-center h-screen text-muted-foreground">
    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-2" />
    加载中...
  </div>
)

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ConnectionBanner />
        <UpdateNotification />
        <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* 登录页 */}
            <Route path="/login" element={<LoginPage />} />

            {/* 注册页 */}
            <Route path="/register" element={<RegisterPage />} />

            {/* 快捷入口首页 */}
            <Route
              path="/home"
              element={
                <AuthGuard>
                  <ConsoleLayout />
                </AuthGuard>
              }
            />

            {/* 应用页面 */}
            <Route
              path="/app/*"
              element={
                <AuthGuard>
                  <ConsoleLayout />
                </AuthGuard>
              }
            />

            {/* 设置页 */}
            <Route
              path="/settings"
              element={
                <AuthGuard>
                  <SettingsPage />
                </AuthGuard>
              }
            />

            {/* 管理后台 */}
            <Route
              path="/admin"
              element={
                <AuthGuard requiredPermission="user:read">
                  <AdminPage />
                </AuthGuard>
              }
            />

            {/* 默认重定向到登录 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App