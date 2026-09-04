import { useEffect, useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { fileToKnowledgePayload } from "@/lib/ikamva/file-upload";



const STATUS_TONE: Record<string, string> = {
  Indexed: "var(--state-working)",
  Processing: "var(--state-waiting)",
  Failed: "var(--state-failed)",
};

function ContextPage() {
  const [sources, setSources] = useState<{ id: string; name: string; status: string; kind: string; size: string; origin: string; addedAt: string }[]>([]);
  const [employeeName, setEmployeeName] = useState("your Employee");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pastedContent, setPastedContent] = useState("");
  const [loadError, setLoadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void Promise.all([employeeApi.getMine(), workforceApi.listKnowledge()]).then(([{ employee: record }, { sources = [] }]) => { setSources(sources.map((source: any) => ({ id: source.id, name: source.source || source.title, status: "Indexed", kind: "Document", size: "", origin: source.source_type || "Upload", addedAt: source.created_at }))); if (record) setEmployeeName(record.name || "your Employee"); }).catch(error => setLoadError(error?.message || "Unable to load Company Brain data.")).finally(() => setLoading(false)); }, []);
  async function ingest(file: File) {
    setUploading(true); setLoadError("");
    try { const result = await workforceApi.ingestKnowledge(await fileToKnowledgePayload(file)); setSources(current => [...current, ...result.chunks.map((chunk: any) => ({ id: chunk.id, name: file.name, status: "Indexed", kind: "Document", size: `${file.size} bytes`, origin: "Upload", addedAt: new Date().toLocaleDateString() }))]); }
    catch (error: any) { setLoadError(error?.message || "Unable to ingest document."); } finally { setUploading(false); }
  }
  async function ingestText() {
    if (!pastedContent.trim()) return;
    setUploading(true); setLoadError("");
    try {
      const result = await workforceApi.ingestKnowledge({ content: pastedContent, source_file: "pasted-company-knowledge.txt" });
      setSources(current => [...current, ...result.chunks.map((chunk: any) => ({ id: chunk.id, name: "pasted-company-knowledge.txt", status: "Indexed", kind: "Document", size: `${pastedContent.length} characters`, origin: "Paste", addedAt: new Date().toLocaleDateString() }))]);
      setPastedContent("");
    } catch (error: any) { setLoadError(error?.message || "Unable to ingest pasted knowledge."); } finally { setUploading(false); }
  }
  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Context"
          title={`What ${employeeName} knows`}
          description={`${employeeName} answers from the material you provide. The more context your Employee has, the more accurate the work becomes.`}
          actions={
            <Button onClick={() => fileRef.current?.click()}>
              + Add knowledge
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Sources", value: String(sources.length) },
            { label: "Documents", value: String(sources.filter((s) => s.kind !== "Website").length) },
          ].map((s) => (
            <div key={s.label} className="glass rounded-3xl p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display mt-2 text-3xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        <Panel title="Company Brain" description={`Documents and pages ${employeeName} has read.`}>
          {loading && <p className="mb-4 text-sm text-muted-foreground" role="status">Loading Company Brain…</p>}
          <div
            className="mb-6 flex flex-col items-center rounded-3xl border border-dashed border-border px-6 py-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void ingest(file);
            }}
          >
            <UploadCloud className="size-6 text-primary" />
            <p className="mt-4 font-medium">Drag documents here</p>
            <p className="mt-1.5 text-sm text-muted-foreground">PDF · DOCX · TXT · CSV</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => fileRef.current?.click()} disabled={uploading}
              >
                {uploading ? "Indexing…" : "Upload documents"}
              </Button>
              <Button variant="outline" onClick={ingestText} disabled={uploading || !pastedContent.trim()}>Save pasted text</Button>
              <input ref={fileRef} type="file" accept=".txt,.pdf" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void ingest(file); event.currentTarget.value = ""; }} />
            </div>
          </div>
          <textarea aria-label="Paste company knowledge" value={pastedContent} onChange={event => setPastedContent(event.target.value)} placeholder="Or paste company facts here…" className="mb-6 min-h-24 w-full rounded-2xl border border-border bg-transparent p-4 text-sm" />

          {loadError && <p role="alert" className="mb-4 text-sm text-destructive">{loadError}</p>}
          {sources.length === 0 ? (
            <EmptyState
              headline={`${employeeName} doesn't know your company yet.`}
              why="Give her the information she needs to work accurately — policies, product details and the way you speak to customers."
              actions={[{ label: "Upload documents", onClick: () => fileRef.current?.click() }]}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.kind} · {s.size} · {s.origin} · {s.addedAt}
                      </p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      color: STATUS_TONE[s.status],
                      background: `color-mix(in oklab, ${STATUS_TONE[s.status]} 12%, transparent)`,
                    }}
                  >
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

      </div>
    </>
  );
}

export default ContextPage;
