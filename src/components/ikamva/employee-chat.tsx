import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, Paperclip, Plus, Plug, X, FileText, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { employee, sendToEmployee } from "@/lib/ikamva/workspace-adapter";
import { workforceApi } from "@/lib/ikamva/api-client";
import { fileToKnowledgePayload } from "@/lib/ikamva/file-upload";
import type { ChatMessage } from "@/lib/ikamva/types";
import { AgentThinkingLoader } from "./AgentThinkingLoader";
import { toast } from "sonner";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  content: string;
}

export function EmployeeChat({ suggestions = [] }: { suggestions?: string[] }) {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Quick connect popover state
  const [showConnectMenu, setShowConnectMenu] = useState(false);
  const [connectingTool, setConnectingTool] = useState(false);

  // Speech to text state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          setValue((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${currentTranscript.trim()}` : currentTranscript.trim();
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("[SpeechRecognition] Error:", event.error);
        if (event.error !== "no-speech") {
          toast.error(`Voice recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("[SpeechRecognition] Init error:", err);
      setSpeechSupported(false);
    }
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      toast("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        toast.info("Listening... speak into your microphone.");
      } catch (err: any) {
        console.error("[SpeechRecognition] Start error:", err);
        setIsListening(false);
      }
    }
  };

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File exceeds 10MB limit. Please attach a smaller file.");
      e.target.value = "";
      return;
    }

    // Validate extension
    const allowedExtensions = [".pdf", ".docx", ".doc", ".txt", ".csv", ".xlsx"];
    const hasValidExt = allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      toast.error("Unsupported file type. Please attach a PDF, DOCX, TXT, CSV, or XLSX file.");
      e.target.value = "";
      return;
    }

    setUploadingAttachment(true);
    try {
      const payload = await fileToKnowledgePayload(file);
      const newAttachment: AttachedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        content: payload.content || "",
      };
      setAttachments((prev) => [...prev, newAttachment]);
      toast.success(`Attached ${file.name}`);
    } catch (err: any) {
      console.error("Failed to parse attachment:", err);
      toast.error("Unable to read attachment. Please try another file.");
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleConnectGmail = async () => {
    try {
      setConnectingTool(true);
      const result = await workforceApi.connectGmail(window.location.pathname);
      const consentUrl = result.url || result.consent_url;
      if (!consentUrl) throw new Error("Gmail authorization URL was not returned.");
      window.location.href = consentUrl;
    } catch (err: any) {
      toast.error(err.message || "Unable to start Gmail connection.");
      setConnectingTool(false);
    }
  };

  async function submit() {
    const text = value.trim();
    if ((!text && attachments.length === 0) || pending) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const outgoingAttachments = [...attachments];
    const messageBody = text || (outgoingAttachments.length > 0 ? `[Attached ${outgoingAttachments.map(a => a.name).join(", ")}]` : "");

    setValue("");
    setAttachments([]);
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
    }
    setPending(true);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "client", body: messageBody }]);

    const result = await sendToEmployee(messageBody, outgoingAttachments);
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
    <div className="w-full flex flex-col h-[680px] max-h-[85vh] rounded-3xl border border-white/10 bg-[#121212]/80 backdrop-blur-2xl shadow-2xl overflow-hidden">
      {/* ── Chat Pinned Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1a1a1a]/70 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
            {employee.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {employee.name}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-bold tracking-wider">
                Manager
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">Always active · Ready to coordinate work</p>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        {suggestions.length > 0 && messages.length === 0 && (
          <div className="hidden sm:flex items-center gap-2">
            {suggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setValue(sug);
                  inputRef.current?.focus();
                }}
                className="text-xs border border-white/10 rounded-full px-3 py-1 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable Message History ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {historyLoading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground" role="status">
            Loading conversation history…
          </div>
        )}

        {messages.length === 0 && !historyLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12 text-muted-foreground">
            <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-primary">
              <CheckCircle2 className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Direct Operations Channel</h3>
            <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
              Ask your Manager for status updates, attach documents to analyze, or connect integrations.
            </p>
          </div>
        )}

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
                  {/* Markdown Renderer with Ikamva Typography styling */}
                  <div className="text-sm leading-relaxed text-foreground/90 break-words prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-code:text-[#fcfc03] prose-strong:text-foreground">
                    <ReactMarkdown>{m.body}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <AgentThinkingLoader loading={pending} duration={1200} />
        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Pinned Input Footer ── */}
      <div className="p-4 bg-[#1a1a1a]/80 border-t border-white/10 shrink-0 relative z-20">
        {/* Attachment Chips Display */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-medium shadow-sm animate-fade-in"
              >
                <FileText className="size-3.5" />
                <span className="truncate max-w-[160px]">{att.name}</span>
                <span className="text-[10px] opacity-70">({Math.round(att.size / 1024)} KB)</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="hover:bg-primary/20 rounded-full p-0.5 transition-colors ml-1 cursor-pointer"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick Connect Popover Dropdown */}
        {showConnectMenu && (
          <div className="absolute bottom-20 left-6 z-30 w-72 rounded-2xl border border-white/15 bg-[#1e1e1e] p-3 shadow-2xl backdrop-blur-xl animate-fade-in">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Connect Integration</span>
              <button
                type="button"
                onClick={() => setShowConnectMenu(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={connectingTool}
                onClick={handleConnectGmail}
                className="flex items-center justify-between p-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-foreground transition-colors cursor-pointer w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-red-500/20 text-red-400 font-bold text-[10px]">GM</span>
                  <span>Google / Gmail</span>
                </div>
                <span className="text-[10px] text-primary font-semibold">Connect &rarr;</span>
              </button>
              <div className="flex items-center justify-between p-2 rounded-xl text-xs font-medium bg-white/5 opacity-50 text-muted-foreground cursor-not-allowed">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-blue-500/20 text-blue-400 font-bold text-[10px]">M3</span>
                  <span>Microsoft 365</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Coming soon</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl text-xs font-medium bg-white/5 opacity-50 text-muted-foreground cursor-not-allowed">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">HS</span>
                  <span>HubSpot CRM</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Coming soon</span>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className={cn(
            "bg-[#242424]/90 border rounded-2xl p-2.5 shadow-xl transition-all flex flex-col gap-1.5",
            isListening ? "border-red-500/50 ring-2 ring-red-500/20" : "border-white/10 focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10"
          )}
        >
          <label htmlFor="ask-employee" className="sr-only">
            Ask {employee.name}
          </label>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.csv,.xlsx"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Textarea */}
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
            placeholder={isListening ? "Listening to your voice..." : `Ask ${employee.name} anything or attach a file...`}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="w-full resize-none bg-transparent px-2.5 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 max-h-[180px] overflow-y-auto text-foreground"
            style={{ minHeight: "44px" }}
          />

          {/* Pinned Bottom Toolbar */}
          <div className="flex items-center justify-between px-1 pt-1 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              {/* 1. File Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment}
                title="Attach document (.pdf, .docx, .txt, .csv, .xlsx)"
                className="rounded-full p-2 text-muted-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                aria-label="Attach a file"
              >
                <Plus className="size-4 text-primary" />
                <Paperclip className="size-3.5" />
              </button>

              {/* 2. Quick-Connect Integration Button */}
              <button
                type="button"
                onClick={() => setShowConnectMenu(!showConnectMenu)}
                title="Quick-connect integrations (Gmail, CRM, Calendar)"
                className="rounded-full p-2 text-muted-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                aria-label="Connect an integration"
              >
                <Plug className="size-3.5 text-[#fcfc03]" />
                <span className="text-[11px] font-medium hidden sm:inline">Connect</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* 3. Browser Speech-to-Text Button */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? "Stop listening" : "Speak to input text"}
                  className={cn(
                    "grid size-8 place-items-center rounded-full transition-all cursor-pointer shadow-sm",
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-white/10 text-muted-foreground hover:text-foreground hover:bg-white/20"
                  )}
                  aria-label={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </button>
              )}

              {/* Send Button */}
              <button
                type="submit"
                disabled={(!value.trim() && attachments.length === 0) || pending}
                className="grid size-8 place-items-center rounded-full bg-white text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:bg-white/20 disabled:text-white/40 shadow-sm cursor-pointer"
                aria-label="Send message"
              >
                <ArrowUp className="size-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
