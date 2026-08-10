"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DOMPurify from "dompurify";
import { MessageCircle, Send, X, Loader2, Bot } from "lucide-react";
import { markdownToHtml } from "@/lib/chat-markdown";

// Kemi answers in Markdown. Render the small subset it uses (bold, lists, links) as HTML, then
// sanitize: DOMPurify strips anything not in this allow-list, and chat-markdown already escaped the
// raw text and restricted link hrefs. DOMPurify needs the DOM, so callers guard on a mounted flag.
function renderKemi(markdown: string): string {
  return DOMPurify.sanitize(markdownToHtml(markdown), {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "code", "ol", "ul", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_HREF = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I'd like to know more about KAT Learning.")}`
  : null;

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

type Message = {
  id: string;
  role: "user" | "model";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "What age groups do you accept?",
  "How does pricing work?",
  "What will my child learn?",
  "How do I enroll?",
];

const WELCOME: Message = {
  id: "welcome",
  role: "model",
  content:
    "Hi! I'm Kemi, KAT's enrollment assistant 👋\n\nI can answer questions about our programs, age tracks, class schedule, and how to get your child started. What would you like to know?",
};

export function EnrollmentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  // DOMPurify runs in the browser only; before mount, model messages fall back to plain text.
  const [mounted, setMounted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "model", content: "" }]);

    try {
      const res = await fetch("/api/chat/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: err.error ?? "Something went wrong. Please try again." }
              : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Network error. Please check your connection and try again." }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <>
      {/* Floating trigger button */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {!open && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setOpen(true)}
              className="group flex items-center gap-2.5 rounded-full bg-[var(--kat-clay)] px-5 py-3.5 font-display text-sm font-semibold text-[var(--kat-paper)] shadow-kat transition-colors hover:bg-[var(--kat-clay-deep)]"
              aria-label="Open enrollment assistant"
            >
              <MessageCircle className="size-5 shrink-0" />
              <span>Ask Kemi</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--kat-border)] bg-[var(--kat-raised)] shadow-kat-lg"
            style={{ maxHeight: "min(560px, calc(100dvh - 3rem))" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-[var(--kat-ink)] px-4 py-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--kat-clay)]">
                <Bot className="size-5 text-[var(--kat-paper)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-[var(--kat-paper)]">Kemi</p>
                <p className="font-mono text-[0.65rem] uppercase tracking-wider text-[var(--kat-paper)]/55">
                  Enrollment assistant
                </p>
              </div>
              {/* WhatsApp shortcut */}
              {WHATSAPP_HREF && (
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat on WhatsApp"
                  title="Chat on WhatsApp"
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <WhatsAppIcon className="size-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--kat-paper)]/70 transition-colors hover:bg-white/10 hover:text-[var(--kat-paper)]"
                aria-label="Close chat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "model" && (
                    <div className="mr-2 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--kat-clay)]">
                      <Bot className="size-3.5 text-[var(--kat-paper)]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 font-body text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-[var(--kat-clay)] text-[var(--kat-paper)]"
                        : "rounded-bl-sm bg-[var(--kat-paper)] text-[var(--kat-ink)]"
                    }`}
                  >
                    {msg.content ? (
                      msg.role === "model" && mounted ? (
                        // Rendered Markdown (bold, lists, clickable links). Sanitized in renderKemi.
                        <div
                          className="space-y-2 [&_a]:font-semibold [&_a]:text-[var(--kat-clay)] [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
                          dangerouslySetInnerHTML={{ __html: renderKemi(msg.content) }}
                        />
                      ) : (
                        <span className="whitespace-pre-line">{msg.content}</span>
                      )
                    ) : (
                      <span className="flex items-center gap-1.5 text-[var(--kat-muted)]">
                        <Loader2 className="size-3.5 animate-spin" />
                        Thinking…
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Suggested questions */}
              {showSuggestions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => void sendMessage(q)}
                      disabled={streaming}
                      className="rounded-full border border-[var(--kat-border)] bg-[var(--kat-paper)] px-3 py-1.5 text-xs font-medium text-[var(--kat-clay)] transition-colors hover:bg-[var(--kat-clay)] hover:text-[var(--kat-paper)] disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-[var(--kat-border)] p-3">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--kat-border)] bg-[var(--kat-paper)] px-3 py-2 transition-all focus-within:border-[var(--kat-clay)] focus-within:ring-2 focus-within:ring-[var(--kat-clay)]/15">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question…"
                  disabled={streaming}
                  className="flex-1 bg-transparent font-body text-sm text-[var(--kat-ink)] outline-none placeholder:text-[var(--kat-muted)] disabled:opacity-60"
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--kat-clay)] text-[var(--kat-paper)] transition-opacity hover:bg-[var(--kat-clay-deep)] disabled:opacity-40"
                  aria-label="Send"
                >
                  {streaming ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                </button>
              </div>
              <p className="mt-2 text-center font-mono text-[0.6rem] uppercase tracking-wider text-[var(--kat-muted)]">
                Powered by Gemini · AI can make mistakes
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
