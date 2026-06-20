"""app02 AI 审查服务 — 全面审查：课时/教师/错别字/学校名"""
import json
import re
import asyncio
import urllib.request
import urllib.error

from docx import Document

ARK_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
ARK_KEY = "ark-00ec7229-97af-43d2-a5ed-865fc9de3ad1-fb92c"
MODEL_ID = "deepseek-v4-pro-260425"


def extract_doc_text(filepath: str) -> str:
    """提取 docx 文件的所有文本内容，保留表格结构"""
    doc = Document(filepath)
    parts: list[str] = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            parts.append(text)

    for t_idx, table in enumerate(doc.tables):
        parts.append(f"\n[表格{t_idx + 1}]")
        for r_idx, row in enumerate(table.rows):
            cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
            parts.append(f"  行{r_idx + 1}: " + " | ".join(cells))

    return "\n".join(parts)


def build_prompt(doc_text: str, filename: str) -> str:
    """构建 app02 AI 审查提示词 — 覆盖全部审查规则"""
    text = doc_text[:10000] if len(doc_text) > 10000 else doc_text

    return f"""你是一个高校教务文件审查助手。请对以下教学文档进行全面审查，找出所有问题。

## 第一步：提取文档基本信息
从文档内容中提取：
- teacher: 教师姓名（通常出现在"任课教师""教师""授课教师"等字段旁，2-4字中文姓名）
- course: 课程名称（通常出现在"课程名称""课程""授课课程"等字段旁）
- class_name: 班级名称（如果有）

## 第二步：全面审查以下规则

### 规则1：学校名称错误（severity: error）
学校正确名称为"深圳信息职业技术大学"。检查是否出现：
- "深圳信息职业技术学院"（混淆旧校名，这是最常见的错误）
- 其他学校名称的错别字、遗漏、多余字

### 规则2：教师信息不匹配（severity: error）
- 同一文档中同一老师被列为不同班级/不同课程的任课教师（可能是班级填错）
- 教师姓名前后不一致（同一人名字在不同位置写法不同，如"张老师"vs"张教师"）

### 规则3：错别字（severity: warning）
通过上下文识别明显错别字，如：
- "授科计划"应为"授课计划"
- "客程标准"应为"课程标准"
- 其他明显的中文错别字

### 规则4：课时计算校验（severity: error）—— 非常重要！
仔细阅读文档中的课时相关数据，检查以下内容：

4a. 汇总表中的"周数 × 周学时"是否等于"总学时/计划教学时数"
- 找到汇总表（通常是表格1）中的教学周数、周学时、总学时
- 验证：周数 × 周学时 = 总学时 是否成立
- 注意：有些文档会在总学时中扣除节假日/假期（比如总学时=周数×周学时-假期学时），这种情况是合理的，不应报错
- 只有当计算结果明显对不上且没有合理解释时才标记为错误

4b. 进度表累加学时是否与汇总表总学时一致
- 找到进度表（通常是表格2及之后），累加每一行的学时
- 对比汇总表声称的总学时
- 注意：进度表中可能有"复习""考试"等不计学时的行，要排除

4c. 课时数据的合理性
- 教学周数是否在合理范围（通常16-20周）
- 周学时是否合理（通常2-6学时）
- 总学时是否在合理范围（通常32-120学时）

## 输出格式
严格按以下JSON格式输出，不要输出任何其他内容：
```json
{{
  "extracted_info": {{
    "teacher": "教师姓名或null",
    "course": "课程名称或null",
    "class_name": "班级名称或null"
  }},
  "findings": [
    {{
      "rule": "school_name_error",
      "severity": "error",
      "description": "详细描述问题，包含原文和正确写法",
      "location": "表格编号/段落/行号",
      "suggestion": "建议修改方案"
    }},
    {{
      "rule": "teacher_mismatch",
      "severity": "error",
      "description": "详细描述不匹配的具体情况",
      "location": "问题位置",
      "suggestion": "建议"
    }},
    {{
      "rule": "typo",
      "severity": "warning",
      "description": "错别字及正确写法",
      "location": "错别字位置",
      "suggestion": "建议修改为..."
    }},
    {{
      "rule": "hour_calculation_error",
      "severity": "error",
      "description": "详细描述课时计算问题，包含具体数字",
      "location": "表格编号",
      "suggestion": "建议核实并修正"
    }},
    {{
      "rule": "hour_inconsistency",
      "severity": "error",
      "description": "进度表累加与汇总表不一致的具体数字",
      "location": "表格编号",
      "suggestion": "建议核实并统一"
    }}
  ]
}}
```

如果没有发现任何问题，返回 {{"extracted_info": {{"teacher": null, "course": null, "class_name": null}}, "findings": []}}。

## 文档文件名
{filename}

## 文档内容
{text}"""


def parse_ai_response(raw_text: str) -> tuple[list[dict], dict]:
    """解析 AI 返回的文本，返回 (findings, extracted_info)"""
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw_text)
    if json_match:
        raw_text = json_match.group(1).strip()

    data = json.loads(raw_text)
    findings = data.get("findings", [])
    extracted_info = data.get("extracted_info", {}) or {}

    valid_rules = {"school_name_error", "teacher_mismatch", "typo", "hour_calculation_error", "hour_inconsistency"}
    for f in findings:
        if f.get("rule") not in valid_rules:
            f["rule"] = "typo"
        f.setdefault("description", "无描述")
        f.setdefault("location", "")
        f.setdefault("suggestion", "")
        # severity 默认：error 类型为 error，typo 为 warning
        if "severity" not in f:
            if f["rule"] == "typo":
                f["severity"] = "warning"
            else:
                f["severity"] = "error"

    return findings, extracted_info


_proxy_handler = urllib.request.ProxyHandler({})
_opener = urllib.request.build_opener(_proxy_handler)


def _call_api(api_key: str, prompt: str) -> str:
    """同步调用火山引擎 API"""
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
        with _opener.open(req, timeout=300) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"AI API 返回错误 {e.code}: {e.read().decode('utf-8', errors='replace')[:500]}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"无法连接 AI 服务: {e.reason}")

    return result["choices"][0]["message"]["content"]


async def review(filepath: str, filename: str, api_key: str | None = None) -> tuple[list[dict], dict, str]:
    """调用 AI 审查文档内容，返回 (findings列表, extracted_info字典, AI原始响应文本)"""
    key = api_key or ARK_KEY
    doc_text = extract_doc_text(filepath)
    prompt = build_prompt(doc_text, filename)
    content = await asyncio.to_thread(_call_api, key, prompt)
    findings, extracted_info = parse_ai_response(content)
    return findings, extracted_info, content
