# -*- coding: utf-8 -*-
"""
AI-assisted piyyut/composition drafting for the "חיבורים פרטיים" admin-only
library book. Calls the Claude API directly with the maintainer's own
ANTHROPIC_API_KEY (set via .env locally / a Render secret in production) —
this is billed separately from Claude Code and is admin-gated in the UI.
"""
import os

import anthropic

_MODEL = 'claude-opus-4-8'
_client = None

_SYSTEM_PROMPT = (
    "אתה עוזר לחיבור פיוטים וטקסטים בעברית ובארמית שומרונית, בהשראת המסורת "
    "הפייטנית השומרונית (חלוקה לבתים, חריזה, אקרוסטיכונים, לשון מקראית-ארמית, "
    "אזכור מקומות ומועדים שומרוניים כגון הר גריזים ושבתות/חגים). כשמועיל, חפש "
    "ברשת מידע רקע (מנהג, מקור, הקשר) לפני הכתיבה. החזר אך ורק את טקסט הפיוט "
    "עצמו, שורה בשורה נפרדת, ללא כותרת, הסברים או הערות נלוות."
)


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
    return _client


def generate_composition_draft(user_prompt):
    """Returns the drafted text (one line per row). Raises on refusal/API error."""
    client = _get_client()
    messages = [{'role': 'user', 'content': user_prompt}]
    message = None
    for _ in range(3):  # cap pause_turn continuations (server-side web_search loop limit)
        with client.messages.stream(
            model=_MODEL,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            thinking={'type': 'adaptive'},
            tools=[{'type': 'web_search_20260209', 'name': 'web_search', 'max_uses': 5}],
            messages=messages,
        ) as stream:
            message = stream.get_final_message()
        if message.stop_reason == 'pause_turn':
            messages = [
                {'role': 'user', 'content': user_prompt},
                {'role': 'assistant', 'content': message.content},
            ]
            continue
        break
    if message.stop_reason == 'refusal':
        raise RuntimeError('הבקשה נדחתה על ידי מנגנוני הבטיחות של Claude.')
    parts = [b.text for b in message.content if b.type == 'text']
    return '\n'.join(parts).strip()
