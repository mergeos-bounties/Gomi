"""Privacy redactions for shared project memory.

NOTE: This module contains regex patterns for DETECTING secrets.
The patterns themselves (like ghp_, sk-) are not actual secrets -
they are used to identify and redact real secrets in text.
"""
"""Privacy redactions for shared project memory."""

import re

SECRET_PATTERNS = [
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[EMAIL]"),
    (r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", "[PHONE]"),
    (r"\b[A-Za-z0-9]{32,}\b", "[API_KEY]"),
    (r"\bsk-[A-Za-z0-9]{20,}\b", "[SECRET_KEY]"),
    (r"\bghp_[A-Za-z0-9]{36}\b", "[GITHUB_TOKEN]"),
    (r"\bpassword\s*[:=]\s*\S+", "[PASSWORD]"),
]

def redact_secrets(text):
    """Redact potential secrets from text."""
    for pattern, replacement in SECRET_PATTERNS:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text
