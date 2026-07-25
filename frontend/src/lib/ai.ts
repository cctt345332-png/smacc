import api from "./api";

export const AIFeatures = [
  { key: "general",    ar: "عام",           en: "General" },
  { key: "accounting", ar: "المحاسبة",      en: "Accounting" },
  { key: "inventory",  ar: "المخزون",       en: "Inventory" },
  { key: "sales",      ar: "المبيعات",      en: "Sales" },
  { key: "pos",        ar: "نقطة البيع",    en: "POS" },
  { key: "purchases",  ar: "المشتريات",     en: "Purchases" },
  { key: "reports",    ar: "التقارير",      en: "Reports" },
  { key: "treasury",   ar: "الخزينة",       en: "Treasury" },
] as const;

export type FeatureKey = typeof AIFeatures[number]["key"];

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  feature?: FeatureKey;
  toolResult?: any;
  navigateUrl?: string;
}

export async function getAISettings() {
  return api.get("/ai/settings");
}

export async function updateAISettings(data: {
  provider?: string;
  api_key?: string;
  model?: string;
  enabled_features?: string[];
  is_enabled?: boolean;
}) {
  return api.put("/ai/settings", data);
}

export async function validateAPIKey(provider: string, api_key: string, model: string) {
  return api.post("/ai/validate-key", { provider, api_key, model });
}

export async function getAIModels() {
  return api.get("/ai/models");
}

export async function getAIUsage() {
  return api.get("/ai/usage");
}

// Non-streaming chat
export async function sendMessage(
  feature: FeatureKey,
  messages: { role: string; content: string }[],
  context_data?: Record<string, any>
) {
  return api.post("/ai/chat", { feature, messages, context_data });
}

// Streaming chat — returns EventSource-like async generator
// Yields: string chunks OR special objects { type: "tool_result", ... } OR { type: "navigate", url }
export async function* streamMessage(
  feature: FeatureKey,
  messages: { role: string; content: string }[],
  context_data?: Record<string, any>
): AsyncGenerator<string | { type: string; [key: string]: any }> {
  const token = (await import("@/store/authStore")).useAuthStore.getState().token;
  const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  const resp = await fetch(`${baseURL}/ai/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ feature, messages, context_data }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "خطأ في الاتصال" }));
    const status = resp.status;
    if (status === 429) throw new Error("429: تجاوزت حد الطلبات المجانية.");
    if (status === 401 || status === 403) throw new Error(`${status}: ${err.detail || "غير مصرح"}`);
    throw new Error(err.detail || `HTTP ${status}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.done) return;

        // navigate event — format جديد
        if (parsed.navigate) {
          yield { type: "navigate", ...parsed.navigate };
          continue;
        }

        // tool_result event — format جديد
        if (parsed.tool_result) {
          yield { type: "tool_result", ...parsed.tool_result };
          continue;
        }

        if (parsed.chunk) {
          const chunk: string = parsed.chunk;
          // NAVIGATE event — format قديم (للتوافق)
          if (chunk.startsWith("\x00NAVIGATE\x00")) {
            const inner = chunk.slice(10);
            const jsonStr = inner.slice(0, inner.lastIndexOf("\x00"));
            try { yield { type: "navigate", ...JSON.parse(jsonStr) }; } catch {}
          // TOOL_RESULT event — format قديم (للتوافق)
          } else if (chunk.startsWith("\x00TOOL_RESULT\x00")) {
            const inner = chunk.slice(14);
            const jsonStr = inner.slice(0, inner.lastIndexOf("\x00"));
            try { yield { type: "tool_result", ...JSON.parse(jsonStr) }; } catch {}
          } else {
            yield chunk;
          }
        }
      } catch (e: any) {
        if (e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }
}
