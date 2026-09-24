/**
 * Demo bridge: Reporting chrome failure → liquid-workflow /signal (LIQ-16).
 */
export async function signalHelpCentreIncident(args: {
  surface: "sidebar" | "header";
}): Promise<{ ok: boolean; detail?: string }> {
  const endpoint =
    import.meta.env.VITE_WORKFLOW_SIGNAL_URL?.trim() || "http://127.0.0.1:4100/signal";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        issueIdentifier: "LIQ-16",
        title: "[Hero] Help centre works in Core but is dead in Reporting",
        source: `help_${args.surface}`,
        hash: "help-centre",
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
