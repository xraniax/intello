import sys
import os
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("test-imports")

logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
logger.info(f"sys.path: {sys.path}")
logger.info(f"CWD: {os.getcwd()}")

try:
    logger.info("Attempting 'import database'...")
    import database
    logger.info("Successfully imported database")
    logger.info(f"database file: {database.__file__}")
except Exception as e:
    logger.error(f"Failed to import database: {e}")
    import traceback
    logger.error(traceback.format_exc())

try:
    logger.info("Attempting 'import models'...")
    import models
    logger.info("Successfully imported models")
    logger.info(f"models file: {models.__file__}")
except Exception as e:
    logger.error(f"Failed to import models: {e}")
    import traceback
    logger.error(traceback.format_exc())
