import logging
import os

import uvicorn
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

from database import init_db
from scheduler import setup_scheduler

if __name__ == "__main__":
    init_db()
    scheduler = setup_scheduler()
    scheduler.start()
    logging.getLogger(__name__).info("APScheduler 已启动")
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)
