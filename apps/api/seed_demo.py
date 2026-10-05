"""
Seed the RIFT database with demo run history for showcase purposes.
Run: python seed_demo.py
"""
import sys
import os
import datetime
import json
import random
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from db.models import create_db, Run, ResearchNote, Evidence

SCENARIOS = [
    ("cl-te", "CL.TE Desynchronization", "high"),
    ("te-cl", "TE.CL Desynchronization", "high"),
    ("cl-0", "CL.0 Desynchronization", "medium"),
    ("h2-cl", "H2.CL Desynchronization", "medium"),
    ("client-side", "Client-Side Desynchronization", "high"),
    ("pause-based", "Pause-Based Desynchronization", "low"),
]

PROXIES = ["nginx", "haproxy", "caddy"]
BACKENDS = ["flask", "fastapi"]

DEMO_EVENTS_CLTE = [
    {"ts": 0, "kind": "INIT", "message": "Scenario initialized", "data": {"scenario_id": "cl-te", "proxy": "nginx", "backend": "flask", "hardened": False}},
    {"ts": 12, "kind": "PROXY_READY", "message": "nginx simulation ready", "data": {"framing_preference": "cl"}},
    {"ts": 18, "kind": "BACKEND_READY", "message": "flask simulation ready", "data": {"framing_preference": "te"}},
    {"ts": 24, "kind": "CLIENT_SENT", "message": "Ambiguous request transmitted", "data": {"bytes": 147, "hex": "504f5354202f646f6e617465204854545031312e310d0a486f73743a206c61622e726966740d0a436f6e74656e742d4c656e6774683a203133360d0a5472616e736665722d456e636f64696e673a206368756e6b65640d0a0d0a300d0a0d0a"}},
    {"ts": 55, "kind": "PROXY_PARSED", "message": "Frontend parsed 1 request", "data": {"framing": "content-length", "message_count": 1, "consumed_bytes": 147, "boundaries": [{"start": 0, "end": 86, "label": "headers", "semantic": "HEADER"}, {"start": 86, "end": 147, "label": "body (CL=61)", "semantic": "BODY"}]}},
    {"ts": 88, "kind": "BACKEND_PARSED", "message": "Backend parsed 2 requests", "data": {"framing": "chunked", "message_count": 2, "consumed_bytes": 147, "boundaries": [{"start": 0, "end": 86, "label": "headers", "semantic": "HEADER"}, {"start": 86, "end": 92, "label": "chunk-size=0", "semantic": "CHUNK_SIZE"}, {"start": 92, "end": 98, "label": "terminal chunk", "semantic": "CHUNK_DATA"}, {"start": 98, "end": 147, "label": "SMUGGLED prefix", "semantic": "SMUGGLED"}]}},
    {"ts": 89, "kind": "DIVERGENCE", "message": "Boundary divergence detected", "data": {"severity": "high", "frontend_count": 1, "backend_count": 2, "explanation": "Frontend (nginx) consumed all 147 bytes as a single request using Content-Length. Backend (flask) interpreted Transfer-Encoding: chunked, found the terminal chunk at offset 92, and treated bytes 98-147 as the start of a second request — the smuggled prefix.", "divergent_byte_offset": 92, "smuggled_region_hex": "474554202f61646d696e20485454502f312e310d0a"}},
    {"ts": 90, "kind": "DONE", "message": "Run complete", "data": {"run_id": "demo-001"}},
]


def make_events(scenario_id, proxy, backend, hardened, diverged):
    base = [
        {"ts": 0, "kind": "INIT", "message": "Scenario initialized", "data": {"scenario_id": scenario_id, "proxy": proxy, "backend": backend, "hardened": hardened}},
        {"ts": random.randint(8, 20), "kind": "PROXY_READY", "message": f"{proxy} simulation ready", "data": {"framing_preference": "cl" if proxy != "haproxy" else "te"}},
        {"ts": random.randint(15, 30), "kind": "BACKEND_READY", "message": f"{backend} simulation ready", "data": {"framing_preference": "te" if scenario_id == "cl-te" else "cl"}},
        {"ts": random.randint(20, 40), "kind": "CLIENT_SENT", "message": "Ambiguous request transmitted", "data": {"bytes": random.randint(120, 200)}},
    ]
    if hardened:
        base.append({"ts": random.randint(30, 50), "kind": "HARDENED_BLOCKED", "message": "Request rejected by hardened configuration", "data": {"reason": "Ambiguous framing (both CL and TE present) rejected at proxy before reaching backend"}})
    else:
        pref_fe = "content-length" if proxy != "haproxy" else "chunked"
        pref_be = "chunked" if scenario_id in ("cl-te", "cl-0") else "content-length"
        base += [
            {"ts": random.randint(40, 70), "kind": "PROXY_PARSED", "message": "Frontend parsed 1 request", "data": {"framing": pref_fe, "message_count": 1, "consumed_bytes": 147, "boundaries": []}},
            {"ts": random.randint(70, 100), "kind": "BACKEND_PARSED", "message": f"Backend parsed {'2' if diverged else '1'} request(s)", "data": {"framing": pref_be, "message_count": 2 if diverged else 1, "consumed_bytes": 147, "boundaries": []}},
        ]
        if diverged:
            base.append({"ts": random.randint(100, 120), "kind": "DIVERGENCE", "message": "Boundary divergence detected", "data": {"severity": "high", "frontend_count": 1, "backend_count": 2, "explanation": f"Frontend ({proxy}) and backend ({backend}) disagree on request boundary — desynchronization confirmed.", "divergent_byte_offset": random.randint(60, 120)}})
    base.append({"ts": random.randint(110, 140), "kind": "DONE", "message": "Run complete", "data": {}})
    return base


def seed():
    engine, SessionLocal = create_db("rift.db")
    db = SessionLocal()

    # Clear existing demo runs
    db.query(Evidence).filter(Evidence.run_id.like("demo-%")).delete(synchronize_session=False)
    db.query(ResearchNote).filter(ResearchNote.run_id.like("demo-%")).delete(synchronize_session=False)
    db.query(Run).filter(Run.id.like("demo-%")).delete(synchronize_session=False)
    db.commit()

    now = datetime.datetime.utcnow()
    run_id_counter = 1

    combos = [
        # (scenario_id, proxy, backend, hardened, diverged, status, minutes_ago)
        ("cl-te", "nginx", "flask", False, True, "pass", 5),
        ("cl-te", "nginx", "flask", True, False, "pass", 10),
        ("te-cl", "haproxy", "flask", False, True, "pass", 22),
        ("cl-0", "nginx", "fastapi", False, True, "pass", 35),
        ("cl-0", "caddy", "flask", True, False, "pass", 48),
        ("h2-cl", "nginx", "flask", False, False, "pass", 62),
        ("client-side", "nginx", "flask", False, True, "pass", 80),
        ("pause-based", "haproxy", "fastapi", False, False, "pass", 95),
        ("cl-te", "haproxy", "fastapi", False, True, "pass", 120),
        ("te-cl", "caddy", "flask", True, False, "pass", 145),
        ("cl-0", "nginx", "flask", False, True, "pass", 200),
        ("client-side", "haproxy", "flask", False, True, "pass", 240),
    ]

    for scenario_id, proxy, backend, hardened, diverged, status, mins_ago in combos:
        run_id = f"demo-{run_id_counter:03d}"
        run_id_counter += 1
        started = now - datetime.timedelta(minutes=mins_ago)
        duration = random.uniform(0.8, 2.5)
        events = make_events(scenario_id, proxy, backend, hardened, diverged)

        run = Run(
            id=run_id,
            scenario_id=scenario_id,
            proxy=proxy,
            backend=backend,
            mode="hardened" if hardened else "research",
            status=status,
            divergence=diverged,
            hardened_blocked=hardened and not diverged,
            started_at=started,
            duration_ms=int(duration * 1000),
            events_json=json.dumps(events),
        )
        db.add(run)

        # Add raw stream evidence
        ev = Evidence(
            id=str(uuid.uuid4()),
            run_id=run_id,
            kind="raw_stream",
            label="Raw byte stream",
            data_json=json.dumps({"hex": "504f5354202f646f6e617465", "bytes": 147}),
        )
        db.add(ev)

        if diverged:
            ev2 = Evidence(
                id=str(uuid.uuid4()),
                run_id=run_id,
                kind="divergence_report",
                label="Differential analysis report",
                data_json=json.dumps({"severity": "high", "frontend_count": 1, "backend_count": 2}),
            )
            db.add(ev2)

    # Add research notes
    notes_data = [
        ("CL.TE vs nginx — initial findings", "cl-te", "demo-001",
         "nginx processes Content-Length header as authoritative when both CL and TE are present. "
         "Backend flask takes Transfer-Encoding as authoritative per RFC 7230 §3.3.3. The disagreement "
         "creates a consistent smuggling window of 49 bytes in the tested payload.\n\n"
         "Next: test with larger payloads to see if window grows proportionally."),
        ("HAProxy TE preference confirmed", "te-cl", "demo-009",
         "HAProxy consistently strips ambiguous requests when hardened=true. In research mode, it "
         "forwards the full chunked stream which causes flask to re-interpret boundary. CWE-444 confirmed."),
        ("CL.0 — Caddy behavior", "cl-0", "demo-005",
         "Caddy with CL=0 immediately triggers HARDENED_BLOCKED — Caddy's default configuration rejects "
         "zero-length CL with a body. This is the safest default of the three proxies tested."),
        ("H2.CL downgrade notes", "h2-cl", None,
         "HTTP/2 downgrade scenarios are marked experimental because Python's HTTP/2 simulation is "
         "simplified. In real nginx, the HTTP/2 frontend strips hop-by-hop headers before downgrading. "
         "Need to verify HPACK header injection path."),
        ("Client-Side Desync — cross-origin vector", "client-side", "demo-007",
         "CSD exploits are particularly interesting because no reverse proxy is needed — the browser "
         "itself becomes the desync vector. In this simulation, the synthetic victim uses "
         "DEMO_VICTIM_SESSION_8F31 which confirms our controlled environment."),
    ]

    for title, scenario_id, run_id, content in notes_data:
        note = ResearchNote(
            id=str(uuid.uuid4()),
            title=title,
            content=content,
            scenario_id=scenario_id,
            run_id=run_id,
        )
        db.add(note)

    db.commit()
    db.close()
    print(f"Seeded {len(combos)} demo runs and {len(notes_data)} research notes.")
    print("Start the API server: uvicorn main:app --reload --port 8000")


if __name__ == "__main__":
    seed()
