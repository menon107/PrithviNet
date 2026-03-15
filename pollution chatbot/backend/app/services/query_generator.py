import os
import json
import re
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Use a valid model name.
model = genai.GenerativeModel("models/gemini-2.5-flash")

# Schema and Industry context to provide to the LLM
SCHEMA_CONTEXT = """
Collections and their schemas:
1. 'industries':
   - _id: ObjectId
   - name: string (e.g., 'AMUL', 'CHIPS', 'Mumbai Textile Mills')
   - industry_type: string
   - compliance_score: number
   - compliance_status: string ('violation', 'compliant')
   - total_violations: number
   - region_id: ObjectId (links to 'regions')
   - last_report_date: datetime

2. 'monitoringreports':
   - industry_id: ObjectId (links to 'industries')
   - date: datetime
   - air_data: { pm25, pm10, so2, no2, co, temperature, humidity }
   - water_data: { ph, bod, cod, tss, turbidity }
   - compliance_score: number
   - compliance_status: string

3. 'forecasts':
   - industry_id: ObjectId
   - forecast_time: datetime
   - pm25, pm10, so2, no2, co, bod, cod, ph (forecasted values)

4. 'regions':
   - _id: ObjectId
   - name: string (e.g., 'Chhattisgarh Region', 'Mumbai Region')
   - emission_limits: { pm25, pm10, so2, no2, co, ph_min, ph_max, bod, cod }

5. 'alerts':
   - _id: ObjectId
   - type: string (e.g., 'violation_alert')
   - severity: string ('low', 'medium', 'high', 'critical')
   - title: string
   - message: string
   - region_id: ObjectId (links to 'regions')
   - industry_id: ObjectId
   - report_id: ObjectId or null
   - status: string ('active', 'resolved')
   - created_at: datetime

6. 'complaints':
   - _id: ObjectId
   - submitted_by: ObjectId
   - region_id: ObjectId (links to 'regions')
   - industry_id: ObjectId or null
   - category: string (e.g., 'air_pollution')
   - title: string
   - description: string
   - status: string ('open', 'closed', etc.)
   - priority: string ('low', 'medium', 'high')
   - created_at: datetime

7. 'industrywarnings':
   - industry_id: ObjectId
   - severity: string
   - message: string
   - is_active: boolean
   - created_at: datetime
"""

from app.db.mongo import industries_col, regions_col

def generate_mongo_query(question: str):
    # Fetch dynamic context from DB
    try:
        regions = list(regions_col.find({}, {"name": 1, "state": 1}))
        industries = list(industries_col.find({}, {"name": 1}))
        
        # Format for LLM context
        regions_list = [{"id": str(r["_id"]), "name": r["name"]} for r in regions]
        industries_list = [{"id": str(i["_id"]), "name": i["name"]} for i in industries]
    except Exception as e:
        print(f"Error fetching dynamic context: {e}")
        regions_list = []
        industries_list = []

    prompt = f"""
You are a MongoDB expert specializing in environmental sensor data.
Your task is to generate one or more MongoDB queries to fetch the necessary data to answer the user's question.

{SCHEMA_CONTEXT}

Available Context:
Regions: {json.dumps(regions_list, indent=2)}
Industries: {json.dumps(industries_list, indent=2)}

Rules:
1. Return a JSON object with "queries", "reasoning_tasks", and "industry_mapping".
2. Queries must include "collection", "type", and "query".
3. Use {{"$oid": "..."}} for all IDs.
4. If a question involves a Region (e.g., "Chhattisgarh"):
   - Find the region's ID in REGIONS_LIST.
   - Generate a query for 'industries' filtering by that region_id: {{"region_id": {{"$oid": "..."}}}}.
   - Generate a query for 'regions' filtering by that ID to get limits and metadata.
   - If data like forecasts or reports is needed, also generate a query for those collections (e.g., 'forecasts' or 'monitoringreports').
5. If the industry or region name is mentioned:
   - If it is in the provided list, use the corresponding ObjectId with {{"$oid": "..."}}.
   - If it is NOT in the list (e.g., "Raipur Steel Corp"), generate a regex search query: {{"name": {{"$regex": "...", "$options": "i"}}}}.
6. Multi-Collection Fetching:
   - For questions like "worst forecasts in Chhattisgarh", you need: 'industries' (filtered by region_id), 'regions' (filtered by ID), and 'forecasts' (all or latest).
   - Reasoning engine will perform the final filter and ranking.
7. For compliance checks, fetch 'monitoringreports', 'industries', and 'regions' (for limits).

Return ONLY a valid JSON object matching this schema:
{{
  "queries": [
    {{
      "collection": "collection_name",
      "type": "find" | "aggregate",
      "query": [...] or {{...}},
      "sort": {{...}},
      "limit": 10
    }}
  ],
  "reasoning_tasks": ["What the final LLM should calculate or focus on with this data"],
  "industry_mapping": {{"id_string": "Industry Name"}}
}}

Question: {question}
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Remove markdown code blocks if present
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\n', '', text)
            text = re.sub(r'\n```$', '', text)
        
        # Try to find the JSON object
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            json_str = match.group()
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as je:
                # If extraction failed, try a deeper search for the last }
                last_brace = json_str.rfind('}')
                if last_brace != -1:
                    try:
                        return json.loads(json_str[:last_brace+1])
                    except:
                        pass
                print(f"JSON Decode Error: {je} | Raw text: {text}")
                raise je
        else:
            print(f"No JSON found in response: {text}")
            return {"queries": [], "reasoning_tasks": []}
            
    except Exception as e:
        print(f"Error generating query: {e}")
        return {"queries": [], "reasoning_tasks": [], "error": str(e)}
