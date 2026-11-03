# Rust debugging

Development builds and tests use line tables for file and line numbers in
backtraces. The core puzzle generators and solvers retain their `opt-level = 3`
override, debug assertions and overflow checks.

To inspect local variables and types in a debugger, request full debug symbols:

```bash
CARGO_PROFILE_DEV_DEBUG=full cargo test -p puzzled-core -p puzzled-server
```

Cargo's test profile inherits the development setting. An explicit
`CARGO_PROFILE_TEST_DEBUG` override takes precedence for tests. Release builds
use the release profile.
