/**
 * Demo bridge: Reporting chrome failure → liquid-workflow /signal.
 */
async function postSignal(body: Record<string, unknown>): Promise<{ ok: boolean; detail?: string }> {
  const endpoint =
    import.meta.env.VITE_WORKFLOW_SIGNAL_URL?.trim() || "http://127.0.0.1:4100/signal";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        ...body,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
    if (!response.ok) {
      return { ok: false, detail: (await response.text()).slice(0, 200) };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** LIQ-17 — Notifications dead in Reporting. */
export async function signalNotificationsIncident(args: {
  surface: "header";
}): Promise<{ ok: boolean; detail?: string }> {
  return postSignal({
    issueIdentifier: "LIQ-17",
    title: "[Hero] Notifications work in Core but are dead in Reporting",
    source: `notifications_${args.surface}`,
    hash: "notifications",
  });
}

