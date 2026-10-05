# RIFT — HTTP Desync Research Platform

> *Where HTTP interpretations diverge.*

RIFT is a local security research platform for understanding and reproducing HTTP request desynchronization inside a completely controlled environment. It models how different HTTP tiers interpret the same byte stream and turns that protocol disagreement into an observable, explainable event.

---

## Why RIFT Exists

Most HTTP smuggling tools are scanners — they tell you whether a target is vulnerable. RIFT does something different: it shows you *why* the vulnerability exists at the protocol level, lets you watch the byte-level disagreement happen in real time, and then demonstrates what a hardened configuration looks like.

The central idea is simple:

```
ONE BYTE STREAM

        ↓

┌─────────────────────┐
│ FRONTEND PROXY      │
│ interprets request  │
└─────────────────────┘
        ↓
   interpretation A

        ↓

┌─────────────────────┐
│ BACKEND SERVER      │
│ interprets request  │
└─────────────────────┘
        ↓
   interpretation B

When A ≠ B → RIFT
```

RIFT makes this disagreement visible, reproducible, and educational.

---

## Architecture

```
React + TypeScript + Vite (port 5173)
    │
    ├─ REST ──────────► FastAPI (port 8000)
    └─ WebSocket ─────► FastAPI (port 8000)
                             │
                        Protocol Engine
                        (Python — real HTTP framing,
                         CL/TE parsing, chunked decoding,
                         differential analysis)
                             │
                        Simulation Layer
                        (Models nginx/HAProxy/Flask
                         parsing behavior without Docker)
                             │
                        SQLite (rift.db)
                        (runs · evidence · notes · history)
```

The protocol engine is real computation — byte-level framing, chunked encoding parsing, and differential analysis all run in Python. The simulation layer replaces Docker containers with Python classes that model how each proxy/backend combination interprets framing headers. This produces accurate results without requiring a container runtime.

---

## Supported Scenarios

| Scenario | Protocol | Status | Description |
|----------|----------|--------|-------------|
| CL.TE | HTTP/1.1 | Implemented | Frontend uses Content-Length; backend uses Transfer-Encoding |
| TE.CL | HTTP/1.1 | Implemented | Frontend uses Transfer-Encoding; backend uses Content-Length |
| CL.0 | HTTP/1.1 | Implemented | Content-Length: 0 with body-consumption disagreement |
| H2.CL | HTTP/2→1.1 | Experimental | Injected Content-Length survives H2 translation |
| H2.TE | HTTP/2→1.1 | Experimental | Transfer-Encoding forwarded through H2 translation |
| Client-Side Desync | HTTP/1.1 | Simulated | Browser connection pool poisoning (synthetic browser) |
| Pause-Based | HTTP/1.1 | Implemented | Timeout mismatch creates framing boundary |

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:5173

---

## Running Tests

```bash
cd apps/api
pip install pytest
pytest ../../tests/backend/ -v
```

---

## Lab Topology

```
┌──────────────┐
│    CLIENT    │  Synthetic — lab.rift
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    PROXY     │  nginx | HAProxy | Caddy (simulated)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   BACKEND    │  Flask | FastAPI (simulated)
└──────────────┘
```

All traffic stays inside the local simulation layer. No external requests are made.

---

## Security Boundary

RIFT is designed for authorized security research and education only.

- All attack demonstrations target intentionally configured local simulation components
- No real credentials, cookies, or tokens are collected
- Victim headers use clearly labeled synthetic values (`DEMO_VICTIM_SESSION_8F31`)
- The lab cannot target arbitrary URLs — only internal simulation endpoints
- No external network requests are made during scenario execution
- The WAF is a local simulated rule engine, not an actual WAF

RIFT demonstrates *how* desynchronization works, not how to exploit arbitrary production infrastructure.

---

## Project Structure

```
rift/
├── apps/
│   ├── web/               # React + TS + Vite frontend
│   └── api/               # FastAPI backend
│       ├── protocol/      # HTTP framing engine
│       ├── scenarios/     # Scenario definitions + loader
│       ├── simulation/    # Proxy/backend simulators
│       ├── analysis/      # Differential interpretation engine
│       ├── evidence/      # Evidence capture
│       └── db/            # SQLAlchemy + SQLite
├── fixtures/              # YAML scenario definitions
├── tests/                 # pytest backend tests
└── docs/                  # Architecture + threat model
```

---

## Limitations

- The simulation layer models framing behavior accurately but does not reproduce real network timing, connection reset behavior, or OS-level TCP stack differences
- H2 scenarios model the translation layer in software; real H2 downgrade behavior may vary between implementations
- Pause-based desync uses configurable delays in the simulation; real exploitation depends on actual server timeout configuration
- The client-side desync simulation uses a synthetic browser model; real browser behavior involves connection pooling strategies that differ by implementation

---

## License

MIT — for authorized security research and education use.
