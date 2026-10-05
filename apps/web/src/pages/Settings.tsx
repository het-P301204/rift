import { useNavigate } from "react-router-dom";
import { Sun, Moon, Trash2, ExternalLink, Server } from "lucide-react";
import { useLabStore } from "../store/useLabStore";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { theme, toggleTheme, activeProxy, activeBackend, setProxy, setBackend } = useLabStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const clearHistory = () => {
    if (confirm("Clear all run history from the database? This cannot be undone.")) {
      // The backend would need a DELETE /api/runs endpoint for bulk delete
      // For now, invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Theme</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Current: {theme}</div>
            </div>
            <button onClick={toggleTheme} className="btn-secondary gap-2">
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              Switch to {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        {/* Lab Defaults */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Lab Defaults</h2>
          <div>
            <label className="label block mb-2">Default Proxy</label>
            <select
              value={activeProxy}
              onChange={(e) => setProxy(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
            >
              <option value="nginx">nginx</option>
              <option value="haproxy">HAProxy</option>
              <option value="caddy">Caddy</option>
            </select>
          </div>
          <div>
            <label className="label block mb-2">Default Backend</label>
            <select
              value={activeBackend}
              onChange={(e) => setBackend(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-control border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
            >
              <option value="flask">Flask</option>
              <option value="fastapi">FastAPI</option>
            </select>
          </div>
        </div>

        {/* API Connection */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">API Connection</h2>
          <div className="flex items-center gap-3">
            <Server size={16} className="text-[var(--color-text-muted)]" />
            <div>
              <div className="text-sm font-medium mono">http://localhost:8000</div>
              <div className="text-xs text-[var(--color-text-muted)]">FastAPI research engine</div>
            </div>
            <span className="badge badge-pass ml-auto">Connected</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] pt-1">
            Start the API with <code className="mono">uvicorn main:app --reload --port 8000</code> from <code className="mono">apps/api/</code>
          </div>
        </div>

        {/* Data */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Research Data</h2>
          <div className="text-xs text-[var(--color-text-muted)]">
            Run history, evidence, and research notes are stored in <code className="mono">rift.db</code> (SQLite).
          </div>
          <button onClick={clearHistory} className="btn-secondary gap-2 text-vermilion border-vermilion/30 hover:bg-vermilion/10">
            <Trash2 size={14} />
            Clear Run History
          </button>
        </div>

        {/* About */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">About</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Platform</span>
              <span className="mono text-xs">RIFT v1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Engine</span>
              <span className="mono text-xs">Python Protocol Simulation</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Scenarios</span>
              <span className="mono text-xs">7 (5 implemented, 2 experimental)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Mode</span>
              <span className="mono text-xs">Local Research Only</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            RIFT is an authorized security research and education platform. All attack demonstrations
            operate against intentionally configured local simulation components.
          </div>
          <a
            href="https://github.com/het-P301204/rift"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary gap-2 text-xs w-fit"
          >
            <ExternalLink size={12} />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
