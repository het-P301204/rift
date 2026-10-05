import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useLabStore } from "./store/useLabStore";
import Layout from "./components/Layout";
import CommandPalette from "./components/CommandPalette";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import ScenarioLibrary from "./pages/ScenarioLibrary";
import ScenarioDetail from "./pages/ScenarioDetail";
import Lab from "./pages/Lab";
import Visualizer from "./pages/Visualizer";
import Topology from "./pages/Topology";
import Runs from "./pages/Runs";
import RunDetail from "./pages/RunDetail";
import Notes from "./pages/Notes";
import Compare from "./pages/Compare";
import Docs from "./pages/Docs";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";

export default function App() {
  const { theme, commandPaletteOpen, setCommandPalette } = useLabStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPalette(true);
      }
      if (e.key === "Escape") setCommandPalette(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCommandPalette]);

  return (
    <BrowserRouter>
      {commandPaletteOpen && <CommandPalette onClose={() => setCommandPalette(false)} />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/lab" element={<Lab />} />
          <Route path="/scenarios" element={<ScenarioLibrary />} />
          <Route path="/scenarios/:id" element={<ScenarioDetail />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/visualizer" element={<Visualizer />} />
          <Route path="/visualizer/:runId" element={<Visualizer />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/topology" element={<Topology />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
