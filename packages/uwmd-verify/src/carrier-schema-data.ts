// Generated from the current Envelope/block schemas; carrier-schema.test.ts checks equality.
export const carrierSchemas = [
  {
    "$id": "https://uwmd.org/schemas/uw-document-envelope.schema.json",
    "type": "object",
    "additionalProperties": true,
    "required": [
      "envelope_version",
      "format_version",
      "frontmatter",
      "sections",
      "pipeline_log",
      "custom_calculations",
      "custom_scenarios",
      "extensions",
      "superseded"
    ],
    "properties": {
      "envelope_version": {
        "const": "2.0"
      },
      "format_version": {
        "const": "3.0"
      },
      "generated_at": {
        "type": "string",
        "format": "date-time"
      },
      "generator": {
        "type": "string",
        "minLength": 1
      },
      "semantic_digest": {
        "type": "string",
        "pattern": "^sha256:[0-9a-f]{64}$"
      },
      "frontmatter": {
        "type": "object",
        "required": [
          "uw_version",
          "deal_id",
          "deal_name"
        ],
        "properties": {
          "uw_version": {
            "const": "3.0"
          },
          "deal_id": {
            "type": "string"
          },
          "deal_name": {
            "type": "string"
          },
          "asset_class": {
            "type": "string"
          }
        },
        "additionalProperties": true
      },
      "sections": {
        "type": "object",
        "additionalProperties": {
          "oneOf": [
            {
              "$ref": "#/$defs/block"
            },
            {
              "$ref": "#/$defs/variantMap"
            }
          ]
        }
      },
      "pipeline_log": {
        "$ref": "#/$defs/blockArray"
      },
      "custom_calculations": {
        "$ref": "#/$defs/blockArray"
      },
      "custom_scenarios": {
        "$ref": "#/$defs/blockArray"
      },
      "extensions": {
        "type": "object",
        "additionalProperties": {
          "$ref": "#/$defs/extension"
        }
      },
      "superseded": {
        "type": "object",
        "additionalProperties": {
          "$ref": "#/$defs/blockArray"
        }
      }
    },
    "$defs": {
      "annotation": {
        "type": "object",
        "required": [
          "section"
        ],
        "properties": {
          "section": {
            "type": "string",
            "minLength": 1
          }
        },
        "additionalProperties": {
          "type": [
            "string",
            "number",
            "boolean"
          ]
        }
      },
      "meta": {
        "$ref": "https://uwmd.org/schemas/uwmd-block.schema.json#/$defs/UWMeta"
      },
      "content": {
        "$ref": "https://uwmd.org/schemas/uwmd-block.schema.json"
      },
      "block": {
        "type": "object",
        "additionalProperties": true,
        "required": [
          "annotation",
          "content"
        ],
        "properties": {
          "annotation": {
            "$ref": "#/$defs/annotation"
          },
          "content": {
            "$ref": "#/$defs/content"
          },
          "prose": {
            "type": "string"
          }
        }
      },
      "variantMap": {
        "type": "object",
        "minProperties": 1,
        "additionalProperties": {
          "$ref": "#/$defs/block"
        }
      },
      "blockArray": {
        "type": "array",
        "items": {
          "$ref": "#/$defs/block"
        }
      },
      "extension": {
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "mode",
              "block"
            ],
            "properties": {
              "mode": {
                "const": "single"
              },
              "block": {
                "$ref": "#/$defs/block"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "mode",
              "blocks"
            ],
            "properties": {
              "mode": {
                "const": "variants"
              },
              "blocks": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "variant",
                    "block"
                  ],
                  "properties": {
                    "variant": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "block": {
                      "$ref": "#/$defs/block"
                    }
                  }
                }
              }
            }
          }
        ]
      }
    }
  },
  {
    "$id": "https://uwmd.org/schemas/uwmd-block.schema.json",
    "type": "object",
    "required": [
      "_meta"
    ],
    "additionalProperties": true,
    "properties": {
      "_role": {
        "enum": [
          "primary",
          "senior",
          "junior",
          "summary",
          "detail",
          "component"
        ]
      },
      "_meta": {
        "$ref": "#/$defs/UWMeta"
      },
      "_overrides": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path"
          ],
          "properties": {
            "path": {
              "type": "string"
            },
            "confidence": {
              "enum": [
                "high",
                "medium",
                "low"
              ]
            },
            "source": {
              "type": "string",
              "pattern": "^(manual|(agent|document|system|institution)/[A-Za-z0-9][A-Za-z0-9._-]*)$"
            },
            "resolution": {
              "$ref": "#/$defs/ResolutionTag"
            },
            "reason": {
              "enum": [
                "illegible",
                "missing",
                "overridden",
                "estimated",
                "computed"
              ]
            },
            "note": {
              "type": "string"
            }
          }
        }
      },
      "_notes": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "$defs": {
      "UWMeta": {
        "type": "object",
        "required": [
          "section",
          "provenance",
          "quality",
          "lifecycle"
        ],
        "additionalProperties": true,
        "properties": {
          "section": {
            "type": "string"
          },
          "provenance": {
            "type": "object",
            "required": [
              "source",
              "actor",
              "timestamp"
            ],
            "additionalProperties": true,
            "properties": {
              "source": {
                "type": "string",
                "pattern": "^(manual|(agent|document|system|institution)/[A-Za-z0-9][A-Za-z0-9._-]*)$",
                "minLength": 1
              },
              "resolution": {
                "$ref": "#/$defs/ResolutionTag"
              },
              "actor": {
                "type": "string",
                "minLength": 1
              },
              "agent_id": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "agent_version": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "timestamp": {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:[02468][048]|[13579][26])00)-02-29|[0-9]{4}-(?:(?:01|03|05|07|08|10|12)-(?:0[1-9]|[12][0-9]|3[01])|(?:04|06|09|11)-(?:0[1-9]|[12][0-9]|30)|02-(?:0[1-9]|1[0-9]|2[0-8])))T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]+)?Z(?![\\s\\S])"
              },
              "notes": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "market_data_ref": {
                "type": "object",
                "required": [
                  "document_id",
                  "as_of",
                  "digest"
                ],
                "properties": {
                  "document_id": {
                    "type": "string"
                  },
                  "as_of": {
                    "$ref": "#/$defs/MarketReferenceDate"
                  },
                  "digest": {
                    "type": "string",
                    "pattern": "^sha256:[0-9a-f]{64}(?![\\s\\S])"
                  },
                  "rationale": {
                    "type": "string"
                  }
                }
              },
              "inherited_from": {
                "type": "object",
                "required": [
                  "document_id",
                  "digest",
                  "distance"
                ],
                "properties": {
                  "document_id": {
                    "type": "string"
                  },
                  "digest": {
                    "type": "string",
                    "pattern": "^sha256:[0-9a-f]{64}(?![\\s\\S])"
                  },
                  "distance": {
                    "type": "integer",
                    "minimum": 1
                  }
                }
              }
            }
          },
          "quality": {
            "type": "object",
            "required": [
              "confidence",
              "human_review_required"
            ],
            "additionalProperties": true,
            "properties": {
              "confidence": {
                "enum": [
                  "high",
                  "medium",
                  "low"
                ]
              },
              "human_review_required": {
                "type": "boolean"
              },
              "flags": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "partial": {
                "type": "boolean"
              },
              "provisional": {
                "type": "boolean"
              }
            },
            "not": {
              "required": [
                "field_overrides"
              ]
            }
          },
          "lifecycle": {
            "type": "object",
            "required": [
              "revision",
              "superseded"
            ],
            "additionalProperties": true,
            "properties": {
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "superseded": {
                "type": "boolean"
              }
            }
          },
          "integrity": {
            "type": "object",
            "additionalProperties": true,
            "properties": {
              "algorithm": {
                "enum": [
                  "sha256"
                ]
              },
              "input_hash": {
                "type": [
                  "string",
                  "null"
                ],
                "pattern": "^(sha256:[0-9a-f]{64})?$"
              },
              "content_hash": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$"
              },
              "parent_hash": {
                "type": [
                  "string",
                  "null"
                ],
                "pattern": "^([0-9a-f]{64})?$"
              },
              "signature": {
                "type": "object",
                "required": [
                  "alg",
                  "kid",
                  "sig",
                  "signed_at"
                ],
                "additionalProperties": false,
                "properties": {
                  "alg": {
                    "enum": [
                      "ed25519",
                      "es256",
                      "es384"
                    ]
                  },
                  "kid": {
                    "type": "string",
                    "minLength": 1
                  },
                  "sig": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_-]+$"
                  },
                  "signed_at": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "v": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "not": {
          "required": [
            "section_id"
          ]
        }
      },
      "ResolutionTag": {
        "enum": [
          "user_input",
          "user_override",
          "inherited_assumption",
          "investor_profile",
          "market_data",
          "market_data_accepted",
          "ai_extracted",
          "agent_computed",
          "asset_class_default",
          "scenario_default",
          "global_default",
          "system_default"
        ]
      },
      "MarketReferenceDate": {
        "type": "string",
        "pattern": "^(?!0000)(?:[0-9]{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|02-(?:0[1-9]|1[0-9]|2[0-8]))|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)(?![\\s\\S])"
      }
    },
    "not": {
      "required": [
        "section_id"
      ]
    },
    "allOf": [
      {
        "if": {
          "allOf": [
            {
              "required": [
                "_meta"
              ],
              "properties": {
                "_meta": {
                  "type": "object",
                  "required": [
                    "provenance",
                    "lifecycle"
                  ],
                  "properties": {
                    "provenance": {
                      "type": "object"
                    },
                    "lifecycle": {
                      "type": "object"
                    }
                  }
                }
              },
              "not": {
                "required": [
                  "section_id"
                ]
              }
            },
            {
              "required": [
                "_meta"
              ],
              "properties": {
                "_meta": {
                  "type": "object",
                  "required": [
                    "provenance"
                  ],
                  "properties": {
                    "provenance": {
                      "required": [
                        "source"
                      ],
                      "properties": {
                        "source": {
                          "type": "string",
                          "pattern": "^agent/[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])"
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        },
        "then": {
          "properties": {
            "_meta": {
              "properties": {
                "provenance": {
                  "required": [
                    "agent_id"
                  ]
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "allOf": [
            {
              "required": [
                "_meta"
              ],
              "properties": {
                "_meta": {
                  "type": "object",
                  "required": [
                    "provenance",
                    "lifecycle"
                  ],
                  "properties": {
                    "provenance": {
                      "type": "object"
                    },
                    "lifecycle": {
                      "type": "object"
                    }
                  }
                }
              },
              "not": {
                "required": [
                  "section_id"
                ]
              }
            },
            {
              "anyOf": [
                {
                  "required": [
                    "_meta"
                  ],
                  "properties": {
                    "_meta": {
                      "type": "object",
                      "required": [
                        "provenance"
                      ],
                      "properties": {
                        "provenance": {
                          "type": "object",
                          "required": [
                            "resolution"
                          ],
                          "properties": {
                            "resolution": {
                              "const": "inherited_assumption"
                            }
                          }
                        }
                      }
                    }
                  }
                },
                {
                  "required": [
                    "_overrides"
                  ],
                  "properties": {
                    "_overrides": {
                      "type": "array",
                      "contains": {
                        "type": "object",
                        "required": [
                          "resolution"
                        ],
                        "properties": {
                          "resolution": {
                            "const": "inherited_assumption"
                          }
                        }
                      }
                    }
                  }
                }
              ]
            }
          ]
        },
        "then": {
          "properties": {
            "_meta": {
              "properties": {
                "provenance": {
                  "required": [
                    "inherited_from"
                  ]
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "allOf": [
            {
              "required": [
                "_meta"
              ],
              "properties": {
                "_meta": {
                  "type": "object",
                  "required": [
                    "provenance",
                    "lifecycle"
                  ],
                  "properties": {
                    "provenance": {
                      "type": "object"
                    },
                    "lifecycle": {
                      "type": "object"
                    }
                  }
                }
              },
              "not": {
                "required": [
                  "section_id"
                ]
              }
            },
            {
              "anyOf": [
                {
                  "required": [
                    "_meta"
                  ],
                  "properties": {
                    "_meta": {
                      "type": "object",
                      "required": [
                        "provenance"
                      ],
                      "properties": {
                        "provenance": {
                          "type": "object",
                          "required": [
                            "resolution"
                          ],
                          "properties": {
                            "resolution": {
                              "const": "market_data_accepted"
                            }
                          }
                        }
                      }
                    }
                  }
                },
                {
                  "required": [
                    "_overrides"
                  ],
                  "properties": {
                    "_overrides": {
                      "type": "array",
                      "contains": {
                        "type": "object",
                        "required": [
                          "resolution"
                        ],
                        "properties": {
                          "resolution": {
                            "const": "market_data_accepted"
                          }
                        }
                      }
                    }
                  }
                }
              ]
            }
          ]
        },
        "then": {
          "properties": {
            "_meta": {
              "properties": {
                "provenance": {
                  "required": [
                    "market_data_ref"
                  ]
                }
              }
            }
          }
        }
      }
    ]
  }
];
