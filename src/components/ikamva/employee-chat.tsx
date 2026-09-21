import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Paperclip, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { employee, sendToEmployee } from "@/lib/ikamva/workspace-adapter";
import { workforceApi } from "@/lib/ikamva/api-client";
import type { ChatMessage } from "@/lib/ikamva/types";
import { AgentThinkingLoader } from "./AgentThinkingLoader";

export function EmployeeChat({ suggestions = [] }: { suggestions?: string[] }) {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea dynamically based on content scrollHeight (min 44px, max 180px)
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), 180);
      textarea.style.height = `${nextHeight}px`;
    }
  }, [value]);

  // Scroll to bottom whenever messages or pending state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    let cancelled = false;
    void workforceApi.getChatHistory()
      .then(({ exchanges = [] }) => {
        if (cancelled) return;
        setMessages(exchanges.flatMap((exchange: { task_id: string; message: string; response: string }) => [
          { id: `${exchange.task_id}-client`, role: "client" as const, body: exchange.message },
          { id: `${exchange.task_id}-employee`, role: "employee" as const, body: exchange.response },
        ]));
      })
      .catch(error => {
        if (!cancelled) console.error("Unable to load chat history:", error);
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function submit() {
    const text = value.trim();
    if (!text || pending) return;
    setValue("");
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
    }
    setPending(true);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "client", body: text }]);

    const result = await sendToEmployee(text);
    setPending(false);

    if (result.connected) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "employee",
          body: result.response,
        },
      ]);
    } else {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "employee",
          phase: "paused",
          body: result.response || `${employee.name} could not complete that request.`,
        },
      ]);
    }
  }

  return (
    <div className="w-full flex flex-col">
      {historyLoading && (
        <div className="mb-6 flex items-center justify-center py-4 text-sm text-muted-foreground" role="status">
          Loading conversation history…
        </div>
      )}

      {messages.length > 0 && (
        <div className="mb-6 flex flex-col gap-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("animate-fade-in flex w-full", m.role === "client" ? "justify-end" : "justify-start")}
            >
              {m.role === "client" ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm break-words">
                  {m.body}
                </div>
              ) : (
                <div className="flex items-start gap-3 max-w-[90%] min-w-0">
                  <div className="size-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold text-white/90">
                    {employee.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground/90">{employee.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground uppercase font-medium tracking-wider">Manager</span>
                    </div>
                    <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                      {m.body}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <AgentThinkingLoader loading={pending} duration={1200} />
          <div ref={messagesEndRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="bg-[#242424]/90 border border-white/10 rounded-2xl p-2.5 shadow-xl focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all flex flex-col gap-1.5 mt-2"
      >
        <label htmlFor="ask-employee" className="sr-only">
          Ask {employee.name}
        </label>

        {/* Textarea takes full width with clean vertical growth up to 180px */}
        <textarea
          id="ask-employee"
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`Ask ${employee.name} anything...`}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="w-full resize-none bg-transparent px-2.5 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 max-h-[180px] overflow-y-auto text-foreground"
          style={{ minHeight: "44px" }}
        />

        {/* Dedicated bottom toolbar pinned strictly beneath textarea to prevent overlap */}
        <div className="flex items-center justify-between px-1 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="text-xs text-muted-foreground/90 border border-white/10 rounded-full px-2.5 py-0.5 cursor-pointer hover:bg-white/5 hover:text-foreground transition-colors flex items-center gap-1 font-medium"
              title="Operating Mode"
            >
              <span>Auto</span>
              <span className="text-[10px] opacity-60">⌄</span>
            </button>
            <button
              type="button"
              disabled
              title="Attachments arrive with the file pipeline"
              className="rounded-full p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
              aria-label="Attach a file"
            >
              <Paperclip className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="submit"
              disabled={!value.trim() && !pending}
              className="grid size-8 place-items-center rounded-full bg-white text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:bg-white/20 disabled:text-white/40 shadow-sm"
              aria-label={value.trim() ? "Send message" : "Voice input"}
            >
              {value.trim() ? <ArrowUp className="size-4 stroke-[2.5]" /> : <Mic className="size-4" />}
            </button>
          </div>
        </div>
      </form>

      {messages.length === 0 && (
        <div className="mt-8 px-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent chats</h3>
          <div className="flex flex-col gap-1">
            {[
              { title: "Daily Brief Review", time: "6:58 am" },
              { title: "Daily Brief Pre-Send Review", time: "Yesterday" },
              { title: "Checking Gmail Access", time: "Sep 6" },
              { title: "Daily Brief Report", time: "Sep 6" },
              { title: "Welcome to Ikamva!", time: "Sep 6" },
            ].map((chat, i) => (
              <div key={i} className="flex justify-between items-center text-sm text-foreground/85 hover:bg-white/5 p-2 rounded-lg cursor-pointer transition-colors group">
                <span className="truncate pr-4">{chat.title}</span>
                <div className="flex items-center gap-3 shrink-0 text-muted-foreground text-xs">
                  <span>{chat.time}</span>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
