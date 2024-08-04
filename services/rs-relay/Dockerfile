FROM rust:alpine AS builder

WORKDIR /app/src
RUN USER=root

RUN apk add pkgconfig openssl-dev libc-dev
COPY ./ ./
RUN cargo build --release

FROM alpine:latest
WORKDIR /app
RUN apk update \
    && apk add openssl ca-certificates

COPY --from=builder /app/src/target/release/krypton-signaller /app/krypton-signaller

CMD ["/app/krypton-signaller"]
