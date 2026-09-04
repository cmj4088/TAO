import React from "react"
import { Zap, Cpu, Bot, Cloud, Star, Flame, Rocket, Beaker, LayoutDashboard, Globe, Wrench, Pencil } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** AI 供应商信息 */
export interface ProviderInfo {
  id: string
  name: string
  apiUrl: string
  defaultModel: string
  description: string
  color: string
  icon: React.ReactNode
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
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: "volcano",
    name: "火山引擎（豆包）",
    apiUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "deepseek-v4-pro-260425",
    description: "字节跳动旗下，支持多种模型",
    color: "#FE5C36",
    icon: <Flame className="h-5 w-5" />,
  },
  {
    id: "openai",
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
    description: "全球领先的 AI 模型",
    color: "#10A37F",
    icon: <Bot className="h-5 w-5" />,
  },
  {
    id: "alibaba",
    name: "阿里云百炼",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-max",
    description: "通义千问系列模型",
    color: "#FF6A00",
    icon: <Cloud className="h-5 w-5" />,
  },
  {
    id: "zhipu",
    name: "智谱 AI",
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4-plus",
    description: "清华系，GLM 系列模型",
    color: "#1677FF",
    icon: <Star className="h-5 w-5" />,
  },
  {
    id: "baidu",
    name: "百度千帆",
    apiUrl: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-4.0-turbo",
    description: "文心一言系列模型",
    color: "#2468E5",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    id: "moonshot",
    name: "Moonshot（Kimi）",
    apiUrl: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "moonshot-v1-8k",
    description: "超长上下文，适合文档处理",
    color: "#8B5CF6",
    icon: <Rocket className="h-5 w-5" />,
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    apiUrl: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    description: "硅基流动，聚合多种开源模型",
    color: "#6366F1",
    icon: <Beaker className="h-5 w-5" />,
  },
  {
    id: "tencent",
    name: "腾讯混元",
    apiUrl: "https://api.lkeap.cloud.tencent.com/v1/chat/completions",
    defaultModel: "hunyuan-T1",
    description: "腾讯自研大模型",
    color: "#00A4FF",
    icon: <Globe className="h-5 w-5" />,
  },
  {
    id: "groq",
    name: "Groq",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.1-70b-versatile",
    description: "超快推理速度，免费额度",
    color: "#F97316",
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    id: "together",
    name: "Together AI",
    apiUrl: "https://api.together.xyz/v1/chat/completions",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    description: "开源模型聚合平台",
    color: "#0FA5E9",
    icon: <Wrench className="h-5 w-5" />,
  },
]

interface ProviderQuickSelectProps {
  open: boolean
  onClose: () => void
  onSelect: (provider: ProviderInfo) => void
}

const ProviderQuickSelect: React.FC<ProviderQuickSelectProps> = ({ open, onClose, onSelect }) => {
  const handleSelect = (provider: ProviderInfo) => {
    onSelect(provider)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            快捷配置 — 选择 AI 供应商
          </DialogTitle>
          <DialogDescription>
            选择一个供应商，系统将自动填入 API 地址和模型名称，您只需输入 API Key 即可。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleSelect(p)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: p.color }}
                >
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 mb-1.5">{p.description}</div>
                  <Badge variant="secondary" className="text-xs">
                    {p.defaultModel}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          没找到你的供应商？
          <button onClick={onClose} className="ml-1 text-primary hover:underline inline-flex items-center gap-1">
            手动填写 API 地址和模型 <Pencil className="h-3 w-3" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { PROVIDERS }
export default ProviderQuickSelect

/** 根据 API URL 匹配供应商（前缀匹配），未匹配返回 null */
export function matchProvider(url: string): ProviderInfo | null {
  if (!url) return null
  const normalized = url.trim().toLowerCase()
  const sorted = [...PROVIDERS].sort((a, b) => b.apiUrl.length - a.apiUrl.length)
  for (const p of sorted) {
    if (normalized.startsWith(p.apiUrl.toLowerCase())) {
      return p
    }
  }
  return null
}

/** 供应商匹配指示器：在 URL 输入框下方显示当前匹配的供应商 */
export const ProviderMatchIndicator: React.FC<{ url: string }> = ({ url }) => {
  const provider = matchProvider(url)
  if (!provider) return null
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs mt-1"
      style={{
        backgroundColor: `${provider.color}15`,
        borderColor: `${provider.color}40`,
        borderWidth: 1,
        borderStyle: "solid",
      }}
    >
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-white"
        style={{ backgroundColor: provider.color }}
      >
        {provider.icon}
      </span>
      <span className="font-medium" style={{ color: provider.color }}>
        {provider.name}
      </span>
      <span className="text-muted-foreground">已识别</span>
    </div>
  )
}