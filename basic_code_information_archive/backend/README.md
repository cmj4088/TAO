# backend/ 目录说明

后端使用 **Python FastAPI** 框架，提供 RESTful API 接口。

## 目录结构

```
backend/
├── app/                    # 应用主代码
│   ├── main.py            # FastAPI 应用入口，注册路由
│   ├── config.py          # 配置管理器（ConfigManager），读写SQLite配置
│   ├── crypto_utils.py    # AES加密工具（敏感字段加密存储）
│   ├── database.py        # 数据库连接和建表（SQLAlchemy + SQLite）
│   ├── models/            # 数据库模型（ORM）
│   │   └── settings.py    # Setting 表模型（键值对配置）
│   ├── routers/           # API 路由（接口层）
│   │   ├── settings.py    # 设置相关接口（LLM配置读写）
│   │   ├── app01.py       # 监考分配相关接口
│   │   └── app02.py       # 文件审查相关接口
│   ├── schemas/           # Pydantic 数据校验模型
│   │   ├── settings.py    # 设置相关的请求/响应模型
│   │   ├── app01.py       # 监考分配的数据模型
│   │   └── app02.py       # 文件审查的数据模型
│   └── services/          # 业务逻辑层
│       ├── invigilator.py          # 监考分配算法
│       ├── ai_reviewer_app01.py    # App01 AI审查服务
│       ├── ai_reviewer_app02.py    # App02 AI审查服务
│       ├── doc_converter.py        # 文档格式转换（.doc→.docx）
│       └── doc_reviewer.py         # 文档审查引擎
├── data/                  # SQLite 数据库文件存储
├── Dockerfile             # Docker 镜像构建文件
├── docker-compose.yml     # Docker Compose 编排
├── requirements.txt       # Python 依赖
└── update.sh             # 手动更新脚本
```

## 关键设计
- **配置管理**：三级回退（参数→DB→默认值），敏感字段 AES 加密
- **数据库**：SQLite，轻量无需额外安装
- **端口**：8002（Docker内8000）