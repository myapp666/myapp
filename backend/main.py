import os
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from api import app
import uvicorn

if __name__ == "__main__":
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
