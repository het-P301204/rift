import { useMemo } from "react";

export interface ByteBoundary {
  start: number;
  end: number;
  label: string;
  semantic: string;
}

interface ByteViewerProps {
  rawHex: string;
  boundaries: ByteBoundary[];
  mode: "ascii" | "hex" | "decoded" | "semantic";
}

const SEMANTIC_CLASSES: Record<string, string> = {
  HEADER: "byte-header",
  BODY: "byte-body",
  CHUNK_SIZE: "byte-chunk-size",
  CHUNK_DATA: "byte-chunk-data",
  SMUGGLED: "byte-smuggled",
  TRAILER: "byte-trailer",
};

const SEMANTIC_LABELS: Record<string, string> = {
  HEADER: "HTTP Header",
  BODY: "Message Body",
  CHUNK_SIZE: "Chunk Size",
  CHUNK_DATA: "Chunk Data",
  SMUGGLED: "Smuggled Request",
  TRAILER: "Trailer",
};

const ROW_SIZE = 16;

function isPrintable(byte: number): boolean {
  return byte >= 0x20 && byte < 0x7f;
}

function toVisibleChar(byte: number): string {
  if (isPrintable(byte)) return String.fromCharCode(byte);
  return ".";
}

function toBoundaryClass(semantic: string): string {
  return SEMANTIC_CLASSES[semantic] ?? "";
}

function getBoundaryForByte(
  index: number,
  boundaries: ByteBoundary[]
): ByteBoundary | null {
  for (const b of boundaries) {
    if (index >= b.start && index < b.end) return b;
  }
  return null;
}

function hexByte(b: number): string {
  return b.toString(16).padStart(2, "0").toUpperCase();
}

function hexOffset(n: number): string {
  return n.toString(16).padStart(8, "0").toUpperCase();
}

// ─── Hex dump view ───────────────────────────────────────────────────────────

function HexDumpRow({
  row,
  offset,
  boundaries,
}: {
  row: number[];
  offset: number;
  boundaries: ByteBoundary[];
}) {
  return (
    <div className="flex gap-3 px-3 py-0.5 hover:bg-[var(--color-surface-2)] group">
      {/* Offset */}
      <span className="mono text-xs text-[var(--color-text-faint)] w-[6ch] shrink-0 tabular-nums select-none">
        {hexOffset(offset)}
      </span>

      {/* Hex bytes */}
      <span className="mono text-xs flex gap-px">
        {row.map((byte, bi) => {
          const byteIdx = offset + bi;
          const boundary = getBoundaryForByte(byteIdx, boundaries);
          const cls = boundary ? toBoundaryClass(boundary.semantic) : "";
          const title = boundary
            ? `${boundary.label} — ${SEMANTIC_LABELS[boundary.semantic] ?? boundary.semantic} (byte ${byteIdx})`
            : `byte ${byteIdx}`;
          return (
            <span
              key={bi}
              className={`inline-block w-[2.1ch] text-center px-px rounded-sm ${cls}`}
              title={title}
            >
              {hexByte(byte)}
            </span>
          );
        })}
        {/* Pad incomplete last row */}
        {Array.from({ length: ROW_SIZE - row.length }, (_, i) => (
          <span key={`pad-${i}`} className="inline-block w-[2.1ch]" />
        ))}
      </span>

      {/* Separator */}
      <span className="border-l border-[var(--color-border)]" />

      {/* ASCII column */}
      <span className="mono text-xs w-[16ch] shrink-0 text-[var(--color-text-muted)]">
        {row.map((byte, bi) => {
          const byteIdx = offset + bi;
          const boundary = getBoundaryForByte(byteIdx, boundaries);
          const cls = boundary ? toBoundaryClass(boundary.semantic) : "";
          return (
            <span key={bi} className={`${cls}`}>
              {toVisibleChar(byte)}
            </span>
          );
        })}
      </span>
    </div>
  );
}

// ─── Semantic region builder ──────────────────────────────────────────────────

function buildRegions(
  bytes: number[],
  boundaries: ByteBoundary[]
): Array<{
  start: number;
  end: number;
  boundary: ByteBoundary | null;
  bytes: number[];
}> {
  const regions: Array<{
    start: number;
    end: number;
    boundary: ByteBoundary | null;
    bytes: number[];
  }> = [];

  let i = 0;
  while (i < bytes.length) {
    const boundary = getBoundaryForByte(i, boundaries);
    if (boundary) {
      const end = Math.min(boundary.end, bytes.length);
      regions.push({
        start: i,
        end,
        boundary,
        bytes: bytes.slice(i, end),
      });
      i = end;
    } else {
      // Walk to next boundary start
      const nextStart = boundaries
        .filter((b) => b.start > i)
        .reduce((m, b) => Math.min(m, b.start), bytes.length);
      if (nextStart > i) {
        regions.push({
          start: i,
          end: nextStart,
          boundary: null,
          bytes: bytes.slice(i, nextStart),
        });
      }
      i = Math.max(nextStart, i + 1); // safety: always advance
    }
  }
  return regions;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ByteViewer({ rawHex, boundaries, mode }: ByteViewerProps) {
  // All hooks must be called unconditionally before any early return
  const bytes = useMemo(() => {
    const clean = rawHex.replace(/\s/g, "");
    const result: number[] = [];
    for (let i = 0; i < clean.length - 1; i += 2) {
      const val = parseInt(clean.slice(i, i + 2), 16);
      if (!isNaN(val)) result.push(val);
    }
    return result;
  }, [rawHex]);

  const rows = useMemo(() => {
    const r: number[][] = [];
    for (let i = 0; i < bytes.length; i += ROW_SIZE) {
      r.push(bytes.slice(i, i + ROW_SIZE));
    }
    return r;
  }, [bytes]);

  // Pre-compute semantic regions (used only in semantic mode, but must be here)
  const regions = useMemo(
    () => buildRegions(bytes, boundaries),
    [bytes, boundaries]
  );

  const namedRegions = useMemo(
    () => regions.filter((r) => r.boundary !== null),
    [regions]
  );

  if (!rawHex || bytes.length === 0) {
    return (
      <div className="mono text-xs text-[var(--color-text-faint)] p-6 text-center">
        No byte data available
      </div>
    );
  }

  // ── Hex dump ──────────────────────────────────────────────────────────────
  if (mode === "hex") {
    return (
      <div className="overflow-x-auto">
        {/* Column header */}
        <div className="flex gap-3 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-10">
          <span className="mono text-xs text-[var(--color-text-faint)] w-[6ch] shrink-0 select-none">
            Offset
          </span>
          <span className="mono text-xs text-[var(--color-text-faint)] flex gap-px">
            {Array.from({ length: ROW_SIZE }, (_, i) => (
              <span key={i} className="inline-block w-[2.1ch] text-center">
                {i.toString(16).toUpperCase()}
              </span>
            ))}
          </span>
          <span className="border-l border-[var(--color-border)]" />
          <span className="mono text-xs text-[var(--color-text-faint)] w-[16ch] shrink-0 pl-1 select-none">
            ASCII
          </span>
        </div>

        {rows.map((row, rowIdx) => (
          <HexDumpRow
            key={rowIdx}
            row={row}
            offset={rowIdx * ROW_SIZE}
            boundaries={boundaries}
          />
        ))}
      </div>
    );
  }

  // ── ASCII view ────────────────────────────────────────────────────────────
  if (mode === "ascii") {
    return (
      <div className="overflow-x-auto p-3">
        {rows.map((row, rowIdx) => {
          const offset = rowIdx * ROW_SIZE;
          return (
            <div
              key={rowIdx}
              className="flex gap-3 hover:bg-[var(--color-surface-2)] px-1 py-0.5 rounded"
            >
              <span className="mono text-xs text-[var(--color-text-faint)] w-[4ch] shrink-0 tabular-nums select-none">
                {offset.toString(16).padStart(4, "0")}
              </span>
              <span className="mono text-xs">
                {row.map((byte, bi) => {
                  const byteIdx = offset + bi;
                  const boundary = getBoundaryForByte(byteIdx, boundaries);
                  const cls = boundary
                    ? toBoundaryClass(boundary.semantic)
                    : "text-[var(--color-text-muted)]";
                  const ch = (() => {
                    if (byte === 0x0d) return "·";
                    if (byte === 0x0a) return "↵";
                    if (byte === 0x09) return "→";
                    return toVisibleChar(byte);
                  })();
                  return (
                    <span
                      key={bi}
                      className={cls}
                      title={boundary?.label}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Decoded view ──────────────────────────────────────────────────────────
  if (mode === "decoded") {
    const lines: JSX.Element[] = [];
    let lineBytes: { byte: number; boundary: ByteBoundary | null }[] = [];

    const flush = (key: number) => {
      if (lineBytes.length === 0) return;
      lines.push(
        <div key={key} className="flex flex-wrap gap-0 leading-relaxed">
          {lineBytes.map(({ byte, boundary }, bi) => {
            const cls = boundary
              ? toBoundaryClass(boundary.semantic)
              : "text-[var(--color-text-muted)]";
            const ch = isPrintable(byte)
              ? String.fromCharCode(byte)
              : byte === 0x09
                ? "\t"
                : `\\x${hexByte(byte)}`;
            return (
              <span key={bi} className={`mono text-xs ${cls}`} title={boundary?.label}>
                {ch}
              </span>
            );
          })}
        </div>
      );
      lineBytes = [];
    };

    bytes.forEach((byte, i) => {
      const boundary = getBoundaryForByte(i, boundaries);
      if (byte === 0x0a) {
        lineBytes.push({ byte, boundary });
        flush(i);
      } else {
        lineBytes.push({ byte, boundary });
      }
    });
    flush(bytes.length);

    return (
      <div className="overflow-x-auto p-3 space-y-px">{lines}</div>
    );
  }

  // ── Semantic view ─────────────────────────────────────────────────────────
  return (
    <div className="p-3 space-y-4">
      {/* Byte stream with inline coloring */}
      <div className="mono text-xs bg-[var(--color-surface-2)] rounded-lg p-3 overflow-x-auto">
        <span className="leading-relaxed whitespace-pre-wrap break-all">
          {regions.map((region, ri) => {
            const cls = region.boundary
              ? toBoundaryClass(region.boundary.semantic)
              : "text-[var(--color-text-faint)]";
            const text = region.bytes.map(toVisibleChar).join("");
            const title = region.boundary
              ? `${region.boundary.label} (${SEMANTIC_LABELS[region.boundary.semantic] ?? region.boundary.semantic}, bytes ${region.start}–${region.end - 1})`
              : `Unclassified (bytes ${region.start}–${region.end - 1})`;
            return (
              <span
                key={ri}
                className={`${cls} rounded-sm px-px cursor-default`}
                title={title}
              >
                {text}
              </span>
            );
          })}
        </span>
      </div>

      {/* Region legend */}
      {namedRegions.length > 0 && (
        <div>
          <div className="label mb-2">Semantic Regions</div>
          <div className="space-y-1.5">
            {namedRegions.map((region, ri) => {
              const b = region.boundary!;
              const cls = toBoundaryClass(b.semantic);
              return (
                <div key={ri} className="flex items-center gap-2.5">
                  <span
                    className={`inline-block w-3 h-3 rounded-sm shrink-0 ${cls}`}
                  />
                  <span className="text-xs font-medium text-[var(--color-text)]">
                    {b.label}
                  </span>
                  <span className="text-xs text-[var(--color-text-faint)]">
                    {SEMANTIC_LABELS[b.semantic] ?? b.semantic}
                  </span>
                  <span className="text-xs mono text-[var(--color-text-faint)] ml-auto">
                    {b.start}–{b.end - 1} ({region.end - region.start}B)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
