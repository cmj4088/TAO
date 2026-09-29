# pages/AdminPage.tsx — 管理员后台页面

**文件路径**：`frontend/src/pages/AdminPage.tsx`

**作用**：管理员后台，含用户管理、大模型配置、数据备份与迁移三大板块。

**板块**：
- 用户管理：用户列表（表格）、创建用户（弹窗，角色 admin/teacher）、删除用户（二次确认）、重置密码（弹窗）；点击行选中用户以编辑其 LLM 配置
- 大模型配置：LLM URL / API Key（脱敏 + 修改模式）/ Model；供应商快捷选择（ProviderQuickSelect 弹窗自动填入）；对选中用户或当前用户生效
- 数据备份与迁移（2026-09-04 新增）：
  - 导出备份：裸 axios GET `/api/admin/backup/export`（responseType blob，120s 超时，手动带 Bearer），从 Content-Disposition 解析文件名后触发浏览器下载
  - 导入恢复：隐藏 `<input type="file" accept=".db">` 选文件 → AlertDialog 二次确认（提示覆盖全库不可撤销）→ 裸 axios POST multipart `/api/admin/backup/restore` → 成功后清除本地 token 并跳转 /login（恢复后导出之后的会话全部失效）

**实现要点**：
- 导出/上传用裸 `axios`（非通用 client）：通用 client 默认 JSON Content-Type 会破坏 multipart boundary，且备份传输需要超长超时
- API 约定：`{"data": ..., "error": null}`，错误取 `e.response.data.detail`

**最后修改**: 2026-09-04
**修改原因**: 新增数据备份与迁移板块（对接 backend/app/routers/backup.py）
