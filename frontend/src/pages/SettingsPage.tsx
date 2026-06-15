import React, { useEffect } from "react";
import { Card, Form, Select, Divider } from "antd";
import { useSettingsStore } from "@/stores/settingsStore";

const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useSettingsStore();

  return (
    <Card title="设置" style={{ maxWidth: 600 }}>
      <Form layout="vertical">
        <Form.Item label="主题模式">
          <Select value={theme} onChange={(v) => setTheme(v)} style={{ width: 200 }}>
            <Select.Option value="light">浅色模式</Select.Option>
            <Select.Option value="dark">深色模式</Select.Option>
          </Select>
        </Form.Item>
        <Divider />
        <Form.Item label="大模型配置">
          <span style={{ color: "#999" }}>请在「管理后台」中配置大模型的 URL 和 Key</span>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SettingsPage;
