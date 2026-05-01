import asyncio
import httpx
import logging
import os
from contextlib import asynccontextmanager
from services.api import app
from services.diagnostics import run_pipeline_diagnostic

logger = logging.getLogger("engine-main")

@app.on_event("startup")
async def startup_event():
    # Run diagnostic as a background task
    asyncio.create_task(run_pipeline_diagnostic())