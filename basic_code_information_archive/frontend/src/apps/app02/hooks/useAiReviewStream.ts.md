# apps/app02/hooks/useAiReviewStream.ts — AI审查流式数据Hook

**文件路径**：`frontend/src/apps/app02/hooks/useAiReviewStream.ts`

**作用**：自定义 React Hook，用于读取 AI 审查的 SSE（Server-Sent Events）流式数据，实时更新审查进度和结果。**不使用浏览器原生 `EventSource`**（它无法携带 Authorization 头，会被后端 `get_current_user` 鉴权拒绝返回 401，导致界面无限"加载中"），改用 `fetch` + `ReadableStream` 手动解析 SSE 帧。

## 文件: useAiReviewStream.ts
- **路径**: `frontend/src/apps/app02/hooks/useAiReviewStream.ts`
- **作用**: 订阅 `/api/app02/ai-review/stream/{task_id}` SSE 流，逐帧解析事件并更新各文件审查的流式状态
- **关键函数/类**:
  - `useAiReviewStream(taskId)`: 主 Hook；taskId 变化时建立 fetch 连接，返回流式状态集合
  - `handleFrame(frame)`: 解析单个 SSE 事件帧（`event:` + `data:` 行），分发到对应状态更新；支持 `reasoning` / `token` / `file_done` / `file_error` / `task_done` 五种事件
  - `fail(message)`: 连接级错误处理——写入 `connectionError` 状态（401 提示"登录已过期"，非 200 提示 HTTP 状态码，网络中断提示"连接中断"），由页面显式 toast 并结束加载状态，杜绝无限转圈
  - `reset()`: 清空全部流式状态（新任务开始前调用）
- **鉴权方式**: 从 `localStorage` 读取 `access_token`，以 `Authorization: Bearer` 请求头传递（原生 EventSource 做不到这一点，是本次重写的根因）
- **返回状态**:
  - `streamingTexts` / `streamReasonings`: 每个文件的流式正文与思考过程
  - `streamFindings` / `streamExtractedInfo`: 完成后的审查发现与信息提取结果
  - `streamStatus` / `streamPhase`: 每个文件的流状态（streaming/done/error）与阶段
  - `allDone`: 全部文件审查完成（收到 `task_done`）
  - `connectionError`: 连接级错误信息（新增，2026-09-07）
- **依赖关系**:
  - 引入: react、`@/types` 类型、`@/api/client`（仅取 `API_BASE`，请求用原生 fetch）
  - 被引用: `frontend/src/apps/app02/index.tsx`
- **最后修改**: 2026-09-07
- **修改原因**: 修复 v2.0.x 加账号系统后的回归 Bug——后端给 APP02 SSE 接口加了 `Depends(get_current_user)` 鉴权，前端 EventSource 无法带 Authorization 头，永远 401 且 `es.onerror` 不处理导致"AI 审查一直加载"。改用 fetch 流式读取并显式处理连接错误
