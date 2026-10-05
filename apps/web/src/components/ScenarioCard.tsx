import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Play, ExternalLink, Zap, Shield, AlertTriangle } from "lucide-react";
import type { Scenario } from "../lib/api";

interface ScenarioCardProps {
  scenario: Scenario;
  onRun: (scenario: Scenario) => void;
  compact?: boolean;
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toLowerCase();
  if (s === "high") return <span className="badge badge-fail">High</span>;
  if (s === "medium") return <span className="badge badge-warn">Medium</span>;
  if (s === "low") return <span className="badge badge-pass">Low</span>;
  return <span className="badge badge-neutral">{severity}</span>;
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const p = protocol?.toUpperCase();
  const cls =
    p === "HTTP/2"
      ? "badge badge-info"
      : p === "EXPERIMENTAL"
        ? "badge badge-warn"
        : p === "BROWSER"
          ? "badge bg-plum/15 text-iris dark:text-iris"
          : "badge badge-neutral";
  return <span className={cls}>{protocol || "HTTP/1.1"}</span>;
}

function StatusLabel({ status }: { status?: string }) {
  const s = status?.toLowerCase();
  if (s === "experimental")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-golden">
        <AlertTriangle size={10} />
        Experimental
      </span>
    );
  if (s === "simulated")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-faint)]">
        <Zap size={10} />
        Simulated
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-sage dark:text-sage">
      <Shield size={10} />
      Implemented
    </span>
  );
}

export default function ScenarioCard({ scenario, onRun, compact = false }: ScenarioCardProps) {
  const excerpt = scenario.description
    ? scenario.description.length > 120
      ? scenario.description.slice(0, 117) + "..."
      : scenario.description
    : "No description available.";

  return (
    <motion.div
      className="card p-4 flex flex-col gap-3 cursor-default group"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ProtocolBadge protocol={scenario.protocol} />
          <SeverityBadge severity={scenario.severity} />
        </div>
        <StatusLabel status={scenario.status} />
      </div>

      {/* Title */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)] leading-snug group-hover:text-[var(--color-accent)] transition-colors duration-150">
          {scenario.name}
        </h3>
        {!compact && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-widest font-medium">
            {scenario.category}
          </p>
        )}
      </div>

      {/* Description excerpt */}
      {!compact && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed flex-1">{excerpt}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <motion.button
          className="btn-primary text-xs px-3 py-1.5 flex-1"
          onClick={() => onRun(scenario)}
          whileTap={{ scale: 0.97 }}
        >
          <Play size={12} />
          Run
        </motion.button>
        <Link
          to={`/scenarios/${scenario.id}`}
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
          Details
        </Link>
      </div>
    </motion.div>
  );
}
