"""Private exact-reference source accounting; never a financial projection."""


def metadata_blocks(document):
    sources = document._retained_sources
    if not sources:
        return document.source.blocks
    ordered, seen = [], set()
    for source in (*sources, document.source):
        for block in source.blocks:
            if id(block) not in seen:
                seen.add(id(block)); ordered.append(block)
    return tuple(ordered)


def original_source_index(document, block):
    for index, source in enumerate(document._retained_sources):
        if any(current is block for current in source.blocks):
            return index
    return None


def authored_source_reference(document, block):
    return not document._retained_sources or original_source_index(document, block) is not None


def source_context(document, index, block):
    context = dict(block_index=index, variant=dict(block.attributes).get("variant"),
                   body_byte_start=block.body_span.start, body_byte_end=block.body_span.end)
    if document._retained_sources:
        context["source_index"] = original_source_index(document, block)
        context["model_only"] = context["source_index"] is None
    return context


def number_source(document, token):
    """Return the exact immutable source owning this token's original span.

    Assembled pointers are model paths; their spans never become root offsets.
    Unknown/copied tokens have no inferred byte origin.
    """
    for current, source in document._number_origins:
        if current is token:
            return source
    for source in document._retained_sources or (document.source,):
        if any(current is token for block in source.blocks for current in block.parsed.numbers):
            return source
    return None
