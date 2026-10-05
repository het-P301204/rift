"""HTTP/1.1 framing parser — real byte-level interpretation logic."""
from __future__ import annotations
from typing import Optional
from .models import (
    Header, HttpMessage, Boundary, Interpretation, FramingMode, HttpVersion
)


def parse_headers(raw_headers: bytes) -> tuple[str, str, str, list[Header]]:
    """Parse request line + headers from raw bytes."""
    lines = raw_headers.split(b"\r\n")
    request_line = lines[0].decode("latin-1")
    parts = request_line.split(" ", 2)
    method = parts[0] if len(parts) > 0 else ""
    target = parts[1] if len(parts) > 1 else "/"
    version = parts[2] if len(parts) > 2 else "HTTP/1.1"

    headers: list[Header] = []
    for line in lines[1:]:
        if b":" in line:
            name_b, _, value_b = line.partition(b":")
            headers.append(Header(
                name=name_b.decode("latin-1").strip(),
                value=value_b.decode("latin-1").strip(),
                raw=line,
            ))
    return method, target, version, headers


def detect_framing(headers: list[Header]) -> tuple[FramingMode, Optional[int], bool]:
    """Determine framing mode from parsed headers."""
    cl_values = [h.value for h in headers if h.name.lower() == "content-length"]
    te_values = [h.value for h in headers if h.name.lower() == "transfer-encoding"]

    has_chunked = any("chunked" in v.lower() for v in te_values)
    has_cl = bool(cl_values)
    cl_int: Optional[int] = None

    if has_cl:
        try:
            cl_int = int(cl_values[-1].strip())
        except ValueError:
            cl_int = None

    if has_cl and cl_int == 0 and not has_chunked:
        return FramingMode.CL_ZERO, 0, False

    if has_chunked:
        return FramingMode.CHUNKED, cl_int, True

    if has_cl and cl_int is not None:
        return FramingMode.CONTENT_LENGTH, cl_int, False

    return FramingMode.UNKNOWN, None, False


def decode_chunked_body(data: bytes) -> tuple[bytes, int, list[Boundary]]:
    """Decode chunked transfer encoding, return (body, bytes_consumed, boundaries)."""
    body = bytearray()
    offset = 0
    boundaries: list[Boundary] = []

    while offset < len(data):
        crlf = data.find(b"\r\n", offset)
        if crlf == -1:
            break
        try:
            chunk_size = int(data[offset:crlf].split(b";")[0], 16)
        except ValueError:
            break

        boundaries.append(Boundary(
            start_byte=offset,
            end_byte=crlf,
            label=f"chunk-size:{chunk_size}",
            semantic="CHUNK_SIZE",
        ))

        offset = crlf + 2
        if chunk_size == 0:
            # terminal chunk — trailer follows
            boundaries.append(Boundary(
                start_byte=offset - 2,
                end_byte=offset,
                label="chunk-terminal",
                semantic="TRAILER",
            ))
            offset += 2  # consume trailing \r\n
            break

        chunk_end = offset + chunk_size
        boundaries.append(Boundary(
            start_byte=offset,
            end_byte=chunk_end,
            label=f"chunk-data:{chunk_size}",
            semantic="CHUNK_DATA",
        ))
        body.extend(data[offset:chunk_end])
        offset = chunk_end + 2  # skip \r\n after chunk

    return bytes(body), offset, boundaries


def parse_stream(raw: bytes, tier: str, framing_preference: Optional[str] = None) -> Interpretation:
    """
    Parse a raw byte stream into an Interpretation from the perspective of one tier.
    framing_preference: "cl" | "te" | None (auto)
    """
    messages: list[HttpMessage] = []
    all_boundaries: list[Boundary] = []
    offset = 0
    notes: list[str] = []
    framing = FramingMode.UNKNOWN

    while offset < len(raw):
        # Find header/body separator
        sep = raw.find(b"\r\n\r\n", offset)
        if sep == -1:
            notes.append("Incomplete HTTP message — no header terminator found")
            break

        raw_headers = raw[offset:sep]
        header_end = sep + 4

        all_boundaries.append(Boundary(
            start_byte=offset,
            end_byte=sep,
            label="headers",
            semantic="HEADER",
        ))

        method, target, version, headers = parse_headers(raw_headers)
        framing, cl_int, has_te_chunked = detect_framing(headers)

        # Apply framing preference (simulates proxy/backend preference)
        if framing_preference == "cl" and cl_int is not None:
            framing = FramingMode.CONTENT_LENGTH
            has_te_chunked = False
        elif framing_preference == "te" and has_te_chunked:
            framing = FramingMode.CHUNKED
            cl_int = None

        body_start = header_end
        body = b""
        body_consumed = 0
        chunk_boundaries: list[Boundary] = []

        if framing == FramingMode.CONTENT_LENGTH and cl_int is not None:
            body = raw[body_start:body_start + cl_int]
            body_consumed = cl_int
            all_boundaries.append(Boundary(
                start_byte=body_start,
                end_byte=body_start + cl_int,
                label=f"body(cl={cl_int})",
                semantic="BODY",
            ))
            remainder_start = body_start + cl_int
            if remainder_start < len(raw):
                all_boundaries.append(Boundary(
                    start_byte=remainder_start,
                    end_byte=len(raw),
                    label="smuggled-region",
                    semantic="SMUGGLED",
                ))
                notes.append(
                    f"Bytes beyond Content-Length boundary remain in stream: "
                    f"offset {remainder_start}–{len(raw)}"
                )

        elif framing == FramingMode.CHUNKED:
            body, body_consumed, chunk_boundaries = decode_chunked_body(raw[body_start:])
            all_boundaries.extend([
                Boundary(
                    start_byte=b.start_byte + body_start,
                    end_byte=b.end_byte + body_start,
                    label=b.label,
                    semantic=b.semantic,
                )
                for b in chunk_boundaries
            ])

        elif framing == FramingMode.CL_ZERO:
            body = b""
            body_consumed = 0
            # Body is empty; remaining bytes are a new request
            if body_start < len(raw):
                all_boundaries.append(Boundary(
                    start_byte=body_start,
                    end_byte=len(raw),
                    label="next-request(cl=0)",
                    semantic="SMUGGLED",
                ))
                notes.append(
                    "CL: 0 — body not consumed; subsequent bytes interpreted as new request"
                )

        else:
            # No framing — consume nothing, stop
            body_consumed = 0

        messages.append(HttpMessage(
            raw=raw[offset:body_start + body_consumed],
            version=version,
            method=method,
            target=target,
            headers=headers,
            body=body,
            framing_mode=framing,
            declared_content_length=cl_int,
            has_transfer_encoding_chunked=has_te_chunked,
        ))

        next_offset = body_start + body_consumed

        # For CL.TE: frontend stops here, backend will see remaining bytes
        # For TE.CL: backend stops at CL; frontend consumed chunked entirely
        if framing == FramingMode.CONTENT_LENGTH:
            break  # this tier consumed one request by CL; stop
        elif framing == FramingMode.CHUNKED:
            offset = next_offset
            if offset >= len(raw):
                break
        elif framing == FramingMode.CL_ZERO:
            break
        else:
            break

    return Interpretation(
        messages=messages,
        boundaries=all_boundaries,
        consumed_bytes=offset if messages else 0,
        framing_decision=framing if messages else FramingMode.UNKNOWN,
        tier=tier,
        raw_stream=raw,
        notes=notes,
    )
