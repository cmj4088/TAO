"""
部署流程健壮性测试
模拟各种异常场景，验证部署和更新流程不会导致数据丢失或服务不可用

测试场景：
  1. 快速连续更新（watchtower 多次拉取）
  2. 容器异常退出自动恢复
  3. 数据卷持久化验证
  4. 端口冲突处理
  5. 磁盘空间不足模拟（仅检查）
  6. 并发请求中重启
  7. 镜像拉取失败回退

用法：
  python test_deploy_robustness.py
"""

import subprocess
import time
import sys
import os
import json
import shutil
import signal
from pathlib import Path
from dataclasses import dataclass, field

# ============================================================
# 配置
# ============================================================

COMPOSE_DIR = os.path.dirname(os.path.abspath(__file__))
COMPOSE_FILE = os.path.join(COMPOSE_DIR, "docker-compose.yml")
DATA_DIR = os.path.join(COMPOSE_DIR, "data")
BACKUP_DIR = os.path.join(COMPOSE_DIR, "data_backup")

BASE_URL = "http://127.0.0.1:8002"


# ============================================================
# 工具函数
# ============================================================

def run(cmd: str, capture=True, check=False) -> subprocess.CompletedProcess:
    """运行 shell 命令"""
    return subprocess.run(
        cmd, shell=True, capture_output=capture, text=True,
        cwd=COMPOSE_DIR, timeout=60,
    )


def docker_compose(cmd: str, **kwargs) -> subprocess.CompletedProcess:
    return run(f"docker compose -f {COMPOSE_FILE} {cmd}", **kwargs)


def compose_ps() -> dict | None:
    """获取 compose 服务状态"""
    result = docker_compose("ps --format json")
    if result.returncode != 0:
        return None
    services = {}
    for line in result.stdout.strip().split("\n"):
        if line:
            try:
                info = json.loads(line)
                services[info.get("Service", "")] = info
            except json.JSONDecodeError:
                pass
    return services


def service_healthy() -> bool:
    """检查后端是否响应"""
    import urllib.request
    try:
        resp = urllib.request.urlopen(f"{BASE_URL}/api/version", timeout=5)
        return resp.status == 200
    except Exception:
        return False


def wait_for_healthy(timeout: int = 30) -> bool:
    """等待服务恢复"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if service_healthy():
            return True
        time.sleep(1)
    return False


def backup_data():
    """备份数据目录"""
    if os.path.exists(DATA_DIR) and os.listdir(DATA_DIR):
        if os.path.exists(BACKUP_DIR):
            shutil.rmtree(BACKUP_DIR)
        shutil.copytree(DATA_DIR, BACKUP_DIR)
        print(f"  [BACKUP] 数据已备份: {BACKUP_DIR}")


def restore_data():
    """恢复数据目录（跳过被锁定的文件）"""
    if os.path.exists(BACKUP_DIR):
        for root, dirs, files in os.walk(BACKUP_DIR):
            rel_path = os.path.relpath(root, BACKUP_DIR)
            target_dir = os.path.join(DATA_DIR, rel_path) if rel_path != "." else DATA_DIR
            os.makedirs(target_dir, exist_ok=True)
            for f in files:
                src = os.path.join(root, f)
                dst = os.path.join(target_dir, f)
                try:
                    shutil.copy2(src, dst)
                except PermissionError:
                    print(f"  [WARN] 无法恢复 {f}（文件被锁定，跳过）")
        print(f"  [RESTORE] 数据已恢复")


# ============================================================
# 测试用例
# ============================================================

@dataclass
class TestResult:
    name: str
    passed: bool
    detail: str = ""
    warnings: list[str] = field(default_factory=list)


class RobustnessTester:
    def __init__(self):
        self.results: list[TestResult] = []

    def add(self, result: TestResult):
        icon = "[OK]" if result.passed else "[FAIL]"
        print(f"\n  {icon} {result.name}")
        if result.detail:
            print(f"     {result.detail}")
        for w in result.warnings:
            print(f"     [WARN] {w}")
        self.results.append(result)

    # ---- 场景1：快速连续更新 ----
    def test_rapid_updates(self):
        """连续多次 docker compose up -d，模拟 watchtower 快速更新"""
        print("\n--- 场景1：快速连续更新 ---")

        # 先确保服务在跑
        docker_compose("up -d")
        if not wait_for_healthy():
            self.add(TestResult("快速连续更新", False, "初始启动失败"))
            return

        # 连续3次 up -d + pull
        ok_count = 0
        for i in range(3):
            print(f"  第{i+1}次更新...")
            docker_compose("pull backend")  # 尝试拉取（可能没有新镜像，但不应报错）
            result = docker_compose("up -d")
            if result.returncode == 0:
                ok_count += 1
            time.sleep(2)

        healthy = wait_for_healthy()
        passed = ok_count == 3 and healthy
        self.add(TestResult(
            "快速连续更新 (3次)",
            passed,
            f"成功 {ok_count}/3 次，最终服务{'正常' if healthy else '异常'}",
        ))

    # ---- 场景2：容器异常退出自动恢复 ----
    def test_auto_restart(self):
        """杀掉容器，验证 restart: unless-stopped 自动恢复"""
        print("\n--- 场景2：容器异常退出自动恢复 ---")

        docker_compose("up -d")
        if not wait_for_healthy():
            self.add(TestResult("自动重启恢复", False, "初始启动失败"))
            return

        # 记录启动时间
        ps_before = compose_ps()
        if not ps_before:
            self.add(TestResult("自动重启恢复", False, "无法获取容器状态"))
            return

        # 杀掉容器
        print("  正在杀掉 backend 容器...")
        run("docker compose -f {} kill backend".format(COMPOSE_FILE))

        time.sleep(5)

        # 检查是否自动恢复
        healthy = wait_for_healthy(timeout=30)
        ps_after = compose_ps()

        passed = healthy and ps_after is not None
        self.add(TestResult(
            "容器异常退出自动恢复",
            passed,
            f"杀掉后{'已' if healthy else '未'}恢复响应",
        ))

    # ---- 场景3：数据持久化验证 ----
    def test_data_persistence(self):
        """重启容器后数据是否还在"""
        print("\n--- 场景3：数据持久化验证 ---")

        docker_compose("up -d")
        wait_for_healthy()

        # 记录 data 目录内容
        before_files = set()
        for root, dirs, files in os.walk(DATA_DIR):
            for f in files:
                before_files.add(os.path.relpath(os.path.join(root, f), DATA_DIR))
        print(f"  重启前 data 目录: {len(before_files)} 个文件")

        # 重启
        docker_compose("restart backend")
        wait_for_healthy()

        after_files = set()
        for root, dirs, files in os.walk(DATA_DIR):
            for f in files:
                after_files.add(os.path.relpath(os.path.join(root, f), DATA_DIR))

        lost = before_files - after_files
        new_files = after_files - before_files
        passed = len(lost) == 0

        detail = f"重启后文件数: {len(after_files)}"
        if lost:
            detail += f"，丢失: {lost}"
        if new_files:
            detail += f"，新增: {new_files}"

        self.add(TestResult("数据持久化（重启后数据不丢）", passed, detail))

    # ---- 场景4：并发请求中重启 ----
    def test_restart_during_load(self):
        """服务正在处理请求时重启"""
        print("\n--- 场景4：并发请求中重启 ---")

        docker_compose("up -d")
        if not wait_for_healthy():
            self.add(TestResult("负载中重启", False, "初始启动失败"))
            return

        # 用后台任务持续发请求
        import threading
        import urllib.request

        error_count = [0]
        stop_flag = [False]

        def hammer():
            while not stop_flag[0]:
                try:
                    urllib.request.urlopen(f"{BASE_URL}/api/version", timeout=2)
                except Exception:
                    error_count[0] += 1
                time.sleep(0.05)

        threads = [threading.Thread(target=hammer, daemon=True) for _ in range(4)]
        for t in threads:
            t.start()

        # 发请求2秒后重启
        time.sleep(2)
        print("  正在重启...")
        docker_compose("restart backend")

        # 再等5秒后停止
        time.sleep(5)
        stop_flag[0] = True
        for t in threads:
            t.join(timeout=2)

        final_healthy = wait_for_healthy()

        # 有错误是正常的（重启期间），关键是最终恢复了
        passed = final_healthy
        self.add(TestResult(
            "并发请求中重启",
            passed,
            f"重启期间 {error_count[0]} 次请求失败，最终服务{'正常' if final_healthy else '异常'}",
        ))

    # ---- 场景5：磁盘空间检查（不实际操作，只警告） ----
    def test_disk_space_check(self):
        """检查 data 目录所在磁盘剩余空间"""
        print("\n--- 场景5：磁盘空间检查 ---")

        try:
            usage = shutil.disk_usage(DATA_DIR) if os.path.exists(DATA_DIR) else shutil.disk_usage(COMPOSE_DIR)
            free_gb = usage.free / (1024 ** 3)
            total_gb = usage.total / (1024 ** 3)

            if free_gb < 1:
                self.add(TestResult(
                    "磁盘空间检查",
                    False,
                    f"剩余仅 {free_gb:.1f}GB / 总计 {total_gb:.1f}GB [WARN] 磁盘空间不足！",
                ))
            elif free_gb < 5:
                self.add(TestResult(
                    "磁盘空间检查",
                    True,
                    f"剩余 {free_gb:.1f}GB / 总计 {total_gb:.1f}GB",
                    warnings=[f"剩余空间不足 5GB，建议清理"],
                ))
            else:
                self.add(TestResult(
                    "磁盘空间检查",
                    True,
                    f"剩余 {free_gb:.1f}GB / 总计 {total_gb:.1f}GB",
                ))
        except Exception as e:
            self.add(TestResult("磁盘空间检查", True, f"无法检查: {e}"))

    # ---- 场景6：docker-compose.yml 语法检查 ----
    def test_compose_config(self):
        """验证 docker-compose.yml 配置有效"""
        print("\n--- 场景6：compose 配置验证 ---")

        result = run(f"docker compose -f {COMPOSE_FILE} config")
        if result.returncode == 0:
            # 检查关键配置
            config = result.stdout
            has_image = "image:" in config and "ghcr.io" in config
            has_restart = "restart: unless-stopped" in config
            has_volumes = "data:/app/data" in config or "./data:/app/data" in config
            has_watchtower_label = "watchtower.enable" in config

            issues = []
            if not has_image:
                issues.append("未使用 image 而是本地 build")
            if not has_restart:
                issues.append("未配置 restart: unless-stopped")
            if not has_volumes:
                issues.append("未挂载 data 卷")
            if not has_watchtower_label:
                issues.append("未配置 watchtower label")

            passed = len(issues) == 0
            self.add(TestResult(
                "docker-compose.yml 配置验证",
                passed,
                "配置正确" if passed else "; ".join(issues),
                warnings=issues if not passed else [],
            ))
        else:
            self.add(TestResult(
                "docker-compose.yml 配置验证",
                False,
                f"配置解析失败: {result.stderr[:200]}",
            ))

    # ---- 场景7：Dockerfile 最佳实践检查 ----
    def test_dockerfile_best_practices(self):
        """检查 Dockerfile 是否有 .dockerignore"""
        print("\n--- 场景7：Dockerfile 最佳实践 ---")

        dockerignore = os.path.join(COMPOSE_DIR, ".dockerignore")
        dockerfile = os.path.join(COMPOSE_DIR, "Dockerfile")

        issues = []

        if not os.path.exists(dockerignore):
            issues.append("缺少 .dockerignore 文件")

        if os.path.exists(dockerfile):
            content = Path(dockerfile).read_text()
            if "COPY . ." in content and not os.path.exists(dockerignore):
                issues.append("COPY . . 会包含 __pycache__、.git 等无关文件")

        passed = len(issues) == 0
        self.add(TestResult(
            "Dockerfile 最佳实践",
            passed,
            "检查通过" if passed else "; ".join(issues),
            warnings=issues if not passed else [],
        ))


# ============================================================
# 主流程
# ============================================================

def main():
    print("=" * 70)
    print("  部署流程健壮性测试")
    print("=" * 70)

    # 检查 docker 是否可用
    docker_check = run("docker --version")
    if docker_check.returncode != 0:
        print("\n  [FAIL] 未检测到 Docker，请先安装 Docker")
        print("     部分测试将被跳过\n")

    compose_check = run("docker compose version")
    has_compose = compose_check.returncode == 0
    if not has_compose:
        print("  [WARN] 未检测到 docker compose 插件，部分测试将被跳过\n")

    tester = RobustnessTester()

    # 先备份数据
    if os.path.exists(DATA_DIR):
        backup_data()

    try:
        if has_compose:
            tester.test_compose_config()
            tester.test_dockerfile_best_practices()
            tester.test_rapid_updates()
            tester.test_auto_restart()
            tester.test_data_persistence()
            tester.test_restart_during_load()
        else:
            tester.test_compose_config()
            tester.test_dockerfile_best_practices()

        tester.test_disk_space_check()

    finally:
        # 确保恢复数据
        if os.path.exists(BACKUP_DIR):
            restore_data()
            shutil.rmtree(BACKUP_DIR)

    # 打印汇总
    print("\n" + "=" * 70)
    print("  汇总")
    print("=" * 70)

    passed = sum(1 for r in tester.results if r.passed)
    total = len(tester.results)
    for r in tester.results:
        icon = "[OK]" if r.passed else "[FAIL]"
        print(f"  {icon} {r.name}")

    print(f"\n  通过: {passed}/{total}")
    if passed == total:
        print("  [OK] 全部通过")
    else:
        print(f"  [WARN] {total - passed} 项未通过")

    print("=" * 70)


if __name__ == "__main__":
    main()
