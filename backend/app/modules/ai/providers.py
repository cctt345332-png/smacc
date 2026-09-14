"""
AI Providers — OpenAI & Gemini
───────────────────────────────
كل provider يدعم:
  - chat()        → رد كامل (non-streaming)
  - stream()      → generator يرجع chunks
  - count_tokens() → تقدير عدد الـ tokens
"""
from __future__ import annotations
import json
import os
from typing import AsyncGenerator, Any
import httpx

# ─── Models المتاحة ───────────────────────────────────────────────────
OPENAI_MODELS = [
    {"id": "gpt-5-nano",  "name": "GPT-5 Nano",  "context": 128000},
    {"id": "gpt-5-mini",  "name": "GPT-5 Mini",  "context": 128000},
    {"id": "gpt-5",       "name": "GPT-5",       "context": 128000},
    {"id": "gpt-5.5",     "name": "GPT-5.5",     "context": 128000},
]

GEMINI_MODELS = [
    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "context": 1000000},
    {"id": "gemini-2.5-pro",   "name": "Gemini 2.5 Pro",   "context": 1000000},
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "context": 1000000},
    {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "context": 1000000},
]

# نماذج UnoRouter الشائعة، مع تمييز النماذج المجانية التي تنتهي بـ :free.
# يمكن تحديث القائمة لاحقًا من /models دون تغيير عقد المحادثة.
UNOROUTER_MODELS = [
    {"id": "gpt-oss-120b:free", "name": "GPT OSS 120B · مجاني", "context": 131072, "free": True},
    {"id": "deepseek-v4-flash-0731:free", "name": "DeepSeek V4 Flash · مجاني", "context": 1000000, "free": True},
    {"id": "glm-5.3-flash:free", "name": "GLM 5.3 Flash · مجاني", "context": 1000000, "free": True},
    {"id": "qwen3.8-27b:free", "name": "Qwen 3.8 27B · مجاني", "context": 65536, "free": True},
    {"id": "gemini-3.6-flash:free", "name": "Gemini 3.6 Flash · مجاني", "context": 1000000, "free": True},
    {"id": "mistral-small:free", "name": "Mistral Small · مجاني", "context": 32768, "free": True},
    {"id": "llama-3.3-70b:free", "name": "Llama 3.3 70B · مجاني", "context": 131072, "free": True},
    {"id": "deepseek-v4.1-flash", "name": "DeepSeek V4.1 Flash", "context": 1000000, "free": False},
]

ALL_MODELS = {
    "openai": OPENAI_MODELS,
    "gemini": GEMINI_MODELS,
    "unorouter": UNOROUTER_MODELS,
}


# ══════════════════════════════════════════════════════════════════════
# OpenAI Provider
# ══════════════════════════════════════════════════════════════════════
class OpenAIProvider:
    DEFAULT_BASE_URL = "https://api.openai.com/v1"

    def __init__(self, api_key: str, model: str = "gpt-5-mini", base_url: str | None = None, provider_name: str = "openai"):
        self.api_key = api_key
        self.model = model
        self.provider_name = provider_name
        # يسمح لمعاينة SMACC باستخدام خدمة النماذج المهيأة في البيئة،
        # ويبقي OpenAI المباشر هو السلوك الافتراضي خارج المعاينة.
        self.BASE_URL = (base_url or os.getenv("OPENAI_API_BASE", self.DEFAULT_BASE_URL)).rstrip("/")
        self._proxy_mode = self.BASE_URL != self.DEFAULT_BASE_URL

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _raise_for_response(self, resp: httpx.Response) -> None:
        """احتفظ بتفاصيل خطأ OpenAI-compatible بدل فقدان body عند raise_for_status."""
        if resp.is_success:
            return
        try:
            payload = resp.json()
            error = payload.get("error", {}) if isinstance(payload, dict) else {}
            message = error.get("message") or payload.get("detail") or resp.reason_phrase
            code = error.get("code") or error.get("type") or "http_error"
        except Exception:
            message = resp.text[:500] or resp.reason_phrase
            code = "http_error"
        request_id = resp.headers.get("x-request-id") or resp.headers.get("request-id") or ""
        retry_after = resp.headers.get("retry-after") or ""
        details = f"HTTP {resp.status_code} [{code}] {message}"
        if request_id:
            details += f" (request id: {request_id})"
        if retry_after:
            details += f" (retry-after: {retry_after})"
        raise RuntimeError(details)

    def _build_body(self, messages: list[dict], system_prompt: str | None = None, stream: bool = False) -> dict:
        msgs = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.extend(messages)
        body = {
            "model": self.model,
            "messages": msgs,
            "stream": stream,
            "temperature": 0.7,
        }
        # نماذج GPT-5 تستخدم max_completion_tokens؛ أما النماذج الأقدم فتستخدم max_tokens.
        body["max_completion_tokens" if self.model.startswith("gpt-5") else "max_tokens"] = 2048
        return body

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> dict:
        """رد كامل — يرجع dict فيه content + usage"""
        body = self._build_body(messages, system_prompt, stream=False)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self.BASE_URL}/chat/completions",
                headers=self._headers(),
                json=body,
            )
            self._raise_for_response(resp)
            data = resp.json()
            return {
                "content": data["choices"][0]["message"]["content"],
                "tokens_used": data.get("usage", {}).get("total_tokens", 0),
                "model": data.get("model", self.model),
                "provider": self.provider_name,
            }

    async def stream(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming — مع بديل رد كامل للخدمات التي لا تعرض SSE."""
        if self._proxy_mode:
            # خدمة المعاينة لا تضمن SSE؛ نعيد النص كاملاً بدل فشل المحادثة.
            result = await self.chat(messages, system_prompt)
            if result.get("content"):
                yield result["content"]
            return

        body = self._build_body(messages, system_prompt, stream=True)
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.BASE_URL}/chat/completions",
                headers=self._headers(),
                json=body,
            ) as resp:
                self._raise_for_response(resp)
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def list_models(self) -> list[dict]:
        """جلب النماذج من OpenAI-compatible /models."""
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(f"{self.BASE_URL}/models", headers=self._headers())
            self._raise_for_response(resp)
            payload = resp.json()
        return payload.get("data", []) if isinstance(payload, dict) else []

    async def validate_key(self) -> bool:
        """التحقق من صحة المفتاح"""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/models",
                    headers=self._headers(),
                )
                return resp.status_code == 200
        except Exception:
            return False


# ══════════════════════════════════════════════════════════════════════
# UnoRouter Provider
# ══════════════════════════════════════════════════════════════════════
class UnoRouterProvider(OpenAIProvider):
    """UnoRouter عبر واجهة OpenAI-compatible الرسمية."""
    BASE_URL = "https://api.unorouter.com/v1"

    def __init__(self, api_key: str, model: str = "gpt-oss-120b:free"):
        super().__init__(api_key=api_key, model=model, base_url=self.BASE_URL, provider_name="unorouter")
        # UnoRouter يدعم SSE مثل OpenAI، فلا نستخدم fallback النص الكامل.
        self._proxy_mode = False


# ══════════════════════════════════════════════════════════════════════
# Gemini Provider
# ══════════════════════════════════════════════════════════════════════
class GeminiProvider:
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model

    def _convert_messages(self, messages: list[dict], system_prompt: str | None) -> tuple[list, str | None]:
        """تحويل messages من OpenAI format لـ Gemini format"""
        contents = []
        sys_instruction = system_prompt

        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                sys_instruction = content
                continue
            gemini_role = "user" if role == "user" else "model"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": content}],
            })

        return contents, sys_instruction

    def _build_body(self, messages: list[dict], system_prompt: str | None = None) -> dict:
        contents, sys_instruction = self._convert_messages(messages, system_prompt)
        body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2048,
            },
        }
        if sys_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": sys_instruction}]
            }
        return body

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> dict:
        body = self._build_body(messages, system_prompt)
        url = f"{self.BASE_URL}/models/{self.model}:generateContent?key={self.api_key}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            usage = data.get("usageMetadata", {})
            tokens = usage.get("totalTokenCount", 0)
            return {
                "content": content,
                "tokens_used": tokens,
                "model": self.model,
                "provider": "gemini",
            }

    async def stream(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        body = self._build_body(messages, system_prompt)
        url = f"{self.BASE_URL}/models/{self.model}:streamGenerateContent?key={self.api_key}&alt=sse"
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", url, json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    try:
                        data = json.loads(data_str)
                        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                        for part in parts:
                            text = part.get("text", "")
                            if text:
                                yield text
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def validate_key(self) -> bool:
        try:
            url = f"{self.BASE_URL}/models?key={self.api_key}"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                return resp.status_code == 200
        except Exception:
            return False


# ══════════════════════════════════════════════════════════════════════
# Factory
# ══════════════════════════════════════════════════════════════════════
def get_provider(provider: str, api_key: str, model: str) -> OpenAIProvider | GeminiProvider | UnoRouterProvider:
    """Factory — يرجع الـ provider الصح"""
    if provider == "openai":
        return OpenAIProvider(api_key=api_key, model=model)
    elif provider == "gemini":
        return GeminiProvider(api_key=api_key, model=model)
    elif provider == "unorouter":
        return UnoRouterProvider(api_key=api_key, model=model)
    else:
        raise ValueError(f"Unsupported provider: {provider}")
