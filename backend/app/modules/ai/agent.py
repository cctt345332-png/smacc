"""
AI Agent — يقرر متى يستدعي tool ومتى يجاوب مباشرة
يستخدم Tool Calling مع OpenAI/Gemini
"""
from __future__ import annotations
import json
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai.tools import TOOLS_DEFINITION, execute_tool
from app.modules.ai.prompts import get_system_prompt
from app.modules.ai.providers import get_provider, OpenAIProvider, GeminiProvider
from app.modules.ai.creation_tools import CREATION_TOOLS_DEFINITION, execute_creation_tool

# دمج كل الـ tools
ALL_TOOLS_DEFINITION = TOOLS_DEFINITION + CREATION_TOOLS_DEFINITION


def _format_tool_result_as_text(tool_name: str, result: dict) -> str:
    """
    يحول نتيجة الـ tool لنص عربي مقروء — fallback إذا فشل الـ AI streaming
    """
    lines = []

    if tool_name == "get_sales_summary":
        lines.append(f"**ملخص المبيعات — {result.get('period', '')}**")
        lines.append(f"- عدد الفواتير: {result.get('invoices_count', 0)}")
        lines.append(f"- إجمالي المبيعات: {result.get('total_sales', '0')} ر.س")
        lines.append(f"- ضريبة القيمة المضافة: {result.get('total_vat', '0')} ر.س")
        lines.append(f"- المحصّل: {result.get('paid_amount', '0')} ر.س")
        lines.append(f"- المستحق: {result.get('unpaid_amount', '0')} ر.س")
        if result.get("top_customers"):
            lines.append("\n**أفضل العملاء:**")
            for c in result["top_customers"]:
                lines.append(f"  - {c.get('name', '')}: {c.get('total', '0')} ر.س")

    elif tool_name == "get_purchases_summary":
        lines.append(f"**ملخص المشتريات — {result.get('period', '')}**")
        lines.append(f"- عدد الفواتير: {result.get('bills_count', 0)}")
        lines.append(f"- إجمالي المشتريات: {result.get('total_purchases', '0')} ر.س")
        lines.append(f"- ضريبة القيمة المضافة: {result.get('total_vat', '0')} ر.س")

    elif tool_name == "get_inventory_status":
        lines.append(f"**حالة المخزون**")
        lines.append(f"- إجمالي الأصناف: {result.get('total_items', 0)}")
        lines.append(f"- قيمة المخزون: {result.get('total_value', '0')} ر.س")
        lines.append(f"- أصناف منخفضة: {result.get('low_stock_count', 0)}")
        lines.append(f"- سيريالات متاحة: {result.get('serials_in_stock', 0)}")
        if result.get("low_stock_items"):
            lines.append("\n**أصناف تحتاج تجديد:**")
            for item in result["low_stock_items"]:
                lines.append(f"  - {item.get('name', '')}: {item.get('qty', 0)} متبقي")

    elif tool_name == "get_overdue_invoices":
        lines.append(f"**الفواتير المتأخرة**")
        lines.append(f"- العدد: {result.get('count', 0)}")
        lines.append(f"- الإجمالي المتأخر: {result.get('total_overdue', '0')} ر.س")
        if result.get("invoices"):
            lines.append("\n**التفاصيل:**")
            for inv in result["invoices"][:5]:
                lines.append(f"  - {inv.get('customer', '')} | {inv.get('number', '')} | {inv.get('remaining', '0')} ر.س | متأخر {inv.get('days_overdue', 0)} يوم")

    elif tool_name == "get_vat_report":
        lines.append(f"**تقرير ضريبة القيمة المضافة — {result.get('period', '')}**")
        lines.append(f"- ضريبة المبيعات (مخرجات): {result.get('output_vat', '0')} ر.س")
        lines.append(f"- ضريبة المشتريات (مدخلات): {result.get('input_vat', '0')} ر.س")
        lines.append(f"- صافي الضريبة المستحقة: {result.get('net_vat_due', '0')} ر.س")
        lines.append(f"- الحالة: {result.get('status', '')}")

    elif tool_name == "get_cash_flow":
        lines.append(f"**التدفق النقدي — {result.get('period', '')}**")
        lines.append(f"- المقبوضات: {result.get('receipts', '0')} ر.س")
        lines.append(f"- المدفوعات: {result.get('payments', '0')} ر.س")
        lines.append(f"- الصافي: {result.get('net_cash', '0')} ر.س ({result.get('status', '')})")

    elif tool_name == "get_profit_loss":
        lines.append(f"**الأرباح والخسائر — {result.get('period', '')}**")
        lines.append(f"- الإيرادات: {result.get('revenue', '0')} ر.س")
        lines.append(f"- التكاليف: {result.get('cost', '0')} ر.س")
        lines.append(f"- إجمالي الربح: {result.get('gross_profit', '0')} ر.س")
        lines.append(f"- هامش الربح: {result.get('gross_margin_pct', '0%')}")
        lines.append(f"- الحالة: {result.get('status', '')}")

    elif tool_name == "get_pos_summary":
        lines.append(f"**مبيعات نقطة البيع — {result.get('period', '')}**")
        lines.append(f"- عدد المعاملات: {result.get('transactions_count', 0)}")
        lines.append(f"- إجمالي المبيعات: {result.get('total_sales', '0')} ر.س")
        if result.get("by_payment_method"):
            lines.append("\n**طرق الدفع:**")
            for method, amount in result["by_payment_method"].items():
                lines.append(f"  - {method}: {amount} ر.س")

    elif tool_name == "get_top_customers":
        lines.append(f"**أفضل العملاء — {result.get('period', '')}**")
        for c in result.get("customers", []):
            lines.append(f"  {c.get('rank', '')}. {c.get('name', '')} — {c.get('total', '0')} ر.س ({c.get('invoices', 0)} فاتورة)")

    elif tool_name == "get_top_items":
        lines.append(f"**أفضل الأصناف مبيعاً — {result.get('period', '')}**")
        for item in result.get("items", []):
            lines.append(f"  {item.get('rank', '')}. {item.get('name', '')} — {item.get('total', '0')} ر.س")

    elif tool_name == "get_customer_balance":
        if result.get("error"):
            return result["error"]
        lines.append(f"**رصيد العميل: {result.get('customer', '')}**")
        lines.append(f"- إجمالي الفواتير: {result.get('total_invoiced', '0')} ر.س")
        lines.append(f"- المدفوع: {result.get('total_paid', '0')} ر.س")
        lines.append(f"- الرصيد المستحق: {result.get('outstanding_balance', '0')} ر.س")

    elif tool_name == "get_vendor_balance":
        if result.get("error"):
            return result["error"]
        lines.append(f"**رصيد المورد: {result.get('vendor', '')}**")
        lines.append(f"- إجمالي الفواتير: {result.get('total_billed', '0')} ر.س")
        lines.append(f"- المدفوع: {result.get('total_paid', '0')} ر.س")
        lines.append(f"- الرصيد المستحق: {result.get('outstanding_balance', '0')} ر.س")

    elif result.get("error"):
        return f"حدث خطأ: {result['error']}"

    else:
        # fallback عام
        import json as _j
        return f"البيانات:\n```\n{_j.dumps(result, ensure_ascii=False, indent=2)}\n```"

    return "\n".join(lines) if lines else "لا توجد بيانات."


# ══════════════════════════════════════════════════════════════════════
# OpenAI Tool Calling
# ══════════════════════════════════════════════════════════════════════

def _build_openai_tools() -> list[dict]:
    """تحويل ALL_TOOLS_DEFINITION لصيغة OpenAI function calling"""
    tools = []
    for t in ALL_TOOLS_DEFINITION:
        props = {}
        for param_name, param_desc in t.get("parameters", {}).items():
            props[param_name] = {"type": "string", "description": param_desc}
        tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": {
                    "type": "object",
                    "properties": props,
                    "required": [],
                },
            }
        })
    return tools


async def _openai_agent_call(
    provider: OpenAIProvider,
    messages: list[dict],
    system_prompt: str,
) -> tuple[str | None, str | None, dict | None]:
    """
    يرجع: (tool_name, tool_params_json, full_response)
    إذا AI قرر استدعاء tool → tool_name و tool_params
    إذا قرر الرد مباشرة → full_response
    """
    import httpx, json

    tools = _build_openai_tools()
    msgs = [{"role": "system", "content": system_prompt}] + messages

    body = {
        "model": provider.model,
        "messages": msgs,
        "tools": tools,
        "tool_choice": "auto",
        "temperature": 0.3,
    }
    body["max_completion_tokens" if provider.model.startswith("gpt-5") else "max_tokens"] = 2048

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{provider.BASE_URL}/chat/completions",
            headers=provider._headers(),
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    choice = data["choices"][0]
    message = choice["message"]

    # هل AI طلب tool call؟
    if message.get("tool_calls"):
        tc = message["tool_calls"][0]
        tool_name = tc["function"]["name"]
        try:
            params = json.loads(tc["function"]["arguments"])
        except Exception:
            params = {}
        return tool_name, params, None

    # رد نصي مباشر
    return None, None, {
        "content": message.get("content", ""),
        "tokens_used": data.get("usage", {}).get("total_tokens", 0),
        "model": data.get("model", provider.model),
        "provider": "openai",
    }


# ══════════════════════════════════════════════════════════════════════
# Gemini Tool Calling
# ══════════════════════════════════════════════════════════════════════

def _build_gemini_tools() -> list[dict]:
    """تحويل ALL_TOOLS_DEFINITION لصيغة Gemini function declarations"""
    declarations = []
    for t in ALL_TOOLS_DEFINITION:
        props = {}
        for param_name, param_desc in t.get("parameters", {}).items():
            props[param_name] = {"type": "STRING", "description": param_desc}
        declarations.append({
            "name": t["name"],
            "description": t["description"],
            "parameters": {
                "type": "OBJECT",
                "properties": props,
            }
        })
    return [{"function_declarations": declarations}]


async def _gemini_agent_call(
    provider: GeminiProvider,
    messages: list[dict],
    system_prompt: str,
) -> tuple[str | None, dict | None, dict | None]:
    import httpx, json

    contents, sys_instruction = provider._convert_messages(messages, system_prompt)
    tools = _build_gemini_tools()

    body: dict = {
        "contents": contents,
        "tools": tools,
        "toolConfig": {"functionCallingConfig": {"mode": "AUTO"}},
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2048},
    }
    if sys_instruction:
        body["systemInstruction"] = {"parts": [{"text": sys_instruction}]}

    url = f"{provider.BASE_URL}/models/{provider.model}:generateContent?key={provider.api_key}"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()

    candidate = data.get("candidates", [{}])[0]
    content = candidate.get("content", {})
    parts = content.get("parts", [])

    # هل فيه function call؟
    for part in parts:
        if "functionCall" in part:
            fc = part["functionCall"]
            return fc["name"], fc.get("args", {}), None

    # رد نصي
    text = "".join(p.get("text", "") for p in parts)
    usage = data.get("usageMetadata", {})
    return None, None, {
        "content": text,
        "tokens_used": usage.get("totalTokenCount", 0),
        "model": provider.model,
        "provider": "gemini",
    }


# ══════════════════════════════════════════════════════════════════════
# Main Agent Function
# ══════════════════════════════════════════════════════════════════════

async def agent_chat(
    provider_name: str,
    api_key: str,
    model: str,
    feature: str,
    messages: list[dict],
    tenant_id: str,
    db: AsyncSession,
    user_id: str = "",
    context_data: dict | None = None,
) -> dict:
    """
    Agent يقرر:
    1. هل يحتاج tool؟ → ينفذه ويرجع البيانات للـ AI → AI يصيغ الرد
    2. لا يحتاج tool؟ → يرد مباشرة
    """
    system_prompt = get_system_prompt(feature, context_data)
    provider = get_provider(provider_name, api_key, model)

    # ── الخطوة 1: اسأل AI هل يحتاج tool ─────────────────────────────
    try:
        if provider_name in ("openai", "unorouter"):
            tool_name, tool_params, direct_response = await _openai_agent_call(
                provider, messages, system_prompt
            )
        else:  # gemini
            tool_name, tool_params, direct_response = await _gemini_agent_call(
                provider, messages, system_prompt
            )
    except Exception as e:
        err = str(e)
        if "429" in err:
            raise Exception("429: تجاوزت حد الطلبات. انتظر قليلاً.")
        if "404" in err:
            raise Exception(f"404: الموديل '{model}' غير متاح.")
        raise

    # ── رد مباشر بدون tool ───────────────────────────────────────────
    if direct_response:
        return direct_response

    # ── الخطوة 2: نفّذ الـ tool ──────────────────────────────────────
    # تحقق هل هو creation tool أم read tool
    creation_tool_names = {t["name"] for t in CREATION_TOOLS_DEFINITION}

    if tool_name in creation_tool_names:
        tool_result = await execute_creation_tool(tool_name, tool_params or {}, tenant_id, user_id, db)
    else:
        tool_result = await execute_tool(tool_name, tool_params or {}, tenant_id, db)

    # ── الخطوة 3: أرجع النتيجة للـ AI ليصيغ الرد ────────────────────
    tool_result_str = json.dumps(tool_result, ensure_ascii=False, indent=2)

    # أضف نتيجة الـ tool للمحادثة
    messages_with_tool = messages + [
        {
            "role": "user",
            "content": f"[نتيجة الأداة {tool_name}]:\n{tool_result_str}\n\nبناءً على هذه البيانات الحقيقية، أجب على سؤال المستخدم بشكل واضح ومنظم."
        }
    ]

    # ── الخطوة 4: AI يصيغ الرد النهائي ──────────────────────────────
    try:
        if provider_name in ("openai", "unorouter"):
            final = await provider.chat(messages=messages_with_tool, system_prompt=system_prompt)
        else:
            final = await provider.chat(messages=messages_with_tool, system_prompt=system_prompt)
    except Exception as e:
        # إذا فشل الرد النهائي، ارجع البيانات الخام
        final = {
            "content": f"البيانات:\n```json\n{tool_result_str}\n```",
            "tokens_used": 0,
            "model": model,
            "provider": provider_name,
        }

    # أضف معلومة الـ tool المستخدم
    final["tool_used"] = tool_name
    final["tool_result"] = tool_result

    # إذا كان navigate، أضف الرابط
    if tool_name == "navigate" and "url" in tool_result:
        final["navigate_url"] = tool_result["url"]

    return final


# ══════════════════════════════════════════════════════════════════════
# Streaming Agent
# ══════════════════════════════════════════════════════════════════════

async def agent_stream(
    provider_name: str,
    api_key: str,
    model: str,
    feature: str,
    messages: list[dict],
    tenant_id: str,
    db: AsyncSession,
    user_id: str = "",
    context_data: dict | None = None,
) -> AsyncGenerator[str, None]:
    """
    Streaming version — يرسل chunks + tool_result كـ JSON event
    """
    system_prompt = get_system_prompt(feature, context_data)
    provider = get_provider(provider_name, api_key, model)

    # الخطوة 1: تحقق من الـ tool (non-streaming)
    try:
        if provider_name in ("openai", "unorouter"):
            tool_name, tool_params, direct_response = await _openai_agent_call(
                provider, messages, system_prompt
            )
        else:
            tool_name, tool_params, direct_response = await _gemini_agent_call(
                provider, messages, system_prompt
            )
    except Exception as e:
        err = str(e)
        if "429" in err:
            raise Exception("429: تجاوزت حد الطلبات.")
        if "404" in err:
            raise Exception(f"404: الموديل '{model}' غير متاح.")
        raise

    # رد مباشر بدون tool
    if direct_response:
        yield direct_response.get("content", "")
        return

    # الخطوة 2: نفّذ الـ tool
    creation_tool_names = {t["name"] for t in CREATION_TOOLS_DEFINITION}

    if tool_name in creation_tool_names:
        tool_result = await execute_creation_tool(tool_name, tool_params or {}, tenant_id, user_id, db)
    else:
        tool_result = await execute_tool(tool_name, tool_params or {}, tenant_id, db)

    import json as _json

    # إذا navigate → أرسل event التنقل فوراً وانتهِ
    if tool_name == "navigate":
        url = tool_result.get("url", "/dashboard")
        label = tool_result.get("label", "")
        yield f"\x00NAVIGATE\x00{_json.dumps({'url': url, 'label': label}, ensure_ascii=False)}\x00"
        return

    # أرسل tool_result كـ event خاص للفرونت
    yield f"\x00TOOL_RESULT\x00{_json.dumps({'tool': tool_name, 'result': tool_result}, ensure_ascii=False)}\x00"

    # الخطوة 3: AI يصيغ الرد مع streaming
    tool_result_str = _json.dumps(tool_result, ensure_ascii=False, indent=2)
    messages_with_tool = messages + [
        {
            "role": "user",
            "content": f"[نتيجة الأداة {tool_name}]:\n{tool_result_str}\n\nبناءً على هذه البيانات الحقيقية، أجب على سؤال المستخدم بشكل واضح ومنظم باللغة العربية."
        }
    ]

    got_content = False
    try:
        async for chunk in provider.stream(messages=messages_with_tool, system_prompt=system_prompt):
            if chunk:
                got_content = True
                yield chunk
    except Exception:
        pass

    # إذا ما جاء أي محتوى → اعرض البيانات مباشرة كـ fallback
    if not got_content:
        yield _format_tool_result_as_text(tool_name, tool_result)
