"""Paystack API client and webhook signature verification.

Recurring billing is plan-first: the Paystack plan code is the source of
truth for the amount, currency and interval. Every amount sent to Paystack
is converted to the lowest currency subunit (kobo/cents).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Mapping, Optional
from urllib.parse import quote

import httpx

from app.config.settings import get_settings


logger = logging.getLogger(__name__)

CARD_CHANNEL = "card"


class PaystackError(Exception):
    """A safe, user-presentable Paystack integration error."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "PAYSTACK_ERROR",
        status_code: int = 502,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class PaystackPlan:
    """A configured recurring Paystack plan."""

    key: str
    name: str
    code: str
    amount_subunit: int
    currency: str
    interval: str

    @property
    def amount(self) -> Decimal:
        return (Decimal(self.amount_subunit) / Decimal("100")).quantize(Decimal("0.01"))

    @property
    def price_label(self) -> str:
        symbols = {
            "NGN": "₦",
            "USD": "$",
            "ZAR": "R",
            "GHS": "GH₵",
            "KES": "KSh",
        }
        symbol = symbols.get(self.currency, f"{self.currency} ")
        amount = f"{self.amount:,.2f}".rstrip("0").rstrip(".")
        suffix = {
            "hourly": "/hr",
            "daily": "/day",
            "weekly": "/wk",
            "monthly": "/mo",
            "quarterly": "/qtr",
            "biannually": "/6mo",
            "annually": "/yr",
        }.get(self.interval, f"/{self.interval}")
        return f"{symbol}{amount}{suffix}"


def get_premium_plan(settings=None) -> PaystackPlan:
    """Return the configured premium plan or raise ``PaystackError``."""
    settings = settings or get_settings()
    code = (settings.PAYSTACK_PREMIUM_PLAN_CODE or "").strip()
    if not code:
        raise PaystackError(
            "Paystack is not configured. Add PAYSTACK_PREMIUM_PLAN_CODE and PAYSTACK_SECRET_KEY.",
            code="PAYSTACK_NOT_CONFIGURED",
            status_code=503,
        )

    amount_subunit = settings.paystack_amount_subunit
    if amount_subunit <= 0:
        raise PaystackError(
            "The premium plan price must be greater than zero.",
            code="PAYSTACK_NOT_CONFIGURED",
            status_code=503,
        )

    currency = (settings.PAYSTACK_CURRENCY or "NGN").upper()
    return PaystackPlan(
        key="premium",
        name=settings.PAYSTACK_PREMIUM_PLAN_NAME,
        code=code,
        amount_subunit=amount_subunit,
        currency=currency,
        interval=(settings.PAYSTACK_PREMIUM_INTERVAL or "monthly").lower(),
    )


def verify_webhook_signature(
    raw_body: bytes,
    signature: Optional[str],
    secret_key: str,
) -> bool:
    """Validate ``x-paystack-signature`` as HMAC-SHA512(raw body, secret)."""
    if not raw_body or not signature or not secret_key:
        return False
    expected = hmac.new(
        secret_key.encode("utf-8"),
        raw_body,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


class PaystackClient:
    """Small async client for the Paystack REST API."""

    @property
    def _settings(self):
        return get_settings()

    @property
    def configured(self) -> bool:
        return bool((self._settings.PAYSTACK_SECRET_KEY or "").strip())

    async def _request(
        self,
        method: str,
        path: str,
        payload: Optional[Mapping[str, Any]] = None,
    ) -> dict:
        settings = self._settings
        secret_key = (settings.PAYSTACK_SECRET_KEY or "").strip()
        if not secret_key:
            raise PaystackError(
                "Paystack payments are not configured.",
                code="PAYSTACK_NOT_CONFIGURED",
                status_code=503,
            )

        url = f"{settings.PAYSTACK_BASE_URL.rstrip('/')}{path}"
        headers = {
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=settings.PAYSTACK_REQUEST_TIMEOUT) as client:
                response = await client.request(method, url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("Paystack request failed: %s %s", method, path)
            raise PaystackError(
                "Could not reach Paystack. Please try again.",
                code="PAYSTACK_UNAVAILABLE",
                status_code=502,
            ) from exc

        try:
            body = response.json()
        except ValueError:
            body = {}

        if response.status_code >= 500:
            logger.warning("Paystack returned %s for %s %s", response.status_code, method, path)
            raise PaystackError(
                "Paystack is temporarily unavailable. Please try again.",
                code="PAYSTACK_UNAVAILABLE",
                status_code=502,
            )

        if response.status_code >= 400 or not body.get("status"):
            message = str(body.get("message") or "Paystack rejected the request.")
            logger.warning(
                "Paystack API error %s for %s %s: %s",
                response.status_code,
                method,
                path,
                message,
            )
            raise PaystackError(message, code="PAYSTACK_REQUEST_FAILED", status_code=502)

        return body.get("data") or {}

    async def initialize_transaction(
        self,
        *,
        email: str,
        plan_code: str,
        amount_subunit: int,
        currency: str,
        callback_url: str,
        metadata: Mapping[str, Any],
        reference: str,
        channels: tuple[str, ...] = (CARD_CHANNEL,),
    ) -> dict:
        """Initialize a card-only checkout tied to a predefined plan.

        ``plan`` is authoritative for recurring billing. ``amount`` is still
        sent because Paystack requires it on initialize; it is in the lowest
        currency subunit and mirrors the plan price.
        """
        if amount_subunit <= 0:
            raise PaystackError(
                "Invalid plan amount.",
                code="PAYSTACK_ERROR",
                status_code=500,
            )

        payload = {
            "email": email,
            "amount": str(amount_subunit),
            "plan": plan_code,
            "currency": currency.upper(),
            "reference": reference,
            "callback_url": callback_url,
            "channels": list(channels),
            "metadata": json.dumps(dict(metadata), separators=(",", ":")),
        }
        return await self._request("POST", "/transaction/initialize", payload)

    async def verify_transaction(self, reference: str) -> dict:
        """Verify a transaction server-side before provisioning access."""
        safe_reference = quote(reference, safe="")
        return await self._request("GET", f"/transaction/verify/{safe_reference}")

    async def disable_subscription(self, subscription_code: str, email_token: str) -> dict:
        """Stop future charges for a subscription."""
        return await self._request(
            "POST",
            "/subscription/disable",
            {"code": subscription_code, "token": email_token},
        )


paystack_client = PaystackClient()
