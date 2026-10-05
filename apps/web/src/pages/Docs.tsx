import { useState } from "react";
import { motion } from "framer-motion";

const SECTIONS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "architecture", label: "Architecture" },
  { id: "scenarios", label: "Scenarios" },
  { id: "http-framing", label: "HTTP Framing" },
  { id: "proxy-behavior", label: "Proxy Behavior" },
  { id: "hardened-mode", label: "Hardened Mode" },
  { id: "evidence", label: "Evidence" },
  { id: "limitations", label: "Limitations" },
  { id: "glossary", label: "Glossary" },
];

const GLOSSARY = [
  { term: "Request Smuggling", def: "An attack where a single HTTP byte stream is interpreted as multiple requests by different tiers in a proxy chain, allowing an attacker to inject a request prefix into the connection queue." },
  { term: "Desynchronization (Desync)", def: "The condition where frontend and backend tiers disagree on the boundary of an HTTP request, producing different interpretations of the same byte stream." },
  { term: "Content-Length (CL)", def: "An HTTP header declaring the exact byte count of the request body. A frontend that trusts CL determines the body boundary by reading exactly that many bytes." },
  { term: "Transfer-Encoding: chunked", def: "An HTTP/1.1 transfer coding where the body is sent as a sequence of size-prefixed chunks. The body boundary is determined by a zero-length terminal chunk (0\\r\\n\\r\\n)." },
  { term: "CL.TE", def: "A desync variant where the frontend uses Content-Length and the backend uses Transfer-Encoding. The chunked body terminates before the declared CL boundary; remaining bytes appear as a new request to the backend." },
  { term: "TE.CL", def: "The reverse: frontend uses Transfer-Encoding, backend uses Content-Length. The full chunked stream is forwarded, but the backend reads only Content-Length bytes, leaving excess as a next-request prefix." },
  { term: "CL.0", def: "A desync variant where Content-Length is declared as zero. The backend does not consume the declared body, so any trailing bytes in the connection stream are interpreted as a new request." },
  { term: "Client-Side Desync (CSD)", def: "Desynchronization caused by a direct browser-to-server request, without a reverse proxy. The server's connection pool can be poisoned via a cross-origin attacker page." },
  { term: "Pause-Based Desync", def: "Desynchronization caused by timeout differences between proxy and backend. If the proxy has a longer read timeout, a deliberately delayed request causes the backend to close its read early, misinterpreting the body boundary." },
  { term: "Chunked Encoding", def: "HTTP/1.1 transfer mechanism: each chunk begins with its size in hexadecimal followed by \\r\\n, the data, and another \\r\\n. A zero-length chunk terminates the body." },
  { term: "HTTP/2 Downgrade", def: "The translation of an HTTP/2 request to HTTP/1.1 by a proxy. During translation, injected pseudo-headers (Content-Length, Transfer-Encoding) may survive into the HTTP/1.1 representation." },
  { term: "Connection Reuse", def: "HTTP persistent connections allow multiple requests to share a single TCP connection. Request smuggling relies on this: the smuggled bytes prefix the next request on the same connection." },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 pb-10 border-b border-[var(--color-border)] last:border-0">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="card p-4 mono text-xs text-[var(--color-text)] overflow-x-auto leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState("getting-started");

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar nav */}
      <nav className="w-56 flex-shrink-0 border-r border-[var(--color-border)] p-4 overflow-y-auto">
        <div className="label mb-3">Documentation</div>
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={() => setActiveSection(s.id)}
                className={`block px-3 py-2 text-sm rounded-control transition-colors ${
                  activeSection === s.id
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text)] font-medium"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10">
        <Section id="getting-started" title="Getting Started">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            RIFT is a local research platform for HTTP request desynchronization. It models how different HTTP tiers
            interpret the same byte stream and makes the disagreement visible.
          </p>
          <h3 className="font-semibold mt-4">Start the API</h3>
          <CodeBlock>{`cd apps/api
python -m venv venv
venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000`}</CodeBlock>
          <h3 className="font-semibold mt-4">Start the Frontend</h3>
          <CodeBlock>{`cd apps/web
npm install
npm run dev`}</CodeBlock>
          <p className="text-sm text-[var(--color-text-muted)]">Open <code className="mono text-xs">http://localhost:5173</code></p>
        </Section>

        <Section id="architecture" title="Architecture">
          <CodeBlock>{`Browser (React + TS + Vite :5173)
    │
    ├─ REST ──────────► FastAPI (:8000)
    └─ WebSocket ─────► FastAPI (:8000)
                             │
                        Protocol Engine
                        (Python — HTTP framing,
                         CL/TE parsing, boundary analysis)
                             │
                        Simulation Layer
                        (Models proxy/backend behavior)
                             │
                        SQLite (rift.db)`}</CodeBlock>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mt-4">
            The protocol engine performs real byte-level computation. The simulation layer replaces Docker containers
            with Python classes that implement the same parsing decisions a real nginx or Flask instance would make.
          </p>
        </Section>

        <Section id="scenarios" title="Scenarios">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Scenarios are defined in YAML files under <code className="mono text-xs">fixtures/</code>.
            Each scenario specifies which framing mode the frontend and backend prefer, the expected divergence outcome,
            and the defensive mitigation.
          </p>
          <CodeBlock>{`id: cl-te
name: CL.TE Desynchronization
frontend_framing: content-length
backend_framing: chunked
expected_divergence: true
expected_message_count:
  frontend: 1
  backend: 2`}</CodeBlock>
        </Section>

        <Section id="http-framing" title="HTTP Framing">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            HTTP/1.1 supports two body framing mechanisms. Their interaction is the root cause of desynchronization.
          </p>
          <h3 className="font-semibold mt-4">Content-Length</h3>
          <CodeBlock>{`POST /demo HTTP/1.1
Content-Length: 12

hello world!`}</CodeBlock>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">
            The receiver reads exactly 12 bytes. Any bytes beyond that offset remain in the connection stream.
          </p>
          <h3 className="font-semibold mt-4">Transfer-Encoding: chunked</h3>
          <CodeBlock>{`POST /demo HTTP/1.1
Transfer-Encoding: chunked

5\r\n
hello\r\n
0\r\n
\r\n`}</CodeBlock>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">
            The receiver reads chunks until a zero-length chunk. RFC 7230 §3.3.3 says Transfer-Encoding takes precedence
            over Content-Length — but not all implementations agree.
          </p>
        </Section>

        <Section id="proxy-behavior" title="Proxy Behavior">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[var(--color-border)] rounded-card overflow-hidden">
              <thead className="bg-[var(--color-surface-2)]">
                <tr>
                  <th className="text-left px-4 py-2 label">Proxy</th>
                  <th className="text-left px-4 py-2 label">Framing Preference</th>
                  <th className="text-left px-4 py-2 label">Hardened Default</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[
                  ["nginx", "Content-Length", "Reject ambiguous (configurable)"],
                  ["HAProxy", "Transfer-Encoding", "Reject ambiguous"],
                  ["Caddy", "Content-Length", "Reject ambiguous"],
                ].map(([p, pref, hardened]) => (
                  <tr key={p}>
                    <td className="px-4 py-2 mono text-xs font-medium">{p}</td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{pref}</td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{hardened}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="hardened-mode" title="Hardened Mode">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Hardened mode applies documented defensive settings to the same byte stream that produced a desync in
            research mode. Toggle it from the lab controls to observe the mitigation in action.
          </p>
          <CodeBlock>{`RESEARCH MODE:
  Ambiguous framing  →  ACCEPTED
  CL + TE both present  →  forwarded to backend

HARDENED MODE:
  Ambiguous framing  →  REJECTED at proxy
  Request never reaches backend
  Result: HARDENED_BLOCKED event`}</CodeBlock>
        </Section>

        <Section id="evidence" title="Evidence">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Every run captures structured evidence: the raw byte stream, boundary interpretations,
            divergence data, and all timeline events. Evidence can be exported as JSON, Markdown, or CSV
            from the run detail page.
          </p>
        </Section>

        <Section id="limitations" title="Limitations">
          <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
            {[
              "The simulation layer models parsing decisions accurately but does not reproduce network timing, TCP reset behavior, or OS-level differences.",
              "H2 scenarios model HTTP/2 translation in Python; real downgrade behavior differs between nginx, Envoy, and other implementations.",
              "Pause-based desync uses software delays; real exploitation depends on actual server timeout configuration and OS scheduling.",
              "Client-side desync uses a synthetic browser model without connection pooling or real cross-origin constraints.",
            ].map((l, i) => (
              <li key={i} className="flex gap-2"><span className="text-[var(--color-text-faint)]">·</span>{l}</li>
            ))}
          </ul>
        </Section>

        <Section id="glossary" title="Glossary">
          <div className="space-y-4">
            {GLOSSARY.map((g) => (
              <div key={g.term}>
                <dt className="font-medium text-sm mono">{g.term}</dt>
                <dd className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">{g.def}</dd>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
