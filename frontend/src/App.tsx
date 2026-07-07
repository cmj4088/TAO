import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import ConsoleLayout from "@/components/Layout/ConsoleLayout";
import UpdateNotification from "@/components/UpdateNotification";
import { useSettingsStore } from "@/stores/settingsStore";

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
        <UpdateNotification />
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              {/* ConsoleLayout 内部管理所有 App 的挂载/可见性，切换不卸载 */}
              <Route path="*" element={<ConsoleLayout />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
