"""RFC 0100: the generic size contract (Format §5.5), as the reference applies it.

A closed table of size, count, area and rent fields. A stated value must be a
finite number >= 0, and a count must also be an integer; otherwise SIZE-01
(error) at the field. Null and absence are not stated. Signed amounts are
outside the table. A class's own contract keeps its own code; both stand.
"""
from uwmd_binding_sources import finite
from uwmd_validation_selection import current_blocks

COUNT, MEASURE = "count", "measure"
SIZE_CONTRACT = {
    "property": {
        "total_units": COUNT, "keys": COUNT, "total_beds": COUNT, "total_sites": COUNT,
        "rentable_units": COUNT, "entitled_units": COUNT, "parking_spaces": COUNT,
        "total_nra_sqft": MEASURE, "rentable_square_feet": MEASURE, "gross_leasable_area": MEASURE,
        "net_rentable_square_feet": MEASURE, "critical_it_load_kw": MEASURE, "gross_acres": MEASURE,
        "usable_acres": MEASURE, "land_area_sqft": MEASURE, "land_area_acres": MEASURE, "site_acres": MEASURE,
    },
    "rent_roll": {
        "total_units": COUNT, "occupied_units": COUNT, "vacant_units": COUNT, "notice_units": COUNT,
        "model_units": COUNT, "down_units": COUNT, "month_to_month_units": COUNT,
        "total_sites": COUNT, "occupied_sites": COUNT, "vacant_sites": COUNT, "park_owned_homes": COUNT,
        "total_beds": COUNT, "unit_mix[].units": COUNT, "unit_mix[].beds": COUNT, "unit_mix[].occupied_beds": COUNT,
        "unit_mix_summary[].count": COUNT, "lease_expiration_schedule[].expiring_count": COUNT,
        "total_rentable_sf": MEASURE, "occupied_sf": MEASURE, "vacant_sf": MEASURE,
        "tenants[].leased_sf": MEASURE, "units[].sqft": MEASURE, "unit_mix_summary[].avg_sqft": MEASURE,
        "weighted_avg_rent_psf": MEASURE, "tenants[].rent_psf": MEASURE,
        "units[].monthly_rent": MEASURE, "units[].market_rent": MEASURE,
    },
}


def meets(value, kind):
    """Whether a stated value meets its contract; None is not stated."""
    if value is None:
        return True
    if isinstance(value, bool) or not finite(value) or value < 0:
        return False
    return kind == MEASURE or float(value).is_integer()


def _stated(payload, path):
    head, _, rest = path.partition(".")
    if not isinstance(payload, dict):
        return
    if head.endswith("[]"):
        key = head[:-2]
        rows = payload.get(key)
        if isinstance(rows, list):
            for index, row in enumerate(rows):
                for tail, value in _stated(row, rest):
                    yield f"{key}[{index}].{tail}", value
        return
    if not rest:
        if head in payload:
            yield head, payload[head]
        return
    for tail, value in _stated(payload.get(head), rest):
        yield f"{head}.{tail}", value


def size_rules(ledger):
    for section, table in SIZE_CONTRACT.items():
        for block in current_blocks(ledger.document, section):
            for path, kind in table.items():
                for field, value in _stated(block.parsed.value, path):
                    if not meets(value, kind):
                        ledger.issue("SIZE-01", "error", section, field,
                                     "Stated size must be a finite number >= 0" + (" and whole" if kind == COUNT else ""),
                                     **({"value": value} if finite(value) and not isinstance(value, bool) else {}))
