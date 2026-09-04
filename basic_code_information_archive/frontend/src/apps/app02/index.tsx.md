# apps/app02/index.tsx — 文件审查主界面

**文件路径**：`frontend/src/apps/app02/index.tsx`

**作用**：App02（文件审查）的主界面组件。

**功能**：
1. 拖拽上传文件（单文件/多文件/文件夹）
2. 文件审查（规则校验 + AI 分析）
3. SSE 流式面板：实时展示 AI 思考过程（reasoning）+ 逐字回答（streamingTexts）+ 排队加载动画
4. 审查结果汇总：按贴纸分级筛选（❌关键问题/⚠仅有提醒/✅通过）
5. 文档内容预览（左侧 HTML 原文）+ AI 错误批注（右侧）
6. 导出审查结果为 Excel

**关键状态**：
- `aiReviewPhase`: `"idle"` → `"reviewing"` → `"done"`，控制流式面板显隐
- `streamingTexts`: AI 逐字回答内容（新增），在流式面板中实时展示
- `streamReasonings`: AI 思考过程文本
- `expandedStreams`: 控制思考/回答区域的展开/折叠

**最后修改**: 2026-07-30
**修改原因**: 流式面板新增 `streamingTexts` 展示 + 排队等待动画，修复 AI 分析过程无反馈的问题