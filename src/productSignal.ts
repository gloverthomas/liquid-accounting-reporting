/*
  This file posts a product signal from the browser. The POST to /api/v1/product/signal is the product signal. It does not create the Linear ticket.
  Each hash posts once per page load. A later call in that load still notes PostHog and Sentry, and does not POST again. assistant-answer-table runs when an answer failed to render as a table. assistant-related-questions runs when related questions failed to render. assistant-calculation-accordion is defined here, and nothing in this checkout calls it.
  Next: the Reporting server forwards the hash to the workflow. The workflow opens a Todo ticket.
*/

import { captureProductEvent, type PostHogLike } from "./analytics";
import { Sentry } from "./sentry";

export const ASSISTANT_CALC_ACCORDION_SEAM = "assistant-calculation-accordion";
export const ASSISTANT_RELATED_QUESTIONS_SEAM = "assistant-related-questions";
export const ASSISTANT_ANSWER_TABLE_SEAM = "assistant-answer-table";

let accordionSignalSent = false;
let relatedQuestionsSignalSent = false;
let answerTableSignalSent = false;

/** Test-only. The page files each seam once per load. */
export function resetProductSignalsForTests(): void {
  accordionSignalSent = false;
  relatedQuestionsSignalSent = false;
  answerTableSignalSent = false;
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

/*
  Hash assistant-answer-table. Posts the product signal once per page load. Does not create the ticket.
  Runs when an answer failed to render as a table. A normal prose answer does not call this. Opening the assistant does not call this.
  Next: the Reporting server forwards this hash. The workflow opens a Todo with the table title, not “Product signal triage”.
*/
export function reportAssistantAnswerTableFailed(posthog: PostHogLike | null): void {
  captureProductEvent(posthog, "assistant_answer_table_failed", {
    source: "reporting",
  });

  Sentry.captureMessage("AI Assistant answer failed to render as a table", {
    level: "warning",
    tags: { app: "reporting", kind: "assistant-ui", seam: ASSISTANT_ANSWER_TABLE_SEAM },
  });

  if (answerTableSignalSent) return;
  answerTableSignalSent = true;

  void fetch("/api/v1/product/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash: ASSISTANT_ANSWER_TABLE_SEAM,
      source: "reporting:ai-assistant",
      reportingUrl: window.location.href,
    }),
  }).catch(() => {
    /* non-fatal — observability + Linear triage are best-effort from the browser */
  });
}
