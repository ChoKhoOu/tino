"""CLI session management: track connected sessions, assign IDs, handle reconnect."""

import logging
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger(__name__)


class SessionInfo:
    """Represents a connected CLI session."""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.started_at = datetime.now(timezone.utc)
        self.last_active_at = self.started_at
        self.status = "ACTIVE"
        self.active_strategy_hash: str | None = None

    def touch(self):
        self.last_active_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "id": self.session_id,
            "started_at": self.started_at.isoformat(),
            "last_active_at": self.last_active_at.isoformat(),
            "status": self.status,
            "active_strategy_hash": self.active_strategy_hash,
        }


class SessionManager:
    """Manages connected CLI sessions."""

    def __init__(self):
        self._sessions: dict[str, SessionInfo] = {}

    def create_session(self) -> SessionInfo:
        """Create a new CLI session."""
        session_id = str(uuid4())
        session = SessionInfo(session_id)
        self._sessions[session_id] = session
        logger.info(f"Session created: {session_id}")
        return session

    def get_session(self, session_id: str) -> SessionInfo | None:
        return self._sessions.get(session_id)

    def touch_session(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if session:
            session.touch()

    def disconnect_session(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if session:
            session.status = "DISCONNECTED"
            logger.info(f"Session disconnected: {session_id}")

    def reconnect_session(self, session_id: str) -> SessionInfo | None:
        session = self._sessions.get(session_id)
        if session and session.status == "DISCONNECTED":
            session.status = "ACTIVE"
            session.touch()
            logger.info(f"Session reconnected: {session_id}")
            return session
        return None

    def close_session(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if session:
            session.status = "CLOSED"
            logger.info(f"Session closed: {session_id}")

    def list_active_sessions(self) -> list[dict]:
        return [
            s.to_dict() for s in self._sessions.values()
            if s.status == "ACTIVE"
        ]

    def get_session_count(self) -> int:
        return sum(1 for s in self._sessions.values() if s.status == "ACTIVE")


# Global singleton
session_manager = SessionManager()
