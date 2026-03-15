from fastapi import APIRouter
from app.models.request_models import ChatRequest

from app.services.query_generator import generate_mongo_query
from app.utils.mongo_executor import execute_multiple_queries
from app.services.llm_service import generate_reasoning
from app.utils.helpers import serialize_mongo
import json

router = APIRouter()


@router.post("/chat")
def chat(request: ChatRequest):
    # 1. Generate MongoDB queries based on user question
    query_data = generate_mongo_query(request.question)
    queries = query_data.get("queries", [])
    reasoning_tasks = query_data.get("reasoning_tasks", [])
    industry_mapping = query_data.get("industry_mapping", {})

    # 2. Execute queries to fetch relevant data
    raw_data = execute_multiple_queries(queries)

    # 3. Serialize data for the LLM
    compact_data = serialize_mongo(raw_data)
    data_context = json.dumps(compact_data, indent=2)

    # 4. Generate the final answer using the reasoning LLM
    answer = generate_reasoning(request.question, data_context, industry_mapping)

    # 5. Build response
    # We include metadata about what was done for transparency if needed
    response = {
        "answer": answer,
        "queries_executed": queries,
        "reasoning_tasks": reasoning_tasks,
        "retrieved_data_summary": {col: len(docs) for col, docs in raw_data.items()}
    }

    return response