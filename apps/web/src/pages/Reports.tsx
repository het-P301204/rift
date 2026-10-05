import { useQuery } from "@tanstack/react-query";
import { fetchRuns, fetchStats } from "../lib/api";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card p-5">
      <div className="label mb-2">{label}</div>
      <div className={`text-3xl font-bold mono ${color ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</div>}
    </div>
  );
}

export default function Reports() {
  const { data: runs = [] } = useQuery({ queryKey: ["runs"], queryFn: () => fetchRuns(200) });
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });

  const diverged = runs.filter(r => r.divergence === true);
  const hardened = runs.filter(r => r.hardened_blocked === true && r.status === "pass");
  const byScenario = runs.reduce<Record<string, number>>((acc, r) => {
    acc[r.scenario_id] = (acc[r.scenario_id] ?? 0) + 1;
    return acc;
  }, {});
  const byProxy = runs.reduce<Record<string, { total: number; diverged: number }>>((acc, r) => {
    if (!acc[r.proxy]) acc[r.proxy] = { total: 0, diverged: 0 };
    acc[r.proxy].total++;
    if (r.divergence === true) acc[r.proxy].diverged++;
    return acc;
  }, {});
  const successRate = runs.length > 0 ? Math.round(((stats?.passed ?? 0) / runs.length) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Research Reports</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Aggregate analysis of all research sessions</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="TOTAL RUNS" value={runs.length} sub="all scenarios" />
        <StatCard label="DESYNCS DETECTED" value={diverged.length} sub={`${runs.length > 0 ? Math.round((diverged.length / runs.length) * 100) : 0}% detection rate`} color="text-vermilion" />
        <StatCard label="HARDENED BLOCKS" value={hardened.length} sub="mitigations verified" color="text-sage" />
        <StatCard label="SUCCESS RATE" value={`${successRate}%`} sub="clean executions" />
      </div>

      {/* By scenario */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Run Coverage by Scenario</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {Object.entries(byScenario).sort((a, b) => b[1] - a[1]).map(([id, count]) => {
            const scenarioDiverged = runs.filter(r => r.scenario_id === id && r.divergence === true).length;
            const pct = Math.round((scenarioDiverged / count) * 100);
            return (
              <div key={id} className="flex items-center gap-4 px-5 py-3">
                <span className="mono text-sm w-48 truncate">{id}</span>
                <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-vermilion rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-[var(--color-text-muted)] w-28 text-right">{scenarioDiverged}/{count} diverged ({pct}%)</span>
                <Link to={`/scenarios/${id}`} className="btn-ghost text-xs">View</Link>
              </div>
            );
          })}
          {Object.keys(byScenario).length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">No run data yet — launch scenarios from the Research Lab.</div>
          )}
        </div>
      </div>

      {/* By proxy */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Proxy Vulnerability Summary</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)]">
            <tr>
              <th className="text-left px-5 py-2 label">Proxy</th>
              <th className="text-left px-5 py-2 label">Total Runs</th>
              <th className="text-left px-5 py-2 label">Divergences</th>
              <th className="text-left px-5 py-2 label">Vuln Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {Object.entries(byProxy).map(([proxy, { total, diverged: d }]) => (
              <tr key={proxy}>
                <td className="px-5 py-3 mono font-medium">{proxy}</td>
                <td className="px-5 py-3">{total}</td>
                <td className="px-5 py-3 text-vermilion font-medium">{d}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${d / total > 0.5 ? "badge-fail" : "badge-warn"}`}>{Math.round((d / total) * 100)}%</span>
                </td>
              </tr>
            ))}
            {Object.keys(byProxy).length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-[var(--color-text-muted)]">No data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent divergences */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold">Recent Divergences</h2>
          <Link to="/runs?filter=divergence" className="btn-ghost text-xs">View all</Link>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {diverged.slice(0, 8).map(r => (
            <Link key={r.id} to={`/runs/${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--color-surface-2)] transition-colors">
              <AlertTriangle size={14} className="text-vermilion flex-shrink-0" />
              <span className="mono text-xs text-[var(--color-text-muted)]">{r.id}</span>
              <span className="text-sm flex-1">{r.scenario_id}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{r.proxy} → {r.backend}</span>
              <span className={`badge ${r.hardened_blocked ? "badge-pass" : "badge-fail"}`}>{r.hardened_blocked ? "hardened" : "vulnerable"}</span>
            </Link>
          ))}
          {diverged.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">No divergences recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
