/**
 * Reporting's AI Assistant (POST /api/v1/assistant/chat), shared by the local
 * BFF (server/server.mjs) and the Vercel function (api/v1/assistant/chat.js).
 * Grok via xAI when XAI_API_KEY is set; otherwise demo fixtures. Same contract
 * as Core's endpoint, kept as a per-app copy on purpose (no shared BFF yet;
 * see docs/decisions/0002).
 */
const MAX_MESSAGE_CHARS = 2000;

function sanitizeContext(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 100);
}

function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((entry) => entry && ["user", "assistant"].includes(entry.role))
    .map((entry) => ({
      role: entry.role,
      content: String(entry.content ?? "").slice(0, 1000),
    }))
    .slice(-6);
}

function fixtureAssistantReply(message) {
  const lower = String(message ?? "").toLowerCase();
  if (lower.includes("quarter") || lower.includes("compare")) {
    return {
      reply:
        "Income is up versus last quarter, and net profit improved as coffee wholesale held steady.\n\n1. **Income** – $56,180 this quarter vs $48,210 last quarter\n2. **Net profit** – $24,202 vs $18,640\n\nFigures use Liquid Coffee Co. demo books (AUD).",
      table: {
        headers: ["Metric", "Last Quarter (Apr–Jun 2026)", "Current Quarter (Jul–Sep 2026)"],
        rows: [
          ["Income", "$48,210", "$56,180"],
          ["Net Profit", "$18,640", "$24,202"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Compared current quarter (Jul–Sep 2026) income and net profit against last quarter (Apr–Jun 2026) from Liquid Coffee Co. demo books.",
      relatedQuestions: [
        "What's driving the income increase?",
        "What's my gross profit margin?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("margin") || lower.includes("gross")) {
    return {
      reply:
        "Gross profit margin is about **58%** this quarter on demo data — strong for wholesale coffee.",
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale: "Divided gross profit by income for the current quarter on Liquid Coffee Co. demo books.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What are my biggest expenses?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("income") || lower.includes("source")) {
    return {
      reply:
        "Your top income sources this quarter are:\n\n1. **Coffee Sales** – $142,800 (retail & wholesale combined)\n2. **Merchandise** – $18,450\n3. **Catering Events** – $12,300\n\nLast quarter: Coffee Sales were $138,200, Merchandise $15,900, Catering $9,800.",
      table: {
        headers: ["Source", "Amount"],
        rows: [
          ["Coffee Sales", "$142,800"],
          ["Merchandise", "$18,450"],
          ["Catering Events", "$12,300"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Ranked income accounts for the current quarter from Liquid Coffee Co. demo books, then compared the same categories to last quarter.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What's my gross profit margin?",
        "Which income source grew the most?",
      ],
    };
  }
  return {
    reply:
      "I can compare quarters, margin, or income sources using Liquid Coffee Co. demo books. Ask a finance question to continue.",
    table: null,
    cta: null,
    provider: "fixture",
    rationale: "No specific metric requested — offered the default demo finance prompts.",
    relatedQuestions: [
      "How does this quarter compare to last?",
      "What's my gross profit margin?",
      "What are my biggest income sources?",
    ],
  };
}

function parseGrokPayload(raw, fallbackMessage) {
  try {
    const cleaned = String(raw ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    const reply = String(parsed.reply ?? "").trim();
    if (!reply) throw new Error("missing_reply");
    return {
      reply,
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      rationale:
        String(parsed.rationale ?? "").trim() ||
        "Answered from Liquid Coffee Co. demo books for this page context.",
      relatedQuestions: (Array.isArray(parsed.relatedQuestions) ? parsed.relatedQuestions : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 3),
    };
  } catch {
    const fixture = fixtureAssistantReply(fallbackMessage);
    return {
      reply: String(raw ?? "").trim() || fixture.reply,
      table: null,
      cta: fixture.cta,
      rationale: fixture.rationale,
      relatedQuestions: fixture.relatedQuestions,
    };
  }
}

async function callGrok({ message, context, history }, { apiKey, model }) {
  const safeContext = sanitizeContext(context);
  const system = `You are Liquid's in-product AI Assistant for Liquid Coffee Co. (synthetic AU accounting demo).
Prefer AUD. Context page: ${safeContext || "Dashboard"}.
Never invent real customer PII. Do not claim live bank access.

Respond with ONLY valid JSON (no markdown fences) using this shape:
{"reply":"user-facing answer using markdown: paragraphs and numbered lists with **bold** labels; put each list item on its own line","rationale":"1-2 sentences explaining which demo-book figures or steps you used","relatedQuestions":["follow-up 1","follow-up 2","follow-up 3"]}`;

  const messages = [
    { role: "system", content: system },
    ...sanitizeHistory(history),
    { role: "user", content: String(message ?? "").slice(0, 2000) },
  ];

  async function complete(withJsonFormat) {
    const body = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: 700,
    };
    if (withJsonFormat) body.response_format = { type: "json_object" };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`xai_${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("xai_empty_reply");
    return content;
  }

  let content;
  try {
    content = await complete(true);
  } catch {
    content = await complete(false);
  }
  const parsed = parseGrokPayload(content, message);
  if (!parsed.relatedQuestions.length) {
    parsed.relatedQuestions = fixtureAssistantReply(message).relatedQuestions;
  }
  return {
    ...parsed,
    provider: `grok:${model}`,
  };
}

/** Returns { status, payload } for a parsed request body. Never throws. */
export async function answerAssistant(body, { apiKey = "", model = "grok-4-fast-non-reasoning", onFallback } = {}) {
  const message = String(body?.message ?? "").trim();
  if (!message) return { status: 400, payload: { error: "message_required" } };
  if (message.length > MAX_MESSAGE_CHARS) return { status: 400, payload: { error: "message_too_long" } };
  if (!apiKey) return { status: 200, payload: fixtureAssistantReply(message) };
  try {
    return { status: 200, payload: await callGrok({ message, context: body.context, history: body.history }, { apiKey, model }) };
  } catch (error) {
    onFallback?.(error);
    return { status: 200, payload: fixtureAssistantReply(message) };
  }
}

export { fixtureAssistantReply, sanitizeContext, sanitizeHistory };
