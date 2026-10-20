"""Known-answer source tests; these are not portable Reader conformance runs."""
import json
from pathlib import Path
import unittest

from uwmd_source import SourceError, parse_json_source, scan_source


class SourceTests(unittest.TestCase):
    def test_numeric_tokens_survive_binary64_conversion(self):
        parsed = parse_json_source(b'{"a":[1.2300,1e-6,-0,9007199254740993],"x":null}')
        self.assertEqual([token.lexeme for token in parsed.numbers],
                         ["1.2300", "1e-6", "-0", "9007199254740993"])
        self.assertEqual([token.pointer for token in parsed.numbers],
                         ["/a/0", "/a/1", "/a/2", "/a/3"])
        self.assertEqual(parsed.value["a"][3], 9007199254740992.0)
        self.assertIn("x", parsed.value)
        self.assertNotIn("missing", parsed.value)
        self.assertIsNone(parsed.value["x"])

    def test_utf8_byte_spans_and_pointer_escaping(self):
        source = '{"é/~":{"x":1.2500},"not a number":"3.14"}'.encode()
        parsed = parse_json_source(source, byte_offset=7)
        self.assertEqual(len(parsed.numbers), 1)
        token = parsed.numbers[0]
        self.assertEqual(token.pointer, "/é~1~0/x")
        self.assertEqual(token.span.extract(b"prefix!" + source), b"1.2500")

    def test_duplicate_decoded_names_refuse(self):
        for source in [b'{"a":1,"a":2}', b'{"a":1,"\\u0061":2}',
                       b'{"outer":{"x":0,"x":1}}']:
            with self.subTest(source=source), self.assertRaises(SourceError):
                parse_json_source(source)

    def test_invalid_json_and_nonfinite_refuse(self):
        for source in [b"NaN", b"Infinity", b"1e309", b"-1e309", b"01", b"1.",
                       b"+1", b"[1,]", b'{"a":1,}', b"true false", b"\xff",
                       b'{"x":"\\q"}', b'{"x":1 /* comment */}', b"[", b"\x0b1"]:
            with self.subTest(source=source), self.assertRaises(SourceError):
                parse_json_source(source)

    def test_primitive_values_and_numeric_boundaries(self):
        self.assertEqual(parse_json_source(b'[true,false,null,0,[],{}]').value,
                         [True, False, None, 0.0, [], {}])
        self.assertEqual(parse_json_source(b"5e-324").value, 5e-324)
        self.assertEqual(parse_json_source(b"1e-999").numbers[0].lexeme, "1e-999")
        self.assertEqual(parse_json_source(b"1.7976931348623157e308").value,
                         1.7976931348623157e308)

    def test_source_bytes_order_unknown_sections_and_history_retained(self):
        source = (b"\xef\xbb\xbf---\r\nuw_version: '3.0'\r\nx_unknown: yes\r\n---\r\n"
                  b"# Caf\xc3\xa9\r\n```json uw:section=x_custom superseded=true\r\n"
                  b'{"_meta":{"lifecycle":{"superseded":true}},"n":1.00}\r\n```\r\n'
                  b"```json uw:section=property\r\n"
                  b'{"_meta":{},"n":2.00,"content":{"literal":true}}\r\n```\r\n')
        parsed = scan_source(source)
        self.assertIs(parsed.raw, source)
        self.assertEqual(parsed.frontmatter_span.extract(source),
                         b"uw_version: '3.0'\r\nx_unknown: yes\r\n")
        self.assertEqual([block.section for block in parsed.blocks], ["x_custom", "property"])
        self.assertEqual(parsed.blocks[1].parsed.value["content"], {"literal": True})
        for block, lexeme in zip(parsed.blocks, [b"1.00", b"2.00"]):
            token = block.parsed.numbers[0]
            self.assertEqual(token.span.extract(source), lexeme)
            self.assertTrue(block.fence_span.extract(source).endswith(b"```\r\n"))

    def test_only_the_backtick_line_rule_opens_a_block(self):
        # Format 2.4 (RFC 0102): a line that begins exactly ```json uw:... opens a
        # block wherever it appears; tilde and indented fences are ordinary Markdown.
        source = (b"---\nuw_version: '3.0'\n---\n````markdown\n"
                  b"```json uw:section=property\n{}\n```\n````\n"
                  b"~~~json uw:section=x_tilde\n{\"a\":1}\n~~~\n"
                  b"   ```json uw:section=x_indented\n{}\n```\n")
        parsed = scan_source(source)
        self.assertEqual([block.section for block in parsed.blocks], ["property"])

    def test_incomplete_or_ambiguous_sources_refuse(self):
        for source in [b"", b"no frontmatter", b"---\nuw_version: '3.0'",
                       b"---\n---\n```json uw:section=property\n{}",
                       b"---\n---\n```json uw:section=a uw:section=b\n{}\n```\n",
                       b"---\n---\n```json uw:section=a\n[]\n```\n",
                       b"---\n---\n```json uw:section=a invalid\n{}\n```\n"]:
            with self.subTest(source=source), self.assertRaises(SourceError):
                scan_source(source)

    def test_bounded_depth_refuses_instead_of_truncating(self):
        with self.assertRaises(SourceError):
            parse_json_source(b"[" * 205 + b"0" + b"]" * 205)

    def test_all_portable_reader_sources_scan_without_fixture_output_lookup(self):
        root = Path(__file__).resolve().parents[2]
        cases = sorted((root / "conformance/runner/cases").glob("reader__*__parse.case.json"))
        self.assertEqual(len(cases), 17)
        total_blocks = total_numbers = 0
        for case_path in cases:
            case = json.loads(case_path.read_text(encoding="utf-8"))
            path = root / case["fixture_dir"] / case["args"][0]
            with self.subTest(source=path.name):
                raw = path.read_bytes()
                scanned = scan_source(raw)
                self.assertEqual(raw, path.read_bytes())
                self.assertTrue(scanned.blocks)
                for block in scanned.blocks:
                    total_blocks += 1
                    for token in block.parsed.numbers:
                        total_numbers += 1
                        self.assertEqual(token.span.extract(raw).decode("ascii"), token.lexeme)
        # Controls detect accidentally treating all structured fences as prose.
        self.assertGreater(total_blocks, 17)
        self.assertGreater(total_numbers, 100)


if __name__ == "__main__":
    unittest.main()
