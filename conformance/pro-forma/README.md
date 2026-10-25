# Pro-forma profile controls

Synthetic library-operation controls for RFC 0092 and registry `uwmd.pro-forma.l1.1`.
`expected.json` contains independently authored report subsets; the runner checks
all listed members. These are implementation regression controls. They do not
claim independent-implementation or actual cross-runtime CLI proof (#551/#552).

Run after building: `node scripts/run-conformance.mjs --profile=pro-forma`.
The public implementation manifest deliberately omits this profile until both
separate support gates pass. The portable driver remains unchanged.
