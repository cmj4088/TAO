import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import ConsoleLayout from "@/components/Layout/ConsoleLayout";
import { useSettingsStore } from "@/stores/settingsStore";

const App01 = lazy(() => import("@/apps/app01"));
const App02 = lazy(() => import("@/apps/app02"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

const Loading = () => (
  <div style={{ textAlign: "center", padding: 80, color: "#999" }}>加载中...</div>
);

const App: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme === "dark" ? undefined : undefined,
        token: {
          colorPrimary: "#1677ff",
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<ConsoleLayout />}>
                <Route index element={<Navigate to="/app/app01" replace />} />
                <Route path="app/app01" element={<App01 />} />
                <Route path="app/app02" element={<App02 />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
