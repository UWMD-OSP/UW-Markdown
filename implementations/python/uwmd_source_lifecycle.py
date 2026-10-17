"""Read-only lifecycle routing from both accepted source locations (Format 2.4)."""


def source_superseded(block):
    meta = block.parsed.value.get("_meta")
    lifecycle = meta.get("lifecycle") if isinstance(meta, dict) else None
    return (isinstance(lifecycle, dict) and lifecycle.get("superseded") is True
            or dict(block.attributes).get("superseded") == "true")
