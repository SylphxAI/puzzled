# Retired Puzzled server tree

This directory is intentionally non-authoritative and contains no executable
product backend. Git history is the archive; the production API is the Rust
Connect service declared in `sylphx.toml`.

Do not add TypeScript backend source here. The Next.js app is presentation-only;
product API policy and persistence belong to `crates/puzzled-server`.
