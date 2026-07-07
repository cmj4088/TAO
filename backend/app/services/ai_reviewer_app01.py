"""APP01 AI 审查服务 — SSE 流式输出"""
import json
import urllib.request
import urllib.error
import socket

from app.schemas.app01 import ExamRow, TeacherInfo

ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
ARK_KEY = "ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c"
AI_MODEL = "deepseek-v4-pro-260425"
AI_TIMEOUT = 120

_proxy_handler = urllib.request.ProxyHandler({})
_opener = urllib.request.build_opener(_proxy_handler)


def _get_llm_config(api_key: str | None = None, model: str | None = None, url: str | None = None) -> tuple[str, str, str]:
    """读取 LLM 配置：优先使用传入参数 → ConfigManager 数据库配置 → 硬编码默认值"""
    from app.config import ConfigManager
    final_url = url or ConfigManager.get("llm_url", "") or ARK_URL
    final_key = api_key or ConfigManager.get("llm_key", "") or ARK_KEY
    final_model = model or ConfigManager.get("llm_model", "") or AI_MODEL
    return final_url, final_key, final_model


class AiStreamError(Exception):
    """AI 流式调用错误，携带用户可读消息"""


def _call_ai_stream(prompt: str, api_key: str | None = None):
    url, key, model = _get_llm_config(api_key=api_key)
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "stream": True,
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )

    try:
        with _opener.open(req, timeout=AI_TIMEOUT) as resp:
            buffer = b""
            for chunk in resp:
                buffer += chunk
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    line = line.strip()
                    if not line or line == b"data: [DONE]":
                        continue
                    if line.startswith(b"data: "):
                        try:
                            data = json.loads(line[6:])
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
    except urllib.error.HTTPError as e:
        raise AiStreamError(f"AI API 返回错误 {e.code}，请稍后重试")
    except urllib.error.URLError as e:
        raise AiStreamError(f"无法连接 AI 服务：{e.reason}，请检查网络")
    except socket.timeout:
        raise AiStreamError(f"AI 调用超时（{AI_TIMEOUT}秒），请稍后重试")


async def review_stream(
    exam_rows: list[ExamRow],
    teachers: list[TeacherInfo],
    teacher_loads: dict[str, int],
):
    """异步流式审查分配结果，yield (event_type, data)"""

    exam_desc = []
    for r in exam_rows:
        teachers_str = "、".join(r.任课教师)
        exam_desc.append(
            f"  row_{r.index}: 场次={r.场次}, 班级={r.班级名称}, 教学班级={r.教学班级名称}, "
            f"任课教师=[{teachers_str}], 时间={r.考试时间}, 地点={r.考试地点}, "
            f"监考1={r.监考1 or '无'}, 监考2={r.监考2 or '无'}"
        )

    teacher_desc = []
    for t in teachers:
        actual = teacher_loads.get(t.name, 0)
        group_info = f", 分组={t.group}" if t.group else ""
        teacher_desc.append(
            f"  {t.name}: 部门={t.department}, 目标场次={t.slots}, 实际场次={actual}{group_info}"
        )

    prompt = f"""你是一个监考安排审查助手。请审查以下监考分配结果，检查是否存在逻辑问题。

## 考试安排
{chr(10).join(exam_desc)}

## 教师信息
{chr(10).join(teacher_desc)}

请检查以下方面：
1. 同一时间段，是否有老师同时出现在两个考场？（最严重，必须标为error）
2. 老师的实际场次是否等于目标场次？（不一致标为warning）
3. 老师是否优先监考了自己任教的班级？（未优先标为warning）
4. 同组老师的时间段是否一致？（不一致标为warning）
5. 其他任何不合理之处

返回纯JSON（不要markdown代码块）：
{{"findings": [{{"severity": "error"或"warning", "description": "问题描述", "suggestion": "建议修复"}}], "summary": "一句话总结"}}"""

    yield "reasoning", "正在分析监考安排结果..."

    full_response = ""
    try:
        for chunk in _call_ai_stream(prompt):
            full_response += chunk
            yield "token", chunk
    except AiStreamError as e:
        yield "error", str(e)
        return

    try:
        jm = full_response.strip()
        if "```json" in jm:
            jm = jm.split("```json")[1].split("```")[0]
        elif "```" in jm:
            jm = jm.split("```")[1].split("```")[0]
        start = jm.find("{")
        end = jm.rfind("}") + 1
        if start >= 0 and end > start:
            jm = jm[start:end]
        result = json.loads(jm)
    except json.JSONDecodeError:
        result = {
            "findings": [{
                "severity": "warning",
                "description": "AI 返回格式解析失败，请人工检查结果",
                "suggestion": "可尝试重新点击 AI 审查",
            }],
            "summary": "AI 审查未能完成（格式解析失败）",
        }

    findings = result.get("findings", [])
    summary = result.get("summary", "审查完成")
    yield "done", (findings, summary)
