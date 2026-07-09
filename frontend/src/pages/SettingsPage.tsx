import React, { useEffect, useState } from "react";
import { Card, Form, Select, Divider, InputNumber, Input, Button, message, Tag } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { useSettingsStore } from "@/stores/settingsStore";
import ProviderQuickSelect, { type ProviderInfo } from "@/components/ProviderQuickSelect";

const SettingsPage: React.FC = () => {
  const {
    theme, setTheme,
    app02AiConcurrency, setApp02AiConcurrency,
    loadApp02Settings, saveApp02Settings,
    llmUrl, llmKey, llmModel, hasKey, setLlmConfig, saveLlmConfig, loadFromServer,
  } = useSettingsStore();
  const [llmSaving, setLlmSaving] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [providerModalOpen, setProviderModalOpen] = useState(false);

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
      if (editingKey) {
        const trimmedKey = newKey.trim();
        if (!trimmedKey) {
          // 输入为空（全是空格），取消编辑状态，不更新 key
          message.warning("API Key 不能为空，已取消修改");
          setEditingKey(false);
          setNewKey("");
          setLlmSaving(false);
          return;
        }
        await saveLlmConfig(trimmedKey);
        setEditingKey(false);
        setNewKey("");
      } else {
        await saveLlmConfig();
      }
      message.success("大模型配置已保存");
    } catch {
      message.error("保存失败，请检查后端是否启动");
    } finally {
      setLlmSaving(false);
    }
  };

  const handleCancelEditKey = () => {
    setEditingKey(false);
    setNewKey("");
  };

  /** 快捷选择供应商：自动填入 URL 和模型，并切换到 key 编辑状态 */
  const handleProviderSelect = (provider: ProviderInfo) => {
    setLlmConfig(provider.apiUrl, llmKey, provider.defaultModel);
    setEditingKey(true);
    setNewKey("");
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

        {/* 快捷配置按钮 */}
        <Form.Item>
          <Button
            type="dashed"
            icon={<ThunderboltOutlined />}
            onClick={() => setProviderModalOpen(true)}
            block
          >
            快捷配置 — 选择 AI 供应商自动填入地址
          </Button>
        </Form.Item>

        <Form.Item label="大模型 API URL">
          <Input
            placeholder="https://ark.cn-beijing.volces.com/api/v3/chat/completions"
            value={llmUrl}
            onChange={(e) => setLlmConfig(e.target.value, llmKey, llmModel)}
          />
        </Form.Item>
        <Form.Item label="API Key">
          {editingKey ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Input.Password
                placeholder="输入新的 API Key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                autoFocus
                style={{ flex: 1 }}
              />
              <Button onClick={handleCancelEditKey}>取消</Button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Input.Password
                value={hasKey ? llmKey : ""}
                placeholder={hasKey ? undefined : "未配置 API Key"}
                disabled
                style={{ flex: 1 }}
                iconRender={() => null}
              />
              <Button onClick={() => setEditingKey(true)}>
                {hasKey ? "修改" : "设置"}
              </Button>
              {hasKey && <Tag color="green">已配置</Tag>}
              {!hasKey && <Tag color="red">未配置</Tag>}
            </div>
          )}
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

      {/* 供应商快捷选择弹窗 */}
      <ProviderQuickSelect
        open={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        onSelect={handleProviderSelect}
      />
    </Card>
  );
};

export default SettingsPage;