"""Reader boundary/identity controls beyond the 17 portable projections."""
import copy
import json
from pathlib import Path
import unittest

from uwmd import main
from uwmd_reader import ReaderError, parse
from uwmd_source import SourceError


HEADER = (b'---\nuw_version: "3.0"\ndeal_id: test\ndeal_name: "Tower"\n'
          b'created: "2026-01-01"\nlast_modified: "2026-01-01"\n'
          b'property_address: "123 Main St"\ncity: Phoenix\nstate: AZ\nzip: "85001"\n'
          b'asset_class: multifamily\nunknown_key: retained\n---\n')


def block(section, payload=None, variant=None, role=None, superseded=False):
    body = {"_meta": {"section": section, "lifecycle": {"revision": 1, "superseded": superseded}}}
    if role is not None:
        body["_role"] = role
    body.update(payload or {})
    annotation = "```json uw:section=" + section + (" variant=" + variant if variant else "")
    return (annotation + "\n" + json.dumps(body, ensure_ascii=False) + "\n```\n").encode("utf-8")


class ReaderTests(unittest.TestCase):
    def test_all_reader_owned_malformed_corpus_refusals(self):
        # Test-only oracle: production parsing never opens corpus expectations.
        root = Path(__file__).resolve().parents[2]
        index = json.loads((root / "conformance/corpus-index.json").read_text(encoding="utf-8"))
        cases = [case for case in index["cases"] if case["target"] == "reader"
                 and case["suite"] == "documents" and case["scenario"].startswith("malformed/")]
        self.assertEqual(len(cases), 15)
        for case in cases:
            prefix = root / "conformance/documents" / case["scenario"]
            expected = json.loads(Path(str(prefix) + ".expected.json").read_text(encoding="utf-8"))
            source = Path(str(prefix) + ".uwx.md")
            with self.subTest(scenario=case["scenario"]):
                self.assertIs(expected["must_parse"], False)
                self.assertTrue(expected["expected_codes"])
                self.assertLessEqual(set(expected["expected_codes"]),
                                     {"UNSUPPORTED_YAML_FEATURE", "UNSUPPORTED_FORMAT_VERSION",
                                      "SOURCE_BLOCK_MALFORMED"})
                with self.assertRaises(SourceError) as caught:
                    parse(source.read_bytes(), filename=source.name)
                self.assertIn(getattr(caught.exception, "code", None), expected["expected_codes"])

    def test_all_required_frontmatter_values_are_surfaced(self):
        document = parse(HEADER)
        self.assertEqual(document.frontmatter.value, {
            "uw_version": "3.0", "deal_id": "test", "deal_name": "Tower",
            "created": "2026-01-01", "last_modified": "2026-01-01",
            "property_address": "123 Main St", "city": "Phoenix", "state": "AZ", "zip": "85001",
            "asset_class": "multifamily", "unknown_key": "retained"})

    def test_standard_and_new_unknown_sections_are_informative(self):
        # Includes the original 21 IDs and all subsequently standardized IDs.
        names = ("deal_context property ownership rent_roll operating_statement noi_model valuation "
                 "debt_structure sources_uses dcf stress_tests market_analysis borrower_sponsor due_diligence "
                 "risk_assessment compliance assumptions validation pipeline_log custom_calculations custom_scenarios "
                 "gaps components capital_stack lease_up_schedule cash_flow_series distribution_waterfall reserve_accounts "
                 "dc_capacity dc_power dc_revenue hotel_metrics hotel_brand hotel_food_beverage mhc_sites future_section").split()
        document = parse(HEADER + b"".join(block(name, {"n": index}) for index, name in enumerate(names)))
        self.assertEqual([item.section for item in document.source.blocks], names)
        projected = document.projection()
        self.assertEqual(projected["sections"]["future_section"]["content"]["n"], len(names) - 1)
        self.assertEqual(projected["frontmatter"]["unknown_key"], "retained")

    def test_last_active_is_canonical_and_superseded_order_is_preserved(self):
        raw = HEADER + block("property", {"n": 1}, superseded=True) + block("property", {"n": 2})
        raw += block("property", {"n": 3}) + block("property", {"n": 4}, superseded=True)
        result = parse(raw).projection()
        self.assertEqual(result["sections"]["property"]["content"]["n"], 3)
        self.assertEqual([item["content"]["n"] for item in result["superseded"]["property"]], [1, 2, 4])

    def test_role_opt_in_collects_unannotated_peer_in_any_source_order(self):
        role = block("debt_structure", {"n": 1}, variant="loan", role="senior")
        peer = block("debt_structure", {"n": 2}, variant="peer")
        for raw in [role + peer, peer + role]:
            projected = parse(HEADER + raw).projection()["sections"]["debt_structure"]
            self.assertEqual(set(projected), {"loan", "peer"})
            self.assertEqual(projected["loan"]["role"], "senior")

    def test_superseded_role_does_not_activate_variant_opt_in(self):
        raw = block("property", {"n": 1}, variant="old", role="primary", superseded=True)
        raw += block("property", {"n": 2}, variant="a") + block("property", {"n": 3}, variant="b")
        self.assertEqual(parse(HEADER + raw).projection()["sections"]["property"]["content"]["n"], 3)

    def test_registered_parallel_variants_are_not_summed_or_selected(self):
        raw = block("operating_statement", {"n": 10}, variant="t12")
        raw += block("operating_statement", {"n": 20}, variant="budget")
        result = parse(HEADER + raw).projection()["sections"]["operating_statement"]
        self.assertEqual(result["t12"]["content"]["n"], 10)
        self.assertEqual(result["budget"]["content"]["n"], 20)

    def test_unknown_extensions_payload_content_and_null_stay_distinct(self):
        result = parse(HEADER + block("x_future", {"content": {"inside": None}, "unknown": True})).projection()
        payload = result["extensions"]["x_future"]["block"]["content"]
        self.assertEqual(payload["content"], {"inside": None})
        self.assertNotIn("absent", payload)
        self.assertTrue(payload["unknown"])

    def test_role_opt_in_preserves_all_extension_variants_in_both_orders(self):
        primary = block("x_future", {"n": 1}, variant="a", role="primary")
        peer = block("x_future", {"n": 2}, variant="b")
        for body in (primary + peer, peer + primary):
            raw = HEADER + body
            document = parse(raw)
            projected = document.projection()["extensions"]["x_future"]
            self.assertEqual(projected["mode"], "variants")
            self.assertEqual([item["variant"] for item in projected["blocks"]],["a","b"])
            self.assertEqual(projected["blocks"][0]["block"]["role"], "primary")
            self.assertEqual(projected["blocks"][1]["block"]["content"]["n"], 2)
            self.assertEqual(document.source.raw, raw)

    def test_superseded_extension_role_does_not_activate_variant_opt_in(self):
        old = block("x_future", {"n": 0}, variant="old", role="primary", superseded=True)
        raw = HEADER + old + block("x_future", {"n": 1}, variant="a") + block("x_future", {"n": 2}, variant="b")
        document = parse(raw)
        projected = document.projection()
        self.assertEqual(projected["extensions"]["x_future"]["block"]["content"]["n"], 2)
        self.assertEqual(projected["superseded"]["x_future"][0]["content"]["n"], 0)
        self.assertEqual(document.source.raw, raw)

    def test_metadata_no_defaults_notes_and_append_collection_shapes(self):
        raw = HEADER + block("property", {"_notes": "retained in raw", "_overrides": {"n": 1}})
        raw += block("pipeline_log", {"entries": []}) + block("pipeline_log", {"entries": []})
        raw += block("custom_calculations", {"calculations": []}) + block("custom_scenarios", {"scenarios": []})
        document = parse(raw)
        result = document.projection()
        self.assertNotIn("provenance", result["sections"]["property"]["meta"])
        self.assertNotIn("_notes", result["sections"]["property"]["content"])
        self.assertIn("_notes", document.source.blocks[0].parsed.value)
        self.assertEqual(result["sections"]["property"]["overrides"], {"n": 1})
        self.assertEqual(len(result["pipeline_log"]), 2)
        self.assertIn("_meta", result["pipeline_log"][0])
        self.assertIn("meta", result["custom_calculations"][0])
        self.assertIn("meta", result["custom_scenarios"][0])

    def test_bytes_bom_crlf_precision_and_projections_do_not_mutate_source(self):
        raw = b"\xef\xbb\xbf" + (HEADER + block("property", {"name": "Café", "n": 1.23})).replace(b"\n", b"\r\n")
        raw = raw.replace(b'"n": 1.23', b'"n": 1.2300')
        document = parse(raw)
        before = copy.deepcopy(document.source.blocks[0].parsed.value)
        document.projection()
        self.assertEqual(document.source.raw, raw)
        self.assertEqual(document.source.blocks[0].parsed.value, before)
        token = document.source.blocks[0].parsed.numbers[-1]
        self.assertEqual(token.span.extract(raw), b"1.2300")

    def test_version_and_extension_refusals_use_existing_codes(self):
        for raw in [b"", HEADER.replace(b'"3.0"', b'"3.1"'), HEADER.replace(b'"3.0"', b'3.0')]:
            with self.subTest(raw=raw), self.assertRaises(ReaderError) as caught:
                parse(raw)
            self.assertEqual(caught.exception.code, "UNSUPPORTED_FORMAT_VERSION")
            self.assertIn("3.0", str(caught.exception))
        with self.assertRaises(ReaderError) as caught:
            parse(HEADER + block("property"), filename="deal.uw.md")
        self.assertEqual(caught.exception.code, "SOURCE_CONTENT_MISMATCH")

    def test_incomplete_structure_refuses_without_claiming_validation(self):
        with self.assertRaises(SourceError):
            parse(HEADER + b"```json uw:section=property\n{}")
        document = parse(HEADER + b"```json uw:section=property\n{}\n```\n")
        self.assertNotIn("meta", document.projection()["sections"]["property"])
        self.assertEqual(document.source.blocks[0].parsed.value, {})

    def test_fence_only_history_preserves_authored_metadata_and_source(self):
        for meta_state in (False, None):
            old = block("property", {"n": 1, "unknown": {"kept": True}})
            if meta_state is None:
                old = old.replace(b'"superseded": false', b'"other": false')
            old = old.replace(b'uw:section=property', b'uw:section=property superseded=true')
            raw = HEADER + old + block("property", {"n": 2})
            document = parse(raw)
            before = copy.deepcopy([item.parsed.value for item in document.source.blocks])
            result = document.projection()
            self.assertEqual(result["sections"]["property"]["content"]["n"], 2)
            history = result["superseded"]["property"][0]
            self.assertEqual(history["content"]["unknown"], {"kept": True})
            self.assertEqual(history["meta"], before[0]["_meta"])
            self.assertEqual(document.source.raw, raw)
            self.assertEqual([item.parsed.value for item in document.source.blocks], before)

    def test_lifecycle_history_is_not_resurrected_by_false_fence(self):
        old = block("property", {"n": 1}, superseded=True)
        old = old.replace(b'uw:section=property', b'uw:section=property superseded=false')
        result = parse(HEADER + old).projection()
        self.assertNotIn("property", result["sections"])
        self.assertEqual(result["superseded"]["property"][0]["content"]["n"], 1)

    def test_fence_history_role_cannot_activate_named_peer_collection(self):
        old = block("property", {"n": 0}, variant="old", role="primary")
        old = old.replace(b'uw:section=property', b'uw:section=property superseded=true')
        raw = HEADER + old + block("property", {"n": 1}, variant="a")
        raw += block("property", {"n": 2}, variant="b")
        result = parse(raw).projection()
        self.assertEqual(result["sections"]["property"]["content"]["n"], 2)
        self.assertEqual(result["superseded"]["property"][0]["role"], "primary")

    def test_fence_history_routing_applies_to_every_collection_family(self):
        for section in ("operating_statement", "x_future", "future_section",
                        "pipeline_log", "custom_calculations", "custom_scenarios"):
            with self.subTest(section=section):
                old = block(section, {"n": 1}, variant="old")
                old = old.replace(('uw:section=' + section).encode(),
                                  ('uw:section=' + section + ' superseded=true').encode())
                raw = HEADER + old + block(section, {"n": 2}, variant="current")
                result = parse(raw).projection()
                if section in ("pipeline_log", "custom_calculations", "custom_scenarios"):
                    # The accepted contract preserves append-only arrays even
                    # when an entry carries a history flag. No occurrence drops.
                    self.assertNotIn(section,result["superseded"])
                    entries=result[section]
                    self.assertEqual([v["n"] if section=="pipeline_log" else v["content"]["n"] for v in entries],[1,2])
                    continue
                self.assertEqual([v["content"]["n"] for v in result["superseded"][section]], [1])
                if section == "operating_statement":
                    self.assertEqual(set(result["sections"][section]), {"current"})
                elif section == "x_future":
                    self.assertEqual(result["extensions"][section]["block"]["content"]["n"], 2)
                else:
                    self.assertEqual(result["sections"][section]["content"]["n"], 2)

    def test_fence_history_without_metadata_does_not_inject_metadata(self):
        raw = HEADER + b'```json uw:section=property superseded=true\n{"n":1}\n```\n'
        result = parse(raw).projection()
        self.assertNotIn("property", result["sections"])
        self.assertEqual(result["superseded"]["property"], [{"content": {"n": 1}}])

    def test_fence_history_flag_is_exact_and_preserves_physical_order(self):
        raw = HEADER
        for value, number in (("true", 1), ("TRUE", 2), ("false", 3), ("true", 4)):
            body = block("property", {"n": number})
            raw += body.replace(b'uw:section=property', ('uw:section=property superseded=' + value).encode())
        result = parse(raw).projection()
        self.assertEqual(result["sections"]["property"]["content"]["n"], 3)
        self.assertEqual([v["content"]["n"] for v in result["superseded"]["property"]], [1, 2, 4])

    def test_existing_superseded_source_parse_command_retains_history(self):
        root = Path(__file__).resolve().parents[2]
        path = root / "conformance/reserve-draw-bindings/superseded-source/deal.uwx.md"
        raw = path.read_bytes()
        document = parse(raw)
        expected_history = [item for item in document.source.blocks
                            if dict(item.attributes).get("superseded") == "true"]
        self.assertTrue(expected_history)
        result, status = main(["parse", str(path)])
        self.assertEqual(status, 0)
        for item in expected_history:
            projected = result["superseded"][item.section]
            self.assertTrue(any(value.get("meta") == item.parsed.value.get("_meta") for value in projected))
        self.assertEqual(path.read_bytes(), raw)

    def test_manifest_claims_reader_tier_not_verifier_and_missing_commands_do_not_pass(self):
        manifest, status = main(["manifest"])
        self.assertEqual(status, 0)
        self.assertEqual(manifest["capabilities"], ["parse", "calc-evaluate", "validate", "verify-reserve-accounts", "verify-reserve-draws"])
        self.assertEqual(manifest["profiles"], [])
        # Certified Reader tier (#354); never the Verifier tier (Protocol II.2/II.5).
        self.assertEqual(manifest["tier"], "reader")
        for arguments in [["validate", "x"], ["calc", "x"], ["render", "x"]]:
            self.assertNotEqual(main(arguments)[1], 0)


if __name__ == "__main__":
    unittest.main()

class LiteDeclarationTests(unittest.TestCase):
    def test_shared_lite_sources_never_get_an_implicit_rule_set(self):
        for name in ['16-rule-set-missing','17-rule-set-null','18-rule-set-numeric','19-rule-set-unsupported']:
            path=Path(__file__).resolve().parents[2]/'conformance/lite/malformed'/(name+'.uw.md')
            raw=path.read_bytes()
            with self.subTest(name=name),self.assertRaises(ReaderError) as caught:
                parse(raw,filename=path.name)
            self.assertEqual(caught.exception.code,'UNSUPPORTED_FORMAT_VERSION')
            self.assertEqual(path.read_bytes(),raw)
