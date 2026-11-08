"""Paystack payment integration.

All calls use the secret key server-side; the frontend only ever receives a
Paystack authorization URL to redirect the user to.
"""
import hashlib
import hmac
import json
from typing import Any, Optional
from urllib.parse import quote, urlparse

import httpx

from app.config.settings import get_settings


PAYSTACK_BASE_URL = "https://api.paystack.co"


class PaystackError(Exception):
    """Raised when Paystack rejects a request or cannot be reached."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.PAYSTACK_SECRET_KEY and settings.PAYSTACK_PLAN_CODE)


def _headers() -> dict[str, str]:
    settings = get_settings()
    if not settings.PAYSTACK_SECRET_KEY:
        raise PaystackError("Paystack is not configured", 503)
    return {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


async def _request(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(
                method, f"{PAYSTACK_BASE_URL}{path}", headers=_headers(), **kwargs
            )
    except httpx.HTTPError as exc:
        raise PaystackError(f"Could not reach Paystack: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise PaystackError("Paystack returned an invalid response") from exc

    if response.status_code >= 400 or not payload.get("status"):
        raise PaystackError(payload.get("message") or "Paystack request failed")

    return payload


async def initialize_transaction(
    *,
    email: str,
    callback_url: str,
    metadata: dict[str, Any],
    amount: Optional[int] = None,
    currency: Optional[str] = None,
    plan: Optional[str] = None,
) -> dict[str, Any]:
    settings = get_settings()
    payload: dict[str, Any] = {
        "email": email,
        "amount": amount if amount is not None else settings.PAYSTACK_AMOUNT,
        "currency": currency or settings.PAYSTACK_CURRENCY,
        "callback_url": callback_url,
        "metadata": metadata,
        "plan": plan or settings.PAYSTACK_PLAN_CODE,
    }
    result = await _request("POST", "/transaction/initialize", json=payload)
    return result.get("data") or {}


async def verify_transaction(reference: str) -> dict[str, Any]:
    result = await _request("GET", f"/transaction/verify/{quote(reference, safe='')}")
    return result.get("data") or {}


async def fetch_plan(plan_code: str) -> dict[str, Any]:
    result = await _request("GET", f"/plan/{quote(plan_code, safe='')}")
    return result.get("data") or {}


async def list_subscriptions(customer: str) -> list[dict[str, Any]]:
    result = await _request(
        "GET", "/subscription", params={"customer": customer, "perPage": 100}
    )
    data = result.get("data") or []
    return data if isinstance(data, list) else []


async def disable_subscription(code: str, email_token: str) -> dict[str, Any]:
    result = await _request(
        "POST",
        "/subscription/disable",
        json={"code": code, "token": email_token},
    )
    return result.get("data") or {}


def verify_webhook_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    if not signature or not secret:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)


def parse_metadata(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except ValueError:
            return {}
    return {}


def allowed_callback_url(provided: Optional[str], fallback: str) -> str:
    """Only allow redirects back to known frontend origins."""
    settings = get_settings()
    if not provided:
        return fallback

    parsed = urlparse(provided)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise PaystackError("Invalid payment callback URL", 400)

    origin = f"{parsed.scheme}://{parsed.netloc}"
    allowed = {f"{urlparse(o).scheme}://{urlparse(o).netloc}" for o in settings.CORS_ORIGINS}
    fallback_parsed = urlparse(fallback)
    allowed.add(f"{fallback_parsed.scheme}://{fallback_parsed.netloc}")

    if origin not in allowed:
        raise PaystackError("Payment callback URL is not allowed", 400)
    return provided
