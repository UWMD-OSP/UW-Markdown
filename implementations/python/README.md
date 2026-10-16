# Independent Python implementation — initial numeric kernel

Issue [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354).
This directory is an unpublished, incomplete implementation seed, written from
the Protocol rather than translated from the TypeScript implementation.
It has no Node dependency, external packages, implementation manifest, or
Reader/Verifier conformance claim. It is not ready to verify a UWMD record.
No PyPI package name, supported Python floor, or publication workflow is decided.

Implemented now: strict Gregorian-date predicate, the closed day-count registry,
the calc-domain decimal-shift quantizer, ordered cash-flow totals and MOIC.
Tests use independently stated known answers. The numerical investigation also
uses this quantizer to distinguish raw-bit and quantized disagreements.

```sh
python3 -m unittest discover -s implementations/python -v
```

Next independent work, not blocked by #356: Reader/source-token preservation,
unknown fields and supersession, validation and role/period resolution, safe
expression grammar and ordinary arithmetic/null/refusal behavior, dictionary
checks that do not depend on disputed transcendental procedures, exact cash-flow
coverage and arithmetic, and receipt subject/result canonicalization. Protocol
II.2's full stated-figure verifiers and receipts remain obligations; portable
Reader17/Verifier281 cases alone do not establish completeness. Retain the source
numeric tokens for VIII.5.1 rather than recovering precision from Python floats.

#356 affects library powers/logarithms, periodic returns, annuities, dated returns
and any checks depending on those operations. Independent experimental oracles
may expose disagreements now, but cannot choose the missing normative rule.
Do not hard-code Node24 observations as the Python contract. Do not advertise
bit identity or calc-evaluate until the complete applicable requirements pass.
Unclaimed optional profiles remain optional; required base checks cannot be
silently skipped. RFC0085–0087 and the narrower #355 profile are separate targets.

The proposed end-to-end acceptance is a Node-free Python process driven through
Protocol II.6a, full base-obligation inventory, portable cases with no concealed
divergences, and independent Linux/macOS/Windows evidence. No such run has occurred
for this seed. Signature dependency decisions and publication remain separate.
