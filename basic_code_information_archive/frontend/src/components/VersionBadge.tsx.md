# components/VersionBadge.tsx — 版本更新提示

**文件路径**：`frontend/src/components/VersionBadge.tsx`

**功能**：调用 `GET /api/version` 获取远程版本，与硬编码的 `"0.1.0"` 比较，不同时显示橙色"新版本" Tag。

**注意**：版本比较硬编码为 `"0.1.0"`，更新版本号时需同步修改此处。