import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Library, Search, SlidersHorizontal } from "lucide-react";
import { fetchScenarios } from "../lib/api";
import type { Scenario } from "../lib/api";
import { useLabStore } from "../store/useLabStore";
import ScenarioCard from "../components/ScenarioCard";

type ProtocolFilter = "All" | "HTTP/1.1" | "HTTP/2" | "Browser" | "Experimental";

const FILTER_TABS: ProtocolFilter[] = ["All", "HTTP/1.1", "HTTP/2", "Browser", "Experimental"];

function SkeletonCard() {
  return (
    <div className="card p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 rounded-md bg-[var(--color-surface-2)]" />
        <div className="h-5 w-12 rounded-md bg-[var(--color-surface-2)]" />
      </div>
      <div className="h-4 w-3/4 rounded bg-[var(--color-surface-2)]" />
      <div className="h-3 w-1/3 rounded bg-[var(--color-surface-2)]" />
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-[var(--color-surface-2)]" />
        <div className="h-3 w-5/6 rounded bg-[var(--color-surface-2)]" />
        <div className="h-3 w-4/6 rounded bg-[var(--color-surface-2)]" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-8 flex-1 rounded-control bg-[var(--color-surface-2)]" />
        <div className="h-8 w-20 rounded-control bg-[var(--color-surface-2)]" />
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <motion.div
      className="col-span-full flex flex-col items-center justify-center py-24 text-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
        <Library size={24} className="text-[var(--color-text-faint)]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">No scenarios found</p>
        {query && (
          <p className="text-xs text-[var(--color-text-faint)] mt-1">
            No results for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default function ScenarioLibrary() {
  const navigate = useNavigate();
  const { setProxy, setBackend } = useLabStore();

  const [activeFilter, setActiveFilter] = useState<ProtocolFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: scenarios, isLoading, isError } = useQuery<Scenario[]>({
    queryKey: ["scenarios"],
    queryFn: fetchScenarios,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!scenarios) return [];
    let list = scenarios;
    if (activeFilter !== "All") {
      const f = activeFilter.toLowerCase();
      list = list.filter((s) => {
        const p = (s.protocol || "").toLowerCase();
        if (f === "experimental") return (s.status || "").toLowerCase() === "experimental";
        if (f === "browser") return p === "browser";
        if (f === "http/2") return p === "http/2";
        if (f === "http/1.1") return p === "http/1.1" || p === "" || (!p.includes("http/2") && p !== "browser");
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [scenarios, activeFilter, searchQuery]);

  function handleRun(scenario: Scenario) {
    setProxy("nginx");
    setBackend("flask");
    navigate(`/lab?scenario=${scenario.id}`);
  }

  const counts: Record<ProtocolFilter, number> = useMemo(() => {
    if (!scenarios) return { All: 0, "HTTP/1.1": 0, "HTTP/2": 0, Browser: 0, Experimental: 0 };
    return {
      All: scenarios.length,
      "HTTP/1.1": scenarios.filter((s) => {
        const p = (s.protocol || "").toLowerCase();
        return p === "http/1.1" || p === "" || (!p.includes("http/2") && p !== "browser");
      }).length,
      "HTTP/2": scenarios.filter((s) => (s.protocol || "").toLowerCase() === "http/2").length,
      Browser: scenarios.filter((s) => (s.protocol || "").toLowerCase() === "browser").length,
      Experimental: scenarios.filter((s) => (s.status || "").toLowerCase() === "experimental").length,
    };
  }, [scenarios]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Library size={20} className="text-[var(--color-accent)]" />
          <h1 className="text-xl font-bold text-[var(--color-text)]">Scenario Library</h1>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          HTTP desync and request smuggling attack scenarios — select one to run in the lab or study its mechanics.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search scenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-control text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>

        {/* Filter icon hint */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-faint)]">
          <SlidersHorizontal size={13} />
          <span>Filter by protocol</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab;
          return (
            <motion.button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 select-none ${
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              }`}
              whileTap={{ scale: 0.97 }}
            >
              {tab}
              {!isLoading && (
                <span
                  className={`ml-1.5 ${active ? "text-white/70" : "text-[var(--color-text-faint)]"}`}
                >
                  {counts[tab]}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Error banner */}
      {isError && (
        <div className="badge-fail p-3 rounded-card text-sm">
          Failed to load scenarios — check the API server is running on port 8000.
        </div>
      )}

      {/* Grid */}
      <AnimatePresence mode="wait">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
              ? <EmptyState query={searchQuery} />
              : filtered.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onRun={handleRun}
                  />
                ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
