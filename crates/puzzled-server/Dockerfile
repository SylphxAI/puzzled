# puzzled-server — Rust Connect dens product authority
# Also carries Atlas + SQL migrations for [database.migrations] Job (image=api).
FROM rust:1-bookworm AS builder
# Pinned protoc 36.1: the Edition 2024 contract needs protoc >= 30.
# Debian protobuf-compiler is older and fails closed on edition 2024.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL -o /tmp/protoc-36.1-linux-x86_64.zip \
    https://github.com/protocolbuffers/protobuf/releases/download/v36.1/protoc-36.1-linux-x86_64.zip \
  && echo "c4bc672d9d49214dc8cafdceadf4df92182d6ca8e3ec65a56b2d7de5602669b4  /tmp/protoc-36.1-linux-x86_64.zip" | sha256sum -c - \
  && unzip -q /tmp/protoc-36.1-linux-x86_64.zip -d /usr/local \
  && rm /tmp/protoc-36.1-linux-x86_64.zip \
  && protoc --version \
  && test "$(protoc --version)" = "libprotoc 36.1"
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY proto proto
COPY crates/puzzled-core/Cargo.toml crates/puzzled-core/Cargo.toml
COPY crates/puzzled-core/src crates/puzzled-core/src
COPY crates/puzzled-server/Cargo.toml crates/puzzled-server/Cargo.toml
COPY crates/puzzled-server/build.rs crates/puzzled-server/build.rs
COPY crates/puzzled-server/src crates/puzzled-server/src
ENV CARGO_BUILD_JOBS=2
RUN cargo build --locked --release -p puzzled-server

FROM debian:bookworm-slim
ARG ATLAS_VERSION=1.2.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && case "$(dpkg --print-architecture)" in \
       amd64) ATLAS_ARCH=amd64 ;; \
       arm64) ATLAS_ARCH=arm64 ;; \
       *) echo "unsupported arch: $(dpkg --print-architecture)" >&2; exit 1 ;; \
     esac \
  && curl --retry 5 --retry-all-errors --connect-timeout 10 -fsSL \
       "https://release.ariga.io/atlas/atlas-community-linux-${ATLAS_ARCH}-v${ATLAS_VERSION}" \
       -o /usr/local/bin/atlas \
  && chmod +x /usr/local/bin/atlas \
  && atlas version \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/puzzled-server /usr/local/bin/puzzled-server
# Migration dir for Platform [database.migrations] Job (path must match sylphx.toml).
COPY apps/puzzled/atlas/migrations /app/apps/puzzled/atlas/migrations
ENV PUZZLED_HTTP_PORT=8080
EXPOSE 8080
USER 65532:65532
CMD ["puzzled-server"]

# post-dens-success re-trigger 20260811T123108Z
