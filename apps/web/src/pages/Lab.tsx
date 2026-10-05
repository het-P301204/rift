import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Play, Square, Shield, Beaker, Eye, ChevronDown, ArrowRight, AlertTriangle, CheckCircle } from "lucide-react";
import { createRunSocket, fetchScenarios } from "../lib/api";
import { useLabStore } from "../store/useLabStore";
import { EventTimeline } from "../components/EventTimeline";

const PROXIES = [
  { id: "nginx", label: "nginx", desc: "Prefers Content-Length" },
  { id: "haproxy", label: "HAProxy", desc: "Prefers Transfer-Encoding" },
  { id: "caddy", label: "Caddy", desc: "Prefers Content-Length" },
];
const BACKENDS = [
  { id: "flask", label: "Flask", desc: "Python WSGI" },
  { id: "fastapi", label: "FastAPI", desc: "Python ASGI" },
];

export default function Lab() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    activeProxy, activeBackend, hardened, isRunning, activeEvents,
    setProxy, setBackend, setHardened, setRunning, pushEvent, clearEvents, setActiveRun,
  } = useLabStore();

  const [selectedScenario, setSelectedScenario] = useState(searchParams.get("scenario") ?? "cl-te");
  const [timingMs, setTimingMs] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: scenarios } = useQuery({ queryKey: ["scenarios"], queryFn: fetchScenarios });

  const currentDivergence = activeEvents.find((e) => e.kind === "DIVERGENCE");
  const doneEvent = activeEvents.find((e) => e.kind === "DONE");
  const hardenedBlocked = activeEvents.find((e) => e.kind === "HARDENED_BLOCKED");
  const proxyParsed = activeEvents.find((e) => e.kind === "PROXY_PARSED");
  const backendParsed = activeEvents.find((e) => e.kind === "BACKEND_PARSED");
  const clientSent = activeEvents.find((e) => e.kind === "CLIENT_SENT");

  const runScenario = () => {
    if (isRunning) return;
    clearEvents();
    setRunning(true);
    setActiveRun(null);

    wsRef.current = createRunSocket(
      { scenario_id: selectedScenario, proxy: activeProxy, backend: activeBackend, hardened, timing_ms: timingMs },
      (e) => { pushEvent(e); if (e.kind === "DONE") setActiveRun(null); },
      () => setRunning(false),
      (msg) => { pushEvent({ ts: 0, kind: "ERROR", message: msg, data: {} }); setRunning(false); },
    );
  };

  const stopRun = () => {
    wsRef.current?.close();
    setRunning(false);
  };

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const selectedScenarioData = scenarios?.find((s) => s.id === selectedScenario);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Controls Panel */}
      <div className="w-80 flex-shrink-0 border-r border-[var(--color-border)] overflow-y-auto p-5 space-y-5">
        <div>
          <h1 className="text-lg font-bold">Research Lab</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Controlled HTTP desync environment</p>
        </div>

        {/* Scenario */}
        <div>
          <label className="label block mb-2">Scenario</label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            disabled={isRunning}
            className="w-full px-3 py-2 text-sm rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] disabled:opacity-50 outline-none focus:border-vermilion"
          >
            {(scenarios ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedScenarioData && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
              {selectedScenarioData.description?.slice(0, 120)}…
            </p>
          )}
        </div>

        {/* Proxy */}
        <div>
          <label className="label block mb-2">Frontend Proxy</label>
          <div className="space-y-1.5">
            {PROXIES.map((p) => (
              <button
                key={p.id}
                onClick={() => setProxy(p.id)}
                disabled={isRunning}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control border text-sm text-left transition-colors disabled:opacity-50 ${
                  activeProxy === p.id
                    ? "border-graphite-700 bg-graphite-900 text-ivory-warm dark:border-ivory-soft dark:bg-[var(--color-surface-2)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]"
                }`}
              >
                <span className="font-mono text-xs font-semibold w-16">{p.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Backend */}
        <div>
          <label className="label block mb-2">Backend</label>
          <div className="space-y-1.5">
            {BACKENDS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBackend(b.id)}
                disabled={isRunning}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control border text-sm text-left transition-colors disabled:opacity-50 ${
                  activeBackend === b.id
                    ? "border-graphite-700 bg-graphite-900 text-ivory-warm dark:border-ivory-soft dark:bg-[var(--color-surface-2)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]"
                }`}
              >
                <span className="font-mono text-xs font-semibold w-16">{b.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{b.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode toggle */}
        <div>
          <label className="label block mb-2">Mode</label>
          <div className="flex rounded-control overflow-hidden border border-[var(--color-border)]">
            <button
              onClick={() => setHardened(false)}
              disabled={isRunning}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                !hardened ? "bg-graphite-900 text-ivory-warm dark:bg-[var(--color-text)] dark:text-[var(--color-bg)]" : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <Beaker size={12} /> Research
            </button>
            <button
              onClick={() => setHardened(true)}
              disabled={isRunning}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                hardened ? "bg-sage text-white" : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <Shield size={12} /> Hardened
            </button>
          </div>
          {hardened && (
            <p className="text-xs text-sage mt-1.5">Defensive mitigations active — ambiguous requests will be rejected.</p>
          )}
        </div>

        {/* Timing */}
        <div>
          <label className="label block mb-2">Timing Delay <span className="normal-case font-normal">{timingMs}ms</span></label>
          <input
            type="range" min={0} max={500} step={25} value={timingMs}
            onChange={(e) => setTimingMs(Number(e.target.value))}
            disabled={isRunning}
            className="w-full accent-vermilion disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-[var(--color-text-faint)] mt-0.5">
            <span>0ms</span><span>500ms</span>
          </div>
        </div>

        {/* Run / Stop */}
        <div className="pt-2 space-y-2">
          {!isRunning ? (
            <button onClick={runScenario} className="btn-primary w-full justify-center py-3 text-base">
              <Play size={16} /> Run Scenario
            </button>
          ) : (
            <button onClick={stopRun} className="btn-danger w-full justify-center py-3">
              <Square size={16} /> Stop Run
            </button>
          )}
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Status bar */}
        <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${isRunning ? "status-dot-running" : doneEvent ? "status-dot-ready" : "bg-[var(--color-border)]"}`} />
            <span className="text-sm font-medium">
              {isRunning ? "Running…" : activeEvents.length === 0 ? "Waiting for scenario" : doneEvent ? "Complete" : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mono">
            <span>{selectedScenario}</span>
            <ArrowRight size={10} />
            <span>{activeProxy}</span>
            <ArrowRight size={10} />
            <span>{activeBackend}</span>
          </div>
          {hardened && <span className="badge badge-pass"><Shield size={10} /> hardened</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Empty state */}
          {activeEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4 opacity-20">
                <Beaker size={64} className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
                Configure a scenario and click <strong>Run Scenario</strong> to observe HTTP interpretation divergence.
              </p>
            </div>
          )}

          {/* Divergence banner */}
          <AnimatePresence>
            {currentDivergence && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-panel border border-vermilion/40 bg-vermilion/10 p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-vermilion flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-vermilion mb-1">Boundary Divergence Detected</div>
                    <div className="text-sm text-[var(--color-text)] mb-3">
                      Frontend: <strong>{currentDivergence.data.frontend_count as number} request(s)</strong> ·
                      Backend: <strong>{currentDivergence.data.backend_count as number} request(s)</strong>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                      {currentDivergence.data.explanation as string}
                    </p>
                    <button
                      onClick={() => navigate("/visualizer")}
                      className="btn-secondary mt-3 text-xs"
                    >
                      <Eye size={12} /> View Byte Stream
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hardened blocked banner */}
          <AnimatePresence>
            {hardenedBlocked && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-panel border border-sage/40 bg-sage/10 p-5"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-sage flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sage mb-1">Request Blocked by Hardened Configuration</div>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                      {hardenedBlocked.data.reason as string}. The backend never received an ambiguous byte stream.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Split interpretation view */}
          {proxyParsed && backendParsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-4">
              {/* Attacker sends */}
              <div className="card p-4">
                <div className="label mb-3">Attacker Sends</div>
                <div className="text-2xl font-bold mono">1</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">byte stream</div>
                {clientSent && (
                  <div className="mt-3 text-xs mono text-[var(--color-text-faint)] truncate">
                    {clientSent.data.bytes as number} bytes
                  </div>
                )}
              </div>
              {/* Frontend */}
              <div className="card p-4 border-iris/30">
                <div className="label mb-3 text-iris">Frontend Sees</div>
                <div className="text-2xl font-bold mono text-iris">{proxyParsed.data.message_count as number}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">request(s)</div>
                <div className="mt-2 text-xs mono badge badge-info">{proxyParsed.data.framing as string}</div>
              </div>
              {/* Backend */}
              <div className={`card p-4 ${currentDivergence ? "border-vermilion/40" : "border-[var(--color-border)]"}`}>
                <div className={`label mb-3 ${currentDivergence ? "text-vermilion" : ""}`}>Backend Sees</div>
                <div className={`text-2xl font-bold mono ${currentDivergence ? "text-vermilion" : ""}`}>
                  {backendParsed.data.message_count as number}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">request(s)</div>
                <div className="mt-2 text-xs mono badge badge-neutral">{backendParsed.data.framing as string}</div>
              </div>
            </motion.div>
          )}

          {/* Event timeline */}
          {activeEvents.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-medium">Event Timeline</h3>
              </div>
              <EventTimeline events={activeEvents} isLive={isRunning} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
