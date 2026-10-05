import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCompareArrows,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { fetchRuns, fetchScenarios } from "../lib/api";
import type { Run, Scenario } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type CompareMode = "scenario" | "proxy";

type CellResult = "OBSERVED" | "BLOCKED" | "NO-DESYNC" | "NOT-RUN";

interface MatrixCell {
  result: CellResult;
  runId?: string;
  divergence?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROXIES = ["nginx", "haproxy", "caddy"];
const BACKENDS = ["flask", "fastapi"];

function cellClass(result: CellResult): string {
  switch (result) {
    case "OBSERVED":
      return "bg-vermilion/15 text-vermilion border-vermilion/30";
    case "BLOCKED":
      return "bg-sage/15 text-sage border-sage/30";
    case "NO-DESYNC":
      return "bg-iris/15 text-iris border-iris/30";
    default:
      return "bg-[var(--color-surface-2)] text-[var(--color-text-faint)] border-[var(--color-border)]";
  }
}

function CellIcon({ result }: { result: CellResult }) {
  if (result === "OBSERVED") return <AlertTriangle size={12} />;
  if (result === "BLOCKED") return <CheckCircle2 size={12} />;
  if (result === "NO-DESYNC") return <MinusCircle size={12} />;
  return null;
}

function deriveResult(runs: Run[], scenarioId: string, proxy: string, backend: string): MatrixCell {
  const matching = runs.filter(
    (r) =>
      r.scenario_id === scenarioId &&
      r.proxy === proxy &&
      r.backend === backend &&
      (r.status === "pass" || r.status === "fail"),
  );

  if (matching.length === 0) return { result: "NOT-RUN" };

  // Most recent first
  const sorted = [...matching].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
  const latest = sorted[0];

  if (latest.hardened_blocked) return { result: "BLOCKED", runId: latest.id };
  if (latest.divergence) return { result: "OBSERVED", runId: latest.id, divergence: true };
  return { result: "NO-DESYNC", runId: latest.id };
}

// ── Proxy vs Proxy column comparison ─────────────────────────────────────────

interface ProxyCompareTableProps {
  runs: Run[];
  scenarios: Scenario[];
  proxyA: string;
  proxyB: string;
  backend: string;
}

function ProxyCompareTable({
  runs,
  scenarios,
  proxyA,
  proxyB,
  backend,
}: ProxyCompareTableProps) {
  const rows = scenarios.map((s) => ({
    scenario: s,
    a: deriveResult(runs, s.id, proxyA, backend),
    b: deriveResult(runs, s.id, proxyB, backend),
  }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-3 label">Scenario</th>
            <th className="px-4 py-3 label capitalize">{proxyA}</th>
            <th className="px-4 py-3 label capitalize">{proxyB}</th>
            <th className="px-4 py-3 label">Delta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map(({ scenario, a, b }) => {
            const differ = a.result !== b.result;
            return (
              <motion.tr
                key={scenario.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-[var(--color-text)]">{scenario.name}</div>
                  <div className="text-xs font-mono text-[var(--color-text-faint)]">{scenario.id}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${cellClass(a.result)}`}
                  >
                    <CellIcon result={a.result} />
                    {a.result}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${cellClass(b.result)}`}
                  >
                    <CellIcon result={b.result} />
                    {b.result}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {differ ? (
                    <span className="badge badge-warn text-xs flex items-center gap-1">
                      <GitCompareArrows size={10} />
                      Differs
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-faint)]">Same</span>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Scenario comparison ───────────────────────────────────────────────────────

interface ScenarioCompareTableProps {
  runs: Run[];
  scenarioA: Scenario | null;
  scenarioB: Scenario | null;
}

function ScenarioCompareTable({ runs, scenarioA, scenarioB }: ScenarioCompareTableProps) {
  if (!scenarioA || !scenarioB) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--color-text-faint)]">
        Select two scenarios above to compare.
      </div>
    );
  }

  const combos = PROXIES.flatMap((proxy) =>
    BACKENDS.map((backend) => ({ proxy, backend })),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-3 label">Proxy</th>
            <th className="px-4 py-3 label">Backend</th>
            <th className="px-4 py-3 label truncate max-w-[160px]">{scenarioA.name}</th>
            <th className="px-4 py-3 label truncate max-w-[160px]">{scenarioB.name}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {combos.map(({ proxy, backend }) => {
            const a = deriveResult(runs, scenarioA.id, proxy, backend);
            const b = deriveResult(runs, scenarioB.id, proxy, backend);
            return (
              <tr
                key={`${proxy}-${backend}`}
                className="hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--color-text)]">
                  {proxy}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                  {backend}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${cellClass(a.result)}`}
                  >
                    <CellIcon result={a.result} />
                    {a.result}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${cellClass(b.result)}`}
                  >
                    <CellIcon result={b.result} />
                    {b.result}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Full matrix view ──────────────────────────────────────────────────────────

interface MatrixViewProps {
  runs: Run[];
  scenarios: Scenario[];
}

function MatrixView({ runs, scenarios }: MatrixViewProps) {
  const columns = PROXIES.flatMap((proxy) => BACKENDS.map((backend) => ({ proxy, backend })));

  return (
    <div className="overflow-x-auto">
      <table className="text-left border-collapse text-xs w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="px-4 py-3 label w-48">Scenario</th>
            {columns.map(({ proxy, backend }) => (
              <th key={`${proxy}-${backend}`} className="px-3 py-3 label text-center">
                <div className="capitalize">{proxy}</div>
                <div className="text-[var(--color-text-faint)] font-normal normal-case">{backend}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {scenarios.map((scenario) => (
            <tr
              key={scenario.id}
              className="hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-[var(--color-text)] truncate max-w-[180px]">
                  {scenario.name}
                </div>
                <div className="font-mono text-[var(--color-text-faint)]">{scenario.id}</div>
              </td>
              {columns.map(({ proxy, backend }) => {
                const cell = deriveResult(runs, scenario.id, proxy, backend);
                return (
                  <td
                    key={`${proxy}-${backend}`}
                    className="px-3 py-3 text-center"
                  >
                    <span
                      className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cellClass(cell.result)}`}
                    >
                      <CellIcon result={cell.result} />
                      {cell.result === "NOT-RUN" ? "—" : cell.result}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Picker ────────────────────────────────────────────────────────────────────

interface PickerProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

function Picker({ label, value, options, onChange }: PickerProps) {
  return (
    <div>
      <div className="label mb-2">{label}</div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-[var(--color-surface)] border border-[var(--color-border)] rounded-control px-3 py-2.5 pr-8 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-sage/40"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
        />
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs">
      <span className="text-[var(--color-text-faint)]">Legend:</span>
      {(
        [
          { result: "OBSERVED" as CellResult, label: "Desync observed" },
          { result: "BLOCKED" as CellResult, label: "Hardened: blocked" },
          { result: "NO-DESYNC" as CellResult, label: "No divergence" },
          { result: "NOT-RUN" as CellResult, label: "Not tested" },
        ] as { result: CellResult; label: string }[]
      ).map(({ result, label }) => (
        <div key={result} className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${cellClass(result)}`}
          >
            <CellIcon result={result} />
            {result === "NOT-RUN" ? "—" : result}
          </span>
          <span className="text-[var(--color-text-faint)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = "scenario" | "proxy" | "matrix";

export default function Compare() {
  const [viewMode, setViewMode] = useState<ViewMode>("matrix");
  const [scenarioA, setScenarioA] = useState<string>("");
  const [scenarioB, setScenarioB] = useState<string>("");
  const [proxyA, setProxyA] = useState("nginx");
  const [proxyB, setProxyB] = useState("haproxy");
  const [backend, setBackend] = useState("flask");

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns(500),
  });

  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: fetchScenarios,
    retry: false,
  });

  const isLoading = runsLoading || scenariosLoading;

  const scenarioOptions = (scenarios as Scenario[]).map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const selectedA =
    (scenarios as Scenario[]).find((s) => s.id === scenarioA) ?? null;
  const selectedB =
    (scenarios as Scenario[]).find((s) => s.id === scenarioB) ?? null;

  const VIEW_TABS: { key: ViewMode; label: string }[] = [
    { key: "matrix", label: "Full Matrix" },
    { key: "proxy", label: "Proxy vs Proxy" },
    { key: "scenario", label: "Scenario vs Scenario" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 size={20} className="text-iris" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Compare</h1>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Side-by-side analysis of scenarios, proxies, and results across all runs.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex-shrink-0 flex items-center gap-0 border-b border-[var(--color-border)] px-6 bg-[var(--color-surface)]">
        {VIEW_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setViewMode(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              viewMode === t.key
                ? "border-[var(--color-accent)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 gap-3">
            <Loader2 size={20} className="animate-spin text-iris" />
            <span className="text-sm text-[var(--color-text-muted)]">Loading data…</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-5"
            >
              {/* Proxy vs Proxy controls */}
              {viewMode === "proxy" && (
                <div className="card p-5">
                  <div className="label mb-4">Configure Comparison</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Picker
                      label="Proxy A"
                      value={proxyA}
                      onChange={setProxyA}
                      options={PROXIES.map((p) => ({ value: p, label: p }))}
                    />
                    <Picker
                      label="Proxy B"
                      value={proxyB}
                      onChange={setProxyB}
                      options={PROXIES.map((p) => ({ value: p, label: p }))}
                    />
                    <Picker
                      label="Backend"
                      value={backend}
                      onChange={setBackend}
                      options={BACKENDS.map((b) => ({ value: b, label: b }))}
                    />
                  </div>
                </div>
              )}

              {/* Scenario vs Scenario controls */}
              {viewMode === "scenario" && (
                <div className="card p-5">
                  <div className="label mb-4">Select Scenarios to Compare</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Picker
                      label="Scenario A"
                      value={scenarioA}
                      onChange={setScenarioA}
                      options={[
                        { value: "", label: "— Pick a scenario —" },
                        ...scenarioOptions,
                      ]}
                    />
                    <Picker
                      label="Scenario B"
                      value={scenarioB}
                      onChange={setScenarioB}
                      options={[
                        { value: "", label: "— Pick a scenario —" },
                        ...scenarioOptions,
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Legend */}
              <Legend />

              {/* Stats summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    {
                      label: "Observed",
                      result: "OBSERVED" as CellResult,
                      color: "text-vermilion",
                    },
                    { label: "Blocked", result: "BLOCKED" as CellResult, color: "text-sage" },
                    {
                      label: "No Desync",
                      result: "NO-DESYNC" as CellResult,
                      color: "text-iris",
                    },
                    {
                      label: "Not Run",
                      result: "NOT-RUN" as CellResult,
                      color: "text-[var(--color-text-faint)]",
                    },
                  ] as { label: string; result: CellResult; color: string }[]
                ).map(({ label, result, color }) => {
                  const count = (scenarios as Scenario[]).reduce((acc, s) => {
                    const proxiesToCheck =
                      viewMode === "proxy" ? [proxyA, proxyB] : PROXIES;
                    return (
                      acc +
                      proxiesToCheck.filter((p) => {
                        const cell = deriveResult(runs as Run[], s.id, p, backend);
                        return cell.result === result;
                      }).length
                    );
                  }, 0);
                  return (
                    <div key={result} className="card p-4 text-center">
                      <div className={`text-2xl font-bold font-mono ${color}`}>{count}</div>
                      <div className="text-xs text-[var(--color-text-faint)] mt-1">{label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Main table */}
              <div className="card overflow-hidden">
                {viewMode === "matrix" && (
                  <MatrixView runs={runs as Run[]} scenarios={scenarios as Scenario[]} />
                )}
                {viewMode === "proxy" && (
                  <ProxyCompareTable
                    runs={runs as Run[]}
                    scenarios={scenarios as Scenario[]}
                    proxyA={proxyA}
                    proxyB={proxyB}
                    backend={backend}
                  />
                )}
                {viewMode === "scenario" && (
                  <ScenarioCompareTable
                    runs={runs as Run[]}
                    scenarioA={selectedA}
                    scenarioB={selectedB}
                  />
                )}
              </div>

              {/* No runs yet hint */}
              {(runs as Run[]).length === 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-control border border-golden/30 bg-golden/8 text-sm text-golden">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  No runs found. Execute scenarios from the Attack Lab to populate this matrix.
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
