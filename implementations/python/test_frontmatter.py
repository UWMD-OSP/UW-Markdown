"""Known-answer Appendix D controls; no TypeScript or expected-output lookups."""
import unittest
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from test_reader import HEADER

from uwmd_frontmatter import FrontmatterError, parse_frontmatter


class FrontmatterTests(unittest.TestCase):
    def decode(self, text):
        return parse_frontmatter(text.encode("utf-8"))

    def test_scalar_types_and_source_distinctions(self):
        result = self.decode("word: yes\nfalse_value: FALSE\ntrue_value: True\n"
                             "nil: null\nempty:\nnumber: 0012\nfraction: 1.2300e-2\nflags: []\n")
        self.assertEqual(result.value, {"word": "yes", "false_value": False, "true_value": True,
                                       "nil": None, "empty": None, "number": 12.0,
                                       "fraction": .0123, "flags": []})
        self.assertNotIn("absent", result.value)
        self.assertEqual([token.lexeme for token in result.numbers], ["0012", "1.2300e-2"])

    def test_quotes_and_yaml_specific_escapes(self):
        result = self.decode("a: 'O''Brien # &x *y !z {a} [b]'\n"
                             'b: "Caf\\u00e9 \\"Tower\\" \\x41\\U0001F600"\n'
                             'c: "\\0\\a\\b\\t\\n\\v\\f\\r\\e\\ \\/\\\\\\N\\_\\L\\P"\n')
        self.assertEqual(result.value["a"], "O'Brien # &x *y !z {a} [b]")
        self.assertEqual(result.value["b"], 'Café "Tower" A😀')
        self.assertEqual(result.value["c"], '\0\a\b\t\n\v\f\r\x1b /\\\x85\xa0\u2028\u2029')

    def test_comments_and_plain_punctuation(self):
        result = self.decode("city: Phoenix # comment\na: abc#def\nb: Smith & Jones !North\n"
                             "c: Suite [West]\nd: '# retained' # ignored\ne: # null\n")
        self.assertEqual(result.value, {"city": "Phoenix", "a": "abc#def", "b": "Smith & Jones !North",
                                       "c": "Suite [West]", "d": "# retained", "e": None})

    def test_mapping_and_sequence_source_spans(self):
        raw = '"é/~":\r\n  first: -1.200e-2 # value\r\nrows:\r\n  - 0.0550\r\n  -\r\n  - "2"\r\n'.encode()
        parsed = parse_frontmatter(raw, byte_offset=9)
        self.assertEqual(parsed.value, {"é/~": {"first": -.012}, "rows": [.055, None, "2"]})
        self.assertEqual([token.pointer for token in parsed.numbers], ["/é~1~0/first", "/rows/0"])
        for token in parsed.numbers:
            self.assertEqual(token.span.extract(b"123456789" + raw).decode(), token.lexeme)

    def test_quoted_simple_keys_and_duplicate_decoded_keys(self):
        self.assertEqual(self.decode("'unknown:key': retained\n\"é\": 12\n").value,
                         {"unknown:key": "retained", "é": 12})
        raw = ('"é": kept\n"": 1.2300\n"#leading": retained\n'
               "nested:\n  '': -2.500\n  '#tag': yes\n  'embedded:colon': retained\n").encode()
        parsed = parse_frontmatter(raw)
        self.assertEqual(parsed.value, {"é": "kept", "": 1.23, "#leading": "retained",
                                        "nested": {"": -2.5, "#tag": "yes", "embedded:colon": "retained"}})
        self.assertEqual([token.pointer for token in parsed.numbers], ["/", "/nested/"])
        self.assertEqual([token.lexeme for token in parsed.numbers], ["1.2300", "-2.500"])
        for token in parsed.numbers:
            self.assertEqual(token.span.extract(raw).decode(), token.lexeme)
        for text in ["x: 1\n'x': 2\n", 'x:\n  a: 1\n  "a": 2\n', '"\\u0078": 1\nx: 2\n',
                     "'': 1\n\"\": 2\n"]:
            with self.subTest(text=text), self.assertRaises(FrontmatterError):
                self.decode(text)
        for text in [": kept\n", "12: kept\n", "true: kept\n", "null: kept\n"]:
            with self.subTest(text=text), self.assertRaises(FrontmatterError):
                self.decode(text)

    def test_yaml_integer_forms_follow_core_scalar_semantics(self):
        self.assertEqual(self.decode("a: 0o10\nb: 0x10\nc: +2\nd: .5\ne: 1.\nf: -0o7\ng: +0x10\n").value,
                         {"a": 8, "b": 16, "c": 2, "d": .5, "e": 1, "f": "-0o7", "g": "+0x10"})

    def test_authored_unicode_separators_remain_inside_one_line_scalars(self):
        decoded = self.decode('value: "a\x85b\u2028c\u2029d"\nnumber: 1.2300\n')
        self.assertEqual(decoded.value, {"value": "a\x85b\u2028c\u2029d", "number": 1.23})
        raw = 'value: "a\x85b\u2028c\u2029d"\nnumber: 1.2300\n'.encode()
        self.assertEqual(decoded.numbers[0].span.extract(raw), b"1.2300")
        self.assertEqual(self.decode('x: "\\N\\L\\P\\v\\f"\n').value["x"], '\x85\u2028\u2029\v\f')
        for text in ['x: "raw\vcontrol"\n', 'x: "raw\fcontrol"\n', 'x: "raw\0control"\n']:
            with self.subTest(text=text), self.assertRaises(FrontmatterError):
                self.decode(text)

    def test_plain_indicators_and_terminal_colons_require_quotes(self):
        for scalar in ["-", "?", ":", "value:", "value: # trailing comment"]:
            with self.subTest(scalar=scalar), self.assertRaises(FrontmatterError):
                self.decode("x: " + scalar + "\n")
        self.assertEqual(self.decode("a: '-'\nb: '?'\nc: ':'\nd: 'value:'\n"
                                     "url: https://example.test:8443/a-b\n"
                                     "hyphen: -item\nquestion: ?item\ncolon: :item\n").value,
                         {"a": "-", "b": "?", "c": ":", "d": "value:",
                          "url": "https://example.test:8443/a-b", "hyphen": "-item",
                          "question": "?item", "colon": ":item"})

    def test_sequence_objects_follow_format_modules_example_without_name_special_case(self):
        parsed = self.decode('asset_class: com.example.specialty_facility\n'
            'modules:\n  - id: com.example.datacenters\n    version: ">=0.1.0 <1.0.0"\n'
            '  - id: second\n    version: null\n'
            'unknown:\n  - label: kept\n    amount: 1.2300\n  - scalar\n  - true\n  - text\n  -\n')
        self.assertEqual(parsed.value["modules"], [
            {"id":"com.example.datacenters", "version":">=0.1.0 <1.0.0"},
            {"id":"second", "version":None}])
        self.assertEqual(parsed.value["unknown"], [{"label":"kept", "amount":1.23}, "scalar", True, "text", None])
        self.assertEqual(parsed.numbers[0].pointer, "/unknown/0/amount")
        self.assertEqual(parsed.numbers[0].lexeme, "1.2300")
        self.assertEqual(self.decode("x:\n  - # comment\n    id: kept\n").value,
                         {"x":[{"id":"kept"}]})

    def test_sequence_mapping_source_offsets_empty_item_and_quoted_keys(self):
        raw = ('"é/~":\r\n  - "": -1.200e-2 # retained spelling\r\n'
               "    'a/b~c': 0x10\r\n  -\r\n    id: kept\r\n    flags: []\r\n").encode()
        parsed = parse_frontmatter(raw, byte_offset=11)
        self.assertEqual(parsed.value, {"é/~":[{"":-.012, "a/b~c":16}, {"id":"kept", "flags":[]}]})
        self.assertEqual([t.pointer for t in parsed.numbers], ["/é~1~0/0/", "/é~1~0/0/a~1b~0c"])
        for token in parsed.numbers:
            self.assertEqual(token.span.extract(b"12345678901" + raw).decode(), token.lexeme)

    def test_sequence_mapping_addition_keeps_duplicates_depth_and_feature_refusals(self):
        for text in [
                "x:\n  - id: a\n    id: b\n",
                "x:\n  - id: a\n    'id': b\n",
                "x:\n  - '': a\n    \"\": b\n",
                "x:\n  - id:\n      version: nested\n",
                "x:\n  - id: a\n    child:\n      nested: b\n",
                "x:\n  - scalar\n    id: a\n",
                "x:\n  id: a\n    version: b\n",
                "x:\n    id: a\n",
                "x:\n  - id: a\n    - b\n",
                "x:\n  - id: &anchor\n",
                "x:\n  - id: *alias\n",
                "x:\n  - id: !!str 3\n",
                "x:\n  - id: {a: 1}\n",
                "x:\n  - id: [1, 2]\n",
                "x:\n  - id: |\n",
                "x:\n  - id: a\n\tbad: b\n"]:
            with self.subTest(text=text), self.assertRaises(FrontmatterError) as caught:
                self.decode(text)
            self.assertEqual(caught.exception.code, "UNSUPPORTED_YAML_FEATURE")

    def test_sequence_mapping_actual_cli_preserves_complete_source(self):
        raw = HEADER.replace(b"unknown_key: retained",
            b'modules:\n  - id: com.example.specialty_facility\n    version: ">=0.1.0 <1.0.0"\n'
            b'unknown_key:\n  - "a/b~c": 1.2300\n    label: "Caf\\u00e9"')
        with tempfile.TemporaryDirectory(prefix="uwmd-yaml-sequence-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for source in (raw, raw.replace(b"\n", b"\r\n")):
                path.write_bytes(source)
                command = subprocess.run([sys.executable, "-B", str(Path(__file__).with_name("uwmd.py")),
                    "parse", str(path)], capture_output=True, encoding="utf-8", timeout=30)
                self.assertEqual(command.returncode, 0, command.stderr)
                value = json.loads(command.stdout)
                self.assertEqual(value["frontmatter"]["modules"],
                    [{"id": "com.example.specialty_facility", "version": ">=0.1.0 <1.0.0"}])
                self.assertEqual(value["frontmatter"]["unknown_key"], [{"a/b~c": 1.23, "label": "Café"}])
                self.assertEqual(path.read_bytes(), source)

    def test_unsupported_features_refuse_existing_code(self):
        for text in ["x: &anchor\n", "x: *alias\n", "x: !!str 3\n", "x: |\n", "x: >\n",
                     "x: {a: 1}\n", "x: [1,2]\n", "%YAML 1.2\n", "? x: y\n",
                     "x:\n  y:\n    z: 1\n", "x:\n\tbad: 2\n", "x: null\n  y: 1\n",
                     "x:\n  - one\n  two: 2\n", "x: 'unclosed\n", 'x: "\\q"\n',
                     'x: "a" garbage\n', 'x: "\\uD800"\n', 'x: "\\U00110000"\n']:
            with self.subTest(text=text), self.assertRaises(FrontmatterError) as caught:
                self.decode(text)
            self.assertEqual(caught.exception.code, "UNSUPPORTED_YAML_FEATURE")

    def test_nonfinite_inputs_refuse_without_successful_partial_value(self):
        for text in ["x: 1e999\n", "x: .inf\n", "x: -.Inf\n", "x: .NaN\n",
                     "x: 0x" + "f" * 400 + "\n"]:
            with self.subTest(text=text), self.assertRaises(FrontmatterError):
                self.decode(text)


if __name__ == "__main__":
    unittest.main()
