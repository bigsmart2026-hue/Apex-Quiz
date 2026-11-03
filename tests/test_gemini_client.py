"""Tests for the REST Gemini client's model failover and retry behavior."""
import httpx
import pytest

from app.config.settings import get_settings
from app.services.gemini_client import GeminiClient

_settings = get_settings()


def _success_payload(text='{"ok": true}'):
    return {
        "candidates": [{"content": {"parts": [{"text": text}]}}],
        "usageMetadata": {
            "promptTokenCount": 4,
            "candidatesTokenCount": 2,
            "totalTokenCount": 6,
        },
    }


def _status_error(status_code: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://example.test/generate")
    response = httpx.Response(status_code, request=request)
    return httpx.HTTPStatusError(
        f"HTTP {status_code}",
        request=request,
        response=response,
    )


def _make_client(monkeypatch, chain):
    client = GeminiClient()
    client.api_key = "test-key"
    client.model_chain = chain
    client.request_timeout = 1.0
    monkeypatch.setattr(_settings, "GEMINI_MAX_ATTEMPTS", 2)
    monkeypatch.setattr(_settings, "GEMINI_RETRY_DELAY", 0)
    return client


class TestGeminiFailover:
    @pytest.mark.asyncio
    async def test_falls_back_to_next_model_on_503(self, monkeypatch):
        client = _make_client(monkeypatch, ["primary", "backup"])
        calls = []

        async def fake_call(model_name, parts, generation_config=None):
            calls.append(model_name)
            if model_name == "primary":
                raise _status_error(503)
            return _success_payload()

        monkeypatch.setattr(client, "_call_model", fake_call)
        result = await client.generate("hi")

        assert result.success
        assert result.model == "backup"
        assert calls == ["primary", "backup"]
        assert result.usage["total_tokens"] == 6

    @pytest.mark.asyncio
    async def test_retries_chain_once_when_all_models_are_down(self, monkeypatch):
        client = _make_client(monkeypatch, ["primary", "backup"])
        calls = []

        async def fake_call(model_name, parts, generation_config=None):
            calls.append(model_name)
            raise _status_error(503)

        monkeypatch.setattr(client, "_call_model", fake_call)
        result = await client.generate("hi")

        assert not result.success
        assert "503" in result.error
        assert calls == ["primary", "backup", "primary", "backup"]

    @pytest.mark.asyncio
    async def test_does_not_retry_non_retryable_errors(self, monkeypatch):
        client = _make_client(monkeypatch, ["primary", "backup"])
        calls = []

        async def fake_call(model_name, parts, generation_config=None):
            calls.append(model_name)
            raise _status_error(400)

        monkeypatch.setattr(client, "_call_model", fake_call)
        result = await client.generate("hi")

        assert not result.success
        assert "400" in result.error
        assert calls == ["primary"]

    @pytest.mark.asyncio
    async def test_timeout_falls_back(self, monkeypatch):
        client = _make_client(monkeypatch, ["primary", "backup"])

        async def fake_call(model_name, parts, generation_config=None):
            if model_name == "primary":
                raise httpx.ReadTimeout("timed out")
            return _success_payload()

        monkeypatch.setattr(client, "_call_model", fake_call)
        result = await client.generate("hi")

        assert result.success
        assert result.model == "backup"

    @pytest.mark.asyncio
    async def test_empty_response_falls_back(self, monkeypatch):
        client = _make_client(monkeypatch, ["primary", "backup"])

        async def fake_call(model_name, parts, generation_config=None):
            if model_name == "primary":
                return {"candidates": []}
            return _success_payload('{"ok": true}')

        monkeypatch.setattr(client, "_call_model", fake_call)
        result = await client.generate_json("hi")

        assert result.success
        assert result.model == "backup"
        assert result.text == '{"ok": true}'

    @pytest.mark.asyncio
    async def test_missing_key_returns_failure(self):
        client = GeminiClient()
        client.api_key = ""

        result = await client.generate("hi")

        assert not result.success
        assert "not configured" in result.error
