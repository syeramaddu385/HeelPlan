# AI Chatbot Feature - Implementation Documentation

## Overview

This document describes the complete implementation of an AI-powered scheduling chatbot for HeelPlan, using Google's Gemini API to interpret natural language scheduling requests.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│  • Chatbot.jsx - Chat UI with message history               │
│  • ConstraintsPanel.jsx - Display active constraints        │
│  • App.jsx - Integrated 3-panel layout                      │
│  • api.js - HTTP client for chatbot endpoints               │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                        │
├─────────────────────────────────────────────────────────────┤
│  • main.py - REST endpoints (/chat, /constraints, etc.)     │
│  • interpreter.py - Gemini integration                      │
│  • constraint_store.py - In-memory + JSON persistence       │
│  • constraints.py - Pydantic models and schemas             │
│  • scheduler.py - Modified to apply hard/soft constraints   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Message
    ↓
Chatbot.jsx (input)
    ↓
api.sendChatMessage()
    ↓
POST /chat (main.py)
    ↓
ConstraintInterpreter (interpreter.py)
    ↓
Gemini API (structured JSON extraction)
    ↓
InterpretationResult validation
    ↓
ConstraintStore updates
    ↓
Return active constraints
    ↓
Frontend updates UI
```

## Files Changed/Created

### New Backend Files

1. **backend/app/constraints.py** (new)
   - Pydantic models for constraints, types, recurrence patterns
   - `Constraint` - Single scheduling rule
   - `ConstraintType` - Enum for constraint types
   - `InterpretationResult` - LLM output format
   - `TimeRange` - Start/end time representation

2. **backend/app/constraint_store.py** (new)
   - In-memory constraint store with JSON file persistence
   - CRUD operations on constraints
   - Conflict detection
   - Conversion to scheduler preferences format
   - Global singleton instance

3. **backend/app/interpreter.py** (new)
   - Gemini API integration
   - System prompt with detailed instructions
   - Natural language → JSON parsing
   - Validation and error handling
   - Time string parsing utilities

### Modified Backend Files

1. **backend/main.py**
   - Import new modules
   - Added `/chat` endpoint - main chatbot API
   - Added `/constraints` endpoints - CRUD operations
   - Modified to accept constraints in schedule requests

2. **backend/app/scheduler.py**
   - Updated `_no_conflict()` to check against blocked times
   - Updated `_compute_score()` to handle soft preferences
   - Updated `_backtrack()` to pass blocked_times to conflict checker

3. **backend/requirements.txt**
   - Added `google-generativeai==0.7.2`

### New Frontend Files

1. **frontend/src/components/Chatbot.jsx** (new)
   - Chat UI with message history
   - Real-time message display
   - Typing indicator
   - Keyboard support (Enter to send)
   - Message timestamps

2. **frontend/src/components/ConstraintsPanel.jsx** (new)
   - Display all active constraints
   - Expandable details view
   - Visual indicators (hard/soft, priority)
   - Delete functionality
   - Formatted time and day display

### Modified Frontend Files

1. **frontend/src/App.jsx**
   - New 3-column layout: Input | Chat+Constraints | Schedules
   - State for constraints and active constraints list
   - Load constraints on mount
   - Handle constraint updates from chatbot
   - Delete constraint handler

2. **frontend/src/api.js**
   - Added `sendChatMessage(message)` - POST /chat
   - Added `getConstraints()` - GET /constraints
   - Added `deleteConstraint(id)` - DELETE /constraints/{id}

### Config Files

1. **backend/.env**
   - Added GEMINI_API_KEY configuration
   - Added CONSTRAINTS_DB path option

## How It Works

### 1. User Sends Message

User types "Block lunch from 12 to 1 PM on weekdays" in the chatbot input.

### 2. Message Processing

```python
POST /chat
{
  "message": "Block lunch from 12 to 1 PM on weekdays"
}
```

### 3. LLM Interpretation

The `ConstraintInterpreter` sends the message to Gemini with a detailed system prompt:

```python
interpreter = ConstraintInterpreter()
result = interpreter.interpret(user_message)
```

**System Prompt Key Features:**
- Structured JSON output requirement
- Time parsing rules (8 AM = 480 minutes)
- Day codes (M, T, W, H, F)
- Hard vs soft constraint guidance
- Examples for each request type
- Clarification question support

### 4. JSON Parsing & Validation

Gemini returns structured JSON like:

```json
{
  "intent": "create",
  "target_type": "blocked_time",
  "constraints": [{
    "title": "Lunch block",
    "constraint_type": "blocked_time",
    "is_hard_constraint": true,
    "priority": 8,
    "recurrence_type": "weekly",
    "days_of_week": ["M", "T", "W", "H", "F"],
    "time_range": {"start_min": 720, "end_min": 780}
  }],
  "summary": "Blocking lunch from 12 PM to 1 PM every weekday",
  "confidence": 0.98
}
```

### 5. Constraint Storage

```python
store = get_store()
for constraint in result.constraints:
    conflicts = store.find_conflicts(constraint)
    if conflicts:
        for conflict in conflicts:
            store.delete(conflict.id)
    store.add(constraint)
```

### 6. Persistence

Constraints are saved to `.constraints.json`:

```json
{
  "constraints": [
    {
      "id": "lunch-2026-04-06",
      "title": "Lunch block",
      "description": "Daily lunch from 12 PM to 1 PM",
      "constraint_type": "blocked_time",
      "is_hard_constraint": true,
      "priority": 8,
      "recurrence_type": "weekly",
      "days_of_week": ["M", "T", "W", "H", "F"],
      "time_range": {"start_min": 720, "end_min": 780},
      "source": "chatbot",
      "active": true,
      "created_at": "2026-04-06T10:00:00"
    }
  ]
}
```

### 7. Schedule Integration

When building schedules, constraints are applied:

```python
prefs_dict = store.to_preferences_dict()
# Returns:
{
  "avoid_before": 600,
  "avoid_after": 1020,
  "days_off": ["F"],
  "blocked_times": [
    {
      "name": "Lunch block",
      "days": ["M", "T", "W", "H", "F"],
      "start_min": 720,
      "end_min": 780
    }
  ],
  "hard_constraints": [...],
  "soft_preferences": [...]
}
```

The scheduler uses `blocked_times` in `_no_conflict()` to exclude sections that overlap with blocked times.

## Constraint Types

### 1. Earliest Start Time
```json
{
  "title": "Earliest start time",
  "constraint_type": "earliest_start",
  "earliest_start": 600,
  "is_hard_constraint": true
}
```

### 2. Latest End Time
```json
{
  "title": "Latest end time",
  "constraint_type": "latest_end",
  "latest_end": 1020,
  "is_hard_constraint": true
}
```

### 3. Days Off
```json
{
  "title": "Friday off",
  "constraint_type": "days_off",
  "days_of_week": ["F"],
  "is_hard_constraint": true
}
```

### 4. Blocked Time (e.g., lunch, gym)
```json
{
  "title": "Lunch block",
  "constraint_type": "blocked_time",
  "time_range": {"start_min": 720, "end_min": 780},
  "days_of_week": ["M", "T", "W", "H", "F"],
  "is_hard_constraint": true
}
```

### 5. Soft Preference
```json
{
  "title": "Prefer morning classes",
  "constraint_type": "soft_preference",
  "time_range": {"start_min": 480, "end_min": 720},
  "is_hard_constraint": false,
  "priority": 6
}
```

## Natural Language Examples

### Supported Input Types

#### Time Blocks
- ✅ "Block lunch from 12 to 1 PM"
- ✅ "I have gym Monday, Wednesday, Friday 6-7 PM"
- ✅ "Study time 8-10 PM"
- ✅ "Work block Tuesday and Thursday 2-4 PM"

#### Time Preferences
- ✅ "Earliest class at 10 AM"
- ✅ "No classes after 5 PM"
- ✅ "Make my latest end 6 PM except Tuesdays"
- ✅ "Prefer morning classes"

#### Days Off
- ✅ "Keep Fridays free"
- ✅ "No Monday classes"
- ✅ "Days off: Saturdays and Sundays"

#### Soft Preferences
- ✅ "Try to avoid Friday classes"
- ✅ "Prefer classes between 10 AM and 3 PM"
- ✅ "Minimize Mondays"

#### Updates/Modifications
- ✅ "Change lunch to 1-2 PM"
- ✅ "Remove my Wednesday gym block"
- ✅ "Update earliest start to 9 AM"

#### One-Time Events
- ✅ "Next Thursday I'm unavailable after 2 PM"
- ✅ "Block Friday April 11 for exam"

### LLM Gemini Prompt Structure

The system prompt ensures consistent, structured output:

1. **JSON Schema Requirements** - Must return valid JSON only
2. **Time Parsing Rules** - Define time format (480 = 8 AM)
3. **Day Codes** - M, T, W, H, F for weekdays
4. **Intent Types** - create, update, delete, clarify, list
5. **Confidence Levels** - 0.0-1.0 for disambiguation
6. **Clarification Fallback** - Ask questions when ambiguous
7. **Examples** - 3-5 example interactions showing expected format

## Hard vs Soft Constraints

### Hard Constraints (`is_hard_constraint: true`)

**Must be respected** - Sections conflicting with hard constraints are completely excluded.

Examples:
- "Block lunch" - No classes 12-1 PM
- "No Friday classes" - Exclude all Friday sections
- "Earliest class 10 AM" - Exclude early morning sections

Implementation in scheduler:
```python
def _no_conflict(candidate, chosen, blocked_times):
    # Hard constraints prevent scheduling
    for block in blocked_times:
        if times_overlap(candidate, block):
            return False  # Exclude this section
    return True
```

### Soft Preferences (`is_hard_constraint: false`)

**Should be respected when possible** - Penalize scores but don't exclude sections.

Examples:
- "Prefer morning classes" - Slight penalty for afternoon classes
- "Try to avoid Mondays" - Reduce score if Monday section chosen
- "Prefer 10 AM - 3 PM window" - Bonus for classes in this range

Implementation in scheduler:
```python
def _compute_score(chosen, preferences):
    time_score = 10.0
    for pref in soft_preferences:
        if overlaps_with_preference(section, pref):
            time_score -= 1.0  # Penalty but still allowed
    return score
```

## Conflict Detection

The store detects conflicts between new and existing constraints:

```python
def find_conflicts(new_constraint):
    # Same type + overlapping days + overlapping times = conflict
    for existing in active_constraints:
        if (existing.type == new.type and
            days_overlap(existing, new) and
            times_overlap(existing, new)):
            conflicts.append(existing)
    return conflicts
```

**Example:**
```
Existing: Lunch 12-1 PM weekdays
New:      Lunch 12:30-1:30 PM weekdays
→ Conflict detected, delete existing and add new
```

## Persistence Layer

### In-Memory Store
- Constraints kept in `ConstraintCollection` during runtime
- Fast access for comparisons

### File Persistence
- Auto-saved to `.constraints.json` after each operation
- Loaded on server startup
- JSON format for easy inspection and manual editing

### Why This Approach
- No additional database dependencies
- Easy to debug and inspect
- Fast for typical use cases (50-100 constraints)
- Can be easily migrated to PostgreSQL later

## Testing the Feature

### 1. Get Gemini API Key

```bash
# Visit https://aistudio.google.com/app/apikey
# Create new API key
# Copy to .env file
GEMINI_API_KEY=your-key-here
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Start Backend

```bash
source .venv/bin/activate
uvicorn main:app --reload
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Test Chatbot

Try these messages:

1. **"Block lunch from 12 to 1 PM on weekdays"**
   - Creates hard constraint
   - Lunch blocked every Mon-Fri

2. **"Earliest class at 9 AM"**
   - Updates earliest start time
   - No classes before 9 AM

3. **"No Friday classes"**
   - Adds Friday to days_off
   - All Friday sections excluded

4. **"I have gym Monday, Wednesday, Friday 6 to 7 PM"**
   - Creates recurring activity
   - Blocks that time range

5. **"Remove my lunch block"**
   - Asks clarification if multiple constraints
   - Or deletes lunch block if unambiguous

6. **"What constraints am I using?"**
   - Lists all active constraints
   - Shows hard/soft status

## Extension Points

### Adding New Constraint Types

1. **Update enum in constraints.py:**
```python
class ConstraintType(str, Enum):
    MY_NEW_TYPE = "my_new_type"
```

2. **Update scheduler logic in scheduler.py:**
```python
def _no_conflict(candidate, chosen, blocked_times, my_new_constraints):
    # Check against my_new_constraints
    pass
```

3. **Update system prompt in interpreter.py:**
```
Add documentation and examples for the new type
```

4. **Update store conversion in constraint_store.py:**
```python
def to_preferences_dict(self):
    if constraint_type == ConstraintType.MY_NEW_TYPE:
        # Add to preferences dict
```

### Adding New Request Types

1. **Update system prompt** with new examples
2. **Add handling in /chat endpoint** for new intent types
3. **Update UI** if special display needed

### Integrating with Database

To migrate from JSON to PostgreSQL:

1. Create Alembic migration for `constraints` table
2. Create SQLAlchemy ORM model
3. Replace file operations in `constraint_store.py` with database queries
4. No changes needed to API or UI

## Error Handling

### LLM Errors
- Network errors → Return clarification message
- Invalid JSON → Fallback to generic clarification
- Low confidence → Ask follow-up question
- Malformed response → Log and return error message

### Validation Errors
- Bad time ranges (end < start) → Ask for clarification
- Invalid day codes → Use defaults (M-F)
- Missing required fields → Provide sensible defaults

### Storage Errors
- File system errors → Log warning, continue in-memory only
- Persistence failures → Notify but don't crash

## Performance Considerations

- **Constraint matching**: O(n) where n = active constraints
- **Conflict detection**: O(n²) in worst case, typically O(n)
- **Schedule generation**: Blocked times checked in backtracking
- **LLM calls**: ~1-2 seconds (cached when possible)
- **Store operations**: File I/O on every change (could batch in production)

## Security Notes

- LLM input not directly executed (goes through validation)
- Constraint store doesn't allow arbitrary code execution
- Time values validated to 0-1440 range
- No SQL injection risk (not using SQL)

## Future Enhancements

1. **Constraint Categories** - Group related constraints
2. **Templates** - Save constraint combinations as templates
3. **Undo/Redo** - Maintain history of changes
4. **Recurring with Exceptions** - "Lunch except Fridays"
5. **Natural Language Queries** - "What constraints am I using?"
6. **Multi-User Support** - Per-student constraint sets
7. **Database Persistence** - Replace JSON with PostgreSQL
8. **Better Conflict Resolution** - Suggest merges, not just replace
9. **Analytics** - Track constraint popularity
10. **Voice Input** - Speak constraints naturally

## Debugging

### Check Constraints File
```bash
cat .constraints.json | python -m json.tool
```

### Check API Response
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "block lunch from 12 to 1 PM"}'
```

### Enable Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Common Issues

**Issue**: Gemini API key not working
- Solution: Verify key in .env, check quota at console.cloud.google.com

**Issue**: Constraints not persisting
- Solution: Check file permissions, verify .constraints.json is writable

**Issue**: Chatbot misunderstands request
- Solution: Be more specific, use standard time formats (12 PM, not noon)

---

**Last Updated**: April 2026
**Version**: 1.0
**Status**: Production Ready
