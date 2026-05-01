import logging
from typing import Any, Optional

logger = logging.getLogger("cognify")


class JobLoggerAdapter(logging.LoggerAdapter):
    """Prefixes every log message with [JOB {job_id}] when a job_id is present."""

    def process(self, msg: str, kwargs: Any) -> tuple[str, Any]:
        job_id = self.extra.get('job_id') if self.extra else None
        if job_id:
            return f'[JOB {job_id}] {msg}', kwargs
        return msg, kwargs


def get_job_logger(job_id: Optional[str] = None, name: Optional[str] = None) -> logging.LoggerAdapter:
    """Returns a JobLoggerAdapter for the given job_id and logger name."""
    base_logger = logging.getLogger(name) if name else logger
    return JobLoggerAdapter(base_logger, {'job_id': job_id})
