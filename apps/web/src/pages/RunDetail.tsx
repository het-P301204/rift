import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  FileText,
  Terminal,
  Shield,
  StickyNote,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import {
  fetchRun,
  fetchEvidence,
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
} from "../lib/api";
import type { Run, LabEvent, ResearchNote } from "../lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function eventKindClass(kind: string): string {
  if (kind === "DONE") return "text-sage";
  if (kind === "ERROR") return "text-vermilion";
  if (kind === "WARN") return "text-golden";
  if (kind.includes("SEND") || kind.includes("TX")) return "text-iris";
  if (kind.includes("RECV") || kind.includes("RX")) return "text-[var(--color-text-muted)]";
  return "text-[var(--color-text-faint)]";
}

function statusBadge(status: Run["status"]) {
  if (status === "pass")
    return (
      <span className="badge badge-pass flex items-center gap-1">
        <CheckCircle2 size={11} /> PASS
      </span>
    );
  if (status === "fail")
    return (
      <span className="badge badge-fail flex items-center gap-1">
        <XCircle size={11} /> FAIL
      </span>
    );
  if (status === "error")
    return (
      <span className="badge badge-warn flex items-center gap-1">
        <AlertTriangle size={11} /> ERROR
      </span>
    );
  if (status === "running")
    return (
      <span className="badge badge-info flex items-center gap-1">
        <Loader2 size={11} className="animate-spin" /> RUNNING
      </span>
    );
  return <span className="badge badge-neutral">{status.toUpperCase()}</span>;
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportJSON(run: Run) {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rift-run-${run.id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMarkdown(run: Run) {
  const lines = [
    `# RIFT Run Report: ${run.scenario_id}`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Run ID | \`${run.id}\` |`,
    `| Scenario | ${run.scenario_id} |`,
    `| Proxy → Backend | ${run.proxy} → ${run.backend} |`,
    `| Mode | ${run.mode} |`,
    `| Status | ${run.status.toUpperCase()} |`,
    `| Divergence | ${run.divergence ?? "—"} |`,
    `| Frontend Count | ${run.frontend_count ?? "—"} |`,
    `| Backend Count | ${run.backend_count ?? "—"} |`,
    `| Duration | ${formatDuration(run.duration_ms)} |`,
    `| Started | ${run.started_at} |`,
    ``,
    `## Events`,
    ``,
    ...(run.events ?? []).map((e) => `- \`${formatTs(e.ts)}\` **${e.kind}** — ${e.message}`),
    ``,
    `## Explanation`,
    ``,
    run.explanation ?? "_No explanation available._",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rift-run-${run.id.slice(0, 8)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(events: LabEvent[]) {
  const header = "ts,kind,message";
  const rows = events.map(
    (e) => `${e.ts},"${e.kind}","${e.message.replace(/"/g, '""')}"`,
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rift-events.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Events tab ────────────────────────────────────────────────────────────────

function EventTimeline({ events }: { events: LabEvent[] }) {
  if (!events.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--color-text-faint)]">
        No events recorded.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 font-mono text-xs">
      {events.map((e, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-1.5 hover:bg-[var(--color-surface-2)] rounded transition-colors"
        >
          <span className="text-[var(--color-text-faint)] flex-shrink-0 w-28">
            {formatTs(e.ts)}
          </span>
          <span className={`font-semibold flex-shrink-0 w-24 ${eventKindClass(e.kind)}`}>
            {e.kind}
          </span>
          <span className="text-[var(--color-text-muted)] break-all">{e.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Byte stream tab ───────────────────────────────────────────────────────────

function ByteViewer({ run }: { run: Run }) {
  const rawStream =
    (run.events ?? [])
      .filter((e) => e.kind === "SEND" || e.kind === "RECV" || e.kind === "BYTES")
      .map((e) => e.message)
      .join("\n") || "No byte stream data captured.";

  const frontendView =
    (run.events ?? [])
      .filter((e) => e.kind.includes("FRONTEND") || e.kind === "SEND")
      .map((e) => e.message)
      .join("\n") || "No frontend interpretation recorded.";

  const backendView =
    (run.events ?? [])
      .filter((e) => e.kind.includes("BACKEND") || e.kind === "RECV")
      .map((e) => e.message)
      .join("\n") || "No backend interpretation recorded.";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      <div>
        <div className="label mb-2">Raw Stream</div>
        <pre className="mono text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] p-3 rounded-control overflow-auto max-h-96 whitespace-pre-wrap break-all border border-[var(--color-border)]">
          {rawStream}
        </pre>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <div className="label mb-2">Frontend Interpretation</div>
          <pre className="mono text-xs text-iris bg-iris/10 p-3 rounded-control overflow-auto max-h-44 whitespace-pre-wrap break-all border border-iris/25">
            {frontendView}
          </pre>
        </div>
        <div>
          <div className="label mb-2">Backend Interpretation</div>
          <pre className="mono text-xs text-golden bg-golden/10 p-3 rounded-control overflow-auto max-h-44 whitespace-pre-wrap break-all border border-golden/25">
            {backendView}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Evidence tab ──────────────────────────────────────────────────────────────

function EvidenceTab({ runId }: { runId: string }) {
  const { data: evidence = [], isLoading } = useQuery({
    queryKey: ["evidence", runId],
    queryFn: () => fetchEvidence(runId),
    retry: false,
  });

  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(content: string, id: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 gap-3">
        <Loader2 size={18} className="animate-spin text-iris" />
        <span className="text-sm text-[var(--color-text-muted)]">Loading evidence…</span>
      </div>
    );
  }

  if (!Array.isArray(evidence) || evidence.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-sm text-[var(--color-text-faint)]">
        <Shield size={28} className="mb-3 opacity-40" />
        No evidence captured for this run.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {(evidence as Array<{ id: string; type: string; label: string; content: string }>).map(
        (item) => (
          <div key={item.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="badge badge-neutral capitalize">{item.type}</span>
                <span className="ml-2 text-sm font-medium text-[var(--color-text)]">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
                  onClick={() => handleCopy(item.content, item.id)}
                >
                  <Copy size={11} />
                  {copied === item.id ? "Copied!" : "Copy"}
                </button>
                <button
                  className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                  onClick={() => {
                    const blob = new Blob([item.content], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `evidence-${item.id}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={11} />
                  Export
                </button>
              </div>
            </div>
            <pre className="mono text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] p-3 rounded-control overflow-auto max-h-64 whitespace-pre-wrap break-all border border-[var(--color-border)]">
              {item.content}
            </pre>
          </div>
        ),
      )}
    </div>
  );
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ runId, scenarioId }: { runId: string; scenarioId: string }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", runId],
    queryFn: () => fetchNotes({ run_id: runId }),
  });

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", runId] });
      setDraft({ title: "", content: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string } }) =>
      updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", runId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", runId] }),
  });

  function handleCreate() {
    if (!draft.title.trim()) return;
    createMutation.mutate({
      run_id: runId,
      scenario_id: scenarioId,
      title: draft.title,
      content: draft.content,
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Create note */}
      <div className="card p-4 border-dashed border-2 border-[var(--color-border)]">
        <div className="label mb-2">New Note</div>
        <input
          type="text"
          placeholder="Note title…"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-control px-3 py-2 text-sm text-[var(--color-text)] mb-2 focus:outline-none focus:ring-2 focus:ring-sage/40"
        />
        <textarea
          placeholder="Write research notes…"
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          rows={4}
          className="w-full mono bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-control px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-sage/40 resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            onClick={handleCreate}
            disabled={!draft.title.trim() || createMutation.isPending}
          >
            <Plus size={12} />
            Add Note
          </button>
        </div>
      </div>

      {/* Existing notes */}
      {notes.map((note: ResearchNote) =>
        editingId === note.id ? (
          <div key={note.id} className="card p-4">
            <input
              type="text"
              defaultValue={note.title}
              id={`edit-title-${note.id}`}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-control px-3 py-2 text-sm text-[var(--color-text)] mb-2 focus:outline-none focus:ring-2 focus:ring-sage/40"
            />
            <textarea
              defaultValue={note.content}
              id={`edit-content-${note.id}`}
              rows={5}
              className="w-full mono bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-control px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-sage/40 resize-none"
            />
            <div className="flex gap-2 justify-end mt-2">
              <button
                className="btn-secondary text-xs px-3 py-1.5"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                onClick={() => {
                  const titleEl = document.getElementById(`edit-title-${note.id}`) as HTMLInputElement;
                  const contentEl = document.getElementById(`edit-content-${note.id}`) as HTMLTextAreaElement;
                  updateMutation.mutate({
                    id: note.id,
                    data: { title: titleEl.value, content: contentEl.value },
                  });
                }}
              >
                <Save size={12} />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div key={note.id} className="card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-sm font-semibold text-[var(--color-text)]">{note.title}</div>
                <div className="text-xs text-[var(--color-text-faint)] mt-0.5">
                  {new Date(note.updated_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="btn-ghost text-xs px-2 py-1"
                  onClick={() => setEditingId(note.id)}
                >
                  Edit
                </button>
                <button
                  className="btn-ghost text-xs px-2 py-1 text-vermilion"
                  onClick={() => deleteMutation.mutate(note.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <pre className="mono text-xs text-[var(--color-text-muted)] whitespace-pre-wrap break-words leading-relaxed">
              {note.content}
            </pre>
          </div>
        ),
      )}

      {notes.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--color-text-faint)]">
          No notes for this run yet.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabKey = "events" | "bytes" | "evidence" | "notes";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "events", label: "Events", icon: <Terminal size={13} /> },
  { key: "bytes", label: "Byte Stream", icon: <FileText size={13} /> },
  { key: "evidence", label: "Evidence", icon: <Shield size={13} /> },
  { key: "notes", label: "Notes", icon: <StickyNote size={13} /> },
];

export default function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("events");

  const { data: run, isLoading } = useQuery({
    queryKey: ["run", id],
    queryFn: () => fetchRun(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <Loader2 size={24} className="animate-spin text-iris" />
        <span className="text-[var(--color-text-muted)]">Loading run…</span>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <XCircle size={32} className="text-vermilion" />
        <span className="text-[var(--color-text-muted)]">Run not found.</span>
        <button className="btn-secondary text-sm" onClick={() => navigate("/runs")}>
          Back to Runs
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <div className="flex items-start gap-4 flex-wrap">
          <button
            className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1.5 mt-0.5"
            onClick={() => navigate("/runs")}
          >
            <ArrowLeft size={13} />
            Runs
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--color-text)] truncate">
                {run.scenario_id}
              </h1>
              {statusBadge(run.status)}
              {run.divergence && (
                <span className="badge badge-fail flex items-center gap-1">
                  <AlertTriangle size={10} /> Divergence
                </span>
              )}
              {run.hardened_blocked && (
                <span className="badge badge-pass flex items-center gap-1">
                  <Shield size={10} /> Hardened Blocked
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-[var(--color-text-faint)]">
              <span className="font-mono">
                {run.proxy} → {run.backend}
              </span>
              <span>·</span>
              <span className="capitalize">{run.mode}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {formatDuration(run.duration_ms)}
              </span>
              <span>·</span>
              <span>{new Date(run.started_at).toLocaleString()}</span>
            </div>
          </div>
          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              onClick={() => exportJSON(run)}
            >
              <Download size={12} />
              JSON
            </button>
            <button
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              onClick={() => exportMarkdown(run)}
            >
              <Download size={12} />
              Markdown
            </button>
            <button
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              onClick={() => exportCSV(run.events ?? [])}
            >
              <Download size={12} />
              CSV
            </button>
          </div>
        </div>

        {/* Divergence banner */}
        {run.divergence && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 flex items-center gap-3 px-4 py-2.5 rounded-control bg-vermilion/10 border border-vermilion/30"
          >
            <AlertTriangle size={15} className="text-vermilion flex-shrink-0" />
            <div className="text-sm text-vermilion font-medium">
              Request Desynchronization Observed — Frontend parsed{" "}
              <strong>{run.frontend_count}</strong> message(s), Backend parsed{" "}
              <strong>{run.backend_count}</strong>.
            </div>
          </motion.div>
        )}

        {/* Explanation */}
        {run.explanation && (
          <div className="mt-3 text-xs text-[var(--color-text-muted)] leading-relaxed border-l-2 border-[var(--color-border)] pl-3">
            {run.explanation}
          </div>
        )}

        {/* Stat row */}
        <div className="flex items-center gap-6 mt-3 flex-wrap text-xs">
          <div>
            <span className="text-[var(--color-text-faint)]">Frontend msgs</span>
            <span className="ml-2 font-mono font-semibold text-iris">
              {run.frontend_count ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-faint)]">Backend msgs</span>
            <span className="ml-2 font-mono font-semibold text-golden">
              {run.backend_count ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-faint)]">Events</span>
            <span className="ml-2 font-mono font-semibold text-[var(--color-text)]">
              {run.events?.length ?? 0}
            </span>
          </div>
          {run.severity && (
            <div>
              <span className="text-[var(--color-text-faint)]">Severity</span>
              <span
                className={`ml-2 font-mono font-semibold capitalize ${
                  run.severity === "high"
                    ? "text-vermilion"
                    : run.severity === "medium"
                      ? "text-golden"
                      : "text-sage"
                }`}
              >
                {run.severity}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center gap-0 border-b border-[var(--color-border)] px-6 bg-[var(--color-surface)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[var(--color-accent)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {tab === "events" && (
              <div className="p-4">
                <EventTimeline events={run.events ?? []} />
              </div>
            )}
            {tab === "bytes" && <ByteViewer run={run} />}
            {tab === "evidence" && <EvidenceTab runId={run.id} />}
            {tab === "notes" && (
              <NotesTab runId={run.id} scenarioId={run.scenario_id} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
