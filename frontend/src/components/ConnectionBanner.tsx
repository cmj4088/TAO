import React, { useEffect, useState, useRef } from "react";
import { Alert, Space } from "antd";
import { WifiOutlined, ReloadOutlined } from "@ant-design/icons";
import client, { API_BASE } from "@/api/client";

/** 连接状态检查组件 —— 启动时 ping 后端，失败则在页面顶部显示警告横幅 */
const ConnectionBanner: React.FC = () => {
  const [connected, setConnected] = useState<boolean | null>(null); // null=检测中
  const [retrying, setRetrying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const ping = async () => {
    try {
      await client.get("/api/version", { timeout: 5000 });
      if (mountedRef.current) {
        setConnected(true);
        setRetrying(false);
      }
    } catch {
      if (mountedRef.current) {
        setConnected(false);
        setRetrying(false);
      }
    }
  };

  const startPolling = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      ping();
    }, 30_000); // 每 30 秒重试
  };

  useEffect(() => {
    mountedRef.current = true;
    // 首次检测
    ping().then(() => {
      // 无论成功失败都开启轮询
      if (mountedRef.current) startPolling();
    });

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    ping();
  };

  // 检测中或已连接时不显示
  if (connected === null || connected === true) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <Alert
        type="error"
        banner
        showIcon={false}
        style={{
          pointerEvents: "auto",
          borderRadius: "0 0 8px 8px",
          boxShadow: "0 2px 8px rgba(255, 77, 79, 0.25)",
          maxWidth: 520,
          padding: "6px 16px",
        }}
        message={
          <Space size={12}>
            <WifiOutlined style={{ color: "#ff4d4f", fontSize: 14 }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              未连接到服务器（{API_BASE}）
            </span>
            <span
              onClick={handleRetry}
              style={{
                cursor: "pointer",
                color: "#1677ff",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}
            >
              <ReloadOutlined spin={retrying} />
              {retrying ? "检测中..." : "重试"}
            </span>
          </Space>
        }
      />
    </div>
  );
};

export default ConnectionBanner;