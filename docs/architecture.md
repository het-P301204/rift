# RIFT Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RIFT FRONTEND                            │
│              React + TypeScript + Vite                      │
│                                                             │
│  Landing  Lab  Scenarios  Visualizer  Topology  Runs        │
│  Notes    Compare  Docs  Settings                           │
└───────────────────┬─────────────────────────────────────────┘
                    │
         REST (axios) + WebSocket
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                    RIFT API                                 │
│                FastAPI + uvicorn                            │
│                                                             │
│  /api/scenarios     /api/runs       /api/stats              │
│  /api/topology      /api/notes      /api/evidence           │
│  /ws/run (WebSocket — live scenario streaming)              │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                PROTOCOL ENGINE                              │
│                                                             │
│  framing.py     — HTTP/1.1 header parsing                   │
│                 — Content-Length body delimitation           │
│                 — Transfer-Encoding chunked decoding         │
│                 — Boundary calculation                       │
│                                                             │
│  models.py      — HttpMessage, Interpretation, Divergence   │
│                 — Boundary, DifferentialResult              │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│               SIMULATION LAYER                              │
│                                                             │
│  lab.py         — Proxy profiles (nginx, HAProxy, Caddy)    │
│                 — Backend profiles (Flask, FastAPI)         │
│                 — Stream builders for each scenario          │
│                 — Async event generator                     │
│                                                             │
│  ProxyProfile   — framing_preference, rejects_ambiguous     │
│  BackendProfile — framing_preference, strict_body_consume   │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│            DIFFERENTIAL ANALYSIS ENGINE                     │
│                                                             │
│  differential.py — compare(frontend, backend)               │
│                  — message count comparison                 │
│                  — boundary offset comparison               │
│                  — smuggled region extraction               │
│                  — deterministic explanation generation     │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                    SQLITE                                   │
│                                                             │
│  Run            — scenario, proxy, backend, mode, events    │
│  ResearchNote   — attached to run or scenario               │
│  Evidence       — byte stream captures, divergence data     │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: Scenario Execution

```
1. Frontend sends WebSocket message:
   { scenario_id, proxy, backend, hardened, timing_ms }

2. API creates Run record (status=running) in SQLite

3. run_scenario() generator fires:
   a. Selects proxy profile (research or hardened)
   b. Selects backend profile (research or hardened)
   c. Emits PROXY_READY, BACKEND_READY events

4. Stream builder constructs raw bytes:
   build_clte_stream() → bytes

5. Hardened check (if enabled):
   detect ambiguous headers → HARDENED_BLOCKED → DONE

6. parse_stream(raw, framing_preference="cl") → frontend Interpretation
   Emits PROXY_PARSED event with boundaries + message count

7. parse_stream(raw, framing_preference="te") → backend Interpretation
   Emits BACKEND_PARSED event with boundaries + message count

8. compare(frontend, backend) → DifferentialResult
   Emits DIVERGENCE event (or NO_DIVERGENCE)

9. Emits DONE

10. API finalises Run record, saves Evidence
    WebSocket closed
```

## Protocol Engine: Framing Logic

The framing engine (`protocol/framing.py`) parses raw HTTP/1.1 byte streams. It implements the same logic a real HTTP parser would use, but as explicit Python code:

### Content-Length mode
- Reads exactly `Content-Length` bytes from the body
- Remaining bytes after that offset are flagged as a SMUGGLED region
- Produces one message per parse call

### Transfer-Encoding chunked mode  
- Reads chunk-size lines in hex
- Reads chunk-data of that length
- Terminal chunk `0\r\n\r\n` ends the body
- Remaining stream may contain next message

### CL.0 mode
- Body is empty (zero bytes consumed)
- Any bytes after the header separator are flagged as SMUGGLED

### Ambiguity (both CL and TE present)
- `framing_preference` parameter overrides automatic detection
- Simulates how each proxy/backend behaves when both headers are present

## Simulation Layer: Proxy Profiles

Each proxy is modeled as a `ProxyProfile` dataclass:

```python
ProxyProfile(
    name="nginx",
    framing_preference="cl",       # prefer Content-Length
    rejects_ambiguous=False,       # research mode
)

ProxyProfile(
    name="nginx",
    framing_preference="cl",
    rejects_ambiguous=True,        # hardened mode
    strips_te_on_h2=True,
    recalculates_cl=True,
)
```

In research mode, both CL and TE may be forwarded. In hardened mode, the ambiguous request is rejected before the protocol engine runs.

## Evidence Capture

Every run captures:
- Raw stream (hex-encoded) from the CLIENT_SENT event
- Divergence data (message counts, byte offsets, explanation) from DIVERGENCE event
- All events as JSON for full replay

Evidence is attached to the Run record and accessible via `/api/evidence/{run_id}`.
