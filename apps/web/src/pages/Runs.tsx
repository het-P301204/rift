import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Trash2,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
} from "lucide-react";
import { fetchRuns, deleteRun } from "../lib/api";
import type { Run } from "../lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

type FilterKey = "all" | "pass" | "fail" | "error" | "divergence" | "hardened";

function statusBadgeClass(status: Run["status"]): string {
  if (status === "pass") return "badge badge-pass";
  if (status === "fail") return "badge badge-fail";
  if (status === "error") return "badge badge-warn";
  if (status === "running") return "badge badge-info";
  return "badge badge-neutral";
}

function StatusIcon({ status }: { status: Run["status"] }) {
  if (status === "pass") return <CheckCircle2 size={14} className="text-sage" />;
  if (status === "fail") return <XCircle size={14} className="text-vermilion" />;
  if (status === "error") return <AlertTriangle size={14} className="text-golden" />;
  if (status === "running") return <Loader2 size={14} className="text-iris animate-spin" />;
  return <Clock size={14} className="text-[var(--color-text-faint)]" />;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function applyFilter(runs: Run[], filter: FilterKey): Run[] {
  switch (filter) {
    case "pass":
      return runs.filter((r) => r.status === "pass");
    case "fail":
      return runs.filter((r) => r.status === "fail");
    case "error":
      return runs.filter((r) => r.status === "error");
    case "divergence":
      return runs.filter((r) => r.divergence === true);
    case "hardened":
      return runs.filter((r) => r.hardened_blocked === true);
    default:
      return runs;
  }
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pass", label: "Pass" },
  { key: "fail", label: "Fail" },
  { key: "error", label: "Error" },
  { key: "divergence", label: "Divergence" },
  { key: "hardened", label: "Hardened" },
];

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterKey }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <Inbox size={40} className="text-[var(--color-text-faint)] mb-4" />
      <div className="text-base font-semibold text-[var(--color-text-muted)] mb-1">
        {filter === "all" ? "No runs yet" : `No ${filter} runs`}
      </div>
      <p className="text-sm text-[var(--color-text-faint)] max-w-xs">
        {filter === "all"
          ? "Run a scenario from the Attack Lab to see results here."
          : `No runs match the "${filter}" filter. Try a different filter or run more scenarios.`}
      </p>
    </motion.div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  run: Run;
  index: number;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onNavigate: (id: string) => void;
}

function RunRow({ run, index, selected, onSelect, onNavigate }: RowProps) {
  return (
    <motion.tr
      key={run.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.03 }}
      onClick={() => onNavigate(run.id)}
      className="cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors duration-100 group"
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(run.id, e.target.checked)}
          className="accent-sage"
        />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-faint)]">
        {run.id.slice(0, 8)}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-[var(--color-text)]">{run.scenario_id}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          {run.proxy} → {run.backend}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="badge badge-neutral text-xs capitalize">{run.mode}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <StatusIcon status={run.status} />
          <span className={statusBadgeClass(run.status)}>{run.status.toUpperCase()}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-muted)]">
        {run.frontend_count ?? "—"} / {run.backend_count ?? "—"}
      </td>
      <td className="px-4 py-3">
        {run.divergence ? (
          <span className="badge badge-fail">YES</span>
        ) : run.divergence === false ? (
          <span className="badge badge-pass">NO</span>
        ) : (
          <span className="text-xs text-[var(--color-text-faint)]">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-muted)]">
        {formatDuration(run.duration_ms)}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-faint)]">
        {formatDate(run.started_at)}
      </td>
      <td className="px-4 py-3">
        <ChevronRight
          size={14}
          className="text-[var(--color-text-faint)] group-hover:text-[var(--color-text)] transition-colors"
        />
      </td>
    </motion.tr>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Runs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns(200),
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["runs"] }),
  });

  const filtered = applyFilter(runs, filter);

  function handleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(filtered.map((r) => r.id)) : new Set());
  }

  async function handleBulkDelete() {
    for (const id of selected) {
      await deleteMutation.mutateAsync(id);
    }
    setSelected(new Set());
    setConfirmBulkDelete(false);
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className="h-full flex flex-col p-6 gap-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Run History</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            All scenario executions across all configurations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && !confirmBulkDelete && (
            <button
              className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5"
              onClick={() => setConfirmBulkDelete(true)}
            >
              <Trash2 size={13} />
              Delete {selected.size} run{selected.size > 1 ? "s" : ""}
            </button>
          )}
          {confirmBulkDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-vermilion">Confirm delete?</span>
              <button className="btn-danger text-xs px-3 py-1.5" onClick={handleBulkDelete}>
                Yes, delete
              </button>
              <button
                className="btn-secondary text-xs px-3 py-1.5"
                onClick={() => setConfirmBulkDelete(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1 flex-wrap">
        {FILTERS.map((f) => {
          const count =
            f.key === "all"
              ? runs.length
              : applyFilter(runs, f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-control text-xs font-medium transition-colors duration-100 flex items-center gap-1.5 ${
                filter === f.key
                  ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
              }`}
            >
              {f.label}
              <span
                className={`text-xs font-mono ${
                  filter === f.key
                    ? "text-[var(--color-bg)] opacity-70"
                    : "text-[var(--color-text-faint)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
        <span className="ml-auto text-xs text-[var(--color-text-faint)]">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="card flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 gap-3">
            <Loader2 size={20} className="animate-spin text-iris" />
            <span className="text-sm text-[var(--color-text-muted)]">Loading runs…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface)] z-10">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="accent-sage"
                  />
                </th>
                <th className="px-4 py-3 label">Run #</th>
                <th className="px-4 py-3 label">Scenario</th>
                <th className="px-4 py-3 label">Proxy → Backend</th>
                <th className="px-4 py-3 label">Mode</th>
                <th className="px-4 py-3 label">Status</th>
                <th className="px-4 py-3 label">F / B Count</th>
                <th className="px-4 py-3 label">Divergence</th>
                <th className="px-4 py-3 label">Duration</th>
                <th className="px-4 py-3 label">Date</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              <AnimatePresence>
                {filtered.map((run, i) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    index={i}
                    selected={selected.has(run.id)}
                    onSelect={handleSelect}
                    onNavigate={(id) => navigate(`/runs/${id}`)}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
