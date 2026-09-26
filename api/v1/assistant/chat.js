/**
 * Vercel serverless — POST /api/v1/assistant/chat for Reporting.
 * Uses XAI_API_KEY when set; otherwise demo fixtures. Logic: server/assistant.mjs.
 *
 * Public endpoint (the demo app has no sign-in), so, in order:
 * 1. server/assistantGuard.mjs: same-site browser requests only, per-IP rate
 *    limit, body cap.
 * 2. Vercel BotID: headers can be forged, so the request must also come from a
 *    verified browser session. Bots get 403. If BotID itself errors, the answer
 *    comes from demo fixtures (the xAI key is never spent unverified).
 * 3. A daily Grok budget, after which answers come from fixtures.
 */
import { checkBotId } from "botid/server";
import { answerAssistant } from "../../../server/assistant.mjs";
import { checkRequest, takeGrokBudget } from "../../../server/assistantGuard.mjs";

const apiKey = (process.env.XAI_API_KEY ?? "").trim();
const model = (process.env.XAI_MODEL ?? "").trim() || "grok-4-fast-non-reasoning";

/** "human" | "bot" | "unknown" (BotID unavailable). */
async function botVerdict(headers) {
  try {
    const result = await checkBotId({ advancedOptions: { headers } });
    return result.isBot ? "bot" : "human";
  } catch {
    return "unknown";
  }
}

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
  const verdict = await botVerdict(req.headers);
  if (verdict === "bot") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
    const allowGrok = () => verdict === "human" && takeGrokBudget();
    const { status, payload } = await answerAssistant(body, { apiKey, model, allowGrok });
    res.status(status).json(payload);
  } catch {
    res.status(400).json({ error: "invalid_json" });
  }
}
