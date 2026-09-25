import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiAssistant } from "./AiAssistant";

function mockChatOk(overrides: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      reply: "Income is up versus last quarter.",
      provider: "fixture",
      rationale: "Compared June income to the prior quarter in demo books.",
      relatedQuestions: ["What drove the increase?", "Show expense trend"],
      table: {
        headers: ["Quarter", "Income"],
        rows: [
          ["Q1", "$120k"],
          ["Q2", "$148k"],
        ],
      },
      ...overrides,
    }),
  });
}

describe("AiAssistant", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<AiAssistant open={false} onClose={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows welcome state with suggested questions", () => {
    render(<AiAssistant open onClose={() => undefined} />);
    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Hello Jordan/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    ).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AiAssistant open onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends a suggestion, renders reply, table, and closed calculation accordion", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} contextLabel="Reports" />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );

    expect(await screen.findByText(/Income is up versus last quarter/i)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();

    const accordion = screen.getByRole("button", { name: /How this was calculated/i });
    expect(accordion).toHaveAttribute("aria-expanded", "false");

    await user.click(accordion);
    expect(accordion).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/via fixture/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/assistant/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("replaces welcome chips with related questions after a reply", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockChatOk());

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );
    await screen.findByText(/Income is up versus last quarter/i);

    const related = screen.getByLabelText(/Related questions/i);
    expect(within(related).getByRole("button", { name: /What drove the increase\?/i })).toBeInTheDocument();
  });

  it("shows the intentional BFF miss and notifies triage when broken", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    const onBrokenFailure = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} broken onBrokenFailure={onBrokenFailure} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );

    const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(alert).toHaveTextContent(/never wired on this BFF/i);
    expect(onBrokenFailure).toHaveBeenCalledWith(expect.stringMatching(/never wired on this BFF/i));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("complementary")).toHaveAttribute("data-broken", "true");
  });

  it("surfaces API failures as an alert when the BFF is wired", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "assistant_unavailable" }),
      }),
    );

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/assistant_unavailable/i);
  });
});
