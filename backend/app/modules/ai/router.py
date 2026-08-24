"""
AI Router
──────────
/ai/chat          — رد كامل
/ai/stream        — streaming (SSE)
/ai/settings      — إعدادات AI للشركة
/ai/usage         — استخدام الشهر الحالي
/ai/validate-key  — التحقق من صحة مفتاح API
/ai/models        — قائمة الموديلات المتاحة
"""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant import get_current_user
from app.modules.ai.service import (
    ai_chat,
    ai_stream,
    update_tenant_ai_settings,
    get_tenant_ai_info,
    get_system_config,
)
from app.modules.ai.providers import ALL_MODELS, get_provider
from app.modules.ai.encryption import decrypt_key

router = APIRouter(prefix="/ai", tags=["ai"])


# ─── Schemas ──────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str   # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    feature: str = "general"
    messages: list[Message]
    context_data: Optional[dict] = None


class AISettingsUpdate(BaseModel):
    provider: Optional[str] = None       # "internal" | "openai" | "gemini"
    api_key: Optional[str] = None        # المفتاح الجديد (يُشفَّر ويُحفظ)
    model: Optional[str] = None
    enabled_features: Optional[list[str]] = None
    is_enabled: Optional[bool] = None


class ValidateKeyRequest(BaseModel):
    provider: str
    api_key: str
    model: str = "gpt-5-mini"


# ══════════════════════════════════════════════════════════════════════
# Chat — رد كامل
# ══════════════════════════════════════════════════════════════════════
@router.post("/chat")
async def chat(
    req: ChatRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    result = await ai_chat(
        tenant_id=user["tenant_id"],
        feature=req.feature,
        messages=messages,
        db=db,
        context_data=req.context_data,
        user_id=user["user_id"],
    )
    return result


# ══════════════════════════════════════════════════════════════════════
# Stream — Server-Sent Events
# ══════════════════════════════════════════════════════════════════════
@router.post("/stream")
async def stream(
    req: ChatRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Streaming response (SSE).
    كل chunk يُرسَل كـ: data: {"chunk": "..."}\n\n
    آخر رسالة: data: {"done": true}\n\n
    """
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_generator():
        try:
            async for chunk in ai_stream(
                tenant_id=user["tenant_id"],
                feature=req.feature,
                messages=messages,
                db=db,
                context_data=req.context_data,
            ):
                # ── Special events — أرسلها كـ events منفصلة ──────────
                if chunk.startswith("\x00NAVIGATE\x00"):
                    inner = chunk[10:]
                    json_str = inner.rstrip("\x00")
                    try:
                        nav_data = json.loads(json_str)
                        yield f"data: {json.dumps({'navigate': nav_data}, ensure_ascii=False)}\n\n"
                    except Exception:
                        pass
                    continue

                if chunk.startswith("\x00TOOL_RESULT\x00"):
                    inner = chunk[14:]
                    json_str = inner.rstrip("\x00")
                    try:
                        tool_data = json.loads(json_str)
                        yield f"data: {json.dumps({'tool_result': tool_data}, ensure_ascii=False)}\n\n"
                    except Exception:
                        pass
                    continue

                # ── نص عادي ──────────────────────────────────────────
                if chunk:
                    data = json.dumps({"chunk": chunk}, ensure_ascii=False)
                    yield f"data: {data}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"
        except HTTPException as e:
            error_data = json.dumps({"error": e.detail}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
        except Exception as e:
            error_data = json.dumps({"error": "حدث خطأ غير متوقع"}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ══════════════════════════════════════════════════════════════════════
# Settings
# ══════════════════════════════════════════════════════════════════════
@router.get("/settings")
async def get_settings(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """جلب إعدادات AI للشركة الحالية"""
    return await get_tenant_ai_info(user["tenant_id"], db)


@router.put("/settings")
async def update_settings(
    data: AISettingsUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """تحديث إعدادات AI للشركة"""
    # التحقق من صحة الـ provider
    if data.provider and data.provider not in ("internal", "openai", "gemini"):
        raise HTTPException(400, "provider غير صالح. الخيارات: internal, openai, gemini")

    # التحقق من صحة الـ features
    valid_features = {"general", "accounting", "inventory", "sales", "pos", "purchases", "reports", "treasury"}
    if data.enabled_features:
        invalid = set(data.enabled_features) - valid_features
        if invalid:
            raise HTTPException(400, f"features غير صالحة: {invalid}")

    await update_tenant_ai_settings(user["tenant_id"], data.model_dump(exclude_none=True), db)
    return await get_tenant_ai_info(user["tenant_id"], db)


# ══════════════════════════════════════════════════════════════════════
# Validate Key
# ══════════════════════════════════════════════════════════════════════
@router.post("/validate-key")
async def validate_key(
    req: ValidateKeyRequest,
    user=Depends(get_current_user),
):
    """التحقق من صحة مفتاح API قبل الحفظ"""
    try:
        provider = get_provider(req.provider, req.api_key, req.model)
        is_valid = await provider.validate_key()
        return {"valid": is_valid, "message": "المفتاح صالح" if is_valid else "المفتاح غير صالح"}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        return {"valid": False, "message": "تعذّر التحقق من المفتاح"}


# ══════════════════════════════════════════════════════════════════════
# Models
# ══════════════════════════════════════════════════════════════════════
@router.get("/models")
async def get_models(_=Depends(get_current_user)):
    """قائمة الموديلات المتاحة لكل provider"""
    return ALL_MODELS


# ══════════════════════════════════════════════════════════════════════
# Usage
# ══════════════════════════════════════════════════════════════════════
@router.get("/usage")
async def get_usage(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """استخدام AI للشهر الحالي"""
    info = await get_tenant_ai_info(user["tenant_id"], db)
    return info["usage"]
