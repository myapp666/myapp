import json
import os

import anthropic

AI_API_KEY = os.getenv("AI_API_KEY", "")
_MODEL = "claude-haiku-4-5-20251001"

_PROMPT_TMPL = """你是一位竞争情报分析师。请分析以下网页变更并输出 JSON。

URL: {url}

变更摘要（unified diff，最多 2000 字符）:
{diff_summary}

请只输出合法 JSON，格式如下（不要包含 markdown 代码块）:
{{
  "change_type": "价格变动|产品更新|促销活动|页面重构|内容更新|其他",
  "summary": "简短描述变更内容（中文，100字以内）",
  "importance": "低|中|高"
}}"""


def analyze_change(url: str, diff: str) -> dict:
    diff_summary = diff[:2000] if diff else "（无差异）"
    prompt = _PROMPT_TMPL.format(url=url, diff_summary=diff_summary)
    try:
        client = anthropic.Anthropic(api_key=AI_API_KEY)
        resp = client.messages.create(
            model=_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        return json.loads(text)
    except anthropic.APIError as e:
        return {
            "change_type": "",
            "summary": f"[AI 解读失败，原因: {e}]",
            "importance": "",
        }
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        return {
            "change_type": "",
            "summary": f"[AI 解读失败，原因: {e}]",
            "importance": "",
        }
