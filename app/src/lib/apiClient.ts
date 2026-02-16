/**
 * Nexus PM — API Client
 * Typed fetch wrapper for backend communication.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// ---- Health ----

export async function getHealth() {
  return request<{
    status: string;
    timestamp: string;
    services: Record<string, { configured: boolean }>;
    version: string;
  }>('/health');
}

export async function getServicesStatus() {
  return request<Array<{
    id: string; name: string; icon: string; color: string;
    status: string; lastSync: string; health: number; latency: number;
  }>>('/api/services/status');
}

export interface ActivityStats {
  platforms: Array<{ id: string; name: string; events: number; total_events?: number; change: number; trend: string }>;
  totalEvents: number;
  totalEventsAllTime?: number;
  totalSyncs: number;
  activeAgents: number;
  chartData: Array<{ time: string; events: number; syncs: number }>;
  timeRange?: { from: string; to: string };
  slackHistory?: number;
}

export async function getActivityStats(projectId: string) {
  return request<ActivityStats>(`/api/services/activity/${projectId}`);
}

// ---- Projects ----

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  agentCount: number;
  memberCount: number;
  lastActivity: string;
  syncCount: number;
  health: number;
  color: string;
  createdAt: string;
}

export async function getProjects() {
  return request<Project[]>('/api/projects');
}

export async function createProject(name: string, description = '') {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function getProject(id: string) {
  return request<Project>(`/api/projects/${id}`);
}

export async function updateProject(id: string, updates: Partial<Project>) {
  return request<Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteProject(id: string) {
  return request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' });
}

// ---- Connections ----

export interface Connection {
  id: string;
  name: string;
  token?: string;
  tokenPreview?: string;
  webhook?: string;
  icon: string;
  color: string;
  status: string;
  lastSync: string;
  account?: string;
  createdAt?: string;
}

export async function getConnections(projectId: string) {
  return request<Connection[]>(`/api/connections/${projectId}`);
}

export async function createConnection(data: {
  project_id: string; name: string; token: string;
  webhook?: string; icon?: string; color?: string;
}) {
  return request<Connection>('/api/connections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function testConnection(projectId: string, connId: string) {
  return request<{ status: string; message: string }>(
    `/api/connections/${projectId}/${connId}/test`,
    { method: 'POST' },
  );
}

export const deleteConnection = async (projectId: string, connId: string) => {
  const res = await fetch(`${API_BASE}/api/connections/${projectId}/${connId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete connection');
  return res.json();
};

export const updateConnection = async (projectId: string, connId: string, data: Partial<Connection>) => {
  const res = await fetch(`${API_BASE}/api/connections/${projectId}/${connId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update connection');
  return res.json() as Promise<Connection>;
};

// ---- Agent Runs ----

export interface AgentRun {
  id: string;
  name: string;
  status: string;
  currentStage: string;
  sources: string[];
  nodes: Array<{
    id: string; stage: string; title: string;
    description: string; timestamp: string;
    status: string; agent: string; details?: string[];
  }>;
  diffs?: DiffItem[];
  createdAt: string;
  project_id: string;
}

export interface DiffItem {
  id: string;
  title: string;
  description: string;
  platform: string;
  author: string;
  timestamp: string;
  status: string;
  changes: Array<{
    id: string; type: string; field: string;
    oldValue?: string; newValue?: string;
    lineNumbers: { old: number; new: number };
  }>;
  proposal: Record<string, unknown>;
}

export async function triggerRun(projectId: string, description = '', sources = ['slack', 'figma']) {
  return request<AgentRun>('/api/agents/trigger', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, description, sources }),
  });
}

export async function getRuns(projectId: string) {
  return request<AgentRun[]>(`/api/agents/runs/${projectId}`);
}

export async function getRun(projectId: string, runId: string) {
  return request<AgentRun>(`/api/agents/runs/${projectId}/${runId}`);
}

export async function approveRun(projectId: string, runId: string) {
  return request<AgentRun>(`/api/agents/runs/${projectId}/${runId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  });
}

export async function rejectRun(projectId: string, runId: string) {
  return request<AgentRun>(`/api/agents/runs/${projectId}/${runId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action: 'reject' }),
  });
}

export async function triggerRunRest(projectId: string) {
  return request<{ run_id: string; status: string }>(`/api/run/${projectId}`, {
    method: 'POST',
  });
}

// ---- Slack Messages ----

export interface SlackMessagesResponse {
  messages: Array<{
    text: string;
    user: string;
    ts: string;
    channel?: string;
  }>;
  channel: string;
}

export async function getSlackMessages(projectId: string) {
  return request<SlackMessagesResponse>(`/api/services/slack/messages/${projectId}`);
}

// ---- Individual Diff Actions ----

export interface DiffActionResponse {
  diff: DiffItem & { execution_result?: { action: string; key: string; title: string; success: boolean; reason?: string } };
  run: AgentRun;
}

export async function diffAction(projectId: string, runId: string, diffId: string, action: 'approve' | 'reject') {
  return request<DiffActionResponse>(`/api/agents/runs/${projectId}/${runId}/diffs/${diffId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, diff_id: diffId }),
  });
}

// ---- Telemetry Logs ----

export interface TelemetryLog {
  stage: string;
  message: string;
  level: string;
  timestamp: string;
}

export async function getRunLogs(projectId: string, runId: string) {
  return request<{ logs: TelemetryLog[]; count: number }>(`/api/agents/runs/${projectId}/${runId}/logs`);
}

// ---- Admin ----

export async function resetEnvironment() {
  return request<{ ok: boolean; flushed_keys: number }>('/api/agents/admin/reset', {
    method: 'POST',
  });
}
