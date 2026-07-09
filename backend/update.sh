#!/bin/bash
# ============================================
# 教务办·智能体 后端更新脚本
# 用法: bash update.sh
# ============================================
set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "  教务办·智能体 后端更新"
echo "=========================================="

# 停止旧容器
echo "[1/3] 停止旧容器..."
docker compose down 2>/dev/null || true

# 拉取最新镜像
echo "[2/3] 拉取最新镜像..."
docker compose pull

# 启动新容器
echo "[3/3] 启动服务..."
docker compose up -d

# 等待启动
sleep 3

# 健康检查
echo ""
if curl -sf http://localhost:8002/api/version > /dev/null 2>&1; then
    VERSION=$(curl -s http://localhost:8002/api/version | grep -o '"version":"[^"]*"')
    echo "[OK] 更新成功！后端版本: $VERSION"
    echo ""
    echo "LLM 配置接口验证:"
    curl -s http://localhost:8002/api/admin/llm | python3 -m json.tool 2>/dev/null || echo "  (需要安装 python3 查看格式化输出)"
else
    echo "[FAIL] 健康检查失败，请检查 docker compose logs"
    exit 1
fi

echo ""
echo "=========================================="
echo "  后续更新请再次运行: bash update.sh"
echo "=========================================="
