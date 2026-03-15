# Pollution Chatbot (Industrial Compliance Copilot)

This chatbot is integrated into the **Officer** and **Super Admin** dashboards in PrithviNet. Use the **Chatbot** item in the sidebar to open it.

## How to run the chatbot backend

The frontend calls the chatbot API at **http://localhost:8000**. You need to run this backend separately.

### 1. Where

Open a terminal and go to the chatbot backend folder:

```bash
cd "pollution chatbot/backend"
```

(From the repo root: `prithvinet/prithvinet`.)

### 2. Setup (first time)

Create a virtual environment and install dependencies:

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

pip install -r requirements.txt
```

### 3. Environment

Ensure the backend has a `.env` file in `pollution chatbot/backend/` with:

- **MONGO_URI** – MongoDB connection string (same DB as PrithviNet, e.g. your Atlas URI).
- **GEMINI_API_KEY** – Google Gemini API key for the LLM.

The existing `.env` in that folder may already have these; fix `GEMINI_API_KEY` if it’s a placeholder.

### 4. Run

From `pollution chatbot/backend` (with `venv` activated):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see something like:

```
Uvicorn running on http://0.0.0.0:8000
```

### 5. Use it in the app

1. Start the **main app** (e.g. `npm run dev` in `frontend`).
2. Keep the **chatbot backend** running on port 8000.
3. Log in as **Officer** or **Super Admin**.
4. Click **Chatbot** in the sidebar and send messages.

If the backend is not running, the chat page will show a connection error and remind you to start the server on port 8000.
