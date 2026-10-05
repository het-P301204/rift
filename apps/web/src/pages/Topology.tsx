import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Monitor, Server, Database, Wifi, AlertTriangle, CheckCircle } from "lucide-react";
import { fetchTopology } from "../lib/api";
import type { TopologyService } from "../lib/api";
import { useLabStore } from "../store/useLabStore";

// ── Status helpers ──────────────────────────────────────────────────────────

function statusDotClass(status: string): string {
  const s = status?.toLowerCase();
  if (s === "ready" || s === "running") return "status-dot status-dot-ready";
  if (s === "starting") return "status-dot status-dot-running";
  if (s === "failed" || s === "error") return "status-dot status-dot-error";
  return "status-dot status-dot-stopped";
}

function statusLabel(status: string): string {
  const s = status?.toLowerCase();
  if (s === "ready") return "READY";
  if (s === "running") return "RUNNING";
  if (s === "starting") return "STARTING";
  if (s === "failed" || s === "error") return "FAILED";
  return "STOPPED";
}

// ── SVG topology node ────────────────────────────────────────────────────────

interface NodeProps {
  x: number;
  y: number;
  label: string;
  sublabel?: string;
  icon: "monitor" | "server" | "database";
  status: string;
  width?: number;
}

function TopoNode({ x, y, label, sublabel, icon, status, width = 140 }: NodeProps) {
  const h = 84;
  const rx = 14;

  const isReady = ["ready", "running"].includes(status?.toLowerCase());
  const isStarting = status?.toLowerCase() === "starting";
  const isFailed = ["failed", "error"].includes(status?.toLowerCase());

  const borderColor = isReady
    ? "var(--sage, #7FA083)"
    : isStarting
      ? "var(--golden, #D8AA42)"
      : isFailed
        ? "var(--vermilion, #E85D4A)"
        : "var(--color-border)";

  const dotColor = isReady
    ? "#7FA083"
    : isStarting
      ? "#D8AA42"
      : isFailed
        ? "#E85D4A"
        : "#666666";

  return (
    <g>
      {/* Drop shadow rect */}
      <rect
        x={x - width / 2 + 2}
        y={y + 2}
        width={width}
        height={h}
        rx={rx}
        fill="rgba(0,0,0,0.10)"
      />
      {/* Card rect */}
      <rect
        x={x - width / 2}
        y={y}
        width={width}
        height={h}
        rx={rx}
        fill="var(--color-surface)"
        stroke={borderColor}
        strokeWidth="1.5"
      />
      {/* Icon area */}
      <foreignObject x={x - 14} y={y + 10} width={28} height={28}>
        <div
          style={{
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-surface-2)",
            borderRadius: 8,
          }}
        >
          {icon === "monitor" && <Monitor size={14} color="var(--color-text-muted)" />}
          {icon === "server" && <Server size={14} color="var(--color-text-muted)" />}
          {icon === "database" && <Database size={14} color="var(--color-text-muted)" />}
        </div>
      </foreignObject>
      {/* Status dot */}
      <circle cx={x + width / 2 - 14} cy={y + 14} r={4} fill={dotColor}>
        {isStarting && (
          <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
        )}
      </circle>
      {/* Label */}
      <text
        x={x}
        y={y + 56}
        textAnchor="middle"
        fill="var(--color-text)"
        fontSize={12}
        fontWeight={600}
        fontFamily="Manrope, sans-serif"
      >
        {label}
      </text>
      {/* Sublabel */}
      {sublabel && (
        <text
          x={x}
          y={y + 72}
          textAnchor="middle"
          fill="var(--color-text-faint)"
          fontSize={10}
          fontFamily="IBM Plex Mono, monospace"
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

// ── Animated dashed connection line ─────────────────────────────────────────

interface ConnectionProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  active?: boolean;
}

function Connection({ x1, y1, x2, y2, label, active = true }: ConnectionProps) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--color-border)"
        strokeWidth={2}
        strokeDasharray="0"
      />
      {active && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#7FA083"
          strokeWidth={2}
          strokeDasharray="8 6"
          strokeOpacity={0.75}
        >
          <animate
            attributeName="stroke-dashoffset"
            from="100"
            to="0"
            dur="2s"
            repeatCount="indefinite"
          />
        </line>
      )}
      {/* Arrow head */}
      <polygon
        points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`}
        fill={active ? "#7FA083" : "var(--color-border)"}
        opacity={active ? 0.75 : 1}
      />
      {label && (
        <text
          x={mx}
          y={my - 8}
          textAnchor="middle"
          fill="var(--color-text-faint)"
          fontSize={9}
          fontFamily="IBM Plex Mono, monospace"
          letterSpacing={1}
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ── Lab status row ──────────────────────────────────────────────────────────

interface LabStatusRowProps {
  name: string;
  status: string;
  detail?: string;
}

function LabStatusRow({ name, status, detail }: LabStatusRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
      <div>
        <span className="text-sm font-medium text-[var(--color-text)]">{name}</span>
        {detail && (
          <span className="ml-2 text-xs text-[var(--color-text-faint)] font-mono">{detail}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={statusDotClass(status)} />
        <span
          className={`text-xs font-mono font-semibold ${
            ["ready", "running"].includes(status?.toLowerCase())
              ? "text-sage"
              : status?.toLowerCase() === "starting"
                ? "text-golden"
                : status?.toLowerCase() === "failed"
                  ? "text-vermilion"
                  : "text-[var(--color-text-faint)]"
          }`}
        >
          {statusLabel(status)}
        </span>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Topology() {
  const { activeProxy, activeBackend } = useLabStore();

  const { data: topology, isLoading } = useQuery({
    queryKey: ["topology"],
    queryFn: fetchTopology,
    refetchInterval: 5000,
    retry: false,
  });

  const proxy = topology?.proxies?.[0];
  const backend = topology?.backends?.[0];
  const mode = topology?.mode ?? "simulation";
  const network = topology?.network ?? "rift-local-sim";

  const isSimulation = mode === "simulation";

  // SVG layout constants
  const svgW = 640;
  const svgH = 220;
  const nodeY = 60;
  const clientX = 100;
  const proxyX = 320;
  const backendX = 540;
  const midNodeY = nodeY + 42; // vertical center of node for connections

  return (
    <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Container Topology</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Live view of request-smuggling lab infrastructure and service health.
        </p>
      </div>

      {/* Simulation banner */}
      {isSimulation && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-control border border-golden/40 bg-golden/10"
        >
          <AlertTriangle size={16} className="text-golden flex-shrink-0" />
          <span className="text-sm font-medium text-golden">
            SIMULATION MODE — No Docker required. Protocol engine active.
          </span>
        </motion.div>
      )}

      <div className="flex gap-6 flex-col xl:flex-row">
        {/* SVG topology diagram */}
        <motion.div
          className="card flex-1 p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="label mb-4">Network Topology</div>

          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              width="100%"
              style={{ maxWidth: svgW, minWidth: 320 }}
            >
              {/* Connection: CLIENT → PROXY */}
              <Connection
                x1={clientX + 70}
                y1={midNodeY}
                x2={proxyX - 70}
                y2={midNodeY}
                label="HTTP/1.1"
                active={!isLoading}
              />
              {/* Connection: PROXY → BACKEND */}
              <Connection
                x1={proxyX + 70}
                y1={midNodeY}
                x2={backendX - 70}
                y2={midNodeY}
                label="HTTP/1.1"
                active={!isLoading}
              />

              {/* Nodes */}
              <TopoNode
                x={clientX}
                y={nodeY}
                label="CLIENT"
                sublabel="synthetic"
                icon="monitor"
                status="ready"
              />
              <TopoNode
                x={proxyX}
                y={nodeY}
                label="PROXY"
                sublabel={proxy?.name ?? activeProxy}
                icon="server"
                status={proxy?.status ?? "ready"}
                width={150}
              />
              <TopoNode
                x={backendX}
                y={nodeY}
                label="BACKEND"
                sublabel={backend?.name ?? activeBackend}
                icon="database"
                status={backend?.status ?? "ready"}
                width={150}
              />
            </svg>
          </div>

          {/* Network info footer */}
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-faint)]">
            <Wifi size={12} />
            <span className="font-mono">{network}</span>
            <span className="mx-2">·</span>
            <span className="font-mono uppercase">{mode}</span>
          </div>
        </motion.div>

        {/* Lab status panel */}
        <motion.div
          className="card w-full xl:w-80 p-6 flex flex-col"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="label mb-4">Lab Status</div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="status-dot status-dot-running" />
              <span className="ml-2 text-sm text-[var(--color-text-muted)]">Polling…</span>
            </div>
          ) : (
            <div className="flex flex-col">
              <LabStatusRow
                name="Docker"
                status={isSimulation ? "stopped" : "ready"}
                detail={isSimulation ? "sim" : "running"}
              />
              <LabStatusRow
                name="Proxy"
                status={proxy?.status ?? "ready"}
                detail={proxy?.name ?? activeProxy}
              />
              <LabStatusRow
                name="Backend"
                status={backend?.status ?? "ready"}
                detail={backend?.name ?? activeBackend}
              />
              <LabStatusRow
                name="Synthetic Victim"
                status={topology?.victim?.status ?? "ready"}
              />
              <LabStatusRow
                name="Synthetic Attacker"
                status={topology?.attacker?.status ?? "ready"}
              />
              <LabStatusRow
                name="WAF"
                status={topology?.waf?.status ?? "stopped"}
                detail={topology?.waf?.name}
              />
            </div>
          )}

          {/* Active config summary */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <div className="label mb-2">Active Configuration</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[var(--color-text-faint)]">Proxy</span>
                <p className="font-mono font-semibold text-[var(--color-text)] mt-0.5 capitalize">
                  {activeProxy}
                </p>
              </div>
              <div>
                <span className="text-[var(--color-text-faint)]">Backend</span>
                <p className="font-mono font-semibold text-[var(--color-text)] mt-0.5 capitalize">
                  {activeBackend}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Service detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            title: "Proxy Layer",
            service: proxy ?? { id: "proxy", name: activeProxy, status: "ready" } as TopologyService,
            description: "Reverse-proxy receiving all inbound requests. Parsing divergence is observed here.",
            icon: <Server size={18} className="text-iris" />,
          },
          {
            title: "Backend Layer",
            service: backend ?? { id: "backend", name: activeBackend, status: "ready" } as TopologyService,
            description: "Application server processing forwarded requests. Second-parse behavior determines smuggling success.",
            icon: <Database size={18} className="text-golden" />,
          },
          {
            title: "Victim Session",
            service: topology?.victim ?? { id: "victim", name: "victim", status: "ready" } as TopologyService,
            description: "Synthetic victim making authenticated requests used to demonstrate session hijacking.",
            icon: <Monitor size={18} className="text-vermilion" />,
          },
        ].map(({ title, service, description, icon }) => (
          <motion.div
            key={title}
            className="card p-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-control bg-[var(--color-surface-2)] flex items-center justify-center">
                {icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
                <div className="text-xs text-[var(--color-text-faint)] font-mono capitalize">
                  {service.name}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className={statusDotClass(service.status)} />
                <span className="text-xs font-mono text-[var(--color-text-faint)]">
                  {statusLabel(service.status)}
                </span>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{description}</p>
            {service.version && (
              <div className="mt-3 text-xs font-mono text-[var(--color-text-faint)]">
                v{service.version}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Simulation mode explanation */}
      {isSimulation && (
        <motion.div
          className="card p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle size={18} className="text-sage mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)] mb-1">
                Simulation Mode Active
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                RIFT is running in simulation mode. All HTTP Desync scenarios execute through the
                Python protocol engine without requiring Docker or real proxy processes. Request and
                response parsing is performed in pure software, faithfully reproducing known
                CL.TE, TE.CL, CL.0, CSD, H2.CL, H2.TE, and pause-based divergence behaviors. To
                run against real proxies, install Docker and set <code className="mono text-golden">mode=docker</code>{" "}
                in the API configuration.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
