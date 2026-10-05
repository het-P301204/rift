import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Play, BookOpen, BarChart3, Network, FileText,
  Settings, GitCompare, Eye, Search, X
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

interface Props {
  onClose: () => void;
}

export default function CommandPalette({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (path: string) => { navigate(path); onClose(); };

  const commands: Command[] = [
    { id: "lab", label: "Launch Research Lab", description: "Open the active lab workspace", icon: <FlaskConical size={16} />, action: () => go("/lab") },
    { id: "scenarios", label: "Load Scenario", description: "Browse scenario library", icon: <BookOpen size={16} />, action: () => go("/scenarios") },
    { id: "runs", label: "View Run History", description: "All previous test runs", icon: <BarChart3 size={16} />, action: () => go("/runs") },
    { id: "visualizer", label: "Open Visualizer", description: "Byte stream visualization", icon: <Eye size={16} />, action: () => go("/visualizer") },
    { id: "topology", label: "View Topology", description: "Lab network diagram", icon: <Network size={16} />, action: () => go("/topology") },
    { id: "compare", label: "Compare Configurations", description: "Research vs Hardened mode comparison", icon: <GitCompare size={16} />, action: () => go("/compare") },
    { id: "notes", label: "Open Research Notes", description: "Notebook for observations", icon: <FileText size={16} />, action: () => go("/notes") },
    { id: "docs", label: "View Documentation", description: "Architecture, scenarios, HTTP framing", icon: <BookOpen size={16} />, action: () => go("/docs") },
    { id: "settings", label: "Settings", description: "Theme, defaults, API config", icon: <Settings size={16} />, action: () => go("/settings") },
    { id: "cl-te", label: "Run CL.TE Scenario", description: "Content-Length / Transfer-Encoding desync", icon: <Play size={16} />, action: () => go("/scenarios/cl-te") },
    { id: "te-cl", label: "Run TE.CL Scenario", description: "Transfer-Encoding / Content-Length desync", icon: <Play size={16} />, action: () => go("/scenarios/te-cl") },
    { id: "cl-0", label: "Run CL.0 Scenario", description: "Content-Length zero desync", icon: <Play size={16} />, action: () => go("/scenarios/cl-0") },
    { id: "h2-cl", label: "Run H2.CL Scenario", description: "HTTP/2 downgrade with injected CL", icon: <Play size={16} />, action: () => go("/scenarios/h2-cl") },
    { id: "pause", label: "Run Pause-Based Scenario", description: "Timing-based desync", icon: <Play size={16} />, action: () => go("/scenarios/pause-based") },
  ];

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          (c.description?.toLowerCase().includes(query.toLowerCase()))
      )
    : commands;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) { filtered[selected].action(); }
    if (e.key === "Escape") onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-24"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="panel w-full max-w-xl overflow-hidden"
          style={{ maxHeight: "70vh" }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Command palette"
        >
          {/* Search */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <Search size={16} className="text-[var(--color-text-faint)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search commands…"
              className="flex-1 bg-transparent outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)]"
              aria-label="Search commands"
            />
            <button onClick={onClose} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
              <X size={14} />
            </button>
          </div>

          {/* Commands */}
          <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-faint)]">
                No commands match "{query}"
              </div>
            ) : (
              <div className="py-2">
                {filtered.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selected
                        ? "bg-[var(--color-surface-2)]"
                        : "hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    <span className="text-[var(--color-text-muted)] flex-shrink-0">{cmd.icon}</span>
                    <span className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--color-text)]">{cmd.label}</div>
                      {cmd.description && (
                        <div className="text-xs text-[var(--color-text-faint)] truncate">{cmd.description}</div>
                      )}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)] mono">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--color-border)] flex gap-4 text-xs text-[var(--color-text-faint)]">
            <span><kbd className="mono">↑↓</kbd> navigate</span>
            <span><kbd className="mono">↵</kbd> select</span>
            <span><kbd className="mono">esc</kbd> close</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
