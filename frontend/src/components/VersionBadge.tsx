import React, { useEffect, useState } from "react";
import { Tag, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import client from "@/api/client";

/** 获取本地版本号：优先从 Electron API 读取，回退到硬编码 */
function getLocalVersion(): string {
  const api = (window as any).electronAPI;
  return api?.version || "0.1.3";
}

const VersionBadge: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await client.get("/api/version");
        const remote = res.data.version;
        const local = getLocalVersion();
        if (remote && remote !== local) {
          setHasUpdate(true);
        }
      } catch {
        // 后端未启动时静默忽略
      }
    };
    check();
  }, []);

  if (!hasUpdate) return null;

  return (
    <Tooltip title="有新版本可下载">
      <Tag color="orange" icon={<DownloadOutlined />} style={{ cursor: "pointer" }}>
        新版本
      </Tag>
    </Tooltip>
  );
};

export default VersionBadge;
