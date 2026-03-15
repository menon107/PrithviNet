from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    question: str
    industry_id: Optional[str] = None