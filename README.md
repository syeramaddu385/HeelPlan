# HeelPlan

A schedule-building tool for UNC Chapel Hill students. Input your courses and time preferences, get back conflict-free schedules ranked by professor quality.

🔗 **[Live Demo](#)** ← _replace with deployed URL_

## Features

- Search any UNC Spring 2026 course by subject or number
- Set earliest start time, latest end time, and days off
- Backtracking algorithm finds every conflict-free combination and scores by professor rating (60%) + time preferences (40%)
- Visual weekly calendar grid per schedule with RateMyProfessors data per instructor

## Stack

- **Backend** — FastAPI, SQLAlchemy, PostgreSQL
- **Frontend** — React, Vite
- **Data** — UNC course sections + RateMyProfessors aggregates

## Local development

**Prerequisites:** Python 3.12+, Node 18+, Docker

```bash
# Start PostgreSQL
docker compose up -d

# Backend setup
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your Gemini API key from https://aistudio.google.com/app/apikey

alembic upgrade head
python data/load_data.py
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```
