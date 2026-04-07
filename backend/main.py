from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.db import SessionLocal
from app.models import courses, sections, professor_ratings
from app.scheduler import generate_schedules, SectionInfo
from app.interpreter import ConstraintInterpreter
from app.constraint_store import get_store
from app.constraints import InterpretationResult


app = FastAPI()

import os
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    """Yield a database session and close it when the request is done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/courses")
def get_courses(q: str = Query("", description="Search like 'comp' or '210'"), db: Session = Depends(get_db)):
    q_normalized = q.strip().lower().replace(" ", "")

    query = db.query(courses.course_key)

    if q_normalized:
        query = query.filter(courses.normalized_course_key.contains(q_normalized))

    results = query.order_by(courses.course_key).limit(50).all()
    return {"courses": [row.course_key for row in results]}


@app.get("/sections")
def get_sections(course: str = Query(..., description="Course key like 'COMP 210'"), db: Session = Depends(get_db)):
    course_normalized = course.strip().lower().replace(" ", "")

    course_row = db.query(courses).filter(courses.normalized_course_key == course_normalized).first()
    if not course_row:
        raise HTTPException(status_code=404, detail=f"Course '{course}' not found")

    rows = (
        db.query(sections, professor_ratings)
        .outerjoin(
            professor_ratings,
            (sections.name_key == professor_ratings.name_key)
            & (professor_ratings.subject == course_row.subject)
            & (professor_ratings.catalog_number == course_row.catalog_number),
        )
        .filter(sections.course_id == course_row.id)
        .all()
    )

    out = []
    for section, rating in rows:
        out.append({
            "course": course_row.course_key,
            "section": section.class_section,
            "schedule": section.schedule_raw,
            "days": section.days,
            "start_min": section.start_min,
            "end_min": section.end_min,
            "instructor": section.instructor_name,
            "avg_quality": rating.avg_quality if rating else None,
            "avg_difficulty": rating.avg_difficulty if rating else None,
            "would_take_again_pct": rating.would_take_again_pct if rating else None,
        })

    return {"sections": out}


@app.get("/professors/{instructor_name}")
def get_professor(instructor_name: str, db: Session = Depends(get_db)):
    rows = (
        db.query(professor_ratings)
        .filter(func.lower(professor_ratings.instructor_name) == instructor_name.strip().lower())
        .all()
    )

    if not rows:
        raise HTTPException(status_code=404, detail=f"Professor '{instructor_name}' not found")

    # Average across all courses they teach
    avg_quality = sum(r.avg_quality for r in rows if r.avg_quality) / len(rows)
    avg_difficulty = sum(r.avg_difficulty for r in rows if r.avg_difficulty) / len(rows)

    return {
        "instructor_name": rows[0].instructor_name,
        "courses_taught": [f"{r.subject} {r.catalog_number}" for r in rows],
        "avg_quality": round(avg_quality, 2),
        "avg_difficulty": round(avg_difficulty, 2),
        "num_ratings": rows[0].num_ratings,
        "would_take_again_pct": rows[0].would_take_again_pct,
    }


class ScheduleRequest(BaseModel):
    courses: list[str]   # e.g. ["COMP 210", "COMP 301", "MATH 383"]
    preferences: dict = {}  # e.g. {"avoid_before": 540, "avoid_after": 1020, "days_off": ["F"]}


@app.post("/schedule")
def build_schedule(req: ScheduleRequest, db: Session = Depends(get_db)):
    if not req.courses:
        raise HTTPException(status_code=400, detail="Provide at least one course.")

    sections_by_course: dict[str, list[SectionInfo]] = {}

    for course_key in req.courses:
        course_normalized = course_key.strip().lower().replace(" ", "")

        course_row = db.query(courses).filter(courses.normalized_course_key == course_normalized).first()
        if not course_row:
            raise HTTPException(status_code=404, detail=f"Course '{course_key}' not found.")

        rows = (
            db.query(sections, professor_ratings)
            .outerjoin(
                professor_ratings,
                (sections.name_key == professor_ratings.name_key)
                & (professor_ratings.subject == course_row.subject)
                & (professor_ratings.catalog_number == course_row.catalog_number),
            )
            .filter(sections.course_id == course_row.id)
            .all()
        )

        sections_by_course[course_row.course_key] = [
            SectionInfo(
                course=course_row.course_key,
                section=sec.class_section,
                schedule=sec.schedule_raw,
                days=sec.days,
                start_min=sec.start_min,
                end_min=sec.end_min,
                instructor=sec.instructor_name,
                avg_quality=rat.avg_quality if rat else None,
            )
            for sec, rat in rows
        ]

    schedules = generate_schedules(sections_by_course, req.preferences)
    return {"schedules": schedules}


# ────────────────────────────────────────────────────────────
# CHATBOT & CONSTRAINTS API
# ────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    interpretation: dict
    assistant_message: str
    constraints: list = []
    success: bool


@app.post("/chat")
def chat(msg: ChatMessage):
    """
    Process a natural language scheduling request via the chatbot.
    
    1. Interpret the message with Gemini
    2. Update constraint store
    3. Return confirmation and active constraints
    """
    try:
        interpreter = ConstraintInterpreter()
        result: InterpretationResult = interpreter.interpret(msg.message)
        
        store = get_store()
        
        # Process based on intent
        if result.intent == "create":
            for constraint in result.constraints:
                # Check for conflicts
                conflicts = store.find_conflicts(constraint)
                if conflicts:
                    # For now, overwrite if same type
                    for conflict in conflicts:
                        store.delete(conflict.id)
                store.add(constraint)
        
        elif result.intent == "delete" and result.target_ids:
            for target_id in result.target_ids:
                store.delete(target_id)
        
        elif result.intent == "update" and result.target_ids:
            for target_id in result.target_ids:
                if result.constraints:
                    store.update(target_id, result.constraints[0].model_dump())
        
        # Get all active constraints
        active_constraints = [c.model_dump() for c in store.get_all_active()]
        
        return ChatResponse(
            interpretation=result.model_dump(),
            assistant_message=result.summary,
            constraints=active_constraints,
            success=result.confirmation
        )
    
    except Exception as e:
        return ChatResponse(
            interpretation={},
            assistant_message=f"Error processing request: {str(e)}",
            constraints=[],
            success=False
        )


@app.get("/constraints")
def get_constraints():
    """Get all active constraints."""
    store = get_store()
    active = [c.model_dump() for c in store.get_all_active()]
    return {"constraints": active}


@app.delete("/constraints/{constraint_id}")
def delete_constraint(constraint_id: str):
    """Delete a constraint by ID."""
    store = get_store()
    success = store.delete(constraint_id)
    return {"success": success, "message": "Constraint deleted" if success else "Constraint not found"}


@app.post("/constraints/clear")
def clear_constraints():
    """Clear all constraints (for testing)."""
    store = get_store()
    store.clear_all()
    return {"message": "All constraints cleared"}
