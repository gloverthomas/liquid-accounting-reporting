/*
  This is the Reporting AI Assistant. History does not list the saved chat. It says chat history failed to appear.
  That posts the product signal once when History is open and a saved chat exists. An empty History, with no saved chat, does not file. Related questions that fail to render also post once, after Grok has replied and Send is idle. Welcome chips on an empty thread do not file. Send and New chat still work.
  Next: the browser posts the product signal. This file does not create the Todo ticket.
*/

import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Clock3,
  Copy,
  CornerDownRight,
  ExternalLink,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import liquidMark from "../assets/liquid-mark.png";
import { chatTitle, loadChats, rememberChat, type StoredChat } from "../assistantHistory";
import { reportAssistantChatHistoryFailed, reportAssistantRelatedQuestionsFailed } from "../productSignal";

export type AssistantTable = {
  headers: string[];
  rows: string[][];
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  table?: AssistantTable | null;
  cta?: { label: string; href: string } | null;
  provider?: string;
  rationale?: string;
  relatedQuestions?: string[];
};

type ChatResponse = {
  reply?: string;
  table?: AssistantTable | null;
  cta?: { label: string; href: string } | null;
  provider?: string;
  rationale?: string;
  relatedQuestions?: string[];
  error?: string;
};

const WELCOME_SUGGESTIONS = [
  "How does this quarter compare to last?",
  "What's my gross profit margin?",
  "What are my biggest income sources?",
];

type Props = {
  open: boolean;
  onClose: () => void;
  contextLabel?: string;
  userName?: string;
  /** Reports each message's outcome (answered/failed) for usage analytics; never the message text. */
  onMessageOutcome?: (outcome: "answered" | "failed") => void;
};

function newId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function safeCtaHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function normalizeTable(table: unknown): AssistantTable | null {
  if (!table || typeof table !== "object") return null;
  const candidate = table as { headers?: unknown; rows?: unknown };
  if (!Array.isArray(candidate.headers) || !Array.isArray(candidate.rows)) return null;
  return {
    headers: candidate.headers.map((h) => String(h)),
    rows: candidate.rows.map((row) => (Array.isArray(row) ? row.map((c) => String(c)) : [])),
  };
}

const MAX_RELATED_CHARS = 500;

function normalizeRelated(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const text = String(item ?? "")
      .trim()
      .slice(0, MAX_RELATED_CHARS);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= 3) break;
  }
  return out;
}

/** Lightweight safe markdown: paragraphs, numbered/bulleted lists, **bold**. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-b-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part ? <span key={`${keyPrefix}-t-${index}`}>{part}</span> : null;
  });
}

function AssistantMarkdown({ text }: { text: string }) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\s+(\d+)\.\s+/g, "\n$1. ")
    .replace(/\s+[-•]\s+/g, "\n- ")
    .trim();

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks: ReactNode[] = [];
  let listItems: { kind: "ol" | "ul"; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!listItems) return;
    const Tag = listItems.kind === "ol" ? "ol" : "ul";
    blocks.push(
      <Tag key={key} className="ai-md-list">
        {listItems.items.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
        ))}
      </Tag>,
    );
    listItems = null;
  };

  lines.forEach((line, index) => {
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    const bullet = line.match(/^[-•]\s+(.*)$/);
    if (ordered) {
      if (!listItems || listItems.kind !== "ol") {
        flushList(`list-pre-${index}`);
        listItems = { kind: "ol", items: [] };
      }
      listItems.items.push(ordered[1]);
      return;
    }
    if (bullet) {
      if (!listItems || listItems.kind !== "ul") {
        flushList(`list-pre-${index}`);
        listItems = { kind: "ul", items: [] };
      }
      listItems.items.push(bullet[1]);
      return;
    }
    flushList(`list-pre-${index}`);
    blocks.push(
      <p key={`p-${index}`} className="ai-md-p">
        {renderInline(line, `p-${index}`)}
      </p>,
    );
  });
  flushList("list-end");

  return <div className="ai-md">{blocks}</div>;
}

function CalculationAccordion({
  provider,
  rationale,
}: {
  provider?: string;
  rationale: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`ai-calc${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ai-calc-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ai-calc-toggle-main">
          <Sparkles size={14} aria-hidden="true" />
          How this was calculated
        </span>
        <ChevronDown size={16} className="ai-calc-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="ai-calc-panel">
          <p>{rationale}</p>
          <p className="ai-calc-complete">
            <Sparkles size={12} aria-hidden="true" /> Complete
          </p>
          {provider ? <p className="ai-provider-foot">via {provider}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ChatHistoryPanel({ missing }: { missing: boolean }) {
  return (
    <div className="ai-history">
      <h3>Chat history</h3>
      {missing ? (
        <p className="ai-error" role="alert">
          Chat history failed to appear.
        </p>
      ) : (
        <p className="ai-history-empty">No chats yet. Send a question, then open History.</p>
      )}
    </div>
  );
}

export function AiAssistant({
  open,
  onClose,
  contextLabel = "Dashboard",
  userName = "Jordan",
  onMessageOutcome,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationId = useRef(newId());
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState(contextLabel);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chats, setChats] = useState<StoredChat[]>(() => loadChats());

  useEffect(() => {
    setContext(contextLabel);
  }, [contextLabel]);

  useEffect(() => {
    if (!messages.some((message) => message.role === "user")) return;
    setChats(
      rememberChat({
        id: conversationId.current,
        title: chatTitle(messages),
        updatedAt: Date.now(),
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.text,
          relatedQuestions: message.relatedQuestions,
        })),
      }),
    );
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    queueMicrotask(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, error]);

  const footerChips = useMemo(() => {
    if (messages.length === 0) {
      return { mode: "welcome" as const, questions: WELCOME_SUGGESTIONS };
    }
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") {
        const questions = message.relatedQuestions ?? [];
        return { mode: "related" as const, questions };
      }
    }
    return { mode: "welcome" as const, questions: WELCOME_SUGGESTIONS };
  }, [messages]);

  const hasAssistantReply = messages.some((message) => message.role === "assistant");
  const relatedQuestionsFailed =
    hasAssistantReply &&
    !busy &&
    footerChips.mode === "related" &&
    footerChips.questions.length === 0;

  /*
    Related questions failed to render: Grok has replied, Send is idle, and there are no follow-up chips.
    That posts the product signal once. Send and New chat still work.
    Welcome chips on an empty thread do not file. An empty state does not file.
  */
  useEffect(() => {
    if (!relatedQuestionsFailed) return;
    reportAssistantRelatedQuestionsFailed(null);
  }, [relatedQuestionsFailed]);

  const historyMissing = historyOpen && chats.some((chat) => chat.messages.length > 0);

  /*
    Chat history failed to appear: History is open and a saved chat exists, but the panel does not list it.
    That posts the product signal once. An empty History, with no saved chat, does not file.
    Send and New chat still work.
  */
  useEffect(() => {
    if (!historyMissing) return;
    reportAssistantChatHistoryFailed(null);
  }, [historyMissing]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setHistoryOpen(false);
      setError(null);
      setDraft("");
      const userMsg: AssistantMessage = { id: newId(), role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setBusy(true);

      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch("/api/v1/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            context,
            history: messages.slice(-6).map((m) => ({ role: m.role, content: m.text })),
          }),
          signal: abortControllerRef.current.signal,
        });
        const data = (await res.json()) as ChatResponse;
        if (!res.ok) {
          throw new Error(data.error ?? `assistant_http_${res.status}`);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: data.reply ?? "I could not generate a reply.",
            table: normalizeTable(data.table),
            cta: data.cta
              ? (() => {
                  const href = safeCtaHref(data.cta?.href);
                  if (!href || !data.cta?.label) return null;
                  return { label: String(data.cta.label), href };
                })()
              : null,
            provider: data.provider,
            rationale:
              typeof data.rationale === "string" && data.rationale.trim()
                ? data.rationale.trim()
                : "Answered from Liquid Coffee Co. demo books for this page context.",
            relatedQuestions: normalizeRelated(data.relatedQuestions),
          },
        ]);
        onMessageOutcome?.("answered");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        onMessageOutcome?.("failed");
        setError(err instanceof Error ? err.message : "assistant_failed");
      } finally {
        setBusy(false);
        abortControllerRef.current = null;
      }
    },
    [busy, context, messages, onMessageOutcome],
  );

  if (!open) return null;

  const empty = messages.length === 0;

  return (
    <aside
      className="ai-assistant"
      role="complementary"
      aria-labelledby={titleId}
    >
      <header className="ai-assistant-header">
        <div className="ai-assistant-title">
          <img className="ai-brand-mark" src={liquidMark} alt="" width={18} height={18} />
          <h2 id={titleId}>AI Assistant</h2>
          <span className="ai-assistant-beta">Beta</span>
        </div>
        <div className="ai-assistant-header-actions">
          <button
            type="button"
            className="ai-icon-btn"
            aria-label="History"
            aria-pressed={historyOpen}
            onClick={() => setHistoryOpen((value) => !value)}
          >
            <Clock3 size={16} />
          </button>
          <button
            type="button"
            className="ai-icon-btn"
            aria-label="New chat"
            onClick={() => {
              abortControllerRef.current?.abort();
              abortControllerRef.current = null;
              conversationId.current = newId();
              setMessages([]);
              setError(null);
              setBusy(false);
              setHistoryOpen(false);
            }}
          >
            <Plus size={16} />
          </button>
          <button type="button" className="ai-icon-btn" aria-label="Pop out" disabled>
            <ExternalLink size={16} />
          </button>
          <button type="button" className="ai-icon-btn" aria-label="Close assistant" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="ai-assistant-body" ref={scrollerRef}>
        {historyOpen ? (
          <ChatHistoryPanel missing={historyMissing} />
        ) : empty ? (
          <div className="ai-assistant-welcome">
            <img className="ai-welcome-mark" src={liquidMark} alt="" width={40} height={40} />
            <h3>Hello {userName}!</h3>
            <p>How can I help you today?</p>
          </div>
        ) : (
          <ul className="ai-message-list">
            {messages.map((message) => (
              <li key={message.id} className={`ai-message ai-message-${message.role}`}>
                {message.role === "user" ? (
                  <div className="ai-bubble-user">{message.text}</div>
                ) : (
                  <div className="ai-bubble-assistant">
                    <AssistantMarkdown text={message.text} />
                    {message.table ? (
                      <div className="ai-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {message.table.headers.map((header, headerIndex) => (
                                <th key={`${message.id}-h-${headerIndex}`} scope="col">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {message.table.rows.map((row, index) => (
                              <tr key={`${message.id}-row-${index}`}>
                                {row.map((cell, cellIndex) => (
                                  <td key={`${message.id}-${index}-${cellIndex}`}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {message.cta ? (
                      <a className="ai-cta" href={message.cta.href}>
                        {message.cta.label} <ArrowRight size={14} />
                      </a>
                    ) : null}
                    <div className="ai-feedback" aria-label="Response actions">
                      <button type="button" aria-label="Helpful" disabled>
                        <ThumbsUp size={14} />
                      </button>
                      <button type="button" aria-label="Not helpful" disabled>
                        <ThumbsDown size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Copy"
                        onClick={() => {
                          void navigator.clipboard.writeText(message.text).catch(() => undefined);
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    {message.rationale ? (
                      <CalculationAccordion
                        provider={message.provider}
                        rationale={message.rationale}
                      />
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {busy ? (
          <p className="ai-typing" role="status">
            Thinking…
          </p>
        ) : null}
        {error ? <p className="ai-error" role="alert">{error}</p> : null}
      </div>

      <footer className="ai-assistant-footer">
        {relatedQuestionsFailed ? (
          <p className="ai-error" role="alert">
            Related questions failed to render.
          </p>
        ) : null}
        {!busy && footerChips.questions.length > 0 ? (
          <div
            className="ai-related"
            aria-label={footerChips.mode === "welcome" ? "Suggested questions" : "Related questions"}
          >
            {footerChips.questions.map((question, index) => (
              <button
                key={`${footerChips.mode}-${index}-${question.slice(0, 32)}`}
                type="button"
                onClick={() => void send(question)}
              >
                <CornerDownRight size={14} aria-hidden="true" />
                <span>{question}</span>
              </button>
            ))}
          </div>
        ) : null}
        {context ? (
          <div className="ai-context">
            <span>Asking about: {context}</span>
            <button type="button" aria-label="Clear context" onClick={() => setContext("")}>
              <X size={12} />
            </button>
          </div>
        ) : null}
        <div className="ai-composer">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Ask anything..."
            value={draft}
            aria-label="Ask the AI assistant"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <button
            type="button"
            className="ai-send"
            aria-label="Send"
            disabled={busy || !draft.trim()}
            onClick={() => void send(draft)}
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="ai-disclaimer">All responses may be inaccurate. Verify important information.</p>
      </footer>
    </aside>
  );
}
