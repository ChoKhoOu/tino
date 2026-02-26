"""Strategy file manager: save, load, hash, and version strategy scripts."""

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from ..schemas.strategy import StrategyCreate, StrategyResponse

logger = logging.getLogger(__name__)

STRATEGIES_DIR = Path("strategies")


def compute_version_hash(source_code: str) -> str:
    """Compute SHA-256 content hash of strategy source code.

    Returns hash in format: sha256:<hex_digest>
    """
    digest = hashlib.sha256(source_code.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


class StrategyLoader:
    """Manages strategy file persistence and versioning."""

    def __init__(self, strategies_dir: Path = STRATEGIES_DIR):
        self.strategies_dir = strategies_dir
        self.strategies_dir.mkdir(parents=True, exist_ok=True)

    def save_strategy(
        self,
        data: StrategyCreate,
        session_id: str | None = None,
        parent_hash: str | None = None,
    ) -> StrategyResponse:
        """Save a strategy script and return the full entity.

        The version hash is computed from source_code content.
        """
        version_hash = compute_version_hash(data.source_code)
        strategy_id = str(uuid4())
        now = datetime.now(timezone.utc)

        # Save the .py file
        file_path = self._hash_to_path(version_hash)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(data.source_code, encoding="utf-8")

        # Save metadata alongside
        meta_path = file_path.with_suffix(".meta.json")
        meta = {
            "id": strategy_id,
            "version_hash": version_hash,
            "name": data.name,
            "description": data.description,
            "parameters": data.parameters,
            "created_at": now.isoformat(),
            "created_by_session": session_id,
            "parent_version_hash": parent_hash,
        }
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

        logger.info(f"Strategy saved: {data.name} -> {version_hash}")

        return StrategyResponse(
            id=strategy_id,
            version_hash=version_hash,
            name=data.name,
            description=data.description,
            source_code=data.source_code,
            parameters=data.parameters,
            created_at=now,
            created_by_session=session_id,
            parent_version_hash=parent_hash,
        )

    def load_by_hash(self, version_hash: str) -> StrategyResponse | None:
        """Load a strategy by its version hash."""
        file_path = self._hash_to_path(version_hash)
        meta_path = file_path.with_suffix(".meta.json")

        if not file_path.exists() or not meta_path.exists():
            return None

        source_code = file_path.read_text(encoding="utf-8")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))

        return StrategyResponse(
            id=meta["id"],
            version_hash=meta["version_hash"],
            name=meta["name"],
            description=meta.get("description"),
            source_code=source_code,
            parameters=meta.get("parameters", {}),
            created_at=datetime.fromisoformat(meta["created_at"]),
            created_by_session=meta.get("created_by_session"),
            parent_version_hash=meta.get("parent_version_hash"),
        )

    def list_strategies(self) -> list[dict]:
        """List all saved strategies with metadata."""
        strategies = []
        for meta_path in self.strategies_dir.rglob("*.meta.json"):
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                strategies.append(meta)
            except (json.JSONDecodeError, OSError) as e:
                logger.warning(f"Failed to read strategy metadata: {meta_path}: {e}")
        strategies.sort(key=lambda s: s.get("created_at", ""), reverse=True)
        return strategies

    def strategy_exists(self, version_hash: str) -> bool:
        """Check if a strategy with the given hash exists."""
        return self._hash_to_path(version_hash).exists()

    def _hash_to_path(self, version_hash: str) -> Path:
        """Convert a version hash to a file path.

        Uses first 2 chars of hex digest as subdirectory for sharding.
        """
        hex_digest = version_hash.replace("sha256:", "")
        return self.strategies_dir / hex_digest[:2] / f"{hex_digest}.py"
