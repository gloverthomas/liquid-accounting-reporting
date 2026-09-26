/**
 * Vercel serverless — POST /api/v1/assistant/chat for Reporting (LIQ-24).
 * Uses XAI_API_KEY when set; otherwise demo fixtures. Logic: server/assistant.mjs.
 * Public endpoint (the demo app has no sign-in), so server/assistantGuard.mjs
 * limits it to same-site browser requests, rate-limits per IP and caps Grok spend.
 */
import { answerAssistant } from "../../../server/assistant.mjs";
import { checkRequest, takeGrokBudget } from "../../../server/assistantGuard.mjs";

const apiKey = (process.env.XAI_API_KEY ?? "").trim();
const model = (process.env.XAI_MODEL ?? "").trim() || "grok-4-fast-non-reasoning";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const refused = checkRequest({ headers: req.headers, bodyBytes: Buffer.byteLength(raw) });
  if (refused) {
    res.status(refused.status).json({ error: refused.error });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
    const { status, payload } = await answerAssistant(body, { apiKey, model, allowGrok: takeGrokBudget });
    res.status(status).json(payload);
  } catch {
    res.status(400).json({ error: "invalid_json" });
  }
}
