from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_MAX_SUBSCRIPTIONS = 5


@dataclass(frozen=True)
class SubscriptionKey:
    instrument: str
    source: str


@dataclass
class SubscriptionInfo:
    instrument: str
    source: str
    event_type: str


class SubscriptionRegistry:
    def __init__(self, max_subscriptions: int = _MAX_SUBSCRIPTIONS) -> None:
        self._max = max_subscriptions
        self._subs: dict[SubscriptionKey, SubscriptionInfo] = {}

    def add(self, instrument: str, source: str, event_type: str) -> bool:
        key = SubscriptionKey(instrument=instrument, source=source)
        if key in self._subs:
            self._subs[key].event_type = event_type
            return True
        if len(self._subs) >= self._max:
            logger.warning(
                "Max subscriptions (%d) reached, rejecting %s/%s",
                self._max,
                instrument,
                source,
            )
            return False
        self._subs[key] = SubscriptionInfo(
            instrument=instrument, source=source, event_type=event_type
        )
        return True

    def remove(self, instrument: str, source: str) -> bool:
        key = SubscriptionKey(instrument=instrument, source=source)
        if key in self._subs:
            del self._subs[key]
            return True
        return False

    def list_all(self) -> list[SubscriptionInfo]:
        return list(self._subs.values())

    def get(self, instrument: str, source: str) -> SubscriptionInfo | None:
        key = SubscriptionKey(instrument=instrument, source=source)
        return self._subs.get(key)

    def has(self, instrument: str, source: str) -> bool:
        return SubscriptionKey(instrument=instrument, source=source) in self._subs

    @property
    def count(self) -> int:
        return len(self._subs)
