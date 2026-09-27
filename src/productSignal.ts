import { captureProductEvent, type PostHogLike } from "./analytics";
import { Sentry } from "./sentry";

export const ASSISTANT_CALC_ACCORDION_SEAM = "assistant-calculation-accordion";
export const ASSISTANT_RELATED_QUESTIONS_SEAM = "assistant-related-questions";

let accordionSignalSent = false;
let relatedQuestionsSignalSent = false;

/** Test-only. The page files each seam once per load. */
export function resetProductSignalsForTests(): void {
  accordionSignalSent = false;
  relatedQuestionsSignalSent = false;
}

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
