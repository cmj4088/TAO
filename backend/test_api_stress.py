"""
教务办·智能体 后端 API 并发压力测试
测试所有关键接口，多并发级别，输出 QPS、延迟分位数报告

用法：
  python test_api_stress.py                    # 默认 10/50/100 并发
  python test_api_stress.py --host 192.168.1.1  # 指定服务器
  python test_api_stress.py --levels 10,50,100,200
"""

import asyncio
import time
import sys
import os
import json
import argparse
from dataclasses import dataclass, field

import httpx

# ============================================================
# 配置
# ============================================================

HOST = "127.0.0.1"
PORT = 8002
BASE_URL = f"http://{HOST}:{PORT}"

# 并发级别（可命令行覆盖）
DEFAULT_LEVELS = [10, 50, 100]

# 每个接口每个并发级别的请求总数
REQUESTS_PER_LEVEL = 200

# 超时（秒）
TIMEOUT = 30.0

# ============================================================
# 测试用例定义
# ============================================================

@dataclass
class TestCase:
    name: str
    method: str
    path: str
    """接口路径"""
    body: dict | None = None
    """请求体（POST 用）"""
    weight: int = 1
    """权重：混合压测时该接口被调用的比例"""


# 轻量级接口（无状态，适合压连接数）
LIGHTWEIGHT_CASES = [
    TestCase("版本查询", "GET", "/api/version"),
    TestCase("应用列表", "GET", "/api/apps"),
    TestCase("app01状态", "GET", "/api/app01/status"),
    TestCase("app02状态", "GET", "/api/app02/status"),
    TestCase("LLM配置读取", "GET", "/api/admin/llm"),
    TestCase("设置列表", "GET", "/api/settings"),
]

# 写接口测试（有状态，验证 LLM 配置写入）
WRITE_CASES = [
    TestCase("LLM配置写入", "PUT", "/api/admin/llm",
             body={"url": "https://test.com/v1", "key": "sk-test", "model": "test-model"}),
]
MIXED_CASES = [
    TestCase("版本查询", "GET", "/api/version", weight=4),
    TestCase("应用列表", "GET", "/api/apps", weight=3),
    TestCase("app01状态", "GET", "/api/app01/status", weight=2),
    TestCase("app02状态", "GET", "/api/app02/status", weight=2),
]


# ============================================================
# 单接口压测
# ============================================================

@dataclass
class Result:
    """单次请求结果"""
    status: int
    elapsed: float  # 秒
    error: str = ""


@dataclass
class Report:
    """单个测试用例的报告"""
    name: str
    concurrency: int
    total: int
    ok: int
    fail: int
    elapsed_min: float
    elapsed_max: float
    elapsed_avg: float
    elapsed_p50: float
    elapsed_p90: float
    elapsed_p95: float
    elapsed_p99: float
    qps: float
    errors: list[str] = field(default_factory=list)


def percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    k = (len(sorted_vals) - 1) * p / 100.0
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


async def run_one(client: httpx.AsyncClient, case: TestCase) -> Result:
    start = time.perf_counter()
    try:
        if case.method == "GET":
            resp = await client.get(case.path)
        else:
            resp = await client.post(case.path, json=case.body)
        elapsed = time.perf_counter() - start
        return Result(status=resp.status_code, elapsed=elapsed)
    except Exception as e:
        elapsed = time.perf_counter() - start
        return Result(status=0, elapsed=elapsed, error=str(e))


async def test_single_case(
    case: TestCase,
    concurrency: int,
    total: int,
) -> Report:
    """对单个接口做指定并发压测"""
    sem = asyncio.Semaphore(concurrency)
    results: list[Result] = []
    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency)

    async def worker(client: httpx.AsyncClient):
        async with sem:
            r = await run_one(client, case)
            results.append(r)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT, limits=limits) as client:
        tasks = [worker(client) for _ in range(total)]
        start = time.perf_counter()
        await asyncio.gather(*tasks)
    total_elapsed = time.perf_counter() - start

    ok_results = [r for r in results if r.status == 200]
    fail_results = [r for r in results if r.status != 200]
    elapsed_vals = sorted([r.elapsed for r in ok_results])

    return Report(
        name=case.name,
        concurrency=concurrency,
        total=total,
        ok=len(ok_results),
        fail=len(fail_results),
        elapsed_min=min(elapsed_vals) if elapsed_vals else 0,
        elapsed_max=max(elapsed_vals) if elapsed_vals else 0,
        elapsed_avg=sum(elapsed_vals) / len(elapsed_vals) if elapsed_vals else 0,
        elapsed_p50=percentile(elapsed_vals, 50),
        elapsed_p90=percentile(elapsed_vals, 90),
        elapsed_p95=percentile(elapsed_vals, 95),
        elapsed_p99=percentile(elapsed_vals, 99),
        qps=len(ok_results) / total_elapsed if total_elapsed > 0 else 0,
        errors=[r.error for r in fail_results[:10]],  # 只保留前10条错误
    )


# ============================================================
# 混合场景压测
# ============================================================

async def test_mixed(
    cases: list[TestCase],
    concurrency: int,
    total: int,
) -> list[Report]:
    """混合场景：按权重随机调用不同接口"""
    import random

    # 按权重展开
    weighted: list[TestCase] = []
    for c in cases:
        weighted.extend([c] * c.weight)

    sem = asyncio.Semaphore(concurrency)
    all_results: dict[str, list[Result]] = {c.name: [] for c in cases}
    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency)

    async def worker(client: httpx.AsyncClient):
        case = random.choice(weighted)
        async with sem:
            r = await run_one(client, case)
            all_results[case.name].append(r)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT, limits=limits) as client:
        start = time.perf_counter()
        await asyncio.gather(*[worker(client) for _ in range(total)])
    total_elapsed = time.perf_counter() - start

    reports = []
    for case in cases:
        results = all_results[case.name]
        ok_results = [r for r in results if r.status == 200]
        fail_results = [r for r in results if r.status != 200]
        elapsed_vals = sorted([r.elapsed for r in ok_results])

        reports.append(Report(
            name=f"[混合] {case.name}",
            concurrency=concurrency,
            total=len(results),
            ok=len(ok_results),
            fail=len(fail_results),
            elapsed_min=min(elapsed_vals) if elapsed_vals else 0,
            elapsed_max=max(elapsed_vals) if elapsed_vals else 0,
            elapsed_avg=sum(elapsed_vals) / len(elapsed_vals) if elapsed_vals else 0,
            elapsed_p50=percentile(elapsed_vals, 50),
            elapsed_p90=percentile(elapsed_vals, 90),
            elapsed_p95=percentile(elapsed_vals, 95),
            elapsed_p99=percentile(elapsed_vals, 99),
            qps=len(ok_results) / total_elapsed if total_elapsed > 0 else 0,
            errors=[r.error for r in fail_results[:10]],
        ))

    return reports


# ============================================================
# 爆发流量测试（突发大量并发）
# ============================================================

async def test_burst(case: TestCase, burst_size: int) -> Report:
    """一瞬间发起大量请求，测试服务瞬时抗压能力"""
    sem = asyncio.Semaphore(burst_size)
    results: list[Result] = []
    limits = httpx.Limits(max_keepalive_connections=burst_size, max_connections=burst_size)

    async def worker(client: httpx.AsyncClient):
        async with sem:
            r = await run_one(client, case)
            results.append(r)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT, limits=limits) as client:
        start = time.perf_counter()
        await asyncio.gather(*[worker(client) for _ in range(burst_size)])
    total_elapsed = time.perf_counter() - start

    ok_results = [r for r in results if r.status == 200]
    fail_results = [r for r in results if r.status != 200]
    elapsed_vals = sorted([r.elapsed for r in ok_results])

    return Report(
        name=f"[爆发] {case.name}",
        concurrency=burst_size,
        total=burst_size,
        ok=len(ok_results),
        fail=len(fail_results),
        elapsed_min=min(elapsed_vals) if elapsed_vals else 0,
        elapsed_max=max(elapsed_vals) if elapsed_vals else 0,
        elapsed_avg=sum(elapsed_vals) / len(elapsed_vals) if elapsed_vals else 0,
        elapsed_p50=percentile(elapsed_vals, 50),
        elapsed_p90=percentile(elapsed_vals, 90),
        elapsed_p95=percentile(elapsed_vals, 95),
        elapsed_p99=percentile(elapsed_vals, 99),
        qps=len(ok_results) / total_elapsed if total_elapsed > 0 else 0,
        errors=[r.error for r in fail_results[:10]],
    )


# ============================================================
# 健康检查
# ============================================================

async def health_check() -> bool:
    """测试前检查服务是否在线"""
    try:
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=5.0) as client:
            resp = await client.get("/api/version")
            return resp.status_code == 200
    except Exception:
        return False


# ============================================================
# 报告输出
# ============================================================

def print_separator(title: str = ""):
    print()
    print("=" * 90)
    if title:
        print(f"  {title}")
        print("=" * 90)


def print_report(r: Report):
    status_icon = "[OK]" if r.fail == 0 else "[WARN]"
    print(f"\n  {status_icon} {r.name}  (并发={r.concurrency})")
    print(f"    请求数: {r.total}  |  成功: {r.ok}  |  失败: {r.fail}")
    print(f"    QPS: {r.qps:.1f}")
    print(f"    延迟 min/avg/max: {r.elapsed_min*1000:.1f}ms / {r.elapsed_avg*1000:.1f}ms / {r.elapsed_max*1000:.1f}ms")
    print(f"    延迟分位数 p50/p90/p95/p99: "
          f"{r.elapsed_p50*1000:.1f}ms / {r.elapsed_p90*1000:.1f}ms / "
          f"{r.elapsed_p95*1000:.1f}ms / {r.elapsed_p99*1000:.1f}ms")
    if r.errors:
        for err in r.errors[:3]:
            print(f"    错误示例: {err[:100]}")


def export_json(all_reports: list[Report], path: str):
    data = []
    for r in all_reports:
        data.append({
            "name": r.name,
            "concurrency": r.concurrency,
            "total": r.total,
            "ok": r.ok,
            "fail": r.fail,
            "qps": round(r.qps, 1),
            "latency_ms": {
                "min": round(r.elapsed_min * 1000, 1),
                "avg": round(r.elapsed_avg * 1000, 1),
                "max": round(r.elapsed_max * 1000, 1),
                "p50": round(r.elapsed_p50 * 1000, 1),
                "p90": round(r.elapsed_p90 * 1000, 1),
                "p95": round(r.elapsed_p95 * 1000, 1),
                "p99": round(r.elapsed_p99 * 1000, 1),
            },
        })
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ============================================================
# 主流程
# ============================================================

async def main():
    parser = argparse.ArgumentParser(description="教务办·智能体 API 压力测试")
    parser.add_argument("--host", default=HOST, help=f"服务器地址 (默认: {HOST})")
    parser.add_argument("--port", type=int, default=PORT, help=f"端口 (默认: {PORT})")
    parser.add_argument("--levels", default=",".join(map(str, DEFAULT_LEVELS)),
                        help=f"并发级别，逗号分隔 (默认: {','.join(map(str, DEFAULT_LEVELS))})")
    parser.add_argument("--requests", type=int, default=REQUESTS_PER_LEVEL,
                        help=f"每个并发级别的请求数 (默认: {REQUESTS_PER_LEVEL})")
    parser.add_argument("--json", default="stress_report.json",
                        help="JSON 报告输出路径 (默认: stress_report.json)")
    parser.add_argument("--quick", action="store_true",
                        help="快速模式：减少请求数，快速跑完")
    args = parser.parse_args()

    global BASE_URL
    BASE_URL = f"http://{args.host}:{args.port}"

    levels = [int(x.strip()) for x in args.levels.split(",")]
    req_count = args.requests // 4 if args.quick else args.requests

    # 健康检查
    print_separator("教务办·智能体 API 压力测试")
    print(f"  目标: {BASE_URL}")
    print(f"  并发级别: {levels}")
    print(f"  每级请求数: {req_count}")

    if not await health_check():
        print(f"\n  [FAIL] 无法连接到 {BASE_URL}，请确保后端已启动")
        print(f"     启动命令: cd backend && uvicorn app.main:app --host 0.0.0.0 --port {args.port}")
        sys.exit(1)
    print(f"  [OK] 服务在线")

    all_reports: list[Report] = []

    # ---- 第1轮：轻量接口逐个压测 ----
    print_separator("第1轮：轻量接口逐项压测")
    for case in LIGHTWEIGHT_CASES:
        for level in levels:
            r = await test_single_case(case, level, req_count)
            all_reports.append(r)
            print_report(r)

    # ---- 第2轮：混合场景 ----
    print_separator("第2轮：混合场景（模拟真实流量）")
    for level in levels:
        reports = await test_mixed(MIXED_CASES, level, req_count)
        all_reports.extend(reports)
        for r in reports:
            print_report(r)

    # ---- 第3轮：爆发流量 ----
    print_separator("第3轮：爆发流量测试")
    burst_sizes = [50, 200, 500]
    for burst in burst_sizes:
        r = await test_burst(LIGHTWEIGHT_CASES[0], burst)
        all_reports.append(r)
        print_report(r)

    # ---- 第4轮：写入接口测试（LLM 配置） ----
    print_separator("第4轮：LLM 配置写入接口")
    for case in WRITE_CASES:
        for level in levels:
            r = await test_single_case(case, level, req_count)
            all_reports.append(r)
            print_report(r)

    # ---- 汇总 ----
    print_separator("汇总")
    total_ok = sum(r.ok for r in all_reports)
    total_all = sum(r.total for r in all_reports)
    failures = [r for r in all_reports if r.fail > 0]
    max_qps = max(r.qps for r in all_reports)
    best_p50 = min(r.elapsed_p50 for r in all_reports if r.ok > 0)

    print(f"  总请求: {total_all}  |  总成功: {total_ok}  |  总失败: {total_all - total_ok}")
    print(f"  成功率: {total_ok/total_all*100:.2f}%" if total_all > 0 else "  成功率: N/A")
    print(f"  最高 QPS: {max_qps:.1f}")
    print(f"  最低 p50 延迟: {best_p50*1000:.1f}ms")
    if failures:
        print(f"\n  [WARN] 有 {len(failures)} 项测试出现失败")
    else:
        print(f"\n  [OK] 全部测试通过")

    # 导出 JSON 报告
    export_json(all_reports, args.json)
    print(f"\n  JSON 报告已保存到: {os.path.abspath(args.json)}")
    print_separator()


if __name__ == "__main__":
    asyncio.run(main())
