"""
interpreter.py — LLM-based constraint interpretation using Google Gemini.

Converts natural language user requests into structured scheduling constraints.
"""

import os
import json
import re
from typing import Optional
import google.generativeai as genai
from app.constraints import (
    Constraint, ConstraintType, RecurrenceType, TimeRange, InterpretationResult
)


class ConstraintInterpreter:
    """
    Uses Gemini to interpret natural language scheduling requests and convert them
    to structured constraints.
    """
    
    SYSTEM_PROMPT = """You are a scheduling assistant that interprets natural language 
scheduling requests and converts them to structured JSON constraints.

You help users define their scheduling preferences and constraints, such as:
- Time preferences (earliest start, latest end)
- Days off
- Blocked time blocks (lunch, gym, study, etc.)
- Recurring activities
- One-time events or exceptions

When the user provides a request, you MUST respond with ONLY valid JSON matching this exact schema:

{
  "intent": "create" | "update" | "delete" | "clarify" | "list",
  "target_type": "earliest_start" | "latest_end" | "days_off" | "blocked_time" | "recurring_activity" | "soft_preference" | null,
  "constraints": [
    {
      "title": "Human-friendly name",
      "description": "Detailed description",
      "constraint_type": "earliest_start" | "latest_end" | "days_off" | "blocked_time" | "recurring_activity" | "soft_preference",
      "is_hard_constraint": true | false,
      "priority": 1-10,
      "recurrence_type": "once" | "weekly" | "custom",
      "days_of_week": ["M", "T", "W", "H", "F"] or null,
      "specific_date": "YYYY-MM-DD" or null,
      "time_range": {"start_min": 0-1440, "end_min": 0-1440} or null,
      "earliest_start": 0-1440 or null,
      "latest_end": 0-1440 or null
    }
  ],
  "summary": "Human-friendly confirmation of what was understood",
  "confirmation": true | false,
  "clarification_question": "What specific time would you like to block lunch?" or null,
  "confidence": 0.0-1.0,
  "target_ids": ["constraint-id-1"] or null
}

IMPORTANT RULES:
1. Parse times: "12 PM" = 720 minutes, "8 AM" = 480 minutes, etc.
2. Days: M=Mon, T=Tue, W=Wed, H=Thu, F=Fri
3. If ambiguous (e.g., "lunch" with no time), ask clarification_question
4. Hard constraints (e.g., "Block lunch", "No class after 4PM") = is_hard_constraint: true
5. Soft preferences (e.g., "Prefer morning classes", "Try to avoid Friday") = is_hard_constraint: false
6. For "remove" or "delete" requests, ask which constraint to remove if ambiguous
7. Keep responses CONCISE and confident
8. Always validate time ranges: start_min < end_min
9. RESPOND WITH JSON ONLY - no extra text, markdown, or explanations

Example interactions:

User: "Block lunch from 12 to 1 PM every weekday"
Response: {
  "intent": "create",
  "target_type": "blocked_time",
  "constraints": [{
    "title": "Lunch block",
    "description": "Daily lunch from 12 PM to 1 PM",
    "constraint_type": "blocked_time",
    "is_hard_constraint": true,
    "priority": 8,
    "recurrence_type": "weekly",
    "days_of_week": ["M", "T", "W", "H", "F"],
    "time_range": {"start_min": 720, "end_min": 780}
  }],
  "summary": "Blocking lunch from 12 PM to 1 PM every weekday",
  "confirmation": true,
  "confidence": 0.98
}

User: "I have gym in the evening"
Response: {
  "intent": "clarify",
  "summary": "I understood you have a gym session in the evening, but I need more details.",
  "clarification_question": "What time is your evening gym session? For example, 5-6 PM? And which days?",
  "confirmation": false,
  "confidence": 0.6
}

User: "Earliest class at 10 AM"
Response: {
  "intent": "create",
  "target_type": "earliest_start",
  "constraints": [{
    "title": "Earliest start time",
    "description": "Avoid scheduling classes before 10 AM",
    "constraint_type": "earliest_start",
    "is_hard_constraint": true,
    "priority": 7,
    "recurrence_type": "weekly",
    "earliest_start": 600
  }],
  "summary": "Set earliest class start time to 10 AM",
  "confirmation": true,
  "confidence": 0.95
}

User: "No Friday classes"
Response: {
  "intent": "create",
  "target_type": "days_off",
  "constraints": [{
    "title": "Friday off",
    "description": "Keep Fridays free",
    "constraint_type": "days_off",
    "is_hard_constraint": true,
    "priority": 9,
    "recurrence_type": "weekly",
    "days_of_week": ["F"]
  }],
  "summary": "Keeping Fridays free - no classes scheduled",
  "confirmation": true,
  "confidence": 0.95
}
"""

    def __init__(self):
        """Initialize the Gemini client."""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable not set. "
                "Get an API key from https://aistudio.google.com/app/apikey"
            )
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash-lite")
    
    def interpret(self, user_message: str) -> InterpretationResult:
        """
        Interpret a natural language user message and return structured constraints.
        
        Args:
            user_message: Natural language scheduling request
            
        Returns:
            InterpretationResult with parsed constraints or clarification questions
        """
        try:
            # Call Gemini with the structured prompt
            response = self.model.generate_content(
                [
                    {"text": self.SYSTEM_PROMPT},
                    {"text": f"User message: {user_message}"}
                ],
                generation_config={
                    "temperature": 0.3,  # Lower temperature for consistency
                    "top_p": 0.9,
                    "top_k": 40,
                }
            )
            
            # Extract JSON from response
            response_text = response.text.strip()
            
            # Try to parse JSON - handle cases where Gemini might wrap it
            json_data = self._extract_json(response_text)
            
            if not json_data:
                return InterpretationResult(
                    intent="clarify",
                    summary="Sorry, I didn't understand that. Could you rephrase?",
                    clarification_question="Can you describe your scheduling need more specifically?",
                    confirmation=False,
                    confidence=0.1
                )
            
            # Validate and construct InterpretationResult
            result = self._validate_and_construct(json_data, user_message)
            return result
            
        except Exception as e:
            print(f"Error in interpreter: {e}")
            return InterpretationResult(
                intent="clarify",
                summary=f"Error processing request: {str(e)}",
                clarification_question="Could you try again?",
                confirmation=False,
                confidence=0.0
            )
    
    def _extract_json(self, text: str) -> Optional[dict]:
        """
        Extract JSON from model response, handling various formatting.
        """
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        
        # Try to find JSON block
        json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try to find any JSON-like object
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        return None
    
    def _validate_and_construct(self, data: dict, user_message: str) -> InterpretationResult:
        """
        Validate the JSON structure and construct an InterpretationResult.
        """
        try:
            intent = data.get("intent", "clarify")
            constraints_data = data.get("constraints", [])
            
            # Construct Constraint objects
            constraints = []
            for c in constraints_data:
                try:
                    constraint = Constraint(
                        title=c.get("title", "Untitled"),
                        description=c.get("description"),
                        constraint_type=ConstraintType(c.get("constraint_type", "blocked_time")),
                        is_hard_constraint=c.get("is_hard_constraint", True),
                        priority=c.get("priority", 5),
                        recurrence_type=RecurrenceType(c.get("recurrence_type", "weekly")),
                        days_of_week=c.get("days_of_week"),
                        specific_date=c.get("specific_date"),
                        time_range=TimeRange(**c["time_range"]) if c.get("time_range") else None,
                        earliest_start=c.get("earliest_start"),
                        latest_end=c.get("latest_end"),
                        source="chatbot"
                    )
                    constraints.append(constraint)
                except Exception as e:
                    print(f"Warning: Failed to construct constraint: {e}")
            
            target_type = None
            if data.get("target_type"):
                try:
                    target_type = ConstraintType(data["target_type"])
                except ValueError:
                    pass
            
            return InterpretationResult(
                intent=intent,
                target_type=target_type,
                constraints=constraints,
                summary=data.get("summary", "Updated your schedule preferences"),
                confirmation=data.get("confirmation", True),
                clarification_question=data.get("clarification_question"),
                confidence=data.get("confidence", 0.8),
                target_ids=data.get("target_ids")
            )
            
        except Exception as e:
            print(f"Error validating interpretation: {e}")
            return InterpretationResult(
                intent="clarify",
                summary="I had trouble understanding that request",
                clarification_question="Could you rephrase your scheduling need?",
                confirmation=False,
                confidence=0.0
            )
    
    def time_string_to_minutes(self, time_str: str) -> Optional[int]:
        """
        Convert time string to minutes from midnight.
        Examples: "8 AM" -> 480, "12 PM" -> 720, "5:30 PM" -> 1050
        """
        try:
            import re
            from datetime import datetime
            
            # Clean up the string
            time_str = time_str.strip().upper()
            
            # Try parsing with datetime
            for fmt in ["%I:%M %p", "%I %p", "%H:%M", "%H"]:
                try:
                    dt = datetime.strptime(time_str, fmt)
                    return dt.hour * 60 + dt.minute
                except ValueError:
                    continue
            
            return None
        except Exception:
            return None
