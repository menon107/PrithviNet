from bson import ObjectId
from app.db.mongo import db
import datetime

def _convert_oids(query):
    """Recursively convert {"$oid": "..."} to ObjectId in a query."""
    if isinstance(query, dict):
        if "$oid" in query:
            try:
                return ObjectId(query["$oid"])
            except Exception:
                return query["$oid"]
        return {k: _convert_oids(v) for k, v in query.items()}
    elif isinstance(query, list):
        return [_convert_oids(v) for v in query]
    return query

def execute_query(query_spec):
    collection_name = query_spec.get("collection")
    query_type = query_spec.get("type", "find")
    query = _convert_oids(query_spec.get("query", {}))
    limit = query_spec.get("limit")
    sort = query_spec.get("sort")

    try:
        col = db[collection_name]
        
        if query_type == "aggregate":
            cursor = col.aggregate(query)
            # MongoDB aggregation doesn't have a direct sort/limit argument like find,
            # they should be stages in the pipeline. But we can add them if specified separately for convenience.
            results = list(cursor)
        else: # find
            cursor = col.find(query)
            if sort:
                # Convert sort dict to list of tuples if needed
                sort_list = [(k, v) for k, v in sort.items()]
                cursor = cursor.sort(sort_list)
            if limit:
                cursor = cursor.limit(limit)
            results = list(cursor)
            
        return results
    except Exception as e:
        print(f"Error executing query: {e}")
        return []

def execute_multiple_queries(queries_spec):
    all_results = {}
    for spec in queries_spec:
        results = execute_query(spec)
        coll = spec.get("collection")
        if coll not in all_results:
            all_results[coll] = []
        all_results[coll].extend(results)
    return all_results
