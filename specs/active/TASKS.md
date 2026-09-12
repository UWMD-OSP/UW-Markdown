# Command-line calculation context tasks

- [ ] Paused: implement validated context transport, tests and documentation;
  pass all gates and commit the completed stage.

The implementation is preserved as work in progress. Build and context-parser,
calc/refusal CLI and Excel CLI tests pass. The refinement CLI test still compares
an unrounded endpoint (306) against reordered binary64 arithmetic
(306.00000000000006). The repeated-test-failure stop rule has been reached.
Owner resumption is required before another fix attempt. Full gates and user
documentation remain outstanding; do not merge this draft.

PR #182 and #183 are completed stages and remain unaffected.
