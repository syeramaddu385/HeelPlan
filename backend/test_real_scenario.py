#!/usr/bin/env python3
"""Test with the actual courses from the screenshot."""
import sys
sys.path.insert(0, '/Users/manasvellaturi/Documents/HeelPlan/HeelPlan/backend')

from app.db import SessionLocal
from app.models import courses, sections, professor_ratings
from app.scheduler import generate_schedules, SectionInfo
from sqlalchemy import func

db = SessionLocal()

# Recreate what the API does
req_courses = ["COMP 210", "MATH 347", "STOR 435", "AAAD 362", "IDST 124I"]
preferences = {"avoid_before": 480, "avoid_after": 1140, "days_off": []}

sections_by_course = {}

for course_key in req_courses:
    course_normalized = course_key.strip().lower().replace(" ", "")
    course_row = db.query(courses).filter(courses.normalized_course_key == course_normalized).first()
    
    if not course_row:
        print(f"ERROR: Course '{course_key}' not found!")
        continue
    
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
    
    secs_list = [
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
    
    print(f"\n{course_key}: {len(secs_list)} sections")
    for s in secs_list:
        print(f"  {s.section}: {s.instructor} - {s.schedule} - quality={s.avg_quality}")
    
    sections_by_course[course_row.course_key] = secs_list

print("\n" + "="*60)
print(f"Generating schedules with {len(sections_by_course)} courses...")
schedules = generate_schedules(sections_by_course, preferences, top_n=5)

print(f"\nGot {len(schedules)} schedules:")
for i, sched in enumerate(schedules):
    print(f"\nSchedule {i+1} (score {sched['score']}):")
    for sec in sched['sections']:
        print(f"  {sec['course']} {sec['section']}: {sec['instructor']} - {sec['schedule']}")

db.close()
