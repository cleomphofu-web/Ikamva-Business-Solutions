export type EmployeeState =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "approval"
  | "paused"
  | "failed"
  | "suspended";

export interface Employee {
  name: string;
  role: string;
  purpose: string;
  state: EmployeeState;
  stateDetail: string;
}

export interface Workspace {
  companyName: string;
  tagline: string;
  operatorFirstName: string;
}

export interface Capacity {
  tasksUsed: number;
  tasksTotal: number;
  hoursUsed: number;
  hoursTotal: number;
  tokensUsed: number;
  tokensTotal: number;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  kind: "PDF" | "DOCX" | "TXT" | "CSV" | "Website" | "Data source";
  size: string;
  status: "Indexed" | "Processing" | "Failed";
  addedAt: string;
  origin: string;
}

export interface ToolConnection {
  id: string;
  name: string;
  description: string;
  status: "connected" | "available" | "needs-permission" | "disconnected";
  scopes: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  permissions: string[];
  enabled: boolean;
}

export interface Job {
  id: string;
  title: string;
  skill: string;
  state: "running" | "scheduled" | "completed" | "failed";
  when: string;
}

export interface Rule {
  id: string;
  kind: "always" | "never" | "approval" | "escalate";
  text: string;
}

export interface Approval {
  id: string;
  intent: string;
  reason: string;
  data: string;
  system: string;
  permission: string;
  raisedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface LogEvent {
  id: string;
  time: string;
  label: string;
  detail?: string;
  tone: "neutral" | "working" | "approval" | "success" | "failed";
}

export type ChatRole = "client" | "employee";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  body: string;
  phase?: "thinking" | "working" | "tool" | "approval" | "completed" | "paused" | "error";
  toolName?: string;
}
