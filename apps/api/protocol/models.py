"""Core HTTP protocol data models for RIFT."""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class FramingMode(str, Enum):
    CONTENT_LENGTH = "content-length"
    CHUNKED = "chunked"
    CL_ZERO = "cl-zero"
    UNKNOWN = "unknown"


class HttpVersion(str, Enum):
    HTTP_10 = "HTTP/1.0"
    HTTP_11 = "HTTP/1.1"
    HTTP_20 = "HTTP/2.0"


@dataclass
class Header:
    name: str
    value: str
    raw: bytes = field(default=b"")

    def to_bytes(self) -> bytes:
        return f"{self.name}: {self.value}\r\n".encode()


@dataclass
class HttpMessage:
    raw: bytes
    version: str
    method: Optional[str]
    target: Optional[str]
    headers: list[Header]
    body: bytes
    framing_mode: FramingMode
    declared_content_length: Optional[int]
    has_transfer_encoding_chunked: bool

    def header(self, name: str) -> Optional[str]:
        name_lower = name.lower()
        for h in self.headers:
            if h.name.lower() == name_lower:
                return h.value
        return None

    def all_headers(self, name: str) -> list[str]:
        name_lower = name.lower()
        return [h.value for h in self.headers if h.name.lower() == name_lower]


@dataclass
class Boundary:
    start_byte: int
    end_byte: int
    label: str
    semantic: str  # HEADER | BODY | CHUNK_SIZE | CHUNK_DATA | TRAILER | SMUGGLED


@dataclass
class Interpretation:
    messages: list[HttpMessage]
    boundaries: list[Boundary]
    consumed_bytes: int
    framing_decision: FramingMode
    tier: str  # "frontend" | "backend"
    raw_stream: bytes
    notes: list[str] = field(default_factory=list)


@dataclass
class Divergence:
    exists: bool
    message_count_difference: bool
    frontend_count: int
    backend_count: int
    boundary_mismatch: bool
    divergent_byte_offset: Optional[int]
    smuggled_region: Optional[bytes]
    explanation: str
    severity: str  # "none" | "low" | "medium" | "high"


@dataclass
class DifferentialResult:
    equivalent: bool
    frontend: Interpretation
    backend: Interpretation
    divergence: Optional[Divergence]
    raw_stream: bytes
