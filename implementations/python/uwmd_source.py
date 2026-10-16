"""Independent read-only source/token foundation, not a UWMD Reader yet.

Format 2.1/2.4 describes the structured Markdown carrier; Protocol VIII.5.1
requires retaining authored numeric precision. This module preserves the UTF-8
source and JSON number lexemes before float conversion. It does not parse YAML,
route variants, validate records, compute hashes, or claim ``parse`` conformance.
Errors here are implementation-local exceptions, not new Protocol error codes.
"""
from dataclasses import dataclass
import json
import math
import re
from typing import Any


class SourceError(ValueError):
    """Source cannot be scanned without guessing or losing distinctions."""


@dataclass(frozen=True)
class Span:
    """Half-open UTF-8 byte offsets in the original immutable source."""

    start: int
    end: int

    def extract(self, source: bytes) -> bytes:
        return source[self.start:self.end]


@dataclass(frozen=True)
class NumberToken:
    pointer: str
    lexeme: str
    span: Span


@dataclass(frozen=True)
class JSONSource:
    value: Any
    numbers: tuple[NumberToken, ...]


@dataclass(frozen=True)
class StructuredBlock:
    """Physical block only; inclusion does not mean valid, active or selected."""

    section: str
    attributes: tuple[tuple[str, str], ...]
    fence_span: Span
    body_span: Span
    parsed: JSONSource


@dataclass(frozen=True)
class ScannedSource:
    raw: bytes
    frontmatter_span: Span
    blocks: tuple[StructuredBlock, ...]


_NUMBER = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")
_SPACE = re.compile(r"[ \t\r\n]*")
_FENCE = re.compile(rb" {0,3}(`{3,}|~{3,})([^\r\n]*)")
_ATTRIBUTE = re.compile(r"([^\s=]+)=([^\s=]+)")


def _pointer_child(parent: str, key: str) -> str:
    return parent + "/" + key.replace("~", "~0").replace("/", "~1")


def parse_json_source(raw: bytes, *, byte_offset: int = 0) -> JSONSource:
    """Decode JSON and keep every number's original token and source location.

    All JSON numbers are binary64 values, including integer-looking tokens.
    Precision must be obtained from the retained lexeme, never the float's repr.
    Duplicate decoded names refuse instead of silently selecting the last name
    (also required before any future Protocol V.13.2 signing projection).
    """
    try:
        text = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise SourceError("JSON is not UTF-8") from error
    # Python string offsets count code points. Convert once, so multibyte text
    # before a number does not move its original UTF-8 byte span.
    positions = [byte_offset]
    for character in text:
        positions.append(positions[-1] + len(character.encode("utf-8")))
    tokens: list[NumberToken] = []
    decoder = json.JSONDecoder()
    cursor = 0

    def whitespace() -> None:
        nonlocal cursor
        cursor = _SPACE.match(text, cursor).end()

    def string() -> str:
        nonlocal cursor
        if cursor >= len(text) or text[cursor] != '"':
            raise SourceError("expected a JSON string")
        try:
            value, cursor = decoder.raw_decode(text, cursor)
        except json.JSONDecodeError as error:
            raise SourceError("malformed JSON string") from error
        return value

    def consume(expected: str) -> None:
        nonlocal cursor
        whitespace()
        if not text.startswith(expected, cursor):
            raise SourceError("expected JSON delimiter " + expected)
        cursor += len(expected)

    def value(pointer: str, depth: int) -> Any:
        nonlocal cursor
        # A local resource limit is explicit refusal, never a truncated result.
        if depth > 200:
            raise SourceError("JSON nesting exceeds this seed's resource limit")
        whitespace()
        if cursor >= len(text):
            raise SourceError("unexpected end of JSON")
        first = text[cursor]
        if first == '"':
            return string()
        if first == "{":
            cursor += 1
            result = {}
            whitespace()
            if cursor < len(text) and text[cursor] == "}":
                cursor += 1
                return result
            while True:
                whitespace()
                key = string()
                if key in result:
                    raise SourceError("duplicate decoded JSON member: " + repr(key))
                consume(":")
                result[key] = value(_pointer_child(pointer, key), depth + 1)
                whitespace()
                if cursor < len(text) and text[cursor] == "}":
                    cursor += 1
                    return result
                consume(",")
        if first == "[":
            cursor += 1
            result = []
            whitespace()
            if cursor < len(text) and text[cursor] == "]":
                cursor += 1
                return result
            while True:
                result.append(value(_pointer_child(pointer, str(len(result))), depth + 1))
                whitespace()
                if cursor < len(text) and text[cursor] == "]":
                    cursor += 1
                    return result
                consume(",")
        for literal, decoded in (("true", True), ("false", False), ("null", None)):
            if text.startswith(literal, cursor):
                cursor += len(literal)
                return decoded
        match = _NUMBER.match(text, cursor)
        if match is None:
            raise SourceError("unsupported or malformed JSON value")
        start, cursor = match.span()
        lexeme = match.group()
        number = float(lexeme)
        if not math.isfinite(number):
            raise SourceError("JSON number is outside finite binary64 range")
        tokens.append(NumberToken(pointer, lexeme, Span(positions[start], positions[cursor])))
        return number

    try:
        decoded = value("", 0)
    except RecursionError as error:
        raise SourceError("JSON nesting exceeds available resources") from error
    whitespace()
    if cursor != len(text):
        raise SourceError("trailing or malformed JSON content")
    return JSONSource(decoded, tuple(tokens))


def scan_source(raw: bytes) -> ScannedSource:
    """Locate frontmatter and physical JSON UW blocks without modifying bytes.

    Frontmatter is retained, not interpreted. No format/version/extension or
    required-field check is claimed here. Unknown sections and all historical
    blocks are retained in physical order; section routing is a later layer.
    Generic fenced examples are opaque so nested apparent UW fences inside
    them cannot become actual data blocks.
    """
    if not isinstance(raw, bytes):
        raise TypeError("scan_source requires original bytes")
    try:
        raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise SourceError("source is not UTF-8") from error
    lines = raw.splitlines(keepends=True)
    if not lines:
        raise SourceError("missing frontmatter")
    # utf-8-sig is not used: original BOM remains part of raw and every span.
    first = lines[0].removeprefix(b"\xef\xbb\xbf").rstrip(b"\r\n")
    if first != b"---":
        raise SourceError("missing opening frontmatter delimiter")
    offsets = [0]
    for line in lines:
        offsets.append(offsets[-1] + len(line))
    closing = next((i for i in range(1, len(lines))
                    if lines[i].rstrip(b"\r\n") == b"---"), None)
    if closing is None:
        raise SourceError("missing closing frontmatter delimiter")
    frontmatter = Span(offsets[1], offsets[closing])
    blocks = []
    index = closing + 1
    while index < len(lines):
        line = lines[index].rstrip(b"\r\n")
        opening = _FENCE.fullmatch(line)
        if opening is None:
            index += 1
            continue
        marker, info = opening.groups()
        # Backticks in the info string cannot open a backtick fence.
        if marker.startswith(b"`") and b"`" in info:
            index += 1
            continue
        ending = re.compile(rb" {0,3}" + re.escape(marker[:1])
                            + rb"{" + str(len(marker)).encode("ascii") + rb",}[ \t]*")
        end = next((i for i in range(index + 1, len(lines))
                    if ending.fullmatch(lines[i].rstrip(b"\r\n"))), None)
        if end is None:
            raise SourceError("unclosed Markdown fence")
        words = info.decode("utf-8").strip().split()
        if words and words[0] == "json" and any(word.startswith("uw:section=") for word in words[1:]):
            attributes = {}
            for word in words[1:]:
                attribute = _ATTRIBUTE.fullmatch(word)
                if attribute is None:
                    raise SourceError("unsupported fence annotation")
                key, item = attribute.groups()
                if key in attributes:
                    raise SourceError("repeated fence annotation key")
                attributes[key] = item
            body = Span(offsets[index + 1], offsets[end])
            parsed = parse_json_source(body.extract(raw), byte_offset=body.start)
            if not isinstance(parsed.value, dict):
                raise SourceError("UW structured block body is not an object")
            blocks.append(StructuredBlock(attributes["uw:section"], tuple(attributes.items()),
                                          Span(offsets[index], offsets[end + 1]), body, parsed))
        index = end + 1
    return ScannedSource(raw, frontmatter, tuple(blocks))
