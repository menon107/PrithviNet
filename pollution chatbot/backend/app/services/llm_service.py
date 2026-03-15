import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Use a valid model name.
model = genai.GenerativeModel("models/gemini-2.5-flash")


def generate_answer(prompt: str):

    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.4,
            },
        )

        return response.text

    except Exception as e:
        return f"Reasoning temporarily unavailable: {str(e)}"


def generate_reasoning(question: str, data_context: str, industry_mapping: dict = None):
    mapping_str = ""
    if industry_mapping:
        mapping_str = "\nIndustry Name Mapping (ID -> Name):\n" + json.dumps(industry_mapping, indent=2)

    prompt = f"""
You are an intelligent industrial environmental assistant. 
Your goal is to answer the user's question accurately using the provided data from MongoDB.

User Question: {question}

Data context from MongoDB:
{data_context}
{mapping_str}

Instructions:
1. Analyze the data carefully.
2. DATA LINKING: The 'industries' collection contains a 'region_id' field. The 'regions' collection contains the metadata and emission limits for that ID. You MUST use these fields to link industries to their respective regions.
3. If simulation is asked (e.g., "what if SO2 drops by 30%"), perform the calculation yourself using the latest sensor values.
4. Compare industries if requested.
5. Detect spikes or risks based on the data (e.g., if pollutant > regional limit).
6. Explain trends (increasing/decreasing) if multiple timestamps are provided.
7. Provide a clear, decision-ready summary.
8. If data is missing or insufficient (e.g., no industries found for a region), explain it clearly. Do NOT invent data.
9. Be precise with numbers.
10. Use the Industry Name Mapping to replace industry IDs with their actual names in your response.

Your response:
"""
    return generate_answer(prompt)