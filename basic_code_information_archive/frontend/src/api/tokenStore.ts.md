# api/tokenStore.ts — 统一 token 存取层

## 文件: tokenStore.ts
- **路径**: `frontend/src/api/tokenStore.ts`
- **作用**: token 的唯一读写入口。token 始终持有在内存中，**只有用户勾选"记住我"时才写入 localStorage**（重启恢复登录）；修复此前 axios 拦截器刷新 token 时无条件持久化、导致"不勾也被记住"的漏洞
- **关键函数/类**:
  - `isRememberMe()` / `setRememberMe(v)`: 读写 localStorage 的 `remember_me` 标记
  - `getAccessToken()` / `getRefreshToken()` / `hasTokens()`: 读内存中的当前 token（模块加载时先从 localStorage 恢复"记住我"留下的会话）
  - `saveTokens(access, refresh, persist = isRememberMe())`: 始终更新内存；`persist` 为真才落盘
  - `clearTokens()`: 清内存 + localStorage（含 remember_me 标记）
- **依赖关系**:
  - 引入: 无（纯模块）
  - 被引用: `frontend/src/api/client.ts`、`frontend/src/stores/authStore.ts`
- **最后修改**: 2026-09-08
- **修改原因**: 修复"记住我"不生效——① 新建统一存取层，持久化严格由记住我开关控制；② 配合 App.tsx 根路径按登录态分流
