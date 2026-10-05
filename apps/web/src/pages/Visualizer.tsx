import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchRun } from "../lib/api";
import { useLabStore } from "../store/useLabStore";
import { ByteViewer } from "../components/ByteViewer";

type ViewMode = "ascii" | "hex" | "decoded" | "semantic";

interface Boundary {
  start: number;
  end: number;
  label: string;
  semantic: string;
}

export default function Visualizer() {
  const { runId } = useParams();
  const { activeEvents } = useLabStore();
  const [mode, setViewMode] = useState<ViewMode>("semantic");
  const [activeTier, setActiveTier] = useState<"both" | "frontend" | "backend">("both");

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetchRun(runId!),
    enabled: !!runId,
  });

  // Get data from run or from live store events
  const clientSentEvent = run
    ? (run.events ?? []).find((e) => e.kind === "CLIENT_SENT")
    : activeEvents.find((e) => e.kind === "CLIENT_SENT");
  const proxyEvent = run
    ? (run.events ?? []).find((e) => e.kind === "PROXY_PARSED")
    : activeEvents.find((e) => e.kind === "PROXY_PARSED");
  const backendEvent = run
    ? (run.events ?? []).find((e) => e.kind === "BACKEND_PARSED")
    : activeEvents.find((e) => e.kind === "BACKEND_PARSED");
  const divergenceEvent = run
    ? (run.events ?? []).find((e) => e.kind === "DIVERGENCE")
    : activeEvents.find((e) => e.kind === "DIVERGENCE");

  const rawHex = (clientSentEvent?.data?.hex as string) ?? "";
  const frontendBoundaries = ((proxyEvent?.data?.boundaries as Boundary[]) ?? []);
  const backendBoundaries = ((backendEvent?.data?.boundaries as Boundary[]) ?? []);

  const MODES: ViewMode[] = ["ascii", "hex", "decoded", "semantic"];

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="text-sm text-[var(--color-text-muted)]">Loading run data…</div></div>;
  if (isError) return <div className="flex-1 flex items-center justify-center"><div className="text-sm text-vermilion">Failed to load run.</div></div>;

  if (!clientSentEvent && !runId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <div className="text-4xl mb-4 opacity-20">⊥</div>
          <p className="text-sm text-[var(--color-text-muted)]">
            No byte stream data available. Run a scenario in the <a href="/lab" className="underline">Research Lab</a> first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Byte Stream Visualizer</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {rawHex ? `${rawHex.length / 2} bytes transmitted` : "No stream data"}
            {divergenceEvent ? " · Divergence detected" : ""}
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)]">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === m ? "bg-graphite-900 text-ivory-warm dark:bg-[var(--color-text)] dark:text-[var(--color-bg)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Raw stream */}
      {rawHex && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="label">Raw Stream</span>
            <span className="badge badge-neutral mono text-xs">{rawHex.length / 2} bytes</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <ByteViewer rawHex={rawHex} boundaries={frontendBoundaries} mode={mode} />
          </div>
        </div>
      )}

      {/* Interpretation split */}
      <div className="flex gap-2 p-1 rounded-control border border-[var(--color-border)] w-fit">
        {(["both", "frontend", "backend"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTier(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              activeTier === t ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${activeTier === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
        {(activeTier === "both" || activeTier === "frontend") && proxyEvent && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-iris/30 bg-iris/5 flex items-center justify-between">
              <span className="label text-iris">Frontend Interpretation</span>
              <span className="badge badge-info">{proxyEvent.data.message_count as number} request(s)</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-4 text-xs">
                <div><span className="label">Framing</span><div className="mono mt-1">{proxyEvent.data.framing as string}</div></div>
                <div><span className="label">Consumed</span><div className="mono mt-1">{proxyEvent.data.consumed_bytes as number}B</div></div>
              </div>
              <div>
                <span className="label block mb-2">Boundaries</span>
                <div className="space-y-1">
                  {frontendBoundaries.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`badge ${b.semantic === "SMUGGLED" ? "badge-fail" : b.semantic === "HEADER" ? "badge-info" : b.semantic === "BODY" ? "badge-warn" : "badge-neutral"}`}>
                        {b.semantic}
                      </span>
                      <span className="mono text-[var(--color-text-faint)]">{b.start}–{b.end}</span>
                      <span className="text-[var(--color-text-muted)] truncate">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {(proxyEvent.data.notes as string[])?.length > 0 && (
                <div className="mt-2 text-xs text-[var(--color-text-muted)] space-y-1">
                  {(proxyEvent.data.notes as string[]).map((n, i) => <div key={i}>· {n}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {(activeTier === "both" || activeTier === "backend") && backendEvent && (
          <div className={`card overflow-hidden ${divergenceEvent ? "border-vermilion/30" : ""}`}>
            <div className={`px-5 py-3 border-b flex items-center justify-between ${divergenceEvent ? "border-vermilion/30 bg-vermilion/5" : "border-[var(--color-border)]"}`}>
              <span className={`label ${divergenceEvent ? "text-vermilion" : ""}`}>Backend Interpretation</span>
              <span className={`badge ${divergenceEvent ? "badge-fail" : "badge-neutral"}`}>{backendEvent.data.message_count as number} request(s)</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-4 text-xs">
                <div><span className="label">Framing</span><div className="mono mt-1">{backendEvent.data.framing as string}</div></div>
                <div><span className="label">Consumed</span><div className="mono mt-1">{backendEvent.data.consumed_bytes as number}B</div></div>
              </div>
              <div>
                <span className="label block mb-2">Boundaries</span>
                <div className="space-y-1">
                  {backendBoundaries.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`badge ${b.semantic === "SMUGGLED" ? "badge-fail" : b.semantic === "HEADER" ? "badge-info" : b.semantic === "BODY" ? "badge-warn" : "badge-neutral"}`}>
                        {b.semantic}
                      </span>
                      <span className="mono text-[var(--color-text-faint)]">{b.start}–{b.end}</span>
                      <span className="text-[var(--color-text-muted)] truncate">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {(backendEvent.data.notes as string[])?.length > 0 && (
                <div className="mt-2 text-xs text-[var(--color-text-muted)] space-y-1">
                  {(backendEvent.data.notes as string[]).map((n, i) => <div key={i}>· {n}</div>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Explanation */}
      {divergenceEvent && (
        <div className="card p-5 border-vermilion/30">
          <h3 className="font-medium text-vermilion mb-2">Research Observation — Request Boundary Divergence</h3>
          <p className="text-sm text-[var(--color-text)] leading-relaxed mb-3">
            {divergenceEvent.data.explanation as string}
          </p>
          <div className="flex gap-4 text-xs">
            <div><span className="label">Severity</span><div className={`mt-1 badge ${divergenceEvent.data.severity === "high" ? "badge-fail" : "badge-warn"}`}>{divergenceEvent.data.severity as string}</div></div>
            {divergenceEvent.data.divergent_byte_offset != null && (
              <div><span className="label">Divergent Offset</span><div className="mono mt-1">{String(divergenceEvent.data.divergent_byte_offset)}</div></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
