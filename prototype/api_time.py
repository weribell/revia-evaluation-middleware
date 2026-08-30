"""Shared timestamp helpers for the backend."""

from __future__ import annotations

import datetime as dt


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
