import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Database, Globe, UploadCloud, BriefcaseBusiness, ShoppingBag, HeartPulse, Utensils, Building2, Code2, GraduationCap, Wrench } from "lucide-react";
import { Atmosphere } from "@/components/ikamva/atmosphere";
import { EmployeeOrb } from "@/components/ikamva/employee-orb";
import { CapacityMeter } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { capacity, schedule, skills, tools } from "@/lib/ikamva/workspace-adapter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { fileToKnowledgePayload } from "@/lib/ikamva/file-upload";
import { HYBRID_PRICING } from "@/lib/ikamva/pricing";



const STEPS = [
  { title: "Meet your Employee", why: "Give your Employee a name and a role so your team knows who they are working with." },
  { title: "Business category", why: "Choose the closest fit so your Employee can recommend the right knowledge and skills." },
  { title: "Company context", why: "Your Employee uses this context to communicate naturally as your business." },
  { title: "Teach your Employee", why: "Add the documents that give your Employee accurate answers, not guesswork." },
  { title: "Integrations", why: "Connecting tools is how they move from advice to action." },
  { title: "Skills", why: "Choose the kinds of work relevant to your business." },
  { title: "Permissions", why: "Decide exactly what your Employee may read and what they may change." },
  { title: "Rules", why: "Boundaries keep their work safe and on-brand." },
  { title: "Schedule", why: "They work only in the hours you set." },
  { title: "Capacity", why: "You always know how much work is left before they pause." },
  { title: "Review & activate", why: "One last look before they start." },
] as const;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputClass = "rounded-2xl bg-transparent py-6 text-base";

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Customer Operations Specialist");
  const [purpose, setPurpose] = useState("");
  const [personality, setPersonality] = useState("");
  const [industry, setIndustry] = useState("");
  const [company, setCompany] = useState("Ikamva Business Solutions");
  const [description, setDescription] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [escalation, setEscalation] = useState("escalate_email");
  const [tone, setTone] = useState("");
  const [neverDo, setNeverDo] = useState("");
  const [rules, setRules] = useState(["", "", "", ""]);
  const [permissionState, setPermissionState] = useState<Record<string, boolean>>({ read_email: true, draft_email: true, send_email: false, calendar: false });
  const [selectedSkills, setSelectedSkills] = useState<string[]>(skills.filter(skill => skill.enabled).map(skill => skill.id));
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [days, setDays] = useState(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [customPersonality, setCustomPersonality] = useState("");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectingTool, setConnectingTool] = useState("");
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");
  const [activating, setActivating] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<Record<string, string>>({});
  const [pastedDocuments, setPastedDocuments] = useState<Record<string, string>>({});
  const relevantSkills = skills.filter((skill) => {
    if (industry === "Retail & E-commerce" || industry === "Hospitality & Food") return skill.id !== "calendar" && skill.id !== "data";
    if (industry === "Healthcare & Wellness") return skill.id !== "calendar" && skill.id !== "data";
    if (industry === "Technology & Software") return skill.id !== "calendar";
    return true;
  });

  async function uploadDocument(label: string, file?: File) {
    if (!file) return;
    setDocumentStatus(current => ({ ...current, [label]: `Processing ${file.name}…` }));
    try {
      await workforceApi.ingestKnowledge(await fileToKnowledgePayload(file));
      setDocumentStatus(current => ({ ...current, [label]: `${file.name} · ${(file.size / 1024).toFixed(1)} KB · Ready` }));
    } catch (error: any) {
      setDocumentStatus(current => ({ ...current, [label]: error?.message || "Upload failed" }));
    }
  }
  async function pasteDocument(label: string) {
    const content = pastedDocuments[label]?.trim();
    if (!content) return setDocumentStatus(current => ({ ...current, [label]: "Paste some text first." }));
    setDocumentStatus(current => ({ ...current, [label]: "Processing pasted text…" }));
    try { await workforceApi.ingestKnowledge({ content, source_file: `${label}.txt` }); setDocumentStatus(current => ({ ...current, [label]: "Pasted text · Ready" })); }
    catch (error: any) { setDocumentStatus(current => ({ ...current, [label]: error?.message || "Paste failed" })); }
  }
  async function connectTool(toolId: string) {
    if (toolId !== "gmail") return;
    setConnectingTool(toolId); setSaveError("");
    try {
    const result = await workforceApi.connectGmail('/dashboard/onboarding');
      const consentUrl = result.url || result.consent_url;
      if (!consentUrl) throw new Error("Gmail authorization URL was not returned.");
      window.location.href = consentUrl;
    } catch (error: any) {
      setConnectingTool("");
      setSaveError(error?.message || "Unable to start Gmail connection.");
    }
  }

  const canContinue = step !== 0 || (name.trim().length > 1 && role.trim().length > 1);
  const current = STEPS[step]!;

  useEffect(() => {
    let cancelled = false;
    void employeeApi.getMine().then(({ employee }) => {
      if (cancelled || !employee) return;
      setEmployeeId(employee.id);
      setName(employee.name || "");
      setRole(employee.role || "");
      setPurpose(employee.mission || "");
      setPersonality(employee.personality || "");
      const config = employee.configuration || {};
      if (Array.isArray(config.skills)) setSelectedSkills(config.skills);
      setIndustry(config.industry_category || ""); setCompany(config.company_name || "Ikamva Business Solutions");
      setDescription(config.description || ""); setBusinessEmail(config.business_email || ""); setEscalation(config.escalation_policy || "escalate_email"); setTone(config.tone || ""); setNeverDo(config.never_do || "");
      if (config.permissions) setPermissionState(current => ({ ...current, ...config.permissions }));
      if (Array.isArray(employee.rules)) setRules([employee.rules[0] || "", employee.rules[1] || "", employee.rules[2] || "", employee.rules[3] || ""]);
      if (employee.schedule) { setDays(Array.isArray(employee.schedule.days) ? employee.schedule.days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]); setStart(employee.schedule.start || "09:00"); setEnd(employee.schedule.end || "17:00"); setTimezone(employee.schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone); }
      const savedStep = Number(employee.setup_step);
      if (Number.isFinite(savedStep) && savedStep > 0) setStep(Math.min(STEPS.length - 1, savedStep));
    }).catch(error => {
      if (!cancelled) setSaveError(error?.message || "Unable to load Employee setup.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (step !== 4) return;
    void workforceApi.listIntegrations().then(({ integrations }) => {
      setConnectedProviders((integrations || []).filter((item: any) => item.status === "connected").map((item: any) => item.provider));
    }).catch(() => setConnectedProviders([]));
  }, [step]);

  function fieldsForStep() {
    const fields: Record<string, unknown> = { setup_step: String(step + 1) };
    if (step === 0) Object.assign(fields, { name, role, mission: purpose || `${name} helps manage customer communication, support workflows and follow-ups.`, personality });
    if (step === 1) fields.configuration = { industry_category: industry };
    if (step === 2) fields.configuration = { company_name: company, description, business_email: businessEmail, escalation_policy: escalation, tone, never_do: neverDo };
    if (step >= 3 && step <= 6) fields.configuration = { setup_step: step + 1, [`step_${step + 1}`]: true };
    if (step === 5) fields.configuration = { setup_step: 6, skills: selectedSkills.filter(id => relevantSkills.some(skill => skill.id === id)) };
    if (step === 6) fields.configuration = { setup_step: 7, permissions: permissionState };
    if (step === 7) fields.rules = rules.filter(Boolean);
    if (step === 8) fields.schedule = { days, start, end, timezone };
    if (step === 8) Object.assign(fields, { monthly_hours_limit: 60, token_limit: 3000000 });
    return fields;
  }

  async function next() {
    if (!canContinue || (step === 1 && !industry) || (step === 2 && (!company.trim() || !description.trim() || description.length > 120 || !businessEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) || !tone))) {
      setSaveError(step === 1 ? "Choose a business category to continue." : step === 2 ? "Complete the company name, valid business email, one-sentence description, and tone." : "Give your Employee a name and a role to continue.");
      return;
    }
    setSaving(true); setSaveError(""); setSaved(false);
    try {
      const fields = fieldsForStep();
      const result = employeeId ? await employeeApi.update(employeeId, fields) : await employeeApi.create({ ...fields, lifecycle_status: "configuring" });
      setEmployeeId(result.employee.id);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    } catch (error: any) {
      setSaveError(error?.message || "Unable to save this step. Please try again.");
    } finally { setSaving(false); }
  }

  async function activate() {
    if (!employeeId) return;
    setSaving(true); setSaveError("");
    try {
      const result = await employeeApi.activate(employeeId);
      if (result.employee?.lifecycle_status !== "active") throw new Error("Employee activation was not confirmed.");
      setActivating(true);
      navigate("/dashboard");
    } catch (error: any) { setSaveError(error?.message || "Unable to activate Employee."); }
    finally { setSaving(false); }
  }

  return (
    <div className="relative min-h-screen w-full">
      {loading && <div className="fixed inset-0 z-40 grid place-items-center bg-background/70 backdrop-blur-sm" role="status">Loading Employee setup…</div>}
      <Atmosphere />

      {activating && (
        <div className="animate-fade-in fixed inset-0 z-50 grid place-items-center bg-background/80 px-6 text-center backdrop-blur-xl">
          <div>
            <EmployeeOrb state="working" initials={name[0] ?? "S"} size={140} />
            <p className="mt-8 text-2xl font-semibold">{name} is starting her first shift…</p>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6 lg:py-16">
        <header className="mb-10">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <p className="min-w-0 truncate text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Employee setup
            </p>
            <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
              Step {step + 1} of {STEPS.length}
            </p>
            {saved && <span className="text-xs font-medium text-primary" role="status">Saved</span>}
          </div>
          <div className="mt-4 flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-500",
                  i <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </header>

        <div key={step} className="animate-fade-in flex-1">
          <h1 className="text-3xl font-semibold text-balance-tight sm:text-4xl">{current.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {current.why}
          </p>

          <div className="mt-9 flex flex-col gap-6">
            {step === 0 && (
              <>
                <div className="flex items-center gap-5">
                  <EmployeeOrb state="idle" initials={name[0] ?? "S"} size={88} />
                  <p className="min-w-0 text-sm text-muted-foreground">
                    This is how your team will see them across the workspace.
                  </p>
                </div>
                <Field label="Employee name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Role">
                  <select value={["Customer Operations Specialist", "Sales Coordinator", "Executive Assistant", "Other"].includes(role) ? role : "Other"} onChange={(e) => setRole(e.target.value === "Other" ? "" : e.target.value)} className={inputClass}>
                    <option>Customer Operations Specialist</option><option>Sales Coordinator</option><option>Executive Assistant</option><option>Other</option>
                  </select>
                  {!["Customer Operations Specialist", "Sales Coordinator", "Executive Assistant"].includes(role) && <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Enter a custom role" className={inputClass} />}
                </Field>
                <Field label="Purpose" hint="One sentence your team would recognise.">
                  <Textarea
                    rows={3}
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder={`${name} helps manage customer communication, support workflows and follow-ups.`}
                    className="resize-none rounded-2xl bg-transparent text-base"
                  />
                </Field>
                <Field label="Personality">
                  <select value={["Warm and precise", "Friendly and conversational", "Direct and concise", "Other"].includes(personality) ? personality : personality ? "Other" : ""} onChange={(e) => { setPersonality(e.target.value === "Other" ? customPersonality : e.target.value); }} className={inputClass}>
                    <option value="">Choose a personality</option><option>Warm and precise</option><option>Friendly and conversational</option><option>Direct and concise</option><option>Other</option>
                  </select>
                  {(personality && !["Warm and precise", "Friendly and conversational", "Direct and concise"].includes(personality)) || personality === "" ? <Input value={customPersonality || personality} onChange={(e) => { setCustomPersonality(e.target.value); setPersonality(e.target.value); }} placeholder="Describe a custom personality" className={inputClass} /> : null}
                </Field>
              </>
            )}

            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Professional Services", "Law, accounting, consulting, finance", BriefcaseBusiness], ["Retail & E-commerce", "Online store, physical shop, products", ShoppingBag],
                  ["Healthcare & Wellness", "Clinic, pharmacy, therapy, fitness", HeartPulse], ["Hospitality & Food", "Restaurant, hotel, catering, events", Utensils],
                  ["Real Estate & Property", "Agency, rentals, construction, facilities", Building2], ["Technology & Software", "SaaS, IT support, development, digital", Code2],
                  ["Education & Training", "School, tutoring, courses, coaching", GraduationCap], ["Trade & Field Services", "Plumbing, electrical, cleaning, logistics", Wrench],
                  ["Other", "Anything that does not fit above", Globe],
                ].map(([label, detail, Icon]) => <button type="button" key={String(label)} onClick={() => setIndustry(String(label))} className={cn("flex items-start gap-4 rounded-2xl border p-5 text-left transition", industry === label ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><span><strong className="block">{String(label)}</strong><span className="mt-1 block text-sm text-muted-foreground">{String(detail)}</span></span></button>)}
              </div>
            )}

            {step === 2 && (
              <>
                <Field label="What is your company called?"><Input value={company} onChange={e => setCompany(e.target.value)} className={inputClass} /></Field>
                <Field label="Describe your business in one sentence" hint={`${description.length}/120 characters`}><Input maxLength={120} value={description} onChange={e => setDescription(e.target.value)} className={inputClass} /></Field>
                <Field label="What is your main business email address?" hint="This is the inbox your Employee will monitor and reply from."><Input type="email" value={businessEmail} onChange={e => setBusinessEmail(e.target.value)} placeholder="you@company.co.za" className={inputClass} /></Field>
                <Field label="What tone should your Employee use when communicating?" hint="This shapes every reply they write."><select value={tone} onChange={e => setTone(e.target.value)} className={inputClass}><option value="">Choose a tone</option><option>Formal and professional</option><option>Friendly and approachable</option><option>Direct and concise</option><option>Warm and empathetic</option><option>Technical and precise</option></select></Field>
                <Field label="Hard limits" hint="These are non-negotiable. Your Employee will never cross these lines regardless of what a customer asks."><Textarea value={neverDo} onChange={e => setNeverDo(e.target.value)} placeholder="Never quote prices without checking the price list..." rows={3} className="resize-none rounded-2xl bg-transparent text-base" /></Field>
                <Field label="What should happen when your Employee cannot answer a question?" hint="This protects your customers from getting wrong information."><select value={escalation} onChange={e => setEscalation(e.target.value)} className={inputClass}><option value="escalate_email">Escalate to me by email</option><option value="follow_up_notify">Say “I’ll follow up shortly” and notify you</option><option value="ask_call">Ask the customer to call</option></select></Field>
                <p className="text-sm text-muted-foreground">Business hours are configured in the <Link className="font-medium text-primary underline underline-offset-4" to="/dashboard/schedule">Schedule step</Link>; your Employee will only respond during those hours.</p>
              </>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-3">
                {["Company Fact Sheet", "Customer FAQ", "Brand Voice Guide", ...(industry === "Retail & E-commerce" ? ["Product Catalogue / Price List", "Returns & Refunds Policy", "Shipping & Delivery Policy"] : industry === "Professional Services" ? ["Service Catalogue", "Intake Form Template", "Legal & Compliance Notes"] : ["Service and product specifications", "Escalation and operating policy"])].map((doc) => (
                  <div key={doc} className="glass flex flex-col gap-3 rounded-2xl p-4"><div><strong>{doc}</strong><p className="mt-1 text-sm text-muted-foreground">Give your Employee the facts and guidance they need to answer accurately.</p>{documentStatus[String(doc)] && <p className="mt-2 text-xs text-primary" role="status">{documentStatus[String(doc)]}</p>}</div><div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-xl border border-border px-3 py-2 text-sm"><UploadCloud className="mr-1 inline size-4" />Upload<input type="file" accept=".pdf,.docx,.txt,.csv" className="hidden" onChange={e => void uploadDocument(String(doc), e.target.files?.[0])} /></label><Button type="button" variant="outline" onClick={() => void pasteDocument(String(doc))}>Paste text instead</Button><Button type="button" variant="ghost" onClick={() => setDocumentStatus(current => ({ ...current, [String(doc)]: "Skipped for now" }))}>Skip for now</Button></div><Textarea value={pastedDocuments[String(doc)] || ""} onChange={e => setPastedDocuments(current => ({ ...current, [String(doc)]: e.target.value }))} placeholder="Paste the relevant text here (optional)" rows={2} className="resize-none rounded-xl bg-transparent text-sm" /></div>
                ))}
                <p className="text-sm text-muted-foreground">You can skip these for now and add them later in Company Brain.</p>
              </div>
            )}

            {step === 4 &&
              tools.map((t) => (
                <div
                  key={t.id}
                  className="glass grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-3xl p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={() => { if (t.id === "gmail") void connectTool(t.id); else toast(`${t.name} connects through Ikamva's OAuth flow.`); }}
                  >
                    {connectingTool === t.id ? "Opening Google…" : connectedProviders.includes(t.id) ? "Connected" : "Connect"}
                  </Button>
                </div>
              ))}

            {step === 5 &&
              relevantSkills.map((s) => (
                <div
                  key={s.id}
                  className="glass grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-3xl p-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    {s.permissions.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Needs an integration: {s.permissions.join(", ")}</p>}
                    {s.id === "email" && <p className="mt-2 text-xs font-medium text-primary">{HYBRID_PRICING.addOns.email.name}: {HYBRID_PRICING.addOns.email.price} · {HYBRID_PRICING.addOns.email.allowance}</p>}
                    {s.id === "calendar" && <p className="mt-2 text-xs font-medium text-primary">{HYBRID_PRICING.addOns.calendar.name}: {HYBRID_PRICING.addOns.calendar.price}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2"><Switch checked={selectedSkills.includes(s.id)} disabled={s.permissions.length > 0 && !connectedProviders.includes("gmail")} onCheckedChange={(checked) => setSelectedSkills(current => checked ? [...new Set([...current, s.id])] : current.filter(id => id !== s.id))} aria-label={`Enable ${s.name}`} className="shrink-0" />{s.permissions.length > 0 && !connectedProviders.includes("gmail") && <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">Connect integration first</span>}</div>
                </div>
              ))}

            {step === 6 &&
              [
                { system: "Gmail", read: ["Read emails"], write: ["Draft email replies for your approval", "Send emails after approval"] },
                { system: "Calendar", read: ["View calendar"], write: ["Create events", "Modify events"] },
              ].map((p) => (
                <div key={p.system} className="glass rounded-3xl p-5">
                  <p className="font-medium">{p.system}</p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">Read</p>
                      <ul className="mt-3 flex flex-col gap-3">
                        {p.read.map((r) => (
                          <li key={r} className="flex items-center gap-3 text-sm">
                            <Checkbox checked={permissionState[p.system === "Gmail" ? "read_email" : "calendar"]} onCheckedChange={(checked) => setPermissionState(s => ({ ...s, [p.system === "Gmail" ? "read_email" : "calendar"]: Boolean(checked) }))} id={`${p.system}-${r}`} />
                            <label htmlFor={`${p.system}-${r}`}>{r}</label>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">Write</p>
                      <ul className="mt-3 flex flex-col gap-3">
                        {p.write.map((w) => (
                          <li key={w} className="flex items-center gap-3 text-sm">
                            <Checkbox checked={permissionState[p.system === "Gmail" ? (w.startsWith("Draft") ? "draft_email" : "send_email") : "calendar"]} onCheckedChange={(checked) => setPermissionState(s => ({ ...s, [p.system === "Gmail" ? (w.startsWith("Draft") ? "draft_email" : "send_email") : "calendar"]: Boolean(checked) }))} id={`${p.system}-${w}`} />
                            <label htmlFor={`${p.system}-${w}`}>{w}</label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}

            {step === 7 && <>
              {["What should your Employee always do?", "What should your Employee never do?", "What needs your approval before your Employee acts?", "When should your Employee escalate to a human immediately?"].map((label, index) => (
                <Field key={label} label={label} hint={["Always greet customers by name. Always confirm appointments 24 hours before.", "Never share pricing without checking the price list.", "Any email promising a refund or unusual commitment.", "Angry customers, legal threats, or personal health information."][index]}>
                  <Textarea value={rules[index]} onChange={e => setRules(current => current.map((value, i) => i === index ? e.target.value : value))} rows={2} className="resize-none rounded-2xl bg-transparent text-base" />
                </Field>
              ))}
            </>}

            {step === 8 && (
              <>
                <p className="text-sm text-muted-foreground">Your Employee will only process emails and tasks during these hours. Outside these hours they will queue work for the next available slot.</p>
                <div className="flex flex-wrap gap-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
                    <span
                      key={d}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm",
                        days.includes(d)
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <button type="button" onClick={() => setDays(current => current.includes(d) ? current.filter(value => value !== d) : [...current, d])}>{d.slice(0, 3)}</button>
                    </span>
                  ))}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Start">
                    <Input type="time" value={start} onChange={e => setStart(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="End">
                    <Input type="time" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <Field label="Timezone">
                  <Input value={timezone} onChange={e => setTimezone(e.target.value)} className={inputClass} />
                </Field>
              </>
            )}

            {step === 9 && (
              <div className="glass flex flex-col gap-7 rounded-3xl p-6">
                <CapacityMeter label="Monthly tasks" used={capacity.tasksUsed} total={capacity.tasksTotal} />
                <CapacityMeter
                  label="Monthly hours"
                  used={capacity.hoursUsed}
                  total={capacity.hoursTotal}
                  tone="var(--chart-2)"
                />
                <CapacityMeter
                  label="AI token usage"
                  used={capacity.tokensUsed}
                  total={capacity.tokensTotal}
                  tone="var(--chart-3)"
                  format={(n) => `${(n / 1_000_000).toFixed(2)}M`}
                />
                <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    {name} can complete approximately {capacity.tasksTotal - capacity.tasksUsed} more tasks this
                    month.
                  </p>
                  <p>When capacity reaches its limit, {name} automatically pauses.</p>
                  <p>Nothing continues silently in the background.</p>
                </div>
              </div>
            )}

            {step === 10 && (
              <div className="glass rounded-3xl p-6">
                <dl className="grid gap-5 sm:grid-cols-2">
                  {[
                    ["Employee", `${name} · ${role}`],
                    ["Context", "Company profile captured"],
                    ["Knowledge", "Ready for your first documents"],
                    ["Integrations", "None connected yet"],
                    ["Skills", skills.filter((s) => s.enabled).map((s) => s.name).join(", ")],
                    ["Permissions", "Read-only by default"],
                    ["Rules", "Approval required before external email"],
                    ["Schedule", `${days.length} days · ${start}–${end}`],
                    ["Capacity", `${capacity.tasksTotal} tasks · ${capacity.hoursTotal} hours`],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{k}</dt>
                      <dd className="mt-1 text-sm">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 mt-10 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-t border-border/60 bg-background/70 py-4 backdrop-blur-xl">
          {saveError && <p className="col-span-2 text-sm text-destructive" role="alert">{saveError}</p>}
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="shrink-0"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div className="flex justify-end">
            {step < STEPS.length - 1 ? (
              <Button onClick={() => void next()} disabled={saving || loading}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => void activate()} disabled={activating || saving || loading}>
                <Check className="size-4" /> Activate {name}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Onboarding;
