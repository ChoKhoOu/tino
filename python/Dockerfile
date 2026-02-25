# ---- Stage 1: Build dependencies ----
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /build

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies into a virtual environment
RUN uv sync --frozen --no-dev --no-install-project

# Copy source code and install the project itself
COPY tino_daemon/ tino_daemon/
RUN uv sync --frozen --no-dev


# ---- Stage 2: Runtime image ----
FROM python:3.12-slim AS runtime

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1000 tino && \
    useradd --uid 1000 --gid tino --create-home tino

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /build/.venv /app/.venv

# Copy application source
COPY tino_daemon/ /app/tino_daemon/

# Ensure virtualenv binaries are on PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    TINO_DAEMON_PORT=50051

# Data volume for backtest data persistence
VOLUME ["/home/tino/.tino/data"]

EXPOSE 50051

USER tino

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import grpc; ch = grpc.insecure_channel('localhost:${TINO_DAEMON_PORT}'); grpc.channel_ready_future(ch).result(timeout=3)" || exit 1

ENTRYPOINT ["python", "-m", "tino_daemon"]
CMD ["--port", "50051"]
