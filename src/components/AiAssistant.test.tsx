import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiAssistant } from "./AiAssistant";
import { resetProductSignalsForTests } from "../productSignal";

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
    localStorage.clear();
    resetProductSignalsForTests();
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
    expect(screen.queryByText(/via fixture/i)).not.toBeInTheDocument();

    await user.click(accordion);
    expect(accordion).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Compared June income/i)).toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", { name: /How does this quarter compare to last\?/i }),
    ).not.toBeInTheDocument();
  });

  it("clears the thread with New chat", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(screen.getByRole("button", { name: /New chat/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );
    await screen.findByText(/Income is up versus last quarter/i);

    await user.click(screen.getByRole("button", { name: /New chat/i }));
    expect(screen.getByRole("heading", { name: /Hello Jordan/i })).toBeInTheDocument();
    expect(screen.queryByText(/Income is up versus last quarter/i)).not.toBeInTheDocument();
  });

  it("does not file a signal when History is empty", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "History" }));

    expect(screen.getByText(/No chats yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides a saved chat and files one product signal", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk();
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );
    await screen.findByText(/Income is up versus last quarter/i);

    const history = screen.getByRole("button", { name: "History" });
    await user.click(history);

    expect(screen.getByRole("alert")).toHaveTextContent(/Chat history failed to appear/i);
    expect(screen.queryByRole("list", { name: "Chat history" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /How does this quarter compare to last\?/i }),
    ).not.toBeInTheDocument();

    const signalCalls = () =>
      fetchMock.mock.calls.filter((call) => call[0] === "/api/v1/product/signal");
    await vi.waitFor(() => expect(signalCalls()).toHaveLength(1));

    await user.click(history);
    await user.click(history);
    expect(signalCalls()).toHaveLength(1);

    const body = JSON.parse(String((signalCalls()[0][1] as RequestInit).body));
    expect(body.hash).toBe("assistant-chat-history");
    expect(body.source).toBe("reporting:ai-assistant");
  });

  it("shows a render error and files a product signal when related questions fail", async () => {
    const user = userEvent.setup();
    const fetchMock = mockChatOk({ relatedQuestions: [] });
    vi.stubGlobal("fetch", fetchMock);

    render(<AiAssistant open onClose={() => undefined} />);
    await user.click(
      screen.getByRole("button", { name: /How does this quarter compare to last\?/i }),
    );
    await screen.findByText(/Income is up versus last quarter/i);

    expect(screen.getByRole("alert")).toHaveTextContent(/related questions failed to render/i);
    expect(screen.queryByLabelText(/Related questions/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /What drove the increase\?/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /How does this quarter compare to last\?/i }),
    ).not.toBeInTheDocument();

    const signalCall = fetchMock.mock.calls.find((call) => call[0] === "/api/v1/product/signal");
    expect(signalCall).toBeTruthy();
    const body = JSON.parse(String((signalCall?.[1] as RequestInit).body));
    expect(body.hash).toBe("assistant-related-questions");
    expect(body.source).toBe("reporting:ai-assistant");
  });

  it("surfaces API failures as an alert", async () => {
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

  describe("usage outcomes (analytics, never message text)", () => {
    const ask = async (props: Partial<Parameters<typeof AiAssistant>[0]> = {}) => {
      const user = userEvent.setup();
      const onMessageOutcome = vi.fn();
      render(<AiAssistant open onClose={() => undefined} onMessageOutcome={onMessageOutcome} {...props} />);
      await user.type(screen.getByLabelText(/Ask the AI assistant/i), "What's my gross profit margin?{Enter}");
      return onMessageOutcome;
    };

    it("reports 'answered' after a successful reply", async () => {
      vi.stubGlobal("fetch", mockChatOk());
      const onMessageOutcome = await ask();
      expect(await screen.findByText(/Income is up/)).toBeInTheDocument();
      expect(onMessageOutcome).toHaveBeenCalledTimes(1);
      expect(onMessageOutcome).toHaveBeenCalledWith("answered");
    });

    it("reports 'failed' when the BFF errors", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "assistant_failed" }) }));
      const onMessageOutcome = await ask();
      await screen.findByRole("alert").catch(() => undefined);
      await vi.waitFor(() => expect(onMessageOutcome).toHaveBeenCalledWith("failed"));
      expect(onMessageOutcome).not.toHaveBeenCalledWith("answered");
    });
  });
});
