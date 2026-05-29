import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! ScrumRadar 어시스턴트입니다.\n\nScrumRadar 사용 방법이나 개발 관련 궁금한 점을 물어보세요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const historyForApi = messages
    .filter((m) => m.id !== "welcome")
    .map(({ role, content }) => ({ role, content }));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { id: uid(), role: "user", content: text }]);
    setLoading(true);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase 설정이 필요합니다. .env.local 을 확인하세요.");
      }

      const supabase = getSupabase();
      const { data, error: fnError } = await supabase.functions.invoke("chat-rag", {
        body: { message: text, history: historyForApi },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const reply = String(data?.reply ?? "");
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "안녕하세요! ScrumRadar 어시스턴트입니다.\n\nScrumRadar 사용 방법이나 개발 관련 궁금한 점을 물어보세요.",
      },
    ]);
    setError(null);
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      <div className="fixed bottom-5 right-5 z-50">
        <AnimatePresence>
          {!open && (
            <motion.button
              key="chat-toggle"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setOpen(true)}
              aria-label="ScrumRadar 어시스턴트 열기"
              className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <MessageCircle className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* 채팅 패널 */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="chat-panel"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="flex w-[360px] flex-col overflow-hidden rounded-2xl border shadow-2xl"
              style={{
                height: 520,
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              {/* 헤더 */}
              <div
                className="flex flex-shrink-0 items-center gap-2.5 border-b px-4 py-3"
                style={{
                  background: "var(--primary)",
                  borderColor: "transparent",
                }}
              >
                <Bot className="h-4 w-4 flex-shrink-0 text-white" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">ScrumRadar 어시스턴트</div>
                  <div className="text-[10px] text-white/70">사용 방법 · 개발 가이드</div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="대화 초기화"
                  className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 메시지 영역 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}

                {loading && (
                  <div className="flex items-start gap-2">
                    <div
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div
                      className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-3 py-2"
                      style={{ background: "var(--muted)" }}
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--muted-foreground)" }} />
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        답변 생성 중…
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      borderColor: "rgba(239,68,68,0.25)",
                      color: "#ef4444",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* 입력 영역 */}
              <div
                className="flex flex-shrink-0 items-end gap-2 border-t px-3 py-2.5"
                style={{ borderColor: "var(--border)" }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="질문을 입력하세요… (Enter 전송, Shift+Enter 줄바꿈)"
                  rows={1}
                  disabled={loading}
                  className={cn(
                    "flex-1 resize-none rounded-xl border px-3 py-2 text-xs leading-relaxed outline-none transition-colors",
                    "disabled:opacity-50"
                  )}
                  style={{
                    background: "var(--input, var(--background))",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                    maxHeight: 96,
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || loading}
                  aria-label="전송"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-40"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-2">
        <div
          className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {message.content}
        </div>
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
        >
          <User className="h-3.5 w-3.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed"
        style={{ background: "var(--muted)", color: "var(--foreground)" }}
      >
        {message.content}
      </div>
    </div>
  );
}
