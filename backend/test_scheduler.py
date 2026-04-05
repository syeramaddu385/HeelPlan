#!/usr/bin/env python
"""Quick test of scheduler logic."""
import sys
sys.path.insert(0, '/Users/manasvellaturi/Documents/HeelPlan/HeelPlan/backend')

from app.scheduler import generate_schedules, SectionInfo

# Simulate some test sections
sections_by_course = {
    "COMP 210": [
        SectionInfo("COMP 210", "001", "MWF 9:00-10:00", "MWF", 540, 600, "Prof A", 4.5),
        SectionInfo("COMP 210", "002", "MWF 10:00-11:00", "MWF", 600, 660, "Prof B", 3.5),
    ],
    "MATH 347": [
        SectionInfo("MATH 347", "001", "TTh 9:00-10:00", "TTh", 540, 600, "Prof C", 4.0),
        SectionInfo("MATH 347", "002", "TTh 11:00-12:00", "TTh", 660, 720, "Prof D", 3.0),
    ],
}

preferences = {"avoid_before": 480, "avoid_after": 1140, "days_off": []}

result = generate_schedules(sections_by_course, preferences, top_n=5)
print(f"\n\nGot {len(result)} schedules:")
for i, sched in enumerate(result):
    print(f"\nSchedule {i+1} (score {sched['score']}):")
    for sec in sched['sections']:
        print(f"  {sec['course']} {sec['section']}: {sec['instructor']}")
