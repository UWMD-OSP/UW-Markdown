"""Format Appendix D restricted YAML, independently decoded from source bytes.

No YAML library, defaults, schema coercion, host date parser or underwriting
selection is involved. Tokens retain their original UTF-8 spans and spelling.
"""
from dataclasses import dataclass
import math
import re

from uwmd_source import NumberToken, SourceError, Span


class FrontmatterError(SourceError):
    """Existing Format Appendix D refusal, not a new validation family."""

    code = "UNSUPPORTED_YAML_FEATURE"


@dataclass(frozen=True)
class FrontmatterSource:
    value: dict
    numbers: tuple[NumberToken, ...]


_ESCAPES = {
    "0": "\0", "a": "\a", "b": "\b", "t": "\t", "n": "\n", "v": "\v",
    "f": "\f", "r": "\r", "e": "\x1b", " ": " ", '"': '"', "/": "/",
    "\\": "\\", "N": "\x85", "_": "\xa0", "L": "\u2028", "P": "\u2029",
}
_DECIMAL = re.compile(r"[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?")
# Appendix D retains YAML 1.2 scalar meaning. Its Core schema admits signs
# on decimals, not on octal/hex prefixes (YAML 1.2.2 section 10.3.2).
_INTEGER = re.compile(r"(?:0o[0-7]+|0x[0-9a-fA-F]+)")


def _quoted(text: str) -> tuple[str, int]:
    quote, output, position = text[0], [], 1
    while position < len(text):
        char = text[position]
        position += 1
        if char == quote:
            if quote == "'" and text[position:position + 1] == "'":
                output.append("'")
                position += 1
                continue
            return "".join(output), position
        if char == "\\" and quote == '"':
            if position == len(text):
                raise FrontmatterError("unfinished YAML escape")
            escape = text[position]
            position += 1
            if escape in "xuU":
                width = {"x": 2, "u": 4, "U": 8}[escape]
                digits = text[position:position + width]
                if len(digits) != width or re.fullmatch(r"[0-9a-fA-F]+", digits) is None:
                    raise FrontmatterError("malformed YAML Unicode escape")
                point = int(digits, 16)
                if point > 0x10ffff or 0xd800 <= point <= 0xdfff:
                    raise FrontmatterError("YAML escape is not a Unicode scalar")
                output.append(chr(point))
                position += width
            elif escape in _ESCAPES:
                output.append(_ESCAPES[escape])
            else:
                raise FrontmatterError("unsupported YAML escape")
        else:
            output.append(char)
    raise FrontmatterError("unclosed one-line YAML scalar")


def _scalar(text: str):
    """Return value and numeric spelling, if any; comments are not values."""
    text = text.strip(" \t")
    if text.startswith(("'", '"')):
        decoded, end = _quoted(text)
        tail = text[end:]
        if tail.strip(" \t") and re.fullmatch(r"[ \t]+#.*", tail) is None:
            raise FrontmatterError("content after quoted YAML scalar")
        return decoded, None
    text = re.split(r"[ \t]+#", text, maxsplit=1)[0].rstrip(" \t")
    if text.startswith("#") or text in ("", "~", "null", "Null", "NULL"):
        return None, None
    if text in ("true", "True", "TRUE", "false", "False", "FALSE"):
        return text.lower() == "true", None
    if text == "[]":
        return [], None
    if _DECIMAL.fullmatch(text) or _INTEGER.fullmatch(text):
        try:
            if _INTEGER.fullmatch(text):
                value = float(int(text[2:], 8 if text.startswith("0o") else 16))
            else:
                value = float(text)
        except (OverflowError, ValueError) as error:
            raise FrontmatterError("YAML number exceeds available numeric resources") from error
        if not math.isfinite(value):
            raise FrontmatterError("YAML number exceeds finite binary64 range")
        return value, text
    if text.lower() in (".inf", "+.inf", "-.inf", ".nan"):
        raise FrontmatterError("non-finite YAML number")
    if (text[0] in "&*!|>{}[],%@`" or text in ("-", "?", ":") or text.endswith(":")
            or text.startswith(("? ", "- ", ": ")) or re.search(r":[ \t]", text)):
        raise FrontmatterError("YAML feature outside Appendix D")
    return text, None


def _mapping_entry(text: str) -> tuple[str, str, int]:
    if text.startswith(("'", '"')):
        key, end = _quoted(text)
        while end < len(text) and text[end] in " \t":
            end += 1
        if end == len(text) or text[end] != ":":
            raise FrontmatterError("expected colon after scalar mapping key")
    else:
        match = re.search(r":(?=[ \t]|$)", text)
        if match is None:
            raise FrontmatterError("expected YAML mapping entry")
        end = match.start()
        key, token = _scalar(text[:end])
        if token is not None or not isinstance(key, str) or not key:
            raise FrontmatterError("mapping key must be a simple string")
    if not key or end + 1 < len(text) and text[end + 1] not in " \t":
        raise FrontmatterError("invalid YAML mapping delimiter")
    start = end + 1
    while start < len(text) and text[start] in " \t":
        start += 1
    return key, text[start:], start


def parse_frontmatter(raw: bytes, *, byte_offset: int = 0) -> FrontmatterSource:
    """Decode exactly one top-level mapping and its admitted one-level children."""
    try:
        text = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise FrontmatterError("frontmatter is not UTF-8") from error
    if any((ord(char) < 32 and char not in "\t\r\n") or 0x7f <= ord(char) <= 0x84
           or 0x86 <= ord(char) <= 0x9f or ord(char) in (0xfffe, 0xffff) for char in text):
        raise FrontmatterError("raw YAML character is not printable; use a quoted escape")
    rows, offset = [], byte_offset
    # str.splitlines also splits NEL/Unicode line separators and VT/FF. YAML
    # 1.2 physical line breaks are CR/LF; those printable Unicode characters
    # inside a quoted scalar must not become new mapping entries.
    for match in re.finditer(r"[^\r\n]*(?:\r\n|\r|\n|$)", text):
        raw_line = match.group()
        line = raw_line.rstrip("\r\n")
        if line.strip(" \t") and not line.lstrip(" ").startswith("#"):
            indent = len(line) - len(line.lstrip(" "))
            if indent not in (0, 2) or line[indent:].startswith("\t"):
                raise FrontmatterError("only one two-space nested YAML level is admitted")
            rows.append((indent, line[indent:], offset + indent))
        offset += len(raw_line.encode("utf-8"))
    values, tokens, index = {}, [], 0

    def assign(text, start, pointer):
        decoded, spelling = _scalar(text)
        if spelling is not None:
            leading = len(text) - len(text.lstrip(" \t"))
            begin = start + len(text[:leading].encode("utf-8"))
            tokens.append(NumberToken(pointer, spelling, Span(begin, begin + len(spelling.encode("utf-8")))))
        return decoded

    def child_pointer(parent, key):
        return parent + "/" + key.replace("~", "~0").replace("/", "~1")

    while index < len(rows):
        indent, line, start = rows[index]
        if indent:
            raise FrontmatterError("unexpected indented YAML entry")
        key, scalar, scalar_start = _mapping_entry(line)
        if key in values:
            raise FrontmatterError("duplicate decoded YAML mapping key")
        pointer = child_pointer("", key)
        index += 1
        if index == len(rows) or rows[index][0] == 0:
            values[key] = assign(scalar, start + len(line[:scalar_start].encode("utf-8")), pointer)
            continue
        if scalar.strip(" \t") and not scalar.lstrip(" \t").startswith("#"):
            raise FrontmatterError("scalar entry cannot also contain nested entries")
        sequence = rows[index][1] == "-" or rows[index][1].startswith("- ")
        nested = [] if sequence else {}
        while index < len(rows) and rows[index][0] == 2:
            _, child, child_start = rows[index]
            is_item = child == "-" or child.startswith("- ")
            if sequence != is_item:
                raise FrontmatterError("mixed YAML mapping and sequence")
            if sequence:
                item = child[1:].lstrip(" \t")
                item_offset = len(child) - len(item)
                nested.append(assign(item, child_start + len(child[:item_offset].encode("utf-8")),
                                     child_pointer(pointer, str(len(nested)))))
            else:
                item_key, item, item_offset = _mapping_entry(child)
                if item_key in nested:
                    raise FrontmatterError("duplicate decoded nested YAML key")
                nested[item_key] = assign(item, child_start + len(child[:item_offset].encode("utf-8")),
                                          child_pointer(pointer, item_key))
            index += 1
        values[key] = nested
    return FrontmatterSource(values, tuple(tokens))
