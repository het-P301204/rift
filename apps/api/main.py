"""RIFT — HTTP Desync Research Platform API."""
from __future__ import annotations
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import create_db, Run, ResearchNote, Evidence
from scenarios.loader import load_all_scenarios, load_scenario, load_hardened_config
from simulation.lab import run_scenario, PROXY_PROFILES, BACKEND_PROFILES

logger = logging.getLogger(__name__)

# ── Database ──────────────────────────────────────────────────────────────────
engine, SessionLocal = create_db("rift.db")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── App ───────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="RIFT API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class RunRequest(BaseModel):
    scenario_id: str
    proxy: str = "nginx"
    backend: str = "flask"
    hardened: bool = False
    timing_ms: int = Field(default=0, ge=0, le=5000)


class NoteCreate(BaseModel):
    run_id: Optional[str] = None
    scenario_id: Optional[str] = None
    title: str
    content: str


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


# ── Scenarios ─────────────────────────────────────────────────────────────────
@app.get("/api/scenarios")
def list_scenarios():
    return load_all_scenarios()


@app.get("/api/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    s = load_scenario(scenario_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return s


@app.get("/api/hardened")
def get_hardened_config():
    return load_hardened_config()


# ── Lab topology ──────────────────────────────────────────────────────────────
@app.get("/api/topology")
def get_topology():
    return {
        "proxies": [
            {"id": "nginx", "name": "nginx", "status": "ready", "version": "1.25"},
            {"id": "haproxy", "name": "HAProxy", "status": "ready", "version": "2.8"},
            {"id": "caddy", "name": "Caddy", "status": "ready", "version": "2.7"},
        ],
        "backends": [
            {"id": "flask", "name": "Flask", "status": "ready", "version": "3.0"},
            {"id": "fastapi", "name": "FastAPI", "status": "ready", "version": "0.104"},
        ],
        "mode": "simulation",
        "network": "rift-local-sim",
        "victim": {"id": "synthetic-victim", "status": "ready", "session": "DEMO_VICTIM_SESSION_8F31"},
        "attacker": {"id": "synthetic-attacker", "status": "ready"},
        "waf": {"id": "sim-waf", "status": "ready", "rules": 3},
    }


# ── Runs ──────────────────────────────────────────────────────────────────────
@app.get("/api/runs")
def list_runs(limit: int = Query(default=50, ge=1, le=500)):
    db = SessionLocal()
    try:
        runs = db.query(Run).order_by(Run.started_at.desc()).limit(limit).all()
        return [_run_to_dict(r) for r in runs]
    finally:
        db.close()


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    db = SessionLocal()
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        return _run_to_dict(run)
    finally:
        db.close()


@app.delete("/api/runs")
def delete_all_runs(db: Session = Depends(get_db)):
    db.query(Evidence).delete()
    db.query(ResearchNote).filter(ResearchNote.run_id != None).delete()
    db.query(Run).delete()
    db.commit()
    return {"deleted": True}


@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str):
    db = SessionLocal()
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        db.delete(run)
        db.commit()
        return {"deleted": run_id}
    finally:
        db.close()


def _run_to_dict(r: Run) -> dict:
    return {
        "id": r.id,
        "scenario_id": r.scenario_id,
        "proxy": r.proxy,
        "backend": r.backend,
        "mode": r.mode,
        "status": r.status,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "frontend_count": r.frontend_count,
        "backend_count": r.backend_count,
        "divergence": r.divergence,
        "hardened_blocked": r.hardened_blocked,
        "severity": r.severity,
        "explanation": r.explanation,
        "duration_ms": r.duration_ms,
        "events": r.events(),
    }


# ── Dashboard stats ────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats():
    db = SessionLocal()
    try:
        total = db.query(func.count(Run.id)).scalar() or 0
        passed = db.query(func.count(Run.id)).filter(Run.status == "pass").scalar() or 0
        failed = db.query(func.count(Run.id)).filter(Run.status == "fail").scalar() or 0
        errors = db.query(func.count(Run.id)).filter(Run.status == "error").scalar() or 0
        desync = db.query(func.count(Run.id)).filter(Run.divergence == True).scalar() or 0
        hardened_blocked = db.query(func.count(Run.id)).filter(Run.hardened_blocked == True).scalar() or 0
        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "desync_observed": desync,
            "hardened_blocked": hardened_blocked,
        }
    finally:
        db.close()


# ── Research Notes ─────────────────────────────────────────────────────────────
@app.get("/api/notes")
def list_notes(run_id: Optional[str] = None, scenario_id: Optional[str] = None):
    db = SessionLocal()
    try:
        q = db.query(ResearchNote)
        if run_id:
            q = q.filter(ResearchNote.run_id == run_id)
        if scenario_id:
            q = q.filter(ResearchNote.scenario_id == scenario_id)
        notes = q.order_by(ResearchNote.created_at.desc()).all()
        return [_note_to_dict(n) for n in notes]
    finally:
        db.close()


@app.post("/api/notes")
def create_note(body: NoteCreate):
    db = SessionLocal()
    try:
        note = ResearchNote(
            id=str(uuid.uuid4()),
            run_id=body.run_id,
            scenario_id=body.scenario_id,
            title=body.title,
            content=body.content,
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return _note_to_dict(note)
    finally:
        db.close()


@app.put("/api/notes/{note_id}")
def update_note(note_id: str, body: NoteUpdate):
    db = SessionLocal()
    try:
        note = db.query(ResearchNote).filter(ResearchNote.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        if body.title is not None:
            note.title = body.title
        if body.content is not None:
            note.content = body.content
        note.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(note)
        return _note_to_dict(note)
    finally:
        db.close()


@app.delete("/api/notes/{note_id}")
def delete_note(note_id: str):
    db = SessionLocal()
    try:
        note = db.query(ResearchNote).filter(ResearchNote.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        db.delete(note)
        db.commit()
        return {"deleted": note_id}
    finally:
        db.close()


def _note_to_dict(n: ResearchNote) -> dict:
    return {
        "id": n.id,
        "run_id": n.run_id,
        "scenario_id": n.scenario_id,
        "title": n.title,
        "content": n.content,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


# ── Evidence ───────────────────────────────────────────────────────────────────
@app.get("/api/evidence/{run_id}")
def get_evidence(run_id: str):
    db = SessionLocal()
    try:
        items = db.query(Evidence).filter(Evidence.run_id == run_id).all()
        return [
            {
                "id": e.id,
                "run_id": e.run_id,
                "kind": e.kind,
                "label": e.label,
                "data": json.loads(e.data_json),
                "captured_at": e.captured_at.isoformat() if e.captured_at else None,
            }
            for e in items
        ]
    finally:
        db.close()


# ── WebSocket — Live scenario execution ────────────────────────────────────────
@app.websocket("/ws/run")
async def websocket_run(ws: WebSocket):
    await ws.accept()
    db = None
    try:
        raw = await ws.receive_text()
        req = RunRequest(**json.loads(raw))

        run_id = str(uuid.uuid4())
        db = SessionLocal()
        run = Run(
            id=run_id,
            scenario_id=req.scenario_id,
            proxy=req.proxy,
            backend=req.backend,
            mode="hardened" if req.hardened else "research",
            status="running",
        )
        db.add(run)
        db.commit()

        events: list[dict] = []
        t_start = datetime.now(timezone.utc)

        async for event in run_scenario(
            req.scenario_id,
            proxy_name=req.proxy,
            backend_name=req.backend,
            hardened=req.hardened,
            timing_ms=req.timing_ms,
        ):
            payload = {
                "ts": event.ts,
                "kind": event.kind,
                "message": event.message,
                "data": event.data,
            }
            events.append(payload)
            await ws.send_text(json.dumps(payload))

        # Finalise run record
        t_end = datetime.now(timezone.utc)
        done_event = next((e for e in events if e["kind"] == "DONE"), None)
        divergence_event = next((e for e in events if e["kind"] == "DIVERGENCE"), None)
        proxy_event = next((e for e in events if e["kind"] == "PROXY_PARSED"), None)
        backend_event = next((e for e in events if e["kind"] == "BACKEND_PARSED"), None)
        client_event = next((e for e in events if e["kind"] == "CLIENT_SENT"), None)

        run.status = "pass" if done_event else "error"
        run.finished_at = t_end
        run.duration_ms = (t_end - t_start).total_seconds() * 1000
        run.events_json = json.dumps(events)

        if done_event:
            run.divergence = done_event["data"].get("divergence", False)
            run.hardened_blocked = done_event["data"].get("hardened_blocked", False)
        if divergence_event:
            run.severity = divergence_event["data"].get("severity")
            run.explanation = divergence_event["data"].get("explanation")
        if proxy_event:
            run.frontend_count = proxy_event["data"].get("message_count")
        if backend_event:
            run.backend_count = backend_event["data"].get("message_count")
        if client_event:
            run.raw_stream_hex = client_event["data"].get("hex")

        # Save evidence
        if client_event:
            db.add(Evidence(
                id=str(uuid.uuid4()),
                run_id=run_id,
                kind="byte_stream",
                label="Raw stream transmitted by synthetic client",
                data_json=json.dumps(client_event["data"]),
            ))
        if divergence_event:
            db.add(Evidence(
                id=str(uuid.uuid4()),
                run_id=run_id,
                kind="divergence",
                label="Boundary divergence observation",
                data_json=json.dumps(divergence_event["data"]),
            ))

        db.commit()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            logger.exception("WebSocket run error")
            await ws.send_text(json.dumps({"kind": "ERROR", "message": "Internal engine error — check server logs", "data": {}}))
        except Exception:
            pass
    finally:
        if db is not None:
            db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "RIFT API"}
