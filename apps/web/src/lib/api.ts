import axios from "axios";

export const api = axios.create({ baseURL: "http://localhost:8000" });

export interface Scenario {
  id: string;
  name: string;
  category: string;
  protocol: string;
  description: string;
  educational_goal: string;
  expected_divergence: boolean;
  expected_message_count: { frontend: number; backend: number };
  severity: string;
  status?: string;
  mitigation: { title: string; description: string; config_change?: string };
}

export interface Run {
  id: string;
  scenario_id: string;
  proxy: string;
  backend: string;
  mode: string;
  status: "pending" | "running" | "pass" | "fail" | "error";
  started_at: string;
  finished_at: string | null;
  frontend_count: number | null;
  backend_count: number | null;
  divergence: boolean | null;
  hardened_blocked: boolean | null;
  severity: string | null;
  explanation: string | null;
  duration_ms: number | null;
  events: LabEvent[];
}

export interface LabEvent {
  ts: number;
  kind: string;
  message: string;
  data: Record<string, unknown>;
}

export interface ResearchNote {
  id: string;
  run_id: string | null;
  scenario_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  desync_observed: number;
  hardened_blocked: number;
}

export interface TopologyService {
  id: string;
  name: string;
  status: string;
  version?: string;
  session?: string;
  rules?: number;
}

export interface Topology {
  proxies: TopologyService[];
  backends: TopologyService[];
  mode: string;
  network: string;
  victim: TopologyService;
  attacker: TopologyService;
  waf: TopologyService;
}

// API helpers
export const fetchScenarios = () => api.get<Scenario[]>("/api/scenarios").then((r) => r.data);
export const fetchScenario = (id: string) => api.get<Scenario>(`/api/scenarios/${id}`).then((r) => r.data);
export const fetchRuns = (limit = 50) => api.get<Run[]>(`/api/runs?limit=${limit}`).then((r) => r.data);
export const fetchRun = (id: string) => api.get<Run>(`/api/runs/${id}`).then((r) => r.data);
export const deleteRun = (id: string) => api.delete(`/api/runs/${id}`).then((r) => r.data);
export const fetchStats = () => api.get<Stats>("/api/stats").then((r) => r.data);
export const fetchTopology = () => api.get<Topology>("/api/topology").then((r) => r.data);
export const fetchNotes = (params?: { run_id?: string; scenario_id?: string }) =>
  api.get<ResearchNote[]>("/api/notes", { params }).then((r) => r.data);
export const createNote = (data: { run_id?: string; scenario_id?: string; title: string; content: string }) =>
  api.post<ResearchNote>("/api/notes", data).then((r) => r.data);
export const updateNote = (id: string, data: { title?: string; content?: string }) =>
  api.put<ResearchNote>(`/api/notes/${id}`, data).then((r) => r.data);
export const deleteNote = (id: string) => api.delete(`/api/notes/${id}`).then((r) => r.data);
export const fetchEvidence = (runId: string) => api.get(`/api/evidence/${runId}`).then((r) => r.data);
export const fetchHardened = () => api.get("/api/hardened").then((r) => r.data);

// WebSocket runner
export function createRunSocket(
  payload: { scenario_id: string; proxy: string; backend: string; hardened: boolean; timing_ms: number },
  onEvent: (e: LabEvent) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): WebSocket {
  const ws = new WebSocket("ws://localhost:8000/ws/run");
  ws.onopen = () => ws.send(JSON.stringify(payload));
  ws.onmessage = (m) => {
    const event: LabEvent = JSON.parse(m.data);
    onEvent(event);
    if (event.kind === "DONE" || event.kind === "ERROR") {
      ws.onclose = null;  // prevent double-fire of onDone
      onDone();
      ws.close();
    }
  };
  ws.onerror = () => onError("WebSocket connection failed — is the API running?");
  ws.onclose = () => onDone();
  return ws;
}
