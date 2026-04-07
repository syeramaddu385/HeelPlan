"""
constraints.py — Unified constraint/preference model for schedule generation.

Supports both hard constraints (must be enforced) and soft preferences (should be respected).
"""

from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List


class ConstraintType(str, Enum):
    """Type of constraint or preference."""
    EARLIEST_START = "earliest_start"
    LATEST_END = "latest_end"
    DAYS_OFF = "days_off"
    BLOCKED_TIME = "blocked_time"
    RECURRING_ACTIVITY = "recurring_activity"
    SOFT_PREFERENCE = "soft_preference"


class RecurrenceType(str, Enum):
    """How often a constraint recurs."""
    ONCE = "once"
    WEEKLY = "weekly"
    CUSTOM = "custom"


class TimeRange(BaseModel):
    """Represents a start and end time in minutes from midnight."""
    start_min: int  # 0-1440
    end_min: int    # 0-1440

    class Config:
        json_schema_extra = {
            "example": {"start_min": 480, "end_min": 600}  # 8 AM - 10 AM
        }


class Constraint(BaseModel):
    """Base model for a scheduling constraint or preference."""
    id: str = Field(default_factory=lambda: datetime.now().isoformat())
    title: str
    description: Optional[str] = None
    constraint_type: ConstraintType
    
    # Hard vs soft
    is_hard_constraint: bool = True
    priority: int = 5  # 1-10, higher = more important
    
    # Timing
    recurrence_type: RecurrenceType = RecurrenceType.ONCE
    days_of_week: Optional[List[str]] = None  # ["M", "T", "W", "H", "F"]
    specific_date: Optional[str] = None  # ISO format date for one-time exceptions
    
    # Time window constraints
    time_range: Optional[TimeRange] = None
    earliest_start: Optional[int] = None  # minutes from midnight
    latest_end: Optional[int] = None      # minutes from midnight
    
    # Metadata
    source: str = "user"  # "user", "chatbot", "manual"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    active: bool = True

    class Config:
        json_schema_extra = {
            "example": {
                "id": "lunch-2026-04-06",
                "title": "Lunch block",
                "description": "Block lunch from 12 PM to 1 PM every weekday",
                "constraint_type": "blocked_time",
                "is_hard_constraint": True,
                "priority": 8,
                "recurrence_type": "weekly",
                "days_of_week": ["M", "T", "W", "H", "F"],
                "time_range": {"start_min": 720, "end_min": 780},
                "source": "chatbot",
                "created_at": "2026-04-06T10:00:00",
                "updated_at": "2026-04-06T10:00:00",
                "active": True
            }
        }


class ConstraintCollection(BaseModel):
    """All active constraints for a user."""
    constraints: List[Constraint] = Field(default_factory=list)
    
    def get_active(self) -> List[Constraint]:
        """Return only active constraints."""
        return [c for c in self.constraints if c.active]
    
    def find_by_id(self, constraint_id: str) -> Optional[Constraint]:
        """Find constraint by ID."""
        for c in self.constraints:
            if c.id == constraint_id:
                return c
        return None
    
    def get_by_type(self, constraint_type: ConstraintType) -> List[Constraint]:
        """Get all constraints of a specific type."""
        return [c for c in self.constraints if c.constraint_type == constraint_type and c.active]


class InterpretationResult(BaseModel):
    """Result from LLM interpretation of user message."""
    intent: str  # "create", "update", "delete", "clarify", "list"
    target_type: Optional[ConstraintType] = None
    constraints: List[Constraint] = Field(default_factory=list)
    
    # Human-readable output
    summary: str
    confirmation: bool = True
    
    # If clarification needed
    clarification_question: Optional[str] = None
    confidence: float = 1.0  # 0.0-1.0
    
    # For updates/deletes
    target_ids: Optional[List[str]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "intent": "create",
                "target_type": "blocked_time",
                "constraints": [{
                    "id": "lunch-2026-04-06",
                    "title": "Lunch block",
                    "constraint_type": "blocked_time",
                    "is_hard_constraint": True,
                    "priority": 8,
                    "recurrence_type": "weekly",
                    "days_of_week": ["M", "T", "W", "H", "F"],
                    "time_range": {"start_min": 720, "end_min": 780},
                    "source": "chatbot"
                }],
                "summary": "Created lunch block from 12 PM to 1 PM on weekdays",
                "confirmation": True,
                "confidence": 0.95
            }
        }
