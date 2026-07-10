# puzzled-server — Rust drop-in authority (ADR-168 S0+)
FROM rust:1-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/puzzled-core/Cargo.toml crates/puzzled-core/Cargo.toml
COPY crates/puzzled-core/src crates/puzzled-core/src
COPY crates/puzzled-server/Cargo.toml crates/puzzled-server/Cargo.toml
COPY crates/puzzled-server/src crates/puzzled-server/src
ENV CARGO_BUILD_JOBS=2
RUN cargo build --locked --release -p puzzled-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/puzzled-server /usr/local/bin/puzzled-server
ENV PUZZLED_HTTP_PORT=8080
EXPOSE 8080
USER 65532:65532
CMD ["puzzled-server"]
