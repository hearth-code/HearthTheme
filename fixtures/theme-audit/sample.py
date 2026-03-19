# Hearth fixture: Python semantic coverage
from dataclasses import dataclass
from enum import Enum
from typing import Optional

API_ROOT = "https://api.hearthcode.dev"
DEFAULT_TIMEOUT = 30.0


class LogLevel(Enum):
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


@dataclass
class Session:
    token: str
    user_id: int
    expires_at: Optional[str] = None


def load_session(raw: dict[str, object]) -> Optional[Session]:
    if "token" not in raw or "user_id" not in raw:
        return None
    return Session(token=str(raw["token"]), user_id=int(raw["user_id"]))
