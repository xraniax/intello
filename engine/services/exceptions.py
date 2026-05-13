class NonRetriableGenerationError(Exception):
    """Exception raised for deterministic generation failures that should not be retried by Celery."""
    def __init__(self, message: str, details: str = None, raw_output: str = None):
        super().__init__(message)
        self.message = message
        self.details = details
        self.raw_output = raw_output
