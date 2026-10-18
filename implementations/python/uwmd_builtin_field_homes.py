"""Narrow accepted hospitality field homes (Format4.3/4.32, RFC0081G3).

This helper inventories only explicitly removed official field homes. It is
not a schema validator, selector, financial calculation or public inspector.
"""
_REMOVED = {
    "rent_roll": ("keys",),
    "hotel_metrics": ("adr", "occupancy", "available_room_nights", "key_count"),
}


def removed_hospitality_fields(section, content):
    """Authored key presence, including null; never unwrap or infer aliases."""
    if not isinstance(content, dict):
        return ()
    return tuple(field for field in _REMOVED.get(section, ()) if field in content)
