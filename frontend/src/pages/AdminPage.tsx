import React, { useEffect, useState } from "react";
import { Card, Form, Input, Button, message, Spin, Tag } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { useSettingsStore } from "@/stores/settingsStore";
import ProviderQuickSelect, { type ProviderInfo } from "@/components/ProviderQuickSelect";

const AdminPage: React.FC = () => {
  const { llmUrl, llmKey, llmModel, hasKey, loading, error, setLlmConfig, saveLlmConfig, loadFromServer } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState(false);  // 是否正在编辑 key
  const [newKey, setNewKey] = useState("");               // 新 key 输入值
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  useEffect(() => {
    loadFromServer();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingKey) {
        // 用户正在编辑 key
        const trimmedKey = newKey.trim();
        if (!trimmedKey) {
          // 输入为空（全是空格），取消编辑状态，不更新 key
          message.warning("API Key 不能为空，已取消修改");
          setEditingKey(false);
          setNewKey("");
          setSaving(false);
          return;
        }
        await saveLlmConfig(trimmedKey);
        setEditingKey(false);
        setNewKey("");
      } else {
        // 只更新 URL 和 Model
        await saveLlmConfig();
      }
      message.success("大模型配置已保存");
    } catch {
      message.error("保存失败，请检查后端是否启动");
    } finally {
      setSaving(false);
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

  if (loading) return <Spin style={{ display: "block", margin: "100px auto" }} />;

  return (
    <Card title="管理后台 — 大模型配置" style={{ maxWidth: 600 }}>
      <Form layout="vertical">
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
            placeholder="https://api.openai.com/v1"
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
                iconRender={() => null}  // 隐藏眼睛图标，因为已经是脱敏的
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
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存配置
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

export default AdminPage;