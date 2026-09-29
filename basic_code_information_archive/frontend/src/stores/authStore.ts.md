# stores/authStore.ts — 认证状态 store

## 文件: authStore.ts
- **路径**: `frontend/src/stores/authStore.ts`
- **作用**: zustand 全局认证状态：user、accessToken/refreshToken、isAuthenticated；提供 login/register/logout/refreshAuth/loadUser 等动作
- **关键函数/类**:
  - `login(email, password, rememberMe)`: 调 `/api/auth/login`；记录记住我选择，token 经 `api/tokenStore.ts` 保存（勾选才持久化）；登录后 `loadUser()`
  - `register(email, password, displayName, code)`: 调 `/api/auth/register`，默认持久化会话
  - `logout()`: 调后端登出 + `clearTokens()` 清内存与 localStorage
  - `refreshAuth()`: 用 refresh_token 换新 token，是否落盘由记住我标记决定；失败则清空登录态
  - `loadUser()`: 调 `/api/auth/me` 拉用户信息；失败只清 user 不清 token（401 刷新由 axios 拦截器负责）
  - `hasPermission(permission)`: 权限判断
- **依赖关系**:
  - 引入: zustand、`@/api/client`、`@/api/tokenStore`
  - 被引用: `App.tsx`（RootRedirect）、`AuthGuard.tsx`、`LoginPage.tsx`、`RegisterPage.tsx`、`SettingsPage.tsx` 等几乎所有页面
- **最后修改**: 2026-09-08
- **修改原因**: 修复"记住我"不生效——token 读写改走统一存取层 tokenStore；持久化严格由记住我开关控制
