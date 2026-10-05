"""SQLAlchemy ORM models for RIFT persistence."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, Float, DateTime, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


class Run(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True)
    scenario_id = Column(String, nullable=False)
    proxy = Column(String, nullable=False)
    backend = Column(String, nullable=False)
    mode = Column(String, nullable=False)  # research | hardened
    status = Column(String, nullable=False, default="pending")  # pending|running|pass|fail|error
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime, nullable=True)
    frontend_count = Column(Integer, nullable=True)
    backend_count = Column(Integer, nullable=True)
    divergence = Column(Boolean, nullable=True)
    hardened_blocked = Column(Boolean, nullable=True)
    severity = Column(String, nullable=True)
    explanation = Column(Text, nullable=True)
    raw_stream_hex = Column(Text, nullable=True)
    events_json = Column(Text, nullable=True)
    duration_ms = Column(Float, nullable=True)

    def events(self) -> list[dict]:
        if self.events_json:
            return json.loads(self.events_json)
        return []


class ResearchNote(Base):
    __tablename__ = "research_notes"

    id = Column(String, primary_key=True)
    run_id = Column(String, nullable=True)
    scenario_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True)
    run_id = Column(String, nullable=False)
    kind = Column(String, nullable=False)
    label = Column(String, nullable=False)
    data_json = Column(Text, nullable=False)
    captured_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def create_db(db_path: str = "rift.db"):
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return engine, Session
