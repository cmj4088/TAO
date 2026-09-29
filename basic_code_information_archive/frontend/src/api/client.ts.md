# api/client.ts — API 请求客户端

## 文件: client.ts
- **路径**: `frontend/src/api/client.ts`
- **作用**: 创建全局 axios 实例，统一 API 请求的 baseURL、超时与 Content-Type
- **关键函数/类**:
  - `API_BASE`: 从环境变量 `VITE_API_BASE` 读取后端地址；为空字符串时表示同源请求（网页版走 nginx 反代 `/api`），兜底 `http://localhost:8002`。用 `??` 而非 `||`，保证空字符串 env 生效
  - `client`: axios 实例（timeout 10000ms，Content-Type: application/json）
- **依赖关系**:
  - 引入: axios
  - 被引用: frontend/src 下所有 API 调用模块
- **Electron 打包注入**: `.env.production` 的 `VITE_API_BASE`（file:// 协议无法同源，必须写绝对地址）
- **最后修改**: 2026-09-05
- **修改原因**: `.env.production` 切换为老师服务器 `http://10.50.150.176:8006` 并重新打包 Electron 安装包

**2026-09-08 修改（修复记住我）**：请求/响应拦截器的 token 读写全部改走 `api/tokenStore.ts` 统一存取层；修复刷新 token 时无条件写 localStorage 导致"不勾记住我也被持久化"的漏洞
