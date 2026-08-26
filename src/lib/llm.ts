/**
 * Shared LLM helper: Groq (free tier) → OpenAI → Anthropic.
 * Used by generative vocab practice (NOT Guided Story ghostwriting checks).
 */

export type LlmCallResult = {
  text: string;
  provider: "groq" | "openai" | "anthropic";
};

export function llmConfigured(): boolean {
  return Boolean(
    process.env.GROQ_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.ANTHROPIC_API_KEY?.trim(),
  );
}

/** Optional Lesson Capture screenshot vision (OpenAI only). Free notes path uses callLlm / llmConfigured(). */
export function visionLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function callLlm(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<LlmCallResult | null> {
  const temperature = opts.temperature ?? 0.6;
  const maxTokens = opts.maxTokens ?? 1800;

  try {
    if (process.env.GROQ_API_KEY?.trim()) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider: "groq" };
      }
    }

    if (process.env.OPENAI_API_KEY?.trim()) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_VOCAB_MODEL?.trim() || "gpt-4o-mini",
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider: "openai" };
      }
    }

    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY.trim(),
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_VOCAB_MODEL?.trim() || "claude-3-5-haiku-latest",
          max_tokens: maxTokens,
          temperature,
          system: opts.system,
          messages: [{ role: "user", content: opts.user }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: { type: string; text?: string }[] };
        const text = data.content?.find((c) => c.type === "text")?.text?.trim();
        if (text) return { text, provider: "anthropic" };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export type LlmVisionImage = {
  mimeType: string;
  base64: string;
};

export type LlmVisionCallResult =
  | { ok: true; text: string; provider: "openai" }
  | { ok: false; error: string };

/** Vision LLM — OpenAI gpt-4o-mini (requires OPENAI_API_KEY). */
export async function callLlmVision(opts: {
  system: string;
  userText: string;
  images: LlmVisionImage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<LlmVisionCallResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not set. Add it to .env.local and restart the server.",
    };
  }
  if (!opts.images.length) {
    return { ok: false, error: "No screenshot frames available for vision analysis." };
  }

  const temperature = opts.temperature ?? 0.3;
  const maxTokens = opts.maxTokens ?? 2000;

  const imageParts = opts.images.map((img) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:${img.mimeType};base64,${img.base64}`,
      detail: "low" as const,
    },
  }));

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: opts.system },
          {
            role: "user",
            content: [{ type: "text", text: opts.userText }, ...imageParts],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `OpenAI vision HTTP ${res.status}: ${body.slice(0, 300) || res.statusText}`,
      };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) return { ok: true, text, provider: "openai" };
    return { ok: false, error: "OpenAI vision returned an empty response." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "OpenAI vision request failed.",
    };
  }
}

export function extractJsonObject(raw: string): unknown | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}
