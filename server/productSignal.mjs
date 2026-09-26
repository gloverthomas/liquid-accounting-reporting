const LIQ_TEAM_ID = "5389dda4-1725-4096-9ecb-a24a378b28c6";
const PARITY_PROJECT_ID = "555e1574-8669-4119-94c5-f3584b2d9aaa";
const TODO_STATE_ID = (process.env.LINEAR_TODO_STATE_ID ?? "84569319-0517-4fd2-b04f-81c02d0f7192").trim();

export const ASSISTANT_CALC_ACCORDION_SEAM = "assistant-calculation-accordion";

const SEAMS = {
  [ASSISTANT_CALC_ACCORDION_SEAM]: {
    title: '[Hero] Reporting AI Assistant: "How this was calculated" accordion does not expand',
    description:
      "Reporting AI Assistant chat works (LIQ-24). The **How this was calculated** disclosure under replies does not expand when clicked. Core behaves correctly.",
  },
};

async function linearGql(apiKey, query, variables) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `linear_http_${response.status}`);
  }
  return json.data;
}

async function createLinearIssue(apiKey, hash) {
  const seam = SEAMS[hash];
  if (!seam) return null;

  const data = await linearGql(
    apiKey,
    `
    mutation SignalIssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url }
      }
    }
  `,
    {
      input: {
        teamId: LIQ_TEAM_ID,
        projectId: PARITY_PROJECT_ID,
        stateId: TODO_STATE_ID,
        title: seam.title,
        description: `${seam.description}\n\n---\nOpened from Reporting **product signal** (\`${hash}\`).`,
      },
    },
  );

  const issue = data.issueCreate?.issue;
  if (!data.issueCreate?.success || !issue) return null;
  return issue;
}

async function linearComment(apiKey, issueId, body) {
  await linearGql(
    apiKey,
    `
    mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }
  `,
    { input: { issueId, body } },
  );
}

/** Forward to liquid-workflow /signal when configured. */
async function forwardWorkflow(body) {
  const url = (process.env.WORKFLOW_SIGNAL_URL ?? process.env.VITE_WORKFLOW_SIGNAL_URL ?? "").trim();
  if (!url) return null;
  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, json: JSON.parse(text) };
  } catch {
    return { status: response.status, json: { raw: text } };
  }
}

/**
 * Product signal triage: workflow /signal first, else direct Linear create (demo fallback).
 */
export async function handleProductSignal(payload) {
  const hash = typeof payload.hash === "string" ? payload.hash.trim() : "";
  const source = typeof payload.source === "string" ? payload.source : "reporting";
  const reportingUrl = typeof payload.reportingUrl === "string" ? payload.reportingUrl : undefined;

  const body = {
    hash,
    source,
    reportingUrl,
    title: SEAMS[hash]?.title,
  };

  const forwarded = await forwardWorkflow(body);
  if (forwarded && forwarded.status >= 200 && forwarded.status < 300) {
    return { ok: true, via: "workflow", ...forwarded.json };
  }

  const apiKey = (process.env.LINEAR_API_KEY ?? "").trim();
  if (!apiKey || !hash || !SEAMS[hash]) {
    return {
      ok: false,
      error: "signal_unconfigured",
      workflowStatus: forwarded?.status,
    };
  }

  const issue = await createLinearIssue(apiKey, hash);
  if (!issue) {
    return { ok: false, error: "linear_create_failed" };
  }

  await linearComment(
    apiKey,
    issue.id,
    [
      "## Product signal received",
      "",
      `- Source: \`${source}\``,
      `- Seam: \`${hash}\``,
      reportingUrl ? `- URL: ${reportingUrl}` : null,
      "",
      "Assigned for triage (**Todo**). Move to **In Progress** to start the Cursor SDK plan.",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return {
    ok: true,
    via: "linear_direct",
    issue: { identifier: issue.identifier, title: issue.title, url: issue.url },
  };
}
