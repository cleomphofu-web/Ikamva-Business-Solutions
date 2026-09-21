/**
 * IKAMVA FRONTEND ADAPTER — DEVELOPMENT DATA ONLY
 * ------------------------------------------------
 * This module is the single seam between the Ikamva UI and the real backend
 * (WorkerEngine / existing API services). Nothing here is production data.
 *
 * Every export below is clearly-labelled placeholder content used to build and
 * review the interface. When the real endpoints are wired up, replace the
 * bodies of these functions with calls to the existing API client — the
 * component layer does not need to change.
 *
 * Rules for this file:
 *  - never present this data to the client as real AI activity
 *  - never fabricate a successful integration
 *  - keep the shapes identical to the backend contract
 */

import type {
  Approval,
  Capacity,
  Employee,
  Job,
  KnowledgeSource,
  LogEvent,
  Rule,
  Skill,
  ToolConnection,
  Workspace,
} from "./types";

/** True whenever the UI is running on placeholder data instead of the backend. */
export const IS_PREVIEW_DATA = true;

export const workspace: Workspace = {
  companyName: "Ikamva Business Solutions",
  tagline: "AI Workforce",
  operatorFirstName: "Cleo",
};

export const employee: Employee = {
  name: "Your Employee",
  role: "Customer Operations",
  purpose:
    "Your Employee manages customer communication, support workflows and follow-ups so your team stays ahead of every conversation.",
  state: "working",
  stateDetail: "Drafting a refund response for order #18291",
};

export const capacity: Capacity = {
  tasksUsed: 42,
  tasksTotal: 100,
  hoursUsed: 31.5,
  hoursTotal: 60,
  tokensUsed: 1_820_000,
  tokensTotal: 3_000_000,
};

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "k1",
    name: "Refund & Returns Policy.pdf",
    kind: "PDF",
    size: "412 KB",
    status: "Indexed",
    addedAt: "12 Aug",
    origin: "Uploaded by Cleo",
  },
  {
    id: "k2",
    name: "Service Catalogue 2026.docx",
    kind: "DOCX",
    size: "1.1 MB",
    status: "Indexed",
    addedAt: "12 Aug",
    origin: "Uploaded by Cleo",
  },
  {
    id: "k3",
    name: "ikamva.co.za/support",
    kind: "Website",
    size: "18 pages",
    status: "Processing",
    addedAt: "15 Aug",
    origin: "Website crawl",
  },
];

export const tools: ToolConnection[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Read customer threads and draft replies on your behalf.",
    status: "available",
    scopes: ["gmail.readonly", "gmail.send"],
  },
  {
    id: "gcal",
    name: "Google Calendar",
    description: "See availability and schedule customer calls.",
    status: "available",
    scopes: ["calendar.readonly", "calendar.events"],
  },
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Read company documents your Employee needs for accurate answers.",
    status: "available",
    scopes: ["drive.readonly"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Escalate to your team in the right channel.",
    status: "available",
    scopes: ["chat:write", "channels:read"],
  },
  {
    id: "m365",
    name: "Microsoft 365",
    description: "Outlook mail and calendar for Microsoft-first teams.",
    status: "available",
    scopes: ["Mail.Read", "Calendars.ReadWrite"],
  },
  {
    id: "crm",
    name: "CRM",
    description: "Look up customer records and log activity.",
    status: "available",
    scopes: ["contacts.read", "activity.write"],
  },
];

export const skills: Skill[] = [
  {
    id: "support",
    name: "Customer Support",
    description: "Answer customer questions using your company knowledge.",
    capabilities: ["Read conversations", "Draft answers", "Escalate to a human"],
    permissions: ["gmail.readonly"],
    enabled: true,
  },
  {
    id: "email",
    name: "Email Management",
    description: "Triage the inbox, label threads and send approved replies.",
    capabilities: ["Triage", "Label", "Send with approval"],
    permissions: ["gmail.readonly", "gmail.send"],
    enabled: true,
  },
  {
    id: "calendar",
    name: "Calendar Management",
    description: "Book, move and confirm meetings inside working hours.",
    capabilities: ["Read availability", "Create events"],
    permissions: ["calendar.events"],
    enabled: false,
  },
  {
    id: "research",
    name: "Research",
    description: "Gather and summarise information for a decision.",
    capabilities: ["Web research", "Summarise", "Cite sources"],
    permissions: [],
    enabled: false,
  },
  {
    id: "data",
    name: "Data Entry",
    description: "Move structured information into your systems accurately.",
    capabilities: ["Extract fields", "Write records"],
    permissions: ["activity.write"],
    enabled: false,
  },
  {
    id: "reporting",
    name: "Reporting",
    description: "Produce recurring summaries of activity and outcomes.",
    capabilities: ["Aggregate activity", "Generate reports"],
    permissions: [],
    enabled: false,
  },
];

export const jobs: Job[] = [
  {
    id: "j1",
    title: "Refund follow-up — order #18291",
    skill: "Customer Support",
    state: "running",
    when: "Started 10:42",
  },
  {
    id: "j2",
    title: "Morning inbox triage",
    skill: "Email Management",
    state: "scheduled",
    when: "Tomorrow 09:00",
  },
  {
    id: "j3",
    title: "Weekly support summary",
    skill: "Reporting",
    state: "scheduled",
    when: "Friday 16:00",
  },
  {
    id: "j4",
    title: "Inbox triage",
    skill: "Email Management",
    state: "completed",
    when: "Today 09:04",
  },
];

export const rules: Rule[] = [
  { id: "r1", kind: "always", text: "Answer in the company tone: warm, direct, no jargon." },
  { id: "r2", kind: "always", text: "Cite the policy document used when quoting a rule." },
  { id: "r3", kind: "never", text: "Never promise a refund amount that is not in the policy." },
  { id: "r4", kind: "never", text: "Never share internal pricing or supplier names." },
  { id: "r5", kind: "approval", text: "Needs approval before sending any external email." },
  { id: "r6", kind: "escalate", text: "Escalate to a human when a customer mentions legal action." },
];

export const approvals: Approval[] = [
  {
    id: "a1",
    intent: "Send an email to John Mokoena",
    reason: "John requested an update on his refund.",
    data: "Customer order #18291",
    system: "Gmail",
    permission: "gmail.send",
    raisedAt: "10:45",
    status: "pending",
  },
  {
    id: "a2",
    intent: "Book a callback for Thandi Nkosi",
    reason: "Thandi asked to speak to someone about a delayed delivery.",
    data: "Calendar slot, Thu 14:00–14:30",
    system: "Google Calendar",
    permission: "calendar.events",
    raisedAt: "10:12",
    status: "pending",
  },
];

export const logEvents: LogEvent[] = [
  { id: "l1", time: "10:42", label: "Your Employee received a task", detail: "Refund follow-up — order #18291", tone: "neutral" },
  { id: "l2", time: "10:43", label: "Read company refund policy", detail: "Refund & Returns Policy.pdf", tone: "working" },
  { id: "l3", time: "10:44", label: "Checked Gmail", detail: "Thread: “Refund status?”", tone: "working" },
  { id: "l4", time: "10:45", label: "Drafted response", tone: "working" },
  { id: "l5", time: "10:45", label: "Waiting for approval", detail: "gmail.send", tone: "approval" },
];

export const hoursByDay = [
  { day: "Mon", hours: 6.2 },
  { day: "Tue", hours: 7.1 },
  { day: "Wed", hours: 5.4 },
  { day: "Thu", hours: 6.8 },
  { day: "Fri", hours: 6.0 },
];

export const tokensByDay = [
  { day: "Mon", tokens: 320000 },
  { day: "Tue", tokens: 410000 },
  { day: "Wed", tokens: 280000 },
  { day: "Thu", tokens: 460000 },
  { day: "Fri", tokens: 350000 },
];

export const tokensByActivity = [
  { activity: "Customer replies", tokens: 780000 },
  { activity: "Inbox triage", tokens: 460000 },
  { activity: "Knowledge lookups", tokens: 340000 },
  { activity: "Reporting", tokens: 240000 },
];

export const schedule = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  start: "09:00",
  end: "17:00",
  timezone: "Africa/Johannesburg",
  nextRun: "Tomorrow, 09:00 (SAST)",
};

/**
 * Placeholder for the real conversation endpoint.
 * Now wired to the actual workforce API!
 */
import { workforceApi } from './api-client';

export async function sendToEmployee(message: string) {
  try {
    const response = await workforceApi.sendMessage(message);
    let status = await workforceApi.getChatStatus(response.task_id);
    while (["pending", "processing", "validating", "waiting_quota"].includes(status.status)) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await workforceApi.getChatStatus(response.task_id);
    }
    if (status.status === "failed") {
      return { connected: false, response: status.error || "Your Employee could not complete that request." };
    }
    return {
      connected: true,
      response: status.result?.output?.content || "Your Employee completed the request, but no response text was returned.",
    };
  } catch (error) {
    console.error("Error communicating with employee:", error);
    return {
      connected: true, // we connected to the API but it failed
      response: "Sorry, I encountered an error processing your request.",
      error: error.message
    };
  }
}
