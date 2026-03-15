from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)

db = client["test"]

industries_col = db["industries"]
reports_col = db["monitoringreports"]
warnings_col = db["industrywarnings"]
regions_col = db["regions"]
forecasts_col = db["forecasts"]