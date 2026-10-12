# Official builtin class controls (RFC 0080)

The original hospitality/data-center runtime controls and all 49 parked MHC controls now run through ordinary core validation and builtin packs. Expected calculation values and financial rules are retained; standard fixed-field errors are added explicitly. Namespaced spellings of a builtin (for example `org.uwmd.data_center`) are refused as `INVALID-ASSET-CLASS-002`; dedicated core tests and the Reader malformed corpus pin that refusal.

The chosen hospitality RevPAR reads explicitly stated actual rooms revenue/available nights. Fixtures 01–03 add those synthetic actual inputs; invalid ADR-occupancy statements still fail their rule instead of changing actual RevPAR. MHC controls 54–56 preserve the presence-only date boundary.
