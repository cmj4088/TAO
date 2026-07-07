import React, { useEffect, useState } from "react";
import { Card, Form, Input, Button, message, Spin } from "antd";
import { useSettingsStore } from "@/stores/settingsStore";

const AdminPage: React.FC = () => {
  const { llmUrl, llmKey, llmModel, loading, setLlmConfig, saveLlmConfig, loadFromServer } = useSettingsStore();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFromServer();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLlmConfig();
      message.success("大模型配置已保存");
    } catch {
      message.error("保存失败，请检查后端是否启动");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin style={{ display: "block", margin: "100px auto" }} />;

  return (
    <Card title="管理后台 — 大模型配置" style={{ maxWidth: 600 }}>
      <Form layout="vertical">
        <Form.Item label="大模型 API URL">
          <Input
            placeholder="https://api.openai.com/v1"
            value={llmUrl}
            onChange={(e) => setLlmConfig(e.target.value, llmKey, llmModel)}
          />
        </Form.Item>
        <Form.Item label="API Key">
          <Input.Password
            placeholder="sk-..."
            value={llmKey}
            onChange={(e) => setLlmConfig(llmUrl, e.target.value, llmModel)}
          />
        </Form.Item>
        <Form.Item label="模型名称">
          <Input
            placeholder="deepseek-v4-pro-260425"
            value={llmModel}
            onChange={(e) => setLlmConfig(llmUrl, llmKey, e.target.value)}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存配置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AdminPage;
