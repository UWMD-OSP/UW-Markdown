"""Independent V.9 hashes and bounded V.10 read-only chain assessment.

File reports/evidence are nonnormative. Unsupported identity classification is
explicit, never an invented INT code or a complete integrity-profile claim.
"""
import copy
import hashlib
import re

from uwmd_jcs import CanonicalizationError, canonicalize
from uwmd_reader import APPEND, PARALLEL
from uwmd_source import StructuredBlock
from uwmd_source_lifecycle import source_superseded


_HASH = re.compile(r"[0-9a-f]{64}\Z")


class BlockIntegrityError(ValueError):
    """Local unsupported input/canonicalization/provider refusal, not an INT code."""


async def _sha256(preimage):
    return hashlib.sha256(preimage).hexdigest()


async def compute_block_hash(payload, *, hash_provider=None):
    """V.9: remove only top-level _meta; return unprefixed lowercase SHA-256."""
    if not isinstance(payload, dict):
        raise BlockIntegrityError("A fenced block object is required")
    snapshot = copy.deepcopy(payload)
    snapshot.pop("_meta", None)
    try:
        preimage = canonicalize(snapshot).encode("utf-8")
    except CanonicalizationError as error:
        raise BlockIntegrityError("Block canonicalization unavailable: " + str(error)) from error
    try:
        result = await (hash_provider or _sha256)(preimage)
    except Exception as error:
        raise BlockIntegrityError("Block SHA-256 provider unavailable") from error
    if not isinstance(result, str) or _HASH.fullmatch(result) is None:
        raise BlockIntegrityError("Block SHA-256 provider returned invalid lowercase hex")
    return result


def _integrity(block):
    meta = block.parsed.value.get("_meta", {})
    if not isinstance(meta, dict):
        raise BlockIntegrityError("Block _meta is not an object")
    integrity = meta.get("integrity", {})
    if not isinstance(integrity, dict):
        raise BlockIntegrityError("Block integrity metadata is not an object")
    if "algorithm" in integrity and integrity["algorithm"] != "sha256":
        raise BlockIntegrityError("Only the admitted sha256 block algorithm is supported")
    if "content_hash" in integrity and (not isinstance(integrity["content_hash"], str)
            or _HASH.fullmatch(integrity["content_hash"]) is None):
        raise BlockIntegrityError("Stamped content_hash is not lowercase SHA-256 hex")
    parent = integrity.get("parent_hash")
    if parent is not None and parent != "" and (not isinstance(parent, str) or _HASH.fullmatch(parent) is None):
        raise BlockIntegrityError("Stamped parent_hash is not admitted hex or null")
    return integrity


def _file_chains(blocks):
    """Only unambiguous accepted file identities; never discard physical history."""
    sections = {}
    for index, block in enumerate(blocks):
        sections.setdefault(block.section, []).append(index)
    chains, unsupported = [], []
    for section, indexes in sections.items():
        current = [blocks[i] for i in indexes if not source_superseded(blocks[i])]
        role_map = (any("_role" in b.parsed.value for b in current)
                    and any("variant" in dict(b.attributes) for b in current))
        historical_optin = (any("_role" in blocks[i].parsed.value for i in indexes)
                            and any("variant" in dict(blocks[i].attributes) for i in indexes))
        if section not in PARALLEL and not role_map and historical_optin:
            unsupported.append(dict(section=section, block_indexes=list(indexes),
                reason="Historical role/variant identity no longer has a current role-opted classification."))
            continue
        if section in APPEND and len(indexes) > 1:
            unsupported.append(dict(section=section, block_indexes=list(indexes),
                reason="Append-only entries do not define an unambiguous supersede sequence."))
            continue
        if section in PARALLEL or role_map:
            variants = {}
            for index in indexes:
                variants.setdefault(dict(blocks[index].attributes).get("variant"), []).append(index)
            chains.extend(variants.values())
        else:
            chains.append(indexes)
    return chains, unsupported


def _issue(code, severity, section, message, expected=None, actual=None):
    result = dict(code=code, severity=severity, section=section, message=message)
    if expected is not None:
        result["expected"] = expected
    if actual is not None:
        result["actual"] = actual
    return result


async def _assess(blocks, chains, unsupported, hash_provider):
    result = dict(scope="block_content_and_chains", assessment="complete", ok=True, issues=[],
                  chains_with_hashes=0, chains_checked=0, chains_skipped=0, blocks_hashed=0,
                  signatures_present=0, signatures_verified=0, signatures_checked=False,
                  blocks=[], unsupported_chains=unsupported, local_failures=[])
    metadata = []
    for index, block in enumerate(blocks):
        evidence = dict(block_index=index, section=block.section,
                        variant=dict(block.attributes).get("variant"), superseded=source_superseded(block),
                        hash_status="unchecked", stamped_hash=None, computed_hash=None)
        result["blocks"].append(evidence)
        meta = block.parsed.value.get("_meta")
        raw_integrity = meta.get("integrity") if isinstance(meta, dict) else None
        if isinstance(raw_integrity, dict):
            result["signatures_present"] += raw_integrity.get("signature") is not None
        try:
            integrity = _integrity(block)
            metadata.append(integrity)
            stamped = integrity.get("content_hash")
            evidence["stamped_hash"] = stamped
            if stamped is None:
                continue
            computed = await compute_block_hash(block.parsed.value, hash_provider=hash_provider)
            result["blocks_hashed"] += 1
            evidence.update(computed_hash=computed, hash_status="matched" if computed == stamped else "mismatch")
            if computed != stamped:
                result["issues"].append(_issue("INT-04", "warning", block.section,
                    "Stamped content hash does not recompute from current block content.", computed, stamped))
        except BlockIntegrityError as error:
            if len(metadata) <= index:
                metadata.append(None)
            evidence["hash_status"] = "unavailable"
            result["local_failures"].append(dict(block_index=index, message=str(error)))
    for chain in chains:
        # No successful sequence assessment can be made from malformed metadata.
        if any(metadata[index] is None for index in chain):
            continue
        if not any("content_hash" in metadata[index] for index in chain):
            result["chains_skipped"] += 1
            continue
        result["chains_with_hashes"] += 1
        result["chains_checked"] += 1
        seen_hash, previous = False, None
        for index in chain:
            integrity, block = metadata[index], blocks[index]
            if previous is not None and integrity.get("parent_hash") != previous.get("content_hash"):
                result["issues"].append(_issue("INT-01", "error", block.section,
                    "Parent hash differs from the immediately prior retained block's content hash.",
                    previous.get("content_hash"), integrity.get("parent_hash")))
            if "content_hash" not in integrity:
                if seen_hash:
                    result["issues"].append(_issue("INT-03", "warning", block.section,
                        "A later block in an opted-in chain lacks content_hash."))
            else:
                seen_hash = True
            previous = integrity
    if result["local_failures"]:
        result["assessment"] = "unavailable"
    elif unsupported:
        result["assessment"] = "unsupported"
    result["ok"] = result["assessment"] == "complete" and not result["issues"]
    return result


async def verify_block_chain(blocks, *, hash_provider=None):
    """Already-addressed physical sequence; caller owns its chain identity/order.

    No source lookup or role inference occurs. All block payloads are snapshotted
    before the first await. This does not establish completeness of retained history.
    """
    if not isinstance(blocks, (list, tuple)) or any(not isinstance(b, StructuredBlock) for b in blocks):
        raise BlockIntegrityError("An explicitly ordered sequence of structured source blocks is required")
    sequence = copy.deepcopy(list(blocks))
    return await _assess(sequence, [list(range(len(sequence)))] if sequence else [], [], hash_provider)


async def verify_block_integrity(document, *, hash_provider=None):
    """Bounded file-domain V.10 assessment; source/Reader objects remain unchanged.

    Historical role removal and ambiguous append-only sequence classification
    return local unsupported assessment, while every physical block retains V.9
    evidence. `ok` is a strict local summary (warnings also make it false), never
    a signature/authenticity, complete V.10 domain or integrity-profile claim.
    Root/orphan-parent behavior is unchanged: no predecessor is invented.
    """
    snapshot = copy.deepcopy(document)
    chains, unsupported = _file_chains(snapshot.source.blocks)
    return await _assess(snapshot.source.blocks, chains, unsupported, hash_provider)
