"""
scheduler.py — Constraint Satisfaction Problem (CSP) schedule builder.

How it works:
  1. For each course the user picked, we have a list of possible sections.
  2. We try every combination (one section per course) using backtracking:
     - Before adding a section, check it doesn't time-conflict with already chosen ones.
     - If it conflicts, skip it (prune that branch entirely).
  3. Every conflict-free combination is a valid schedule. Score it and keep the top 5.

Scoring:
  - 60% professor quality (avg_quality on a 0–5 scale, normalised to 0–10)
  - 40% time preference (bonus when all sections fall inside the user's preferred window)
"""

from dataclasses import dataclass, field


@dataclass
class SectionInfo:
    """Flat data bag passed into the algorithm — no ORM objects inside the scheduler."""
    course: str
    section: str
    schedule: str | None
    days: str | None
    start_min: int | None
    end_min: int | None
    instructor: str | None
    avg_quality: float | None


def _days_overlap(days_a: str, days_b: str) -> bool:
    """Return True if the two day strings share at least one day character."""
    return bool(set(days_a) & set(days_b))


def _times_overlap(s1: SectionInfo, s2: SectionInfo) -> bool:
    """Return True if two sections have a time conflict."""
    # Sections with no schedule (TBA) never conflict.
    if not s1.days or not s2.days:
        return False
    if s1.start_min is None or s2.start_min is None:
        return False

    if not _days_overlap(s1.days, s2.days):
        return False

    # Standard interval overlap: A starts before B ends, and B starts before A ends.
    return s1.start_min < s2.end_min and s2.start_min < s1.end_min


def _no_conflict(candidate: SectionInfo, chosen: list[SectionInfo], blocked_times: list = None) -> bool:
    """
    Check if candidate section conflicts with chosen sections or blocked times.
    
    Args:
        candidate: Section being considered
        chosen: Already-chosen sections
        blocked_times: List of blocked time blocks (dicts with days, start_min, end_min)
    """
    # Check against other sections
    for c in chosen:
        if _times_overlap(candidate, c):
            return False
    
    # Check against blocked times (hard constraints)
    if blocked_times and candidate.days and candidate.start_min is not None:
        for block in blocked_times:
            block_days = set(block.get("days", []))
            if set(candidate.days) & block_days:
                # Times overlap
                block_start = block.get("start_min")
                block_end = block.get("end_min")
                if (block_start is not None and block_end is not None and
                    candidate.start_min < block_end and block_start < candidate.end_min):
                    return False
    
    return True


def _compute_score(chosen: list[SectionInfo], preferences: dict) -> float:
    # --- Quality score (0–10) ---
    DEFAULT_QUALITY = 2.5  # neutral score for unrated instructors
    qualities = [s.avg_quality if s.avg_quality is not None else DEFAULT_QUALITY for s in chosen]
    quality_score = (sum(qualities) / len(qualities)) * 2  # scale 0-5 → 0-10

    # --- Time preference score (0–10) ---
    avoid_before = preferences.get("avoid_before")  # minutes from midnight, e.g. 540 = 9 AM
    avoid_after = preferences.get("avoid_after")    # e.g. 1020 = 5 PM
    days_off = set(preferences.get("days_off") or [])
    soft_preferences = preferences.get("soft_preferences", [])

    time_score = 10.0
    for s in chosen:
        if s.start_min is None:
            continue
        if avoid_before and s.start_min < avoid_before:
            time_score -= 2.0
        if avoid_after and s.end_min and s.end_min > avoid_after:
            time_score -= 2.0
        if days_off and s.days and set(s.days) & days_off:
            time_score -= 3.0
        
        # Apply soft preference penalties
        for pref in soft_preferences:
            pref_days = set(pref.get("days", []))
            if s.days and set(s.days) & pref_days:
                pref_start = pref.get("start_min")
                pref_end = pref.get("end_min")
                if (pref_start is not None and pref_end is not None and
                    s.start_min < pref_end and pref_start < s.end_min):
                    time_score -= 1.0

    time_score = max(time_score, 0.0)

    return round(0.6 * quality_score + 0.4 * time_score, 2)


def _backtrack(
    course_keys: list[str],
    index: int,
    chosen: list[SectionInfo],
    sections_by_course: dict[str, list[SectionInfo]],
    preferences: dict,
    unique_schedules: dict,
    limit: int,
) -> None:
    if len(unique_schedules) >= limit:
        return

    if index == len(course_keys):
        score = _compute_score(chosen, preferences)
        key = tuple(sorted((s.course, s.section) for s in chosen))
        if key not in unique_schedules:
            unique_schedules[key] = (score, list(chosen))
        return

    blocked_times = preferences.get("blocked_times", [])
    
    for section in sections_by_course[course_keys[index]]:
        if _no_conflict(section, chosen, blocked_times):
            chosen.append(section)
            _backtrack(course_keys, index + 1, chosen, sections_by_course, preferences, unique_schedules, limit)
            chosen.pop()


def generate_schedules(
    sections_by_course: dict[str, list[SectionInfo]],
    preferences: dict,
    top_n: int = 5,
) -> list[dict]:
    """
    Entry point. Returns up to top_n scstill hedules ranked by score.

    sections_by_course: {"COMP 210": [SectionInfo, ...], "MATH 381": [...]}
    preferences: {"avoid_before": 540, "avoid_after": 1020, "days_off": ["F"]}
    """
    course_keys = list(sections_by_course.keys())

    # Collect far more than top_n so we have good candidates to rank.
    # Cap total results to avoid exponential blowup on large inputs.
    raw_limit = max(top_n * 500, 5000)

    unique_schedules: dict[tuple, tuple[float, list[SectionInfo]]] = {}
    _backtrack(course_keys, 0, [], sections_by_course, preferences, unique_schedules, raw_limit)

    # Convert to list and sort by score descending
    results = list(unique_schedules.values())
    results.sort(key=lambda x: x[0], reverse=True)

    # Return only the actual unique schedules (up to top_n)
    actual_count = min(len(results), top_n)
    return [
        {
            "score": score,
            "sections": [
                {
                    "course": s.course,
                    "section": s.section,
                    "schedule": s.schedule,
                    "days": s.days,
                    "start_min": s.start_min,
                    "end_min": s.end_min,
                    "instructor": s.instructor,
                    "avg_quality": s.avg_quality,
                }
                for s in chosen
            ],
        }
        for score, chosen in results[:actual_count]
    ]
