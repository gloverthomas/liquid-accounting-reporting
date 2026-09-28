import { captureProductEvent, type PostHogLike } from "./analytics";
import { Sentry } from "./sentry";

/*
  Browser post for a product signal. The POST /api/v1/product/signal is the product signal.
  It does not create the Linear ticket by itself. Next: the Reporting server forwards the hash to the workflow /signal.
  The POST runs once per page load. A later call in that load still notes PostHog and Sentry, and does not POST again.

  assistant-calculation-accordion — How this was calculated did not expand. Nothing in this checkout calls that function.
  assistant-related-questions — related questions failed to render. The assistant calls this.
  assistant-chat-history — chat history failed to appear. The assistant calls this.
*/

export const ASSISTANT_CALC_ACCORDION_SEAM = "assistant-calculation-accordion";
export const ASSISTANT_RELATED_QUESTIONS_SEAM = "assistant-related-questions";
export const ASSISTANT_CHAT_HISTORY_SEAM = "assistant-chat-history";

let accordionSignalSent = false;
let relatedQuestionsSignalSent = false;
let chatHistorySignalSent = false;

/** Test-only. The page files each seam once per load. */
export function resetProductSignalsForTests(): void {
  accordionSignalSent = false;
  relatedQuestionsSignalSent = false;
  chatHistorySignalSent = false;
}

/* Hash assistant-calculation-accordion. Posts the product signal once per page load. Does not create the ticket. */
export function reportAssistantCalculationAccordionStuck(posthog: PostHogLike | null): void {
  captureProductEvent(posthog, "assistant_calculation_accordion_stuck", {
    source: "reporting",
  });

  Sentry.captureMessage("AI Assistant calculation accordion did not expand", {
    level: "warning",
    tags: { app: "reporting", kind: "assistant-ui", seam: ASSISTANT_CALC_ACCORDION_SEAM },
  });

  if (accordionSignalSent) return;
  accordionSignalSent = true;

  void fetch("/api/v1/product/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash: ASSISTANT_CALC_ACCORDION_SEAM,
      source: "reporting:ai-assistant",
      reportingUrl: window.location.href,
    }),
  }).catch(() => {
    /* non-fatal — observability + Linear triage are best-effort from the browser */
  });
}

/* Hash assistant-related-questions. Posts the product signal once per page load. Does not create the ticket. */
export function reportAssistantRelatedQuestionsFailed(posthog: PostHogLike | null): void {
  captureProductEvent(posthog, "assistant_related_questions_failed", {
    source: "reporting",
  });

  Sentry.captureMessage("AI Assistant related questions failed to render", {
    level: "warning",
    tags: { app: "reporting", kind: "assistant-ui", seam: ASSISTANT_RELATED_QUESTIONS_SEAM },
  });

  if (relatedQuestionsSignalSent) return;
  relatedQuestionsSignalSent = true;

  void fetch("/api/v1/product/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash: ASSISTANT_RELATED_QUESTIONS_SEAM,
      source: "reporting:ai-assistant",
      reportingUrl: window.location.href,
    }),
  }).catch(() => {
    /* non-fatal — observability + Linear triage are best-effort from the browser */
  });
}

/* Hash assistant-chat-history. Posts the product signal once per page load. Does not create the ticket. */
export function reportAssistantChatHistoryFailed(posthog: PostHogLike | null): void {
  captureProductEvent(posthog, "assistant_chat_history_failed", {
    source: "reporting",
  });

  Sentry.captureMessage("AI Assistant chat history failed to appear", {
    level: "warning",
    tags: { app: "reporting", kind: "assistant-ui", seam: ASSISTANT_CHAT_HISTORY_SEAM },
  });

  if (chatHistorySignalSent) return;
  chatHistorySignalSent = true;

  void fetch("/api/v1/product/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash: ASSISTANT_CHAT_HISTORY_SEAM,
      source: "reporting:ai-assistant",
      reportingUrl: window.location.href,
    }),
  }).catch(() => {
    /* non-fatal — observability + Linear triage are best-effort from the browser */
  });
}
