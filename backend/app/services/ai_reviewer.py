"""AI 审查服务 — 调用火山引擎 Ark API 检查监考分配结果
规则1：同一老师不能在同一时间点有2场及以上监考（任何时间交集都算冲突）
规则2：时间点内如有自己的班级在考试，科任老师必须至少监考一个自己的班级
"""
import json
import re
import asyncio
import urllib.request
import urllib.error

from app.schemas.app01 import ExamRow

ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
ARK_KEY = "ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c"
MODEL_ID = "deepseek-v4-pro-260425"


def build_prompt(exam_rows: list[ExamRow]) -> str:
    """构建发送给 AI 的提示词"""
    # 只发送审查所需字段
    simplified = []
    for row in exam_rows:
        simplified.append({
            "index": row.index,
            "班级名称": row.班级名称,
            "课程名称": row.课程名称,
            "任课教师": row.任课教师,
            "考试时间": row.考试时间,
            "监考1": row.监考1,
            "监考2": row.监考2,
        })

    data_json = json.dumps(simplified, ensure_ascii=False, indent=2)

    return f"""你是一个考试监考安排审查助手。请检查以下监考安排，找出所有违反以下两条规则的问题：

## 规则1：时间重叠检测
同一老师不能在同一时间有2场或以上监考。考试时间格式为"2026-01-20(09:00-10:30)"，括号内是起止时间。
只要两个时间段有任何交集（哪怕只重叠1分钟），就算冲突。
请按日期分组检查：同一天内同一老师出现在不同行的监考1或监考2中，检查时间是否重叠。

## 规则2：必须监考自己班级
在某个时间点内，如果某位老师任教的班级有考试，该老师必须至少担任其中一个班级的监考1或监考2。
如果该时间点内该老师有多个任教班级在考试，至少监考一个即可。

## 输出格式
请严格按以下JSON格式输出，不要输出任何其他内容：
```json
{{
  "findings": [
    {{
      "rule": "time_overlap",
      "teacher": "老师姓名",
      "description": "详细描述问题（中文）",
      "affected_cells": [
        {{"row_index": 行号, "field": "监考1或监考2"}},
        {{"row_index": 行号, "field": "监考1或监考2"}}
      ]
    }},
    {{
      "rule": "must_invigilate_own_class",
      "teacher": "老师姓名",
      "description": "详细描述问题（中文）",
      "affected_cells": []
    }}
  ]
}}
```

如果没有发现任何问题，返回 {{"findings": []}}。

以下是考试安排数据：
```json
{data_json}
```"""


def parse_ai_response(raw_text: str) -> list[dict]:
    """解析 AI 返回的文本，提取 findings 列表"""
    # 尝试从 markdown 代码块中提取 JSON
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw_text)
    if json_match:
        raw_text = json_match.group(1).strip()

    data = json.loads(raw_text)
    findings = data.get("findings", [])

    # 验证每条 finding
    valid_rules = {"time_overlap", "must_invigilate_own_class"}
    for f in findings:
        if f.get("rule") not in valid_rules:
            f["rule"] = "time_overlap"  # fallback
        if "teacher" not in f:
            f["teacher"] = "未知"
        if "description" not in f:
            f["description"] = "无描述"
        f.setdefault("affected_cells", [])

    return findings


def _call_api(api_key: str, prompt: str) -> str:
    """同步调用火山引擎 API，返回 AI 响应文本"""
    body = json.dumps({
        "model": MODEL_ID,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
    }).encode("utf-8")

    req = urllib.request.Request(
        ARK_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"AI API 返回错误 {e.code}: {e.read().decode('utf-8', errors='replace')[:500]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"无法连接 AI 服务: {e.reason}")

    return result["choices"][0]["message"]["content"]


async def review(exam_rows: list[ExamRow], api_key: str | None = None) -> tuple[list[dict], str]:
    """调用 AI 审查，返回 (findings列表, AI原始响应文本)"""
    key = api_key or ARK_KEY
    prompt = build_prompt(exam_rows)

    content = await asyncio.to_thread(_call_api, key, prompt)

    findings = parse_ai_response(content)
    return findings, content
