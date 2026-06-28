"""Logging strutturato (JSON line) per i job ETL.

Ogni record viene emesso come una riga JSON con timestamp UTC, livello, logger e
messaggio; gli eventuali campi extra passati via `logger.info(msg, extra={...})`
finiscono nello stesso oggetto. Comodo da grepare e da ingerire in un collector.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

# Attributi standard di LogRecord: tutto ciò che NON è qui è un campo "extra".
_RESERVED = set(
    logging.makeLogRecord({}).__dict__.keys()
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    """Formatta i LogRecord come una singola riga JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    """Configura il root logger con il formatter JSON (idempotente)."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
