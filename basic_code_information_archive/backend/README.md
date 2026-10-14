# backend/ 目录说明

后端使用 **Python FastAPI** 框架，提供 RESTful API 接口。

> 最后校准：2026-10-14（对应代码 v2.0.2）。编程规范见 `docs/agent-guide.md`。

## 目录结构

```
backend/
├── app/                    # 应用主代码
│   ├── main.py            # FastAPI 应用入口：VERSION / REGISTERED_APPS / 路由注册 / CORS
│   ├── config.py          # 配置管理器（ConfigManager）：三级回退 + 加密读写
│   ├── crypto_utils.py    # AES-256-CBC 加密/解密/脱敏（mask_key）
│   ├── database.py        # 引擎、跨进程启动锁、Alembic 迁移、自动备份与回滚、种子数据
│   ├── m0_infrastructure/ # 基础设施常量（config.py：ADMIN_INIT_FILE 等路径）
│   ├── m1_auth/           # 认证与权限模块
│   │   ├── models.py      # Role/Permission/RolePermission/User/Session/UserLLMConfig/VerifyCode
│   │   ├── schemas.py     # 认证相关请求/响应模型
│   │   ├── security.py    # bcrypt 密码哈希、JWT 编解码、token 哈希
│   │   ├── auth_service.py# 注册/登录/刷新/登出/改密/用户管理/LLM配置/邮箱验证码
│   │   ├── middleware.py  # get_db / get_current_user / require_permission
│   │   └── router.py      # /api/auth/*（15 个端点）
│   ├── models/            # 数据库模型（ORM）
│   │   ├── settings.py    # Setting 表（键值对配置）
│   │   └── usage.py       # LlmUsage 表（AI 调用用量）
│   ├── routers/           # API 路由（接口层）
│   │   ├── settings.py    # /api/settings、/api/admin/llm、/api/app02/settings
│   │   ├── app01.py       # 监考分配 10 个端点 + SSE（当前无鉴权）
│   │   ├── app02.py       # 文件审查 10 个端点 + SSE（需登录）
│   │   ├── backup.py      # /api/admin/backup/export|restore（全库备份与恢复）
│   │   └── stats.py       # /api/stats/ai-usage（AI 用量统计）
│   ├── schemas/           # Pydantic 数据校验模型
│   │   ├── settings.py    # 设置相关的请求/响应模型
│   │   ├── app01.py       # 监考分配的数据模型
│   │   └── app02.py       # 文件审查的数据模型
│   └── services/          # 业务逻辑层
│       ├── invigilator.py          # 监考分配算法（贪心 + 随机重试 + AI 兜底）
│       ├── ai_reviewer_app01.py    # App01 AI 审查服务（SSE 流式）
│       ├── ai_reviewer_app02.py    # App02 AI 审查 + Python 后处理补丁
│       ├── doc_converter.py        # 文档格式转换（.doc→.docx，Word COM / LibreOffice）
│       ├── doc_reviewer.py         # 模板分类 + 格式审查引擎
│       └── llm_usage.py            # LLM 用量落库
├── alembic/               # 数据库迁移
│   ├── versions/0001_initial.py    # 基线（8 张业务表）
│   ├── versions/0002_llm_usage.py  # 新增 llm_usage 表
│   └── env.py / script.py.mako
├── data/                  # 运行时数据（已 gitignore，勿提交）
│   ├── tao.db             # SQLite 数据库（路径锚定，不受工作目录影响）
│   ├── backups/           # 迁移/恢复前自动备份，滚动保留 10 份
│   ├── admin_init.txt     # 首次生成的 admin 初始密码
│   ├── .jwt_secret        # JWT 密钥（自动生成）
│   └── init.lock          # 多 worker 启动锁文件
├── Dockerfile             # Docker 镜像（python:3.12-slim + LibreOffice + gunicorn 4 worker）
├── Dockerfile.offline     # 离线环境（wheels 本地安装）
├── docker-compose.yml     # 容器编排（8002，数据卷 ./data，ENCRYPTION_KEY）
├── requirements.txt       # Python 依赖
└── update.sh              # 手动更新脚本
```

## 关键设计
- **配置管理**：三级回退（参数 → DB → 默认值），敏感字段 AES 加密
- **数据库**：SQLite（**同步** Session）；建表/改表一律走 **Alembic**，不使用 `create_all`
- **启动容灾**：迁移前自动备份 → 迁移失败回滚并拒绝启动；`_boot_lock()` 串行化多 worker 启动
- **认证**：JWT（PyJWT）+ bcrypt；`sessions` 表支持撤销；`require_permission("resource:action")` 校验权限
- **LLM 配置两级**：全局（settings 表，管理员）+ 用户级（user_llm_configs）
- **端口**：8002（容器内与本地一致）
