---
rfc: 0132
title: Separate physical and economic occupancy
status: accepted
author: UWMD maintainers
created: 2026-11-04
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0132: Separate physical and economic occupancy

**Accepted - 2026-11-04.** The owner accepted separate physical and economic occupancy, collected rent divided by same-period gross potential rent, explicit unknown evidence and preservation of zero.

## Rules

Physical occupancy and economic occupancy are two separately named fractions: `physical_occupancy_pct` and `economic_occupancy_pct`. Neither supplies the other. Physical occupancy uses the accepted class-specific physical numerator and capacity denominator. An occupied zero-rent suite remains physically occupied; rent alone never determines physical use.

Economic occupancy equals rent collected divided by gross potential rent for the same property scope and reporting period. If either amount is unknown, it is unavailable with a reason. An explicit zero collected amount remains zero. A zero or negative denominator yields an unavailable ratio, following existing division/positive-capacity conventions; no alternative denominator or annualization is inferred.

## Bounded source declaration

Optional `rent_roll.economic_occupancy_inputs` holds `rent_collected` and `gross_potential_rent`, each a finite number or null. These two homes assert one common reporting period, property scope and section variant. As with the common-period NOI declaration in RFC 0126, this is a source assertion, not evidence that the underlying collection records are true. Different periods or scopes require separate section variants; the procedure never combines another statement's period or substitutes EGI, contractual rent, market rent or physical occupancy. Missing members are unknown. This bounded group supplies the economic metric without generating a rent or cash-flow schedule.

The existing self-storage dictionary/pack `economic_occupancy` metric uses precisely these two inputs. Its named statement binding includes `rent_roll.economic_occupancy_pct`. Existing physical class definitions, including hospitality room nights and manufactured-housing sites, retain their denominators. The physical helper's output name is always explicit, rather than the ambiguous commercial `occupancy_pct` write target.

## Reference implementation

The rent-roll helper exposes omitted computed results in `unavailable`, keyed by metric path with a reason. Missing mix occupancy is not full occupancy. Commercial physical area requires an explicit occupied/vacant status and finite area; positive rent does not fill an unknown status. Existing multifamily status classifications are retained. Partial physical prerequisites also withhold dependent occupancy-based amounts rather than inserting a fabricated zero.

The editor exposes unavailable reasons and allows editing commercial status. Reader and full-carrier operations preserve the explicit source inputs and zero/null distinctions. Schema, executable input type, dictionary, pack and Excel parity tests accompany the same change. The former expected-failure gates are ordinary regression tests, supplemented by separate physical/economic controls, missing operands and independent variant inputs.

## Decisions and precedent

The accepted formula is collected rent / gross potential rent. RFC 0126 supplies common-period source assertions; RFC 0092 supplies explicit unavailable evidence; Protocol VIII.5 supplies reporting precision. Local helper reasons are starter evidence, not a new validation-code allocation. The existing physical definitions are unchanged except removing the positive-rent proxy. No release or version bump is authorized.
