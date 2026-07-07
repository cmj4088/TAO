import React, { useEffect, useState } from "react";
import { Card, Form, Select, Divider, InputNumber, Input, Button, message } from "antd";
import { useSettingsStore } from "@/stores/settingsStore";

const SettingsPage: React.FC = () => {
  const {
    theme, setTheme,
    app02AiConcurrency, setApp02AiConcurrency,
    loadApp02Settings, saveApp02Settings,
    llmUrl, llmKey, llmModel, setLlmConfig, saveLlmConfig, loadFromServer,
  } = useSettingsStore();
  const [llmSaving, setLlmSaving] = useState(false);

  useEffect(() => {
    loadApp02Settings();
    loadFromServer();
  }, []);

  const handleSaveAi = async () => {
    try {
      await saveApp02Settings();
      message.success("AI 设置已保存");
    } catch {
      message.error("保存失败");
    }
  };

  const handleSaveLlm = async () => {
    setLlmSaving(true);
    try {
      await saveLlmConfig();
      message.success("大模型配置已保存");
    } catch {
      message.error("保存失败，请检查后端是否启动");
    } finally {
      setLlmSaving(false);
    }
  };

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

        <Form.Item label="AI 审查并发数（1-10）" help="同时审查多少个文件，数值越大越快但可能触发 API 限流">
          <InputNumber
            min={1} max={10}
            value={app02AiConcurrency}
            onChange={(v) => v && setApp02AiConcurrency(v)}
            style={{ width: 120 }}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSaveAi}>保存 AI 设置</Button>
        </Form.Item>

        <Divider />

        <Form.Item label="大模型 API URL">
          <Input
            placeholder="https://ark.cn-beijing.volces.com/api/v3/chat/completions"
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
          <Button type="primary" onClick={handleSaveLlm} loading={llmSaving}>
            保存大模型配置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SettingsPage;
