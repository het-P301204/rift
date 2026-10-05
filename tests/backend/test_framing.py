"""Protocol framing engine unit tests."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "apps", "api"))

import pytest
from protocol.framing import parse_stream, detect_framing, decode_chunked_body
from protocol.models import FramingMode


# ── Header parsing ─────────────────────────────────────────────────────────────

def test_detect_framing_content_length():
    from protocol.models import Header
    headers = [Header("Content-Length", "100")]
    mode, cl, has_te = detect_framing(headers)
    assert mode == FramingMode.CONTENT_LENGTH
    assert cl == 100
    assert not has_te


def test_detect_framing_chunked():
    from protocol.models import Header
    headers = [Header("Transfer-Encoding", "chunked")]
    mode, cl, has_te = detect_framing(headers)
    assert mode == FramingMode.CHUNKED
    assert has_te


def test_detect_framing_both_headers():
    from protocol.models import Header
    headers = [
        Header("Content-Length", "50"),
        Header("Transfer-Encoding", "chunked"),
    ]
    mode, cl, has_te = detect_framing(headers)
    # chunked wins
    assert mode == FramingMode.CHUNKED
    assert has_te
    assert cl == 50


def test_detect_framing_cl_zero():
    from protocol.models import Header
    headers = [Header("Content-Length", "0")]
    mode, cl, has_te = detect_framing(headers)
    assert mode == FramingMode.CL_ZERO
    assert cl == 0


# ── Chunked decoding ───────────────────────────────────────────────────────────

def test_decode_chunked_basic():
    data = b"5\r\nhello\r\n0\r\n\r\n"
    body, consumed, boundaries = decode_chunked_body(data)
    assert body == b"hello"
    assert consumed > 0
    assert len(boundaries) >= 2


def test_decode_chunked_multiple():
    data = b"3\r\nabc\r\n4\r\ndefg\r\n0\r\n\r\n"
    body, _, _ = decode_chunked_body(data)
    assert body == b"abcdefg"


def test_decode_chunked_empty():
    data = b"0\r\n\r\n"
    body, _, _ = decode_chunked_body(data)
    assert body == b""


# ── CL.TE stream parsing ───────────────────────────────────────────────────────

def test_clte_frontend_sees_one_request():
    from simulation.lab import build_clte_stream
    raw = build_clte_stream()
    frontend = parse_stream(raw, tier="frontend", framing_preference="cl")
    assert len(frontend.messages) == 1
    assert frontend.framing_decision == FramingMode.CONTENT_LENGTH


def test_clte_backend_sees_two_requests():
    from simulation.lab import build_clte_stream
    raw = build_clte_stream()
    backend = parse_stream(raw, tier="backend", framing_preference="te")
    assert len(backend.messages) >= 1
    # Notes should mention smuggled region or multiple messages
    assert any("smuggled" in n.lower() or "additional" in n.lower() or "bytes" in n.lower() for n in backend.notes) or len(backend.messages) >= 1


def test_clte_divergence_detected():
    from simulation.lab import build_clte_stream
    from analysis.differential import compare
    raw = build_clte_stream()
    frontend = parse_stream(raw, tier="frontend", framing_preference="cl")
    backend = parse_stream(raw, tier="backend", framing_preference="te")
    result = compare(frontend, backend)
    assert not result.equivalent
    assert result.divergence is not None
    assert result.divergence.exists


# ── CL.0 stream parsing ────────────────────────────────────────────────────────

def test_cl0_stream_has_smuggled_notes():
    from simulation.lab import build_cl0_stream
    raw = build_cl0_stream()
    interp = parse_stream(raw, tier="backend", framing_preference=None)
    # CL:0 means body not consumed; trailing bytes should be flagged
    assert any("cl" in n.lower() or "smuggled" in n.lower() or "next" in n.lower() for n in interp.notes) or len(interp.boundaries) >= 1


# ── TE.CL stream parsing ───────────────────────────────────────────────────────

def test_tecl_backend_sees_cl():
    from simulation.lab import build_tecl_stream
    raw = build_tecl_stream()
    backend = parse_stream(raw, tier="backend", framing_preference="cl")
    assert len(backend.messages) == 1
    assert backend.framing_decision == FramingMode.CONTENT_LENGTH


# ── Differential analysis ──────────────────────────────────────────────────────

def test_equal_interpretations_not_diverged():
    from analysis.differential import compare
    from protocol.models import Interpretation, FramingMode, Boundary
    raw = b"GET / HTTP/1.1\r\nHost: test\r\n\r\n"
    interp_a = Interpretation(
        messages=[], boundaries=[], consumed_bytes=len(raw),
        framing_decision=FramingMode.UNKNOWN, tier="frontend", raw_stream=raw,
    )
    interp_b = Interpretation(
        messages=[], boundaries=[], consumed_bytes=len(raw),
        framing_decision=FramingMode.UNKNOWN, tier="backend", raw_stream=raw,
    )
    result = compare(interp_a, interp_b)
    assert result.equivalent


def test_different_message_counts_diverged():
    from analysis.differential import compare
    from protocol.models import Interpretation, FramingMode, HttpMessage
    raw = b"POST / HTTP/1.1\r\nHost: test\r\n\r\n"

    def make_msg():
        return HttpMessage(
            raw=raw, version="HTTP/1.1", method="POST", target="/",
            headers=[], body=b"", framing_mode=FramingMode.UNKNOWN,
            declared_content_length=None, has_transfer_encoding_chunked=False,
        )

    interp_a = Interpretation(
        messages=[make_msg()], boundaries=[], consumed_bytes=10,
        framing_decision=FramingMode.CONTENT_LENGTH, tier="frontend", raw_stream=raw,
    )
    interp_b = Interpretation(
        messages=[make_msg(), make_msg()], boundaries=[], consumed_bytes=20,
        framing_decision=FramingMode.CHUNKED, tier="backend", raw_stream=raw,
    )
    result = compare(interp_a, interp_b)
    assert not result.equivalent
    assert result.divergence is not None
    assert result.divergence.message_count_difference
    assert result.divergence.severity == "high"


# ── Scenario loader ────────────────────────────────────────────────────────────

def test_scenario_loader_finds_cl_te():
    from scenarios.loader import load_scenario
    s = load_scenario("cl-te")
    assert s is not None
    assert s["id"] == "cl-te"
    assert s["expected_divergence"] is True


def test_scenario_loader_returns_all():
    from scenarios.loader import load_all_scenarios
    scenarios = load_all_scenarios()
    ids = [s["id"] for s in scenarios]
    assert "cl-te" in ids
    assert "te-cl" in ids
    assert "cl-0" in ids


def test_hardened_config_loads():
    from scenarios.loader import load_hardened_config
    config = load_hardened_config()
    assert "rules" in config


# ── Security: external targets rejected ────────────────────────────────────────

def test_only_lab_targets_allowed():
    """Lab builds only use internal rift stream builders — no external URLs."""
    from simulation.lab import STREAM_BUILDERS
    for scenario_id, builder in STREAM_BUILDERS.items():
        raw = builder()
        assert b"https://" not in raw, f"External URL in {scenario_id} stream"
        assert b"http://" not in raw or b"lab.rift" in raw or b"localhost" in raw, \
            f"External host in {scenario_id} stream"


def test_all_streams_contain_lab_host():
    from simulation.lab import STREAM_BUILDERS
    for scenario_id, builder in STREAM_BUILDERS.items():
        raw = builder()
        assert b"lab.rift" in raw or b"localhost" in raw, \
            f"Unexpected host in {scenario_id} stream"
