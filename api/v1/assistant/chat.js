/**
 * Vercel serverless — POST /api/v1/assistant/chat for Reporting (LIQ-24).
 * Uses XAI_API_KEY when set; otherwise demo fixtures. Logic: server/assistant.mjs.
 */
import { answerAssistant } from "../../../server/assistant.mjs";

const apiKey = (process.env.XAI_API_KEY ?? "").trim();
const model = (process.env.XAI_MODEL ?? "").trim() || "grok-4-fast-non-reasoning";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
    const { status, payload } = await answerAssistant(body, { apiKey, model });
    res.status(status).json(payload);
  } catch {
    res.status(400).json({ error: "invalid_json" });
  }
}
