/**
 * Liquid Reporting BFF — loopback only. Report fixtures plus
 * POST /api/v1/assistant/chat (Grok via xAI when XAI_API_KEY is set; else fixture).
 */
import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { answerAssistant } from "./assistant.mjs";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4001", 10);
const allowedOrigin = process.env.LIQUID_REPORTING_APP_ORIGIN ?? "http://localhost:3001";
const expectedToken = process.env.LIQUID_BFF_DEMO_TOKEN;
const requestsByIp = new Map();
const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 120;
const maxBodyBytes = 16 * 1024;
const xaiApiKey = (process.env.XAI_API_KEY ?? "").trim();
const xaiModel = (process.env.XAI_MODEL ?? "").trim() || "grok-4-fast-non-reasoning";

if (!["development", "test"].includes(process.env.NODE_ENV)) {
  throw new Error("This synthetic BFF may only run with NODE_ENV set to development or test.");
}

if (!expectedToken || expectedToken.length < 16) {
  throw new Error("LIQUID_BFF_DEMO_TOKEN must be set to a value of at least 16 characters.");
}

const organisation = {
  id: "org_liquid_coffee",
  name: "Liquid Coffee Co.",
  role: "Owner",
};

const routes = {
  "/health": { status: "ok", service: "liquid-reporting-bff" },
  "/api/v1/organisation": organisation,
  "/api/v1/reports/profit-loss": {
    organisationId: organisation.id,
    period: "2026-04-01/2026-09-30",
    income: 104390,
    expenses: 61547.27,
    netProfit: 42842.73,
  },
  "/api/v1/reports/cash-flow": {
    organisationId: organisation.id,
    period: "2026-04-01/2026-09-30",
    openingCash: 38000,
    netCashMovement: 13392,
    closingCash: 51392,
  },
};

function sendJson(response, statusCode, requestId, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-Id": requestId,
  });
  response.end(JSON.stringify({ requestId, ...payload }));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(new Error("body_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function tokenMatches(authorization) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function withinRateLimit(ip) {
  const now = Date.now();
  const recentRequests = (requestsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < rateLimitWindowMs);
  if (recentRequests.length >= rateLimitMaxRequests) return false;
  recentRequests.push(now);
  requestsByIp.set(ip, recentRequests);
  if (requestsByIp.size > 1_000) {
    requestsByIp.delete(requestsByIp.keys().next().value);
  }
  return true;
}

const server = createServer(async (request, response) => {
  const requestId = randomUUID();
  const origin = request.headers.origin;
  const ip = request.socket.remoteAddress ?? "unknown";
  const path = new URL(request.url, `http://${host}`).pathname;

  if (origin && origin !== allowedOrigin) {
    sendJson(response, 403, requestId, { error: "origin_not_allowed" });
    return;
  }

  if (origin) response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (!withinRateLimit(ip)) {
    sendJson(response, 429, requestId, { error: "rate_limit_exceeded" });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (!tokenMatches(request.headers.authorization)) {
    console.info(JSON.stringify({ event: "authentication_failure", requestId, route: path }));
    sendJson(response, 401, requestId, { error: "unauthorized" });
    return;
  }

  if (request.method === "POST" && path === "/api/v1/assistant/chat") {
    let body;
    try {
      const raw = await readBody(request);
      body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      sendJson(response, 400, requestId, { error: "invalid_body" });
      return;
    }
    const { status, payload } = await answerAssistant(body, {
      apiKey: xaiApiKey,
      model: xaiModel,
      onFallback: (err) =>
        console.info(JSON.stringify({ event: "assistant_grok_fallback", requestId, error: err instanceof Error ? err.message.slice(0, 80) : "unknown" })),
    });
    console.info(JSON.stringify({ event: "assistant_chat", requestId, status, provider: payload.provider ?? null, hasKey: Boolean(xaiApiKey) }));
    sendJson(response, status, requestId, payload);
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, requestId, { error: "method_not_allowed" });
    return;
  }

  const payload = routes[path];
  if (!payload) {
    sendJson(response, 404, requestId, { error: "not_found" });
    return;
  }

  console.info(JSON.stringify({ event: "request_success", requestId, route: path }));
  sendJson(response, 200, requestId, payload);
});

server.listen(port, host, () => {
  console.info(JSON.stringify({ event: "server_started", service: "liquid-reporting-bff", host, port, assistant: xaiApiKey ? "grok" : "fixture" }));
});
