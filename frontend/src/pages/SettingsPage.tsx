import React, { useEffect } from "react";
import { Card, Form, Select, Divider, InputNumber, Button, message } from "antd";
import { useSettingsStore } from "@/stores/settingsStore";

const SettingsPage: React.FC = () => {
  const {
    theme, setTheme,
    app02AiConcurrency, setApp02AiConcurrency,
    loadApp02Settings, saveApp02Settings,
  } = useSettingsStore();

  useEffect(() => {
    loadApp02Settings();
  }, []);

  const handleSave = async () => {
    try {
      await saveApp02Settings();
      message.success("设置已保存");
    } catch {
      message.error("保存失败");
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
          <Button type="primary" onClick={handleSave}>保存 AI 设置</Button>
        </Form.Item>
        <Divider />
        <Form.Item label="大模型配置">
          <span style={{ color: "#999" }}>大模型 Key 和模型名称在服务端代码中配置，无需在前端修改</span>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SettingsPage;
