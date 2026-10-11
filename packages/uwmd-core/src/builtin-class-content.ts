// Standard class content extracted from the official manifests (RFC 0080).
import type { ModuleSectionDecl, ModuleValidationDecl, SectionViewModel } from './protocol.js';

export const BUILTIN_CLASS_CONTENT: Readonly<Record<string, { sections: ModuleSectionDecl[]; validations: ModuleValidationDecl[]; view_models: SectionViewModel[] }>> = {
  "data_center": {
    "sections": [
      {
        "id": "dc_capacity",
        "display_name": "Capacity & Topology",
        "required": true,
        "schema": {
          "type": "object",
          "required": [
            "critical_it_load_kw",
            "planned_it_load_kw",
            "contracted_it_load_kw",
            "utility_feed_kw",
            "design_pue",
            "redundancy"
          ],
          "properties": {
            "critical_it_load_kw": {
              "type": "number",
              "minimum": 0,
              "description": "Commissioned critical IT load, in kW — the capacity that can be sold today."
            },
            "planned_it_load_kw": {
              "type": "number",
              "minimum": 0,
              "description": "Full build-out critical load, in kW. Equals critical_it_load_kw when no further phases exist."
            },
            "contracted_it_load_kw": {
              "type": "number",
              "minimum": 0,
              "description": "Load under signed contract (leased or committed), in kW, including pre-leased future phases."
            },
            "utility_feed_kw": {
              "type": "number",
              "minimum": 0,
              "description": "Utility power available at the meter today, in kW."
            },
            "design_pue": {
              "type": "number",
              "minimum": 1,
              "description": "Design power usage effectiveness: total facility power / IT power. Never below 1."
            },
            "measured_pue": {
              "type": [
                "number",
                "null"
              ],
              "minimum": 1,
              "description": "Trailing measured PUE. Null when the facility is not yet operating."
            },
            "redundancy": {
              "type": "string",
              "enum": [
                "n",
                "n_plus_1",
                "n_plus_2",
                "2n",
                "2n_plus_1"
              ],
              "description": "Electrical/mechanical topology. The fact, not the Uptime tier — the tier is a claim about it."
            },
            "raised_floor_sf": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 0,
              "description": "White space, in SF. Null for powered shells."
            },
            "design_density_kw_per_rack": {
              "type": [
                "number",
                "null"
              ],
              "minimum": 0,
              "description": "Average design density, kW per rack."
            }
          }
        }
      },
      {
        "id": "dc_power",
        "display_name": "Power Economics",
        "schema": {
          "type": "object",
          "required": [
            "utility_rate_per_kwh",
            "billing"
          ],
          "properties": {
            "utility_rate_per_kwh": {
              "type": "number",
              "minimum": 0,
              "description": "Blended $/kWh, all charges."
            },
            "billing": {
              "type": "string",
              "enum": [
                "metered_pass_through",
                "all_in",
                "breakered"
              ],
              "description": "How power is billed to tenants."
            },
            "power_margin": {
              "type": [
                "number",
                "null"
              ],
              "minimum": 0,
              "description": "Landlord margin on power as a FRACTION of cost; meaningful only under all_in / breakered billing."
            },
            "stated_annual_power_cost": {
              "type": [
                "number",
                "null"
              ],
              "minimum": 0,
              "description": "The operator's stated annual utility bill, when known. Takes precedence over the computed figure."
            }
          }
        }
      },
      {
        "id": "dc_revenue",
        "display_name": "Revenue",
        "schema": {
          "type": "object",
          "required": [
            "lease_type",
            "rent_per_kw_month"
          ],
          "properties": {
            "lease_type": {
              "type": "string",
              "enum": [
                "powered_shell",
                "wholesale_turnkey",
                "retail_colocation",
                "hyperscale_build_to_suit"
              ],
              "description": "Predominant lease structure."
            },
            "rent_per_kw_month": {
              "type": "number",
              "minimum": 0,
              "description": "Weighted-average contracted rent, $/kW/month, on contracted_it_load_kw."
            },
            "interconnection_revenue_annual": {
              "type": "number",
              "minimum": 0,
              "description": "Cross-connects and meet-me-room revenue, annual."
            },
            "services_revenue_annual": {
              "type": "number",
              "minimum": 0,
              "description": "Remote hands and other services revenue, annual."
            },
            "market_rent_per_kw_month": {
              "type": [
                "number",
                "null"
              ],
              "minimum": 0,
              "description": "Comp rent, $/kW/month. Null means no comp set was obtained — which is different from a comp set showing zero."
            }
          }
        }
      }
    ],
    "validations": [
      {
        "code": "CC-DC-01",
        "severity": "error",
        "message": "PUE cannot be below 1.0 — total facility power includes the IT load.",
        "rule": "dc_capacity.design_pue >= 1"
      },
      {
        "code": "CC-DC-02",
        "severity": "warning",
        "message": "Design PUE above 1.6 — legacy-grade efficiency; confirm cooling topology and the power pass-through terms.",
        "rule": "dc_capacity.design_pue <= 1.6"
      },
      {
        "code": "CC-DC-03",
        "severity": "error",
        "message": "Commissioned load exceeds the planned build-out.",
        "rule": "dc_capacity.critical_it_load_kw <= dc_capacity.planned_it_load_kw"
      },
      {
        "code": "CC-DC-04",
        "severity": "warning",
        "message": "Contracted load exceeds commissioned load — pre-leased phases; confirm the delivery schedule and any rent-commencement gaps.",
        "rule": "dc_capacity.contracted_it_load_kw <= dc_capacity.critical_it_load_kw"
      },
      {
        "code": "CC-DC-05",
        "severity": "warning",
        "message": "Utility feed is below the facility load at design PUE — confirm the utility upgrade, its cost, and its date.",
        "rule": "facility_load_kw <= dc_capacity.utility_feed_kw"
      },
      {
        "code": "CC-DC-06",
        "severity": "warning",
        "message": "Measured PUE more than 15% above design — the power pass-through economics are not what the design assumed.",
        "rule": "dc_capacity.measured_pue == null || dc_capacity.measured_pue <= dc_capacity.design_pue * 1.15"
      },
      {
        "code": "CC-DC-07",
        "severity": "warning",
        "message": "Contracted rent more than 15% below market — verify the comp set or the lease vintage.",
        "rule": "dc_revenue.market_rent_per_kw_month == null || rent_index >= 0.85"
      }
    ],
    "view_models": [
      {
        "section_id": "dc_capacity",
        "display_name": "Capacity & Topology",
        "display_order": 30,
        "description": "The kilowatts — commissioned, planned, contracted, and available at the meter — plus the efficiency and redundancy facts that price them.",
        "primary_fields": [
          {
            "path": "critical_it_load_kw",
            "label": "Critical IT Load (kW)",
            "kind": "count",
            "primary": true
          },
          {
            "path": "contracted_it_load_kw",
            "label": "Contracted Load (kW)",
            "kind": "count",
            "primary": true
          },
          {
            "path": "design_pue",
            "label": "Design PUE",
            "kind": "ratio",
            "primary": true,
            "decimals": 2
          },
          {
            "path": "redundancy",
            "label": "Redundancy",
            "kind": "enum",
            "primary": true
          }
        ],
        "detail_fields": [
          {
            "path": "planned_it_load_kw",
            "label": "Planned Load (kW)",
            "kind": "count"
          },
          {
            "path": "utility_feed_kw",
            "label": "Utility Feed (kW)",
            "kind": "count"
          },
          {
            "path": "measured_pue",
            "label": "Measured PUE",
            "kind": "ratio",
            "decimals": 2
          },
          {
            "path": "raised_floor_sf",
            "label": "Raised Floor (SF)",
            "kind": "count"
          },
          {
            "path": "design_density_kw_per_rack",
            "label": "Design Density (kW/rack)",
            "kind": "ratio",
            "decimals": 1
          }
        ]
      },
      {
        "section_id": "dc_power",
        "display_name": "Power Economics",
        "display_order": 31,
        "description": "What power costs and how it is billed to tenants — the terms that decide whether the operating margin is 60% or 20%.",
        "primary_fields": [
          {
            "path": "utility_rate_per_kwh",
            "label": "Utility Rate ($/kWh)",
            "kind": "currency",
            "primary": true,
            "decimals": 4
          },
          {
            "path": "billing",
            "label": "Power Billing",
            "kind": "enum",
            "primary": true
          }
        ],
        "detail_fields": [
          {
            "path": "power_margin",
            "label": "Landlord Power Margin",
            "kind": "percent",
            "decimals": 2
          },
          {
            "path": "stated_annual_power_cost",
            "label": "Stated Annual Power Cost",
            "kind": "currency",
            "decimals": 0
          }
        ]
      },
      {
        "section_id": "dc_revenue",
        "display_name": "Revenue",
        "display_order": 32,
        "description": "Rent per kW-month on the contracted load, the ancillary lines, and the comp rent the contract is measured against.",
        "primary_fields": [
          {
            "path": "rent_per_kw_month",
            "label": "Rent ($/kW/mo)",
            "kind": "currency",
            "primary": true,
            "decimals": 2
          },
          {
            "path": "lease_type",
            "label": "Lease Type",
            "kind": "enum",
            "primary": true
          }
        ],
        "detail_fields": [
          {
            "path": "market_rent_per_kw_month",
            "label": "Market Rent ($/kW/mo)",
            "kind": "currency",
            "decimals": 2
          },
          {
            "path": "interconnection_revenue_annual",
            "label": "Interconnection Revenue",
            "kind": "currency",
            "decimals": 0
          },
          {
            "path": "services_revenue_annual",
            "label": "Services Revenue",
            "kind": "currency",
            "decimals": 0
          }
        ]
      }
    ]
  },
  "hospitality": {
    "sections": [
      {
        "id": "hotel_metrics",
        "display_name": "Hotel Operating Metrics",
        "required": true,
        "schema": {
          "type": "object",
          "required": [
            "adr",
            "occupancy",
            "available_room_nights",
            "key_count"
          ],
          "properties": {
            "adr": {
              "type": "number",
              "minimum": 0,
              "description": "Average daily rate, in dollars."
            },
            "occupancy": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "A FRACTION, not a percent: 0.72, never 72. Format-wide rule."
            },
            "available_room_nights": {
              "type": "integer",
              "minimum": 0,
              "description": "Keys x days in the period. Not occupied room nights."
            },
            "key_count": {
              "type": "integer",
              "minimum": 0
            },
            "market_revpar": {
              "type": [
                "number",
                "null"
              ],
              "description": "Comp-set RevPAR for the same period. Null means no comp set was obtained — which is different from a comp set showing zero."
            }
          }
        }
      },
      {
        "id": "hotel_brand",
        "display_name": "Brand & Franchise",
        "schema": {
          "type": "object",
          "properties": {
            "flag": {
              "type": [
                "string",
                "null"
              ],
              "description": "Brand, or null for independent."
            },
            "franchise_fee_pct_of_rooms": {
              "type": "number",
              "minimum": 0,
              "maximum": 0.2
            },
            "marketing_fund_pct": {
              "type": "number",
              "minimum": 0,
              "maximum": 0.1
            },
            "loyalty_program_pct": {
              "type": "number",
              "minimum": 0,
              "maximum": 0.1
            },
            "term_years": {
              "type": [
                "integer",
                "null"
              ],
              "minimum": 0
            }
          }
        }
      },
      {
        "id": "hotel_food_beverage",
        "display_name": "Food & Beverage",
        "schema": {
          "type": "object",
          "properties": {
            "fb_revenue": {
              "type": "number",
              "minimum": 0
            },
            "fb_cogs": {
              "type": "number",
              "minimum": 0
            },
            "fb_labor": {
              "type": "number",
              "minimum": 0
            },
            "complimentary_breakfast_cost_per_occupied_room": {
              "type": "number",
              "minimum": 0
            }
          }
        }
      }
    ],
    "validations": [
      {
        "code": "CC-HOSP-01",
        "severity": "warning",
        "message": "RevPAR is more than 15% below market RevPAR — verify pricing strategy or comp set.",
        "rule": "hotel_metrics.market_revpar == null || revpar >= hotel_metrics.market_revpar * 0.85"
      },
      {
        "code": "CC-HOSP-02",
        "severity": "error",
        "message": "Occupancy must be between 0 and 1 (use a fraction, not a percentage).",
        "rule": "hotel_metrics.occupancy >= 0 && hotel_metrics.occupancy <= 1"
      },
      {
        "code": "CC-HOSP-03",
        "severity": "warning",
        "message": "Total franchise fee burden exceeds 13% of room revenue — confirm flag economics.",
        "rule": "hotel_brand.franchise_fee_pct_of_rooms + hotel_brand.marketing_fund_pct + hotel_brand.loyalty_program_pct <= 0.13"
      }
    ],
    "view_models": [
      {
        "section_id": "hotel_metrics",
        "display_name": "Hotel Operating Metrics",
        "display_order": 30,
        "description": "The four numbers every hotel underwrite starts from, plus the market comp.",
        "primary_fields": [
          {
            "path": "adr",
            "label": "ADR",
            "kind": "currency",
            "primary": true,
            "decimals": 2
          },
          {
            "path": "occupancy",
            "label": "Occupancy",
            "kind": "percent",
            "primary": true,
            "decimals": 1
          },
          {
            "path": "key_count",
            "label": "Keys",
            "kind": "count",
            "primary": true
          }
        ],
        "detail_fields": [
          {
            "path": "available_room_nights",
            "label": "Available Room Nights",
            "kind": "count"
          },
          {
            "path": "market_revpar",
            "label": "Market RevPAR",
            "kind": "currency",
            "decimals": 2
          }
        ]
      },
      {
        "section_id": "hotel_brand",
        "display_name": "Brand & Franchise",
        "display_order": 31,
        "description": "Flag economics — the fees that come off room revenue before anything else does.",
        "primary_fields": [
          {
            "path": "flag",
            "label": "Flag",
            "kind": "string",
            "primary": true
          },
          {
            "path": "franchise_fee_pct_of_rooms",
            "label": "Franchise Fee",
            "kind": "percent",
            "primary": true,
            "decimals": 2
          }
        ],
        "detail_fields": [
          {
            "path": "marketing_fund_pct",
            "label": "Marketing Fund",
            "kind": "percent",
            "decimals": 2
          },
          {
            "path": "loyalty_program_pct",
            "label": "Loyalty Program",
            "kind": "percent",
            "decimals": 2
          },
          {
            "path": "term_years",
            "label": "Franchise Term",
            "kind": "count"
          }
        ]
      },
      {
        "section_id": "hotel_food_beverage",
        "display_name": "Food & Beverage",
        "display_order": 32,
        "description": "The department most likely to be underwritten optimistically. Labor is broken out because it is the line that moves.",
        "primary_fields": [
          {
            "path": "fb_revenue",
            "label": "F&B Revenue",
            "kind": "currency",
            "primary": true
          },
          {
            "path": "fb_cogs",
            "label": "F&B COGS",
            "kind": "currency",
            "primary": true
          }
        ],
        "detail_fields": [
          {
            "path": "fb_labor",
            "label": "F&B Labor",
            "kind": "currency"
          },
          {
            "path": "complimentary_breakfast_cost_per_occupied_room",
            "label": "Comp Breakfast / Occ. Room",
            "kind": "currency",
            "decimals": 2
          }
        ]
      }
    ]
  },
  "manufactured_housing": {
    "sections": [
      {
        "id": "mhc_sites",
        "display_name": "Manufactured Housing Sites",
        "required": true,
        "schema": {
          "type": "object",
          "required": [
            "total_sites",
            "occupied_sites",
            "park_owned_homes",
            "weighted_pad_rent_monthly",
            "as_of_date"
          ],
          "properties": {
            "total_sites": {
              "type": "integer",
              "minimum": 1,
              "description": "Every manufactured-home site, occupied or vacant; the per-site denominator."
            },
            "occupied_sites": {
              "type": "integer",
              "minimum": 0,
              "description": "Sites under in-place leases, no more than total_sites."
            },
            "park_owned_homes": {
              "type": "integer",
              "minimum": 0,
              "description": "Homes owned by the community on its sites, no more than total_sites."
            },
            "weighted_pad_rent_monthly": {
              "type": "number",
              "minimum": 0,
              "description": "Stated, source-backed site-count-weighted monthly pad rent across all sites, vacant at stated asking rent; excludes home rent, fees and reimbursements. Document currency."
            },
            "poh_home_rent_monthly": {
              "type": [
                "number",
                "null"
              ],
              "minimum": 0,
              "description": "Monthly home rent per park-owned home across all owned homes, vacant at stated asking rent; excludes pad rent. Required when homes exist; absent or null otherwise."
            },
            "as_of_date": {
              "description": "Presence only in first scope. Date validity is a separate core RFC."
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "park_owned_homes": {
                    "const": 0
                  }
                },
                "required": [
                  "park_owned_homes"
                ]
              },
              "then": {
                "properties": {
                  "poh_home_rent_monthly": {
                    "type": "null"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "park_owned_homes": {
                    "minimum": 1
                  }
                },
                "required": [
                  "park_owned_homes"
                ]
              },
              "then": {
                "required": [
                  "poh_home_rent_monthly"
                ],
                "properties": {
                  "poh_home_rent_monthly": {
                    "type": "number",
                    "minimum": 0
                  }
                }
              }
            }
          ]
        }
      }
    ],
    "validations": [
      {
        "code": "CC-MH-01",
        "severity": "error",
        "message": "Total sites must be a stated whole number of at least one.",
        "rule": "mhc_sites == null || (mhc_sites.total_sites != null && mhc_sites.total_sites >= 1 && round(mhc_sites.total_sites, 0) == mhc_sites.total_sites)"
      },
      {
        "code": "CC-MH-02",
        "severity": "error",
        "message": "Occupied sites must be a stated whole number between zero and total sites.",
        "rule": "mhc_sites == null || (mhc_sites.occupied_sites != null && mhc_sites.occupied_sites >= 0 && round(mhc_sites.occupied_sites, 0) == mhc_sites.occupied_sites && mhc_sites.occupied_sites <= mhc_sites.total_sites)"
      },
      {
        "code": "CC-MH-03",
        "severity": "error",
        "message": "Park-owned homes must be a stated whole number between zero and total sites.",
        "rule": "mhc_sites == null || (mhc_sites.park_owned_homes != null && mhc_sites.park_owned_homes >= 0 && round(mhc_sites.park_owned_homes, 0) == mhc_sites.park_owned_homes && mhc_sites.park_owned_homes <= mhc_sites.total_sites)"
      },
      {
        "code": "CC-MH-04",
        "severity": "error",
        "message": "Weighted monthly pad rent must be stated and nonnegative.",
        "rule": "mhc_sites == null || (mhc_sites.weighted_pad_rent_monthly != null && mhc_sites.weighted_pad_rent_monthly >= 0)"
      },
      {
        "code": "CC-MH-05",
        "severity": "error",
        "message": "The counts and rents must state an as_of_date; first scope checks presence only.",
        "rule": "mhc_sites == null || mhc_sites.as_of_date != null"
      },
      {
        "code": "CC-MH-06",
        "severity": "error",
        "message": "Home rent must be absent or null when there are no park-owned homes.",
        "rule": "mhc_sites == null || mhc_sites.park_owned_homes != 0 || mhc_sites.poh_home_rent_monthly == null"
      },
      {
        "code": "CC-MH-07",
        "severity": "error",
        "message": "Home rent must be stated and nonnegative when park-owned homes exist.",
        "rule": "mhc_sites == null || mhc_sites.park_owned_homes == null || mhc_sites.park_owned_homes <= 0 || (mhc_sites.poh_home_rent_monthly != null && mhc_sites.poh_home_rent_monthly >= 0)"
      }
    ],
    "view_models": [
      {
        "section_id": "mhc_sites",
        "display_name": "Manufactured Housing Sites",
        "display_order": 30,
        "description": "Stated site inventory and monthly pad/home rents as of the source date.",
        "primary_fields": [
          {
            "path": "total_sites",
            "label": "Total Sites",
            "kind": "count",
            "primary": true
          },
          {
            "path": "occupied_sites",
            "label": "Occupied Sites",
            "kind": "count",
            "primary": true
          },
          {
            "path": "weighted_pad_rent_monthly",
            "label": "Pad Rent ($/site/month)",
            "kind": "currency",
            "decimals": 2,
            "primary": true
          }
        ],
        "detail_fields": [
          {
            "path": "park_owned_homes",
            "label": "Park-Owned Homes",
            "kind": "count"
          },
          {
            "path": "poh_home_rent_monthly",
            "label": "Home Rent ($/home/month)",
            "kind": "currency",
            "decimals": 2
          },
          {
            "path": "as_of_date",
            "label": "As of Date",
            "kind": "date"
          }
        ]
      }
    ]
  }
};
