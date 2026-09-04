# main.py — FastAPI 应用入口

**文件路径**：`backend/app/main.py`

**当前版本**：`VERSION = "0.1.0"`（注意：实际版本应更新为0.1.1）

**作用**：FastAPI 应用的启动入口，负责：
1. 创建 FastAPI 应用实例
2. 配置 CORS 中间件（`allow_origins=["*"]`）
3. 注册所有子应用路由（settings、app01、app02）
4. 定义版本号和已注册应用列表
5. 提供 `/api/version` 和 `/api/apps` 两个基础接口

**关键变量**：
- `VERSION`：当前后端版本号 `"0.1.0"`
- `REGISTERED_APPS`：已注册子应用列表
  - `app01`：监考分配，自动分配监考员，支持拖拽调整
  - `app02`：文件审查，审查教学文件格式与内容错误

**关键函数**：
- `lifespan()`：应用生命周期管理，启动时调用 `init_db()` 初始化数据库
- `get_version()`：返回 `{"version": "0.1.0"}`
- `get_apps()`：返回 `{"apps": [...]}` 所有已注册子应用列表

**注册的路由**：
- `settings.router` → 设置相关接口
- `app01.router` → 监考分配接口
- `app02.router` → 文件审查接口

**扩展新App**：在 `REGISTERED_APPS` 列表中添加条目，然后 `app.include_router()` 注册路由。