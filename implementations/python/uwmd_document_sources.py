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
