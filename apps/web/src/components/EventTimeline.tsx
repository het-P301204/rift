import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LabEvent } from "../lib/api";

interface EventTimelineProps {
  events: LabEvent[];
  isLive: boolean;
}

type KindConfig = {
  label: string;
  badgeClass: string;
};

const KIND_CONFIG: Record<string, KindConfig> = {
  INIT: {
    label: "INIT",
    badgeClass: "badge bg-iris/15 text-iris-dark dark:text-iris",
  },
  CLIENT_SENT: {
    label: "CLIENT SENT",
    badgeClass: "badge bg-plum/15 text-plum-light",
  },
  PROXY_PARSED: {
    label: "PROXY PARSED",
    badgeClass: "badge bg-golden/15 text-golden-dark dark:text-golden",
  },
  BACKEND_PARSED: {
    label: "BACKEND PARSED",
    badgeClass: "badge bg-sage/15 text-sage-dark dark:text-sage",
  },
  DIVERGENCE: {
    label: "DIVERGENCE",
    badgeClass: "badge bg-vermilion/15 text-vermilion-dark dark:text-vermilion",
  },
  DONE: {
    label: "DONE",
    badgeClass: "badge bg-sage/15 text-sage-dark dark:text-sage",
  },
  ERROR: {
    label: "ERROR",
    badgeClass: "badge bg-vermilion/15 text-vermilion-dark dark:text-vermilion",
  },
  HARDENED_BLOCKED: {
    label: "BLOCKED",
    badgeClass: "badge bg-golden/15 text-golden-dark dark:text-golden",
  },
};

const DEFAULT_KIND: KindConfig = {
  label: "EVENT",
  badgeClass:
    "badge bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
};

function formatTs(ts: number): string {
  const ms = ts % 1000;
  const s = Math.floor(ts / 1000) % 60;
  const m = Math.floor(ts / 60000);
  if (m > 0) return `${m}m ${s}.${String(ms).padStart(3, "0")}s`;
  return `${s}.${String(ms).padStart(3, "0")}s`;
}

export function EventTimeline({ events, isLive }: EventTimelineProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLive && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, isLive]);

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[var(--color-text-faint)] text-sm mono">
        No events yet — run a scenario to start the stream
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <AnimatePresence initial={false}>
        {events.map((event, i) => {
          const config = KIND_CONFIG[event.kind] ?? DEFAULT_KIND;
          const isOpen = expanded.has(i);
          const hasData = Object.keys(event.data).length > 0;

          return (
            <motion.div
              key={i}
              initial={isLive ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
            >
              <button
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  hasData
                    ? "hover:bg-[var(--color-surface-2)] cursor-pointer"
                    : "cursor-default"
                }`}
                onClick={() => hasData && toggle(i)}
                disabled={!hasData}
              >
                <span className="mono text-xs text-[var(--color-text-faint)] w-20 shrink-0 tabular-nums">
                  {formatTs(event.ts)}
                </span>
                <span className={`shrink-0 ${config.badgeClass}`}>
                  {config.label}
                </span>
                <span className="text-sm text-[var(--color-text-muted)] flex-1 truncate">
                  {event.message}
                </span>
                {hasData && (
                  <span className="text-[var(--color-text-faint)] shrink-0">
                    {isOpen ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isOpen && hasData && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-1 border-t border-[var(--color-border)]">
                      <pre className="mono text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
