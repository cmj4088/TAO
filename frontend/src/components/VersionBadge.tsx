import React, { useEffect, useState } from "react";
import { Tag, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import client from "@/api/client";

const VersionBadge: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await client.get("/api/version");
        const remote = res.data.version;
        if (remote && remote !== "0.1.0") {
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
