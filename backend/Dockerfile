# Build stage
FROM rust:1.88-slim AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy manifests and lock file
COPY Cargo.toml Cargo.lock ./

# Create a dummy main.rs to cache dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Build the actual application
RUN touch src/main.rs && \
    cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies including curl for health checks
RUN apt-get update && \
    apt-get install -y libssl3 ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --system --gid 1001 backend && \
    useradd --system --uid 1001 --gid backend backend

# Copy binary from builder
COPY --from=builder /app/target/release/filerunner-backend /app/filerunner-backend

# Copy migrations
COPY --from=builder /app/migrations /app/migrations

# Create storage directory and set ownership
RUN mkdir -p /app/storage && \
    chown -R backend:backend /app

# Switch to non-root user
USER backend

# Expose port
EXPOSE 8000

# Run the application
CMD ["/app/filerunner-backend"]
