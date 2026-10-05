"""Differential interpretation engine — compares frontend vs backend parsing."""
from __future__ import annotations
from typing import Optional
from protocol.models import Interpretation, Divergence, DifferentialResult, FramingMode


def _explain_divergence(frontend: Interpretation, backend: Interpretation) -> str:
    fc = len(frontend.messages)
    bc = len(backend.messages)

    if fc == bc == 0:
        return "Neither tier successfully parsed a complete HTTP message from the stream."

    if fc < bc:
        if frontend.framing_decision == FramingMode.CONTENT_LENGTH:
            return (
                "The frontend terminated the request according to the declared Content-Length. "
                "The backend applied Transfer-Encoding chunked framing, which ended earlier, "
                "leaving the remaining bytes to be interpreted as a second HTTP message."
            )
        return (
            f"The frontend interpreted {fc} message(s) while the backend interpreted {bc}. "
            "The framing boundary disagreement left bytes in the stream that the backend "
            "treated as a separate request."
        )

    if fc > bc:
        if backend.framing_decision == FramingMode.CONTENT_LENGTH:
            return (
                "The backend terminated request body consumption at the declared Content-Length. "
                "The frontend had already consumed the full chunked stream. The backend's "
                "remaining unconsumed bytes form a synthetic second request."
            )
        return (
            f"The frontend interpreted {fc} message(s) while the backend interpreted {bc}. "
            "The backend's stricter framing caused it to terminate body consumption earlier."
        )

    if fc == bc and frontend.consumed_bytes != backend.consumed_bytes:
        return (
            f"Both tiers parsed {fc} message(s) but consumed different byte counts "
            f"(frontend: {frontend.consumed_bytes}, backend: {backend.consumed_bytes}). "
            "The boundary offset differs, which can corrupt subsequent connection-reuse requests."
        )

    return "No divergence detected. Both tiers produced equivalent interpretations."


def _find_divergent_offset(frontend: Interpretation, backend: Interpretation) -> Optional[int]:
    """Find the byte offset where interpretations diverge."""
    if not frontend.boundaries or not backend.boundaries:
        return None
    # Compare boundary lists pairwise
    for fb, bb in zip(frontend.boundaries, backend.boundaries):
        if fb.end_byte != bb.end_byte:
            return min(fb.end_byte, bb.end_byte)
    if len(frontend.boundaries) != len(backend.boundaries):
        shorter = min(len(frontend.boundaries), len(backend.boundaries))
        if shorter > 0:
            return frontend.boundaries[shorter - 1].end_byte
    return None


def _smuggled_region(frontend: Interpretation, backend: Interpretation) -> Optional[bytes]:
    """Extract bytes that one tier left unconsumed."""
    raw = frontend.raw_stream
    if len(frontend.messages) < len(backend.messages):
        # Frontend consumed less; remaining bytes are the smuggled prefix
        if frontend.consumed_bytes < len(raw):
            return raw[frontend.consumed_bytes:]
    elif len(frontend.messages) > len(backend.messages):
        if backend.consumed_bytes < len(raw):
            return raw[backend.consumed_bytes:]
    return None


def compare(frontend: Interpretation, backend: Interpretation) -> DifferentialResult:
    fc = len(frontend.messages)
    bc = len(backend.messages)

    message_count_diff = fc != bc
    boundary_mismatch = frontend.consumed_bytes != backend.consumed_bytes
    exists = message_count_diff or boundary_mismatch

    if not exists:
        return DifferentialResult(
            equivalent=True,
            frontend=frontend,
            backend=backend,
            divergence=None,
            raw_stream=frontend.raw_stream,
        )

    severity = "none"
    if message_count_diff:
        severity = "high"
    elif boundary_mismatch:
        severity = "medium"

    divergence = Divergence(
        exists=True,
        message_count_difference=message_count_diff,
        frontend_count=fc,
        backend_count=bc,
        boundary_mismatch=boundary_mismatch,
        divergent_byte_offset=_find_divergent_offset(frontend, backend),
        smuggled_region=_smuggled_region(frontend, backend),
        explanation=_explain_divergence(frontend, backend),
        severity=severity,
    )

    return DifferentialResult(
        equivalent=False,
        frontend=frontend,
        backend=backend,
        divergence=divergence,
        raw_stream=frontend.raw_stream,
    )
