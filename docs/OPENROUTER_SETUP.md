# OpenRouter setup for SetSaathi

SetSaathi's AI Coach calls OpenRouter from the backend.

## SetSaathi AI Coach

Edit the Git-ignored `backend/.env` file and add your key:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-YOUR-REAL-KEY
OPENROUTER_MODEL=openrouter/free
SITE_URL=http://127.0.0.1:5173
PORT=8007
DATABASE_PATH=setsaathi.db
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

`OPENROUTER_API_KEY` is the only missing value. Do not put it in frontend code or commit `backend/.env`. Restart the API after adding or changing the key. From the project root, start it with `python backend/run.py`; then run the website with `npm run dev`.

The browser sends questions to SetSaathi's API. The API retrieves relevant exercise instructions and the member's saved plan and progress, then sends that limited context to OpenRouter's chat completions endpoint. Successful answers are cached in the database per member, model, question, and workout state. Repeated questions with unchanged state do not make another OpenRouter request. Without a key, the coach gives a local library or plan answer. OpenRouter failures also fall back locally but are not cached.

`SITE_URL` sets the optional OpenRouter site header. `PORT` is used by `backend/run.py`. `DATABASE_PATH` is relative to `backend/` unless absolute. `CORS_ORIGINS` is a comma-separated allowlist for the web app. `DATABASE_URL` can still override `DATABASE_PATH` for tests or other databases.

OpenRouter's `openrouter/free` routes to a free model, subject to free-tier rate limits. Use the [OpenRouter free model documentation](https://openrouter.ai/collections/free-models) to check current limits.
