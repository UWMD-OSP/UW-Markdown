"""Independent XML 1.0 Fifth Edition QName admission for the bounded carrier.

Some stdlib Expat builds admit an older Name production. Admit the frozen names
first, then bijectively rename prefix tokens (not values or references) to ASCII
for ElementTree's namespace/tree processing. Expanded names are unchanged.
No Node parser or external dependency is used. XML 1.0 productions 4/4a:
https://www.w3.org/TR/xml/#NT-NameStartChar
"""
import re

START = ('A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff'
         '\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f'
         '\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd'
         '\U00010000-\U000effff')
NCNAME = '[' + START + '][' + START + '0-9.\u00b7\u0300-\u036f\u203f-\u2040-]*'
QNAME = re.compile(NCNAME + '(?::' + NCNAME + ')?')
TOKEN = re.compile(r'[^ \t\r\n/>=]+')
SPACE = re.compile(r'[ \t\r\n]*')


def ascii_prefixes(source):
    """Prefix-only alpha renaming; ET still validates the complete XML syntax.

    Each distinct nonreserved prefix has a unique ASCII image. Declarations,
    start/end tags and attribute names use the same image, so scope, aliasing,
    raw end-tag equality and undeclared-prefix refusal are preserved. Quoted
    attribute values and character data are copied byte-for-character, leaving
    references, whitespace and exactly-once normalization entirely to ET.
    Mapping locals/attributes are fixed ASCII words; unknown locals still refuse.
    """
    out = []
    at = 0

    def name():
        nonlocal at
        match = TOKEN.match(source, at)
        if not match or not QNAME.fullmatch(match[0]):
            raise ValueError('XML malformed qualified name')
        at = match.end()
        token = match[0]
        if ':' not in token:
            return token
        prefix, local = token.split(':')
        if prefix == 'xmlns':
            return 'xmlns:' + renamed(local)
        return renamed(prefix) + ':' + local

    def renamed(prefix):
        # Reserved namespace semantics stay with ET; no generated name collides.
        return prefix if prefix in ('xml', 'xmlns') else 'n' + '_'.join(f'{ord(c):x}' for c in prefix)

    def space():
        nonlocal at
        match = SPACE.match(source, at)
        at = match.end()
        out.append(match[0])
        return bool(match[0])

    while at < len(source):
        opening = source.find('<', at)
        if opening < 0:
            out.append(source[at:])
            break
        out.append(source[at:opening + 1])
        at = opening + 1
        closing = source.startswith('/', at)
        if closing:
            out.append('/')
            at += 1
        out.append(name())
        while True:
            separated = space()
            if source.startswith('>', at):
                out.append('>')
                at += 1
                break
            if not closing and source.startswith('/>', at):
                out.append('/>')
                at += 2
                break
            if closing or not separated:
                raise ValueError('XML attribute separator or closing delimiter')
            out.append(name())
            space()
            if not source.startswith('=', at):
                raise ValueError('XML attribute equality')
            out.append('=')
            at += 1
            space()
            quote = source[at:at + 1]
            if quote not in ('"', "'"):
                raise ValueError('XML attribute quote')
            end = source.find(quote, at + 1)
            if end < 0 or '<' in source[at + 1:end]:
                raise ValueError('XML unterminated attribute or literal less-than')
            out.append(source[at:end + 1])
            at = end + 1
    return ''.join(out)
