import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { employee, sendToEmployee } from "@/lib/ikamva/workspace-adapter";
import { workforceApi } from "@/lib/ikamva/api-client";
import type { ChatMessage } from "@/lib/ikamva/types";

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-current"
            style={{ animation: `ikamva-dot 1.2s ${i * 0.15}s infinite ease-in-out` }}
          />
        ))}
      </span>
      {label}
    </p>
  );
}

export function EmployeeChat({ suggestions = [] }: { suggestions?: string[] }) {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="w-full">
      {historyLoading && (
        <div className="mb-6 flex items-center justify-center py-4 text-sm text-muted-foreground" role="status">
          Loading conversation history…
        </div>
      )}
      {messages.length > 0 && (
        <div className="mb-6 flex flex-col gap-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("animate-fade-in flex", m.role === "client" ? "justify-end" : "justify-start")}
            >
              {m.role === "client" ? (
                <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                  {m.body}
                </p>
              ) : (
                <div className="max-w-[90%] min-w-0">
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {employee.name}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">{m.body}</p>
                </div>
              )}
            </div>
          ))}
          {pending && <ThinkingIndicator label={`${employee.name} is thinking`} />}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="glass-strong rounded-3xl p-2.5 transition-shadow focus-within:ring-2 focus-within:ring-ring/60"
      >
        <label htmlFor="ask-employee" className="sr-only">
          Ask {employee.name}
        </label>
        <textarea
          id="ask-employee"
          ref={inputRef}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`Ask ${employee.name} anything…`}
          className="w-full resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            disabled
            title="Attachments arrive with the file pipeline"
            className="rounded-full p-2 text-muted-foreground/60"
            aria-label="Attach a file (coming soon)"
          >
            <Paperclip className="size-4" />
          </button>
          <button
            type="submit"
            disabled={!value.trim() || pending}
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>

      {suggestions.length > 0 && messages.length === 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setValue(s);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
