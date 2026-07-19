"""Tests for privacy redactions."""

from gomi.memory.redactions import redact_secrets

def test_redact_email():
    text = "Contact me at user@example.com"
    assert redact_secrets(text) == "Contact me at [EMAIL]"

def test_redact_api_key():
    text = "API key: sk_abc123def456ghi789jkl012mno345"
    assert "[SECRET_KEY]" in redact_secrets(text)

def test_redact_github_token():
    text = "Token: ghp_abc123def456ghi789jkl012mno345pqr678"
    assert "[GITHUB_TOKEN]" in redact_secrets(text)

def test_redact_password():
    text = "password: mysecret123"
    assert "[PASSWORD]" in redact_secrets(text)
