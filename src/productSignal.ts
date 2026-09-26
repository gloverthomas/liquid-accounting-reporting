import { captureProductEvent, type PostHogLike } from "./analytics";
import { Sentry } from "./sentry";

export const ASSISTANT_CALC_ACCORDION_SEAM = "assistant-calculation-accordion";

let accordionSignalSent = false;

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
