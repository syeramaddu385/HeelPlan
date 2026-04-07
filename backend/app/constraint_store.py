"""
constraint_store.py — In-memory constraint store with JSON file persistence.

Manages all active constraints for schedule generation.
"""

import json
import os
from typing import List, Optional
from pathlib import Path
from app.constraints import Constraint, ConstraintCollection, ConstraintType


class ConstraintStore:
    """
    Thread-safe constraint store with optional file persistence.
    
    Supports:
    - In-memory operations
    - JSON file persistence
    - CRUD operations on constraints
    - Filtering and querying
    """
    
    def __init__(self, persist_path: Optional[str] = None):
        """
        Initialize the constraint store.
        
        Args:
            persist_path: Path to JSON file for persistence. 
                         If None, uses in-memory only.
        """
        self.persist_path = persist_path or os.getenv("CONSTRAINTS_DB", ".constraints.json")
        self.collection = ConstraintCollection()
        self._load()
    
    def _load(self) -> None:
        """Load constraints from persistent storage if it exists."""
        if os.path.exists(self.persist_path):
            try:
                with open(self.persist_path, 'r') as f:
                    data = json.load(f)
                    self.collection = ConstraintCollection(
                        constraints=[Constraint(**c) for c in data.get('constraints', [])]
                    )
            except Exception as e:
                print(f"Warning: Failed to load constraints from {self.persist_path}: {e}")
    
    def _save(self) -> None:
        """Save constraints to persistent storage."""
        try:
            os.makedirs(os.path.dirname(self.persist_path) or '.', exist_ok=True)
            with open(self.persist_path, 'w') as f:
                data = {'constraints': [c.model_dump() for c in self.collection.constraints]}
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save constraints to {self.persist_path}: {e}")
    
    def add(self, constraint: Constraint) -> Constraint:
        """Add a constraint and persist."""
        self.collection.constraints.append(constraint)
        self._save()
        return constraint
    
    def update(self, constraint_id: str, updates: dict) -> Optional[Constraint]:
        """Update a constraint by ID."""
        existing = self.collection.find_by_id(constraint_id)
        if not existing:
            return None
        
        # Update fields
        for key, value in updates.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        
        existing.updated_at = __import__('datetime').datetime.now().isoformat()
        self._save()
        return existing
    
    def delete(self, constraint_id: str) -> bool:
        """Soft-delete a constraint by marking as inactive."""
        existing = self.collection.find_by_id(constraint_id)
        if not existing:
            return False
        
        existing.active = False
        existing.updated_at = __import__('datetime').datetime.now().isoformat()
        self._save()
        return True
    
    def hard_delete(self, constraint_id: str) -> bool:
        """Permanently delete a constraint."""
        existing = self.collection.find_by_id(constraint_id)
        if not existing:
            return False
        
        self.collection.constraints = [c for c in self.collection.constraints if c.id != constraint_id]
        self._save()
        return True
    
    def get_by_id(self, constraint_id: str) -> Optional[Constraint]:
        """Get a constraint by ID."""
        return self.collection.find_by_id(constraint_id)
    
    def get_all_active(self) -> List[Constraint]:
        """Get all active constraints."""
        return self.collection.get_active()
    
    def get_by_type(self, constraint_type: ConstraintType) -> List[Constraint]:
        """Get all constraints of a specific type."""
        return self.collection.get_by_type(constraint_type)
    
    def find_conflicts(self, new_constraint: Constraint) -> List[Constraint]:
        """
        Find existing constraints that might conflict with a new one.
        
        Useful for detecting duplicate lunch blocks, conflicting time preferences, etc.
        """
        conflicts = []
        
        for existing in self.collection.get_active():
            # Same type and overlapping days
            if existing.constraint_type == new_constraint.constraint_type:
                # Check if days overlap
                if (existing.days_of_week and new_constraint.days_of_week and 
                    set(existing.days_of_week) & set(new_constraint.days_of_week)):
                    # Check if times overlap
                    if (existing.time_range and new_constraint.time_range and
                        existing.time_range.start_min < new_constraint.time_range.end_min and
                        new_constraint.time_range.start_min < existing.time_range.end_min):
                        conflicts.append(existing)
        
        return conflicts
    
    def to_preferences_dict(self) -> dict:
        """
        Convert active constraints to the format expected by the scheduler.
        
        This bridges the new constraint system with the existing scheduler.
        """
        prefs = {
            "avoid_before": None,
            "avoid_after": None,
            "days_off": [],
            "blocked_times": [],
            "hard_constraints": [],
            "soft_preferences": []
        }
        
        for constraint in self.get_all_active():
            if constraint.constraint_type == ConstraintType.EARLIEST_START and constraint.earliest_start:
                prefs["avoid_before"] = constraint.earliest_start
            elif constraint.constraint_type == ConstraintType.LATEST_END and constraint.latest_end:
                prefs["avoid_after"] = constraint.latest_end
            elif constraint.constraint_type == ConstraintType.DAYS_OFF and constraint.days_of_week:
                prefs["days_off"].extend(constraint.days_of_week)
            elif constraint.constraint_type == ConstraintType.BLOCKED_TIME:
                prefs["blocked_times"].append({
                    "name": constraint.title,
                    "days": constraint.days_of_week or ["M", "T", "W", "H", "F"],
                    "start_min": constraint.time_range.start_min if constraint.time_range else None,
                    "end_min": constraint.time_range.end_min if constraint.time_range else None,
                })
            
            # Collect constraints by hard/soft
            constraint_data = {
                "id": constraint.id,
                "title": constraint.title,
                "description": constraint.description,
                "type": constraint.constraint_type,
                "priority": constraint.priority,
                "time_range": constraint.time_range.model_dump() if constraint.time_range else None,
                "days": constraint.days_of_week,
            }
            
            if constraint.is_hard_constraint:
                prefs["hard_constraints"].append(constraint_data)
            else:
                prefs["soft_preferences"].append(constraint_data)
        
        # Deduplicate days_off
        prefs["days_off"] = list(set(prefs["days_off"]))
        
        return prefs
    
    def clear_all(self) -> None:
        """Clear all constraints (useful for testing)."""
        self.collection.constraints = []
        self._save()


# Global store instance
_store: Optional[ConstraintStore] = None


def get_store() -> ConstraintStore:
    """Get or initialize the global constraint store."""
    global _store
    if _store is None:
        _store = ConstraintStore()
    return _store


def reset_store() -> None:
    """Reset the global store (useful for testing)."""
    global _store
    _store = None
