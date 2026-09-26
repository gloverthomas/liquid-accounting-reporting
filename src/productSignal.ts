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

  const signalUrl = import.meta.env.VITE_WORKFLOW_SIGNAL_URL?.trim();
  if (!signalUrl) return;

  void fetch(signalUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash: ASSISTANT_CALC_ACCORDION_SEAM,
      source: "reporting:ai-assistant",
      title: 'Reporting AI Assistant: "How this was calculated" accordion does not expand',
      reportingUrl: window.location.href,
    }),
  }).catch(() => {
    /* non-fatal — observability + Linear triage are best-effort from the browser */
  });
}
