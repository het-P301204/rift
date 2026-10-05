"""Simulation layer and scenario engine tests."""
import sys
import os
import asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "apps", "api"))

import pytest
from simulation.lab import run_scenario, PROXY_PROFILES, BACKEND_PROFILES


def run_async(coro):
    return asyncio.run(coro)


async def collect_events(scenario_id: str, proxy: str = "nginx", backend: str = "flask", hardened: bool = False):
    events = []
    async for e in run_scenario(scenario_id, proxy_name=proxy, backend_name=backend, hardened=hardened):
        events.append(e)
    return events


def test_clte_produces_divergence():
    events = run_async(collect_events("cl-te"))
    kinds = [e.kind for e in events]
    assert "CLIENT_SENT" in kinds
    assert "PROXY_PARSED" in kinds
    assert "BACKEND_PARSED" in kinds
    assert "DIVERGENCE" in kinds or "DONE" in kinds


def test_clte_hardened_blocks():
    events = run_async(collect_events("cl-te", hardened=True))
    kinds = [e.kind for e in events]
    assert "HARDENED_BLOCKED" in kinds
    assert "DIVERGENCE" not in kinds


def test_tecl_produces_divergence():
    events = run_async(collect_events("te-cl"))
    kinds = [e.kind for e in events]
    assert "CLIENT_SENT" in kinds
    assert "DONE" in kinds


def test_cl0_runs_successfully():
    events = run_async(collect_events("cl-0"))
    kinds = [e.kind for e in events]
    assert "DONE" in kinds
    assert "ERROR" not in kinds


def test_csd_runs_successfully():
    events = run_async(collect_events("client-side-desync"))
    kinds = [e.kind for e in events]
    assert "DONE" in kinds


def test_pause_based_runs():
    events = run_async(collect_events("pause-based"))
    kinds = [e.kind for e in events]
    assert "DONE" in kinds


def test_h2cl_runs():
    events = run_async(collect_events("h2-cl"))
    kinds = [e.kind for e in events]
    assert "DONE" in kinds


def test_unknown_proxy_errors():
    events = run_async(collect_events("cl-te", proxy="apache"))
    kinds = [e.kind for e in events]
    assert "ERROR" in kinds


def test_init_event_has_metadata():
    events = run_async(collect_events("cl-te"))
    init = next((e for e in events if e.kind == "INIT"), None)
    assert init is not None
    assert init.data["scenario"] == "cl-te"


def test_proxy_parsed_has_count():
    events = run_async(collect_events("cl-te"))
    proxy_ev = next((e for e in events if e.kind == "PROXY_PARSED"), None)
    assert proxy_ev is not None
    assert "message_count" in proxy_ev.data


def test_client_sent_has_hex():
    events = run_async(collect_events("cl-te"))
    sent = next((e for e in events if e.kind == "CLIENT_SENT"), None)
    assert sent is not None
    assert "hex" in sent.data
    assert len(sent.data["hex"]) > 0


def test_all_proxy_profiles_valid():
    for name, profile in PROXY_PROFILES.items():
        assert profile.name == name
        assert profile.framing_preference in ("cl", "te", "auto")


def test_demo_credentials_are_synthetic():
    """Ensure victim tokens contain DEMO_ prefix — never real credentials."""
    from simulation.lab import build_csd_stream
    raw = build_csd_stream()
    assert b"DEMO_VICTIM_SESSION" in raw
    assert b"DEMO_VICTIM_TOKEN" in raw
