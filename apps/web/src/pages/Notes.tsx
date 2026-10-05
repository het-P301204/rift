import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Save,
  StickyNote,
  Search,
  Tag,
  Clock,
  FileText,
  Loader2,
} from "lucide-react";
import { fetchNotes, createNote, updateNote, deleteNote, fetchScenarios } from "../lib/api";
import type { ResearchNote, Scenario } from "../lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Note list item ────────────────────────────────────────────────────────────

interface NoteItemProps {
  note: ResearchNote;
  selected: boolean;
  onSelect: () => void;
}

function NoteItem({ note, selected, onSelect }: NoteItemProps) {
  const preview =
    note.content.length > 100 ? note.content.slice(0, 97) + "…" : note.content;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      onClick={onSelect}
      className={`p-4 cursor-pointer border-b border-[var(--color-border)] transition-colors duration-100 ${
        selected
          ? "bg-[var(--color-surface-2)] border-l-2 border-l-[var(--color-accent)]"
          : "hover:bg-[var(--color-surface-2)] border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span
          className={`text-sm font-semibold leading-snug ${
            selected ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
          }`}
        >
          {note.title || "Untitled Note"}
        </span>
        <span className="text-xs text-[var(--color-text-faint)] flex-shrink-0">
          {timeAgo(note.updated_at)}
        </span>
      </div>
      {preview && (
        <p className="text-xs text-[var(--color-text-faint)] leading-relaxed line-clamp-2">
          {preview}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {note.scenario_id && (
          <span className="inline-flex items-center gap-1 badge badge-info text-xs">
            <Tag size={9} />
            {note.scenario_id}
          </span>
        )}
        {note.run_id && (
          <span className="inline-flex items-center gap-1 badge badge-neutral text-xs">
            <FileText size={9} />
            {note.run_id.slice(0, 8)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Note editor ───────────────────────────────────────────────────────────────

interface EditorProps {
  note: ResearchNote | null;
  onSave: (data: { title: string; content: string }) => void;
  onDelete: () => void;
  isSaving: boolean;
  isNew: boolean;
}

function NoteEditor({ note, onSave, onDelete, isSaving, isNew }: EditorProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [monoMode, setMonoMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    setDirty(false);
  }, [note?.id]);

  function handleSave() {
    onSave({ title, content });
    setDirty(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
        <div className="flex items-center gap-3">
          {note?.scenario_id && (
            <span className="badge badge-info text-xs flex items-center gap-1">
              <Tag size={10} />
              {note.scenario_id}
            </span>
          )}
          {note?.run_id && (
            <span className="badge badge-neutral text-xs flex items-center gap-1">
              <FileText size={10} />
              Run {note.run_id.slice(0, 8)}
            </span>
          )}
          {note && (
            <span className="text-xs text-[var(--color-text-faint)] flex items-center gap-1">
              <Clock size={10} />
              {formatDate(note.updated_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-2.5 py-1 rounded-control transition-colors font-mono ${
              monoMode
                ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]"
            }`}
            onClick={() => setMonoMode((v) => !v)}
          >
            mono
          </button>
          {!isNew && (
            <button
              className="btn-ghost text-xs px-2.5 py-1 text-vermilion hover:bg-vermilion/10 flex items-center gap-1"
              onClick={onDelete}
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
          <button
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            onClick={handleSave}
            disabled={isSaving || (!dirty && !isNew)}
          >
            {isSaving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        placeholder="Note title…"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        className="px-6 py-4 text-xl font-bold text-[var(--color-text)] bg-transparent border-b border-[var(--color-border)] focus:outline-none placeholder-[var(--color-text-faint)] flex-shrink-0"
      />

      {/* Content */}
      <textarea
        placeholder="Write research notes, observations, attack notes, or findings here…"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        className={`flex-1 resize-none px-6 py-4 text-sm text-[var(--color-text)] bg-transparent focus:outline-none placeholder-[var(--color-text-faint)] leading-relaxed ${
          monoMode ? "font-mono" : ""
        }`}
      />

      {/* Footer stats */}
      {content && (
        <div className="px-6 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
          <span className="text-xs text-[var(--color-text-faint)]">
            {content.split(/\s+/).filter(Boolean).length} words · {content.length} chars
          </span>
        </div>
      )}
    </div>
  );
}

// ── Empty panel placeholder ───────────────────────────────────────────────────

function EmptyEditor() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <StickyNote size={40} className="text-[var(--color-text-faint)] mb-4 opacity-50" />
      <div className="text-base font-semibold text-[var(--color-text-muted)] mb-1">
        Select a note to edit
      </div>
      <p className="text-sm text-[var(--color-text-faint)] max-w-xs">
        Choose a note from the list on the left, or create a new one.
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Notes() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [scenarioFilter, setScenarioFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: () => fetchNotes(),
    refetchInterval: 15000,
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: fetchScenarios,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setIsCreating(false);
      setSelectedId(note.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string } }) =>
      updateNote(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(null);
    },
  });

  // Filtered and searched notes
  const filteredNotes = (notes as ResearchNote[]).filter((n) => {
    const matchScenario =
      scenarioFilter === "all" || n.scenario_id === scenarioFilter;
    const matchSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase());
    return matchScenario && matchSearch;
  });

  const selectedNote =
    selectedId ? (notes as ResearchNote[]).find((n) => n.id === selectedId) ?? null : null;

  function handleSave(data: { title: string; content: string }) {
    if (isCreating) {
      createMutation.mutate({
        scenario_id: scenarioFilter !== "all" ? scenarioFilter : undefined,
        title: data.title,
        content: data.content,
      });
    } else if (selectedId) {
      updateMutation.mutate({ id: selectedId, data });
    }
  }

  function handleDelete() {
    if (selectedId) deleteMutation.mutate(selectedId);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Research Notebook</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Capture findings, observations, and attack notes across scenarios.
            </p>
          </div>
          <button
            className="btn-primary text-sm flex items-center gap-2"
            onClick={() => {
              setIsCreating(true);
              setSelectedId(null);
            }}
          >
            <Plus size={15} />
            New Note
          </button>
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — notes list */}
        <div className="w-80 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-hidden">
          {/* Search & filter */}
          <div className="p-3 border-b border-[var(--color-border)] flex flex-col gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
              />
              <input
                type="text"
                placeholder="Search notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-control pl-8 pr-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-sage/40"
              />
            </div>
            <select
              value={scenarioFilter}
              onChange={(e) => setScenarioFilter(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-control px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-sage/40"
            >
              <option value="all">All scenarios</option>
              {(scenarios as Scenario[]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes count */}
          <div className="px-4 py-2 border-b border-[var(--color-border)]">
            <span className="text-xs text-[var(--color-text-faint)]">
              {filteredNotes.length} note{filteredNotes.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 gap-2">
                <Loader2 size={16} className="animate-spin text-iris" />
                <span className="text-xs text-[var(--color-text-muted)]">Loading…</span>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-xs text-[var(--color-text-faint)] gap-2">
                <StickyNote size={24} className="opacity-40" />
                {search ? "No matching notes" : "No notes yet"}
              </div>
            ) : (
              <AnimatePresence>
                {filteredNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    selected={selectedId === note.id && !isCreating}
                    onSelect={() => {
                      setSelectedId(note.id);
                      setIsCreating(false);
                    }}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Right panel — editor */}
        <div className="flex-1 min-w-0 bg-[var(--color-bg)]">
          {isCreating ? (
            <NoteEditor
              note={null}
              onSave={handleSave}
              onDelete={() => setIsCreating(false)}
              isSaving={createMutation.isPending}
              isNew
            />
          ) : selectedNote ? (
            <NoteEditor
              key={selectedNote.id}
              note={selectedNote}
              onSave={handleSave}
              onDelete={handleDelete}
              isSaving={updateMutation.isPending || deleteMutation.isPending}
              isNew={false}
            />
          ) : (
            <EmptyEditor />
          )}
        </div>
      </div>
    </div>
  );
}
