import React from "react";
import { Modal, Card, Row, Col, Typography, Tag, theme } from "antd";
import {
  ThunderboltOutlined,
  ApiOutlined,
  RobotOutlined,
  CloudOutlined,
  StarOutlined,
  FireOutlined,
  RocketOutlined,
  ExperimentOutlined,
  DashboardOutlined,
  GlobalOutlined,
  ToolOutlined,
  EditOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

/** AI 供应商信息 */
export interface ProviderInfo {
  id: string;
  name: string;
  apiUrl: string;
  defaultModel: string;
  description: string;
  /** 图标颜色 */
  color: string;
  icon: React.ReactNode;
}

/** 市场流行的 AI 供应商，全部支持 OpenAI 兼容 API 格式 */
const PROVIDERS: ProviderInfo[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    defaultModel: "deepseek-chat",
    description: "国产顶尖推理模型，性价比极高",
    color: "#4F46E5",
    icon: <ThunderboltOutlined />,
  },
  {
    id: "volcano",
    name: "火山引擎（豆包）",
    apiUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "deepseek-v4-pro-260425",
    description: "字节跳动旗下，支持多种模型",
    color: "#FE5C36",
    icon: <FireOutlined />,
  },
  {
    id: "openai",
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
    description: "全球领先的 AI 模型",
    color: "#10A37F",
    icon: <RobotOutlined />,
  },
  {
    id: "alibaba",
    name: "阿里云百炼",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-max",
    description: "通义千问系列模型",
    color: "#FF6A00",
    icon: <CloudOutlined />,
  },
  {
    id: "zhipu",
    name: "智谱 AI",
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4-plus",
    description: "清华系，GLM 系列模型",
    color: "#1677FF",
    icon: <StarOutlined />,
  },
  {
    id: "baidu",
    name: "百度千帆",
    apiUrl: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-4.0-turbo",
    description: "文心一言系列模型",
    color: "#2468E5",
    icon: <DashboardOutlined />,
  },
  {
    id: "moonshot",
    name: "Moonshot（Kimi）",
    apiUrl: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "moonshot-v1-8k",
    description: "超长上下文，适合文档处理",
    color: "#8B5CF6",
    icon: <RocketOutlined />,
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    apiUrl: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    description: "硅基流动，聚合多种开源模型",
    color: "#6366F1",
    icon: <ExperimentOutlined />,
  },
  {
    id: "tencent",
    name: "腾讯混元",
    apiUrl: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    defaultModel: "hunyuan-pro",
    description: "腾讯自研大模型",
    color: "#00A4FF",
    icon: <GlobalOutlined />,
  },
  {
    id: "groq",
    name: "Groq",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.1-70b-versatile",
    description: "超快推理速度，免费额度",
    color: "#F97316",
    icon: <ApiOutlined />,
  },
  {
    id: "together",
    name: "Together AI",
    apiUrl: "https://api.together.xyz/v1/chat/completions",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    description: "开源模型聚合平台",
    color: "#0FA5E9",
    icon: <ToolOutlined />,
  },
];

interface ProviderQuickSelectProps {
  open: boolean;
  onClose: () => void;
  /** 选中供应商后的回调：自动填入 URL、模型名，并切换到 key 编辑状态 */
  onSelect: (provider: ProviderInfo) => void;
}

const ProviderQuickSelect: React.FC<ProviderQuickSelectProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { token } = theme.useToken();

  const handleSelect = (provider: ProviderInfo) => {
    onSelect(provider);
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThunderboltOutlined style={{ color: token.colorPrimary }} />
          <span>快捷配置 — 选择 AI 供应商</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      styles={{ body: { maxHeight: "60vh", overflow: "auto", padding: "16px 24px" } }}
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        选择一个供应商，系统将自动填入 API 地址和模型名称，您只需输入 API Key 即可。
      </Text>

      <Row gutter={[12, 12]}>
        {PROVIDERS.map((p) => (
          <Col xs={24} sm={12} key={p.id}>
            <Card
              hoverable
              size="small"
              onClick={() => handleSelect(p)}
              style={{
                borderColor: token.colorBorderSecondary,
                cursor: "pointer",
                height: "100%",
              }}
              bodyStyle={{ padding: "12px 16px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: p.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {p.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Text strong style={{ fontSize: 14 }}>{p.name}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                    {p.description}
                  </Text>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    <Tag style={{ fontSize: 11, margin: 0 }} color="blue">
                      {p.defaultModel}
                    </Tag>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 自定义按钮 */}
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          没找到你的供应商？
          <a onClick={onClose} style={{ marginLeft: 4 }}>
            手动填写 API 地址和模型 <EditOutlined />
          </a>
        </Text>
      </div>
    </Modal>
  );
};

export { PROVIDERS };
export default ProviderQuickSelect;