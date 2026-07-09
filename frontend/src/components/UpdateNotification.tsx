import React, { useEffect, useState, useCallback } from "react";
import { Modal, Button, Progress, Space } from "antd";
import { DownloadOutlined, CheckCircleOutlined } from "@ant-design/icons";

interface UpdateInfo {
  type: "available" | "progress" | "downloaded";
  version?: string;
  percent?: number;
}

const electronAPI = (window as any).electronAPI;

const UpdateNotification: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [version, setVersion] = useState("");
  const [percent, setPercent] = useState(0);

  const handleUpdate = useCallback((data: UpdateInfo) => {
    switch (data.type) {
      case "available":
        setVersion(data.version || "");
        setOpen(true);
        break;
      case "progress":
        setDownloading(true);
        setPercent(data.percent || 0);
        break;
      case "downloaded":
        setDownloading(false);
        setDownloaded(true);
        break;
    }
  }, []);

  useEffect(() => {
    if (electronAPI?.onUpdateStatus) {
      electronAPI.onUpdateStatus(handleUpdate);
    }
  }, [handleUpdate]);

  const startDownload = () => {
    setDownloading(true);
    electronAPI?.downloadUpdate?.();
  };

  const installNow = () => {
    electronAPI?.quitAndInstall?.();
  };

  if (!electronAPI) return null;

  return (
    <Modal
      title="软件更新"
      open={open}
      closable={!downloading}
      footer={null}
      onCancel={() => !downloading && setOpen(false)}
    >
      {!downloading && !downloaded && (
        <>
          <p>
            发现新版本 <strong>v{version}</strong>，是否下载更新？
          </p>
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" icon={<DownloadOutlined />} onClick={startDownload}>
              立即更新
            </Button>
            <Button onClick={() => setOpen(false)}>稍后提醒</Button>
          </Space>
        </>
      )}

      {downloading && (
        <>
          <p>正在下载更新...</p>
          <Progress percent={percent} status="active" />
        </>
      )}

      {downloaded && (
        <>
          <p>
            <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
            更新已下载完成，重启后生效。
          </p>
          <Button type="primary" onClick={installNow} style={{ marginTop: 12 }}>
            立即重启
          </Button>
        </>
      )}
    </Modal>
  );
};

export default UpdateNotification;
