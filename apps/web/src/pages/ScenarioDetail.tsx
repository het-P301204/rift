import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Play,
  BookOpen,
  FlaskConical,
  GraduationCap,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Server,
  Globe,
} from "lucide-react";
import { fetchScenario } from "../lib/api";
import type { Scenario } from "../lib/api";
import { useLabStore } from "../store/useLabStore";

type Tab = "overview" | "lab" | "education" | "mitigation";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BookOpen size={14} /> },
  { id: "lab", label: "Lab", icon: <FlaskConical size={14} /> },
  { id: "education", label: "Education", icon: <GraduationCap size={14} /> },
  { id: "mitigation", label: "Mitigation", icon: <ShieldCheck size={14} /> },
];

const PROXIES = [
  { id: "nginx", label: "nginx" },
  { id: "haproxy", label: "HAProxy" },
  { id: "caddy", label: "Caddy" },
];

const BACKENDS = [
  { id: "flask", label: "Flask" },
  { id: "fastapi", label: "FastAPI" },
];

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toLowerCase();
  if (s === "high") return <span className="badge badge-fail">High Severity</span>;
  if (s === "medium") return <span className="badge badge-warn">Medium Severity</span>;
  if (s === "low") return <span className="badge badge-pass">Low Severity</span>;
  return <span className="badge badge-neutral">{severity}</span>;
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const cls =
    protocol?.toUpperCase() === "HTTP/2"
      ? "badge badge-info"
      : "badge badge-neutral";
  return <span className={cls}>{protocol || "HTTP/1.1"}</span>;
}

function TopologyDiagram({ scenario }: { scenario: Scenario }) {
  const attackLabel = scenario.category?.toUpperCase().replace(/ /g, "-") || "CL.TE";
  return (
    <div className="card p-4">
      <p className="label mb-3">Request Flow Diagram</p>
      <pre className="mono text-xs leading-relaxed text-[var(--color-text-muted)] overflow-x-auto whitespace-pre">
{`
  ┌───────────┐   HTTP/{proto}   ┌─────────────┐   HTTP/1.1   ┌──────────────┐
  │  CLIENT   │ ──────────────▶  │    PROXY    │ ────────────▶ │   BACKEND    │
  │  (victim) │                  │  (front-end)│               │  (back-end)  │
  └───────────┘                  └─────────────┘               └──────────────┘
       │                               │                              │
       │  POST /search HTTP/1.1        │                              │
       │  Transfer-Encoding: chunked   │                              │
       │  Content-Length: {cl}         │                              │
       │ ─────────────────────────────▶│                              │
       │                               │  Forwards full body          │
       │                               │ ─────────────────────────────▶
       │                               │                              │
       │                               │  [{attack}]                  │
       │                               │  Smuggled prefix survives    │
       │                               │ ◀─────────────────────────── │
       │  Response (contaminated)      │                              │
       │ ◀─────────────────────────────│                              │
       │                               │                              │

  Attack variant : {attack}
  Expected desync: {desync}
`
  .replace("{proto}", scenario.protocol?.replace("HTTP/", "") || "1.1")
  .replace("{cl}", "42")
  .replace(/\{attack\}/g, attackLabel)
  .replace("{desync}", scenario.expected_divergence ? "YES — front/back count mismatch" : "NO")}
      </pre>
    </div>
  );
}

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <span>{title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={15} className="text-[var(--color-text-faint)]" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 text-sm text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-4 w-32 rounded bg-[var(--color-surface-2)]" />
      <div className="h-7 w-2/3 rounded bg-[var(--color-surface-2)]" />
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-md bg-[var(--color-surface-2)]" />
        <div className="h-5 w-20 rounded-md bg-[var(--color-surface-2)]" />
      </div>
    </div>
  );
}

// ─── Tab Panels ────────────────────────────────────────────────────────────

function OverviewTab({ scenario }: { scenario: Scenario }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-2">
        <p className="label">Description</p>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {scenario.description || "No description provided."}
        </p>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <p className="label">Educational Goal</p>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {scenario.educational_goal || "Understand the mechanics of this attack variant."}
        </p>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <p className="label">Prerequisites</p>
        <ul className="text-sm text-[var(--color-text-muted)] list-disc list-inside space-y-1">
          <li>Running Docker stack (nginx + flask by default)</li>
          <li>API server on localhost:8000</li>
          <li>Basic understanding of HTTP/1.1 transfer encoding</li>
        </ul>
      </div>
      <TopologyDiagram scenario={scenario} />
    </div>
  );
}

function LabTab({
  scenario,
  proxy,
  backend,
  hardened,
  onProxyChange,
  onBackendChange,
  onHardenedChange,
  onRun,
  isRunning,
}: {
  scenario: Scenario;
  proxy: string;
  backend: string;
  hardened: boolean;
  onProxyChange: (v: string) => void;
  onBackendChange: (v: string) => void;
  onHardenedChange: (v: boolean) => void;
  onRun: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Proxy selector */}
      <div className="card p-4 flex flex-col gap-3">
        <p className="label flex items-center gap-1.5">
          <Globe size={12} />
          Front-end Proxy
        </p>
        <div className="flex gap-2 flex-wrap">
          {PROXIES.map((p) => (
            <button
              key={p.id}
              onClick={() => onProxyChange(p.id)}
              className={`px-3 py-1.5 text-sm rounded-control border transition-colors ${
                proxy === p.id
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Backend selector */}
      <div className="card p-4 flex flex-col gap-3">
        <p className="label flex items-center gap-1.5">
          <Server size={12} />
          Back-end Server
        </p>
        <div className="flex gap-2 flex-wrap">
          {BACKENDS.map((b) => (
            <button
              key={b.id}
              onClick={() => onBackendChange(b.id)}
              className={`px-3 py-1.5 text-sm rounded-control border transition-colors ${
                backend === b.id
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">
            {hardened ? "Hardened Mode" : "Research Mode"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {hardened
              ? "Mitigations active — attack should be blocked."
              : "Default config — vulnerability observable."}
          </p>
        </div>
        <button
          onClick={() => onHardenedChange(!hardened)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
            hardened ? "bg-sage" : "bg-[var(--color-border)]"
          }`}
          role="switch"
          aria-checked={hardened}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
              hardened ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Run button */}
      <motion.button
        className="btn-primary w-full justify-center py-2.5 text-sm"
        onClick={onRun}
        disabled={isRunning}
        whileTap={{ scale: 0.98 }}
      >
        <Play size={14} />
        {isRunning ? "Running…" : `Run "${scenario.name}"`}
      </motion.button>

      <p className="text-xs text-[var(--color-text-faint)] text-center">
        Runs via WebSocket — results appear in the Lab page with full telemetry.
      </p>
    </div>
  );
}

function EducationTab({ scenario }: { scenario: Scenario }) {
  const category = scenario.category || "this attack";
  const hasDesync = scenario.expected_divergence;
  return (
    <div className="flex flex-col gap-3">
      <AccordionSection title="What is happening?">
        <p>
          In a <strong>{category}</strong> attack, the attacker crafts an HTTP request that is
          interpreted differently by the front-end proxy and the back-end server. The front-end
          uses one mechanism (e.g. <code className="mono text-xs">Content-Length</code>) to
          determine where the request ends, while the back-end uses another
          (e.g. <code className="mono text-xs">Transfer-Encoding: chunked</code>). This leaves a
          fragment of the attacker's data prepended to the next victim's request.
        </p>
      </AccordionSection>

      <AccordionSection title="Why does it happen?">
        <p>
          HTTP/1.1 supports two request-body framing methods —{" "}
          <code className="mono text-xs">Content-Length</code> and{" "}
          <code className="mono text-xs">Transfer-Encoding: chunked</code>. When both headers are
          present, RFC 7230 says <code className="mono text-xs">Transfer-Encoding</code> takes
          precedence, but many proxies and servers deviate from the spec for legacy reasons. This
          disagreement lets an attacker control how the connection pipeline is split.
        </p>
      </AccordionSection>

      <AccordionSection title="What does the proxy see?">
        <p>
          The front-end proxy reads the request according to its own parsing logic. It forwards
          what it believes is a complete request to the back-end. Because it and the back-end
          disagree about body boundaries, the proxy considers the connection ready for a new
          request while the back-end still believes the previous body is incomplete.
        </p>
        {hasDesync && (
          <p className="mt-2 text-golden text-xs">
            In this scenario a front/back count mismatch is expected — the front-end sees fewer
            complete requests than the back-end processes.
          </p>
        )}
      </AccordionSection>

      <AccordionSection title="What does the backend see?">
        <p>
          The back-end server processes the bytes it receives in order. Because it sees a different
          request boundary, it treats the tail of the attacker's request as the beginning of the
          next request. If the next request belongs to a victim, the victim's request is now
          contaminated with the attacker-controlled prefix.
        </p>
      </AccordionSection>

      <AccordionSection title="How does hardened mode change the result?">
        <p>
          In hardened mode, the proxy is configured with mitigations such as normalizing ambiguous
          headers, dropping requests with both <code className="mono text-xs">Content-Length</code>{" "}
          and <code className="mono text-xs">Transfer-Encoding</code>, or enforcing strict HTTP/1.1
          compliance. The back-end applies server-side guards. Together these eliminate the parsing
          ambiguity so the smuggled prefix is rejected.
        </p>
        <p className="mt-2">
          Config changes are detailed in the <strong>Mitigation</strong> tab.
        </p>
      </AccordionSection>
    </div>
  );
}

function MitigationTab({ scenario }: { scenario: Scenario }) {
  const mit = scenario.mitigation;
  const hasConfig = !!mit?.config_change;
  const beforeBlock = hasConfig
    ? `# Before (vulnerable)\nproxy_set_header Connection keep-alive;\n# No TE/CL conflict handling`
    : null;
  const afterBlock = hasConfig ? mit.config_change : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-2">
        <p className="label">Mitigation Title</p>
        <p className="text-sm font-medium text-[var(--color-text)]">
          {mit?.title || "Apply recommended server hardening"}
        </p>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <p className="label">Description</p>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {mit?.description || "No mitigation description available for this scenario."}
        </p>
      </div>

      {hasConfig && (
        <div className="flex flex-col gap-3">
          <p className="label">Config Comparison</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="badge badge-fail self-start">Before</span>
              <pre className="card p-3 mono text-xs text-[var(--color-text-muted)] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {beforeBlock}
              </pre>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="badge badge-pass self-start">After</span>
              <pre className="card p-3 mono text-xs text-[var(--color-text-muted)] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {afterBlock}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ScenarioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { activeProxy, activeBackend, hardened, isRunning, setProxy, setBackend, setHardened } =
    useLabStore();

  const { data: scenario, isLoading, isError } = useQuery<Scenario>({
    queryKey: ["scenario", id],
    queryFn: () => fetchScenario(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  function handleRun() {
    navigate(`/lab?scenario=${id}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--color-text-faint)]">
        <Link to="/scenarios" className="hover:text-[var(--color-text)] transition-colors flex items-center gap-1">
          <ChevronLeft size={13} />
          Scenario Library
        </Link>
        {scenario && (
          <>
            <ChevronRight size={11} />
            <span className="text-[var(--color-text-muted)] truncate max-w-[200px]">{scenario.name}</span>
          </>
        )}
      </nav>

      {/* Header */}
      {isLoading ? (
        <SkeletonHeader />
      ) : isError ? (
        <div className="badge-fail p-3 rounded-card text-sm">
          Failed to load scenario — the API may not be running.
        </div>
      ) : scenario ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-neutral">{scenario.category}</span>
            <ProtocolBadge protocol={scenario.protocol} />
            <SeverityBadge severity={scenario.severity} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{scenario.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {scenario.description?.slice(0, 200) || "No description."}
          </p>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-[var(--color-border)]">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-150 -mb-px ${
                active
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {!isLoading && scenario && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "overview" && <OverviewTab scenario={scenario} />}
            {activeTab === "lab" && (
              <LabTab
                scenario={scenario}
                proxy={activeProxy}
                backend={activeBackend}
                hardened={hardened}
                onProxyChange={setProxy}
                onBackendChange={setBackend}
                onHardenedChange={setHardened}
                onRun={handleRun}
                isRunning={isRunning}
              />
            )}
            {activeTab === "education" && <EducationTab scenario={scenario} />}
            {activeTab === "mitigation" && <MitigationTab scenario={scenario} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
