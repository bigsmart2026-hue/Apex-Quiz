"""Tests for the grounded study aid generation pipeline."""
import json

import pytest
from httpx import AsyncClient

from app.schemas.study_aids import FlashcardItem, QuizItem, StudyAidPayload
from app.services.pdf_processor import pdf_processor
from app.services.study_aid_service import (
    StudyAidResult,
    _allocate,
    chunk_source_text,
    is_grounded,
    parse_study_aid_payload,
    study_aid_service,
)


SOURCE_TEXT = (
    "Photosynthesis is the process by which green plants convert light energy into "
    "chemical energy. Chlorophyll is the green pigment that absorbs light. "
    "The light-dependent reactions take place in the thylakoid membranes of the "
    "chloroplast. The Calvin cycle fixes carbon dioxide into glucose. "
    "Cellular respiration releases energy from glucose in the mitochondria."
)


def _valid_payload() -> dict:
    return {
        "flashcards": [
            {
                "id": "fc_001",
                "front": "What pigment absorbs light during photosynthesis?",
                "back": "Chlorophyll.",
                "source_reference": "Chlorophyll is the green pigment that absorbs light.",
            },
            {
                "id": "fc_002",
                "front": "Where do the light-dependent reactions occur?",
                "back": "In the thylakoid membranes of the chloroplast.",
                "source_reference": "The light-dependent reactions take place in the thylakoid membranes of the chloroplast.",
            },
        ],
        "quiz_questions": [
            {
                "id": "q_001",
                "question": "Where does the Calvin cycle fix carbon dioxide?",
                "options": ["Into glucose", "Into oxygen", "Into water", "Into protein"],
                "correct_answer_index": 0,
                "explanation": "The Calvin cycle fixes carbon dioxide into glucose.",
                "source_reference": "The Calvin cycle fixes carbon dioxide into glucose.",
                "difficulty": "medium",
                "topic_tags": ["calvin cycle"],
            }
        ],
    }


class TestChunking:
    def test_short_text_is_single_chunk(self):
        assert chunk_source_text("short text", chunk_size=100) == ["short text"]

    def test_long_text_is_split_with_cap(self):
        text = "\n\n".join(f"Paragraph {index} " + ("word " * 50) for index in range(20))
        chunks = chunk_source_text(text, chunk_size=500, overlap=50, max_chunks=4)

        assert 1 < len(chunks) <= 4
        assert all(chunk.strip() for chunk in chunks)

    def test_empty_text_returns_no_chunks(self):
        assert chunk_source_text("") == []

    def test_allocate_distributes_exact_total(self):
        counts = _allocate(10, [1, 2, 3, 4])
        assert sum(counts) == 10
        # Larger chunks receive more items.
        assert counts[-1] >= counts[0]


class TestGrounding:
    def test_exact_reference_is_grounded(self):
        assert is_grounded(
            "Chlorophyll is the green pigment that absorbs light.",
            SOURCE_TEXT.casefold(),
            SOURCE_TEXT.casefold(),
        )

    def test_punctuation_drift_is_grounded(self):
        assert is_grounded(
            "chlorophyll is the green pigment that absorbs light",
            SOURCE_TEXT.casefold(),
            "".join(ch for ch in SOURCE_TEXT.casefold() if ch.isalnum() or ch.isspace()),
        )

    def test_hallucinated_reference_is_rejected(self):
        assert not is_grounded(
            "Mitochondria are the powerhouse of the cell and produce ATP via photosynthesis.",
            SOURCE_TEXT.casefold(),
            "".join(ch for ch in SOURCE_TEXT.casefold() if ch.isalnum() or ch.isspace()),
        )


class TestPayloadParsing:
    def test_valid_payload_is_parsed(self):
        result = parse_study_aid_payload(json.dumps(_valid_payload()), SOURCE_TEXT)

        assert len(result.payload.flashcards) == 2
        assert len(result.payload.quiz_questions) == 1
        assert result.raw_item_count == 3
        assert result.grounded_item_count == 3

    def test_markdown_fenced_json_is_parsed(self):
        raw = "```json\n" + json.dumps(_valid_payload()) + "\n```"
        result = parse_study_aid_payload(raw, SOURCE_TEXT)

        assert result.payload.total_items == 3

    def test_invalid_json_returns_empty_with_warning(self):
        result = parse_study_aid_payload("this is not json", SOURCE_TEXT)

        assert result.payload.total_items == 0
        assert result.warnings

    def test_ungrounded_items_are_dropped(self):
        payload = _valid_payload()
        payload["flashcards"][0]["source_reference"] = "The moon is made of cheese."
        result = parse_study_aid_payload(json.dumps(payload), SOURCE_TEXT)

        assert len(result.payload.flashcards) == 1
        assert result.grounded_item_count == 2
        assert any("ungrounded" in warning.lower() for warning in result.warnings)

    def test_malformed_quiz_is_skipped(self):
        payload = _valid_payload()
        payload["quiz_questions"][0]["options"] = ["Only one option"]
        result = parse_study_aid_payload(json.dumps(payload), SOURCE_TEXT)

        assert result.payload.quiz_questions == []
        assert any("malformed quiz" in warning.lower() for warning in result.warnings)

    def test_duplicate_items_are_removed(self):
        payload = _valid_payload()
        payload["flashcards"].append(dict(payload["flashcards"][0]))
        result = parse_study_aid_payload(json.dumps(payload), SOURCE_TEXT)

        assert len(result.payload.flashcards) == 2


def _fake_result() -> StudyAidResult:
    return StudyAidResult(
        payload=StudyAidPayload(
            flashcards=[
                FlashcardItem(
                    id="fc_001",
                    front="What pigment absorbs light?",
                    back="Chlorophyll.",
                    source_reference="Chlorophyll is the green pigment that absorbs light.",
                )
            ],
            quiz_questions=[
                QuizItem(
                    id="q_001",
                    question="Where does the Calvin cycle fix carbon dioxide?",
                    options=["Into glucose", "Into oxygen", "Into water", "Into protein"],
                    correct_answer_index=0,
                    explanation="The Calvin cycle fixes carbon dioxide into glucose.",
                    source_reference="The Calvin cycle fixes carbon dioxide into glucose.",
                )
            ],
        ),
        warnings=[],
        grounding_score=1.0,
        chunks_processed=1,
        generation_time_ms=42,
        raw_item_count=2,
        grounded_item_count=2,
    )


class TestStudyAidEndpoints:
    @pytest.mark.asyncio
    async def test_generate_from_text_and_fetch(self, client: AsyncClient, auth_headers, monkeypatch):
        async def fake_generate(**_kwargs):
            return _fake_result()

        monkeypatch.setattr(study_aid_service, "generate", fake_generate)

        response = await client.post(
            "/api/study-aids/generate",
            json={
                "source_text": SOURCE_TEXT,
                "num_flashcards": 1,
                "num_quizzes": 1,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["flashcard_count"] == 1
        assert data["quiz_count"] == 1
        assert data["grounding_score"] == 1.0
        assert data["flashcards"][0]["source_reference"]

        study_set_id = data["study_set_id"]

        fetched = await client.get(f"/api/study-aids/{study_set_id}", headers=auth_headers)
        assert fetched.status_code == 200
        assert fetched.json()["data"]["study_set_id"] == study_set_id

        history = await client.get("/api/study-aids/history", headers=auth_headers)
        assert history.status_code == 200
        assert any(item["study_set_id"] == study_set_id for item in history.json()["data"])

        deleted = await client.delete(f"/api/study-aids/{study_set_id}", headers=auth_headers)
        assert deleted.status_code == 200

    @pytest.mark.asyncio
    async def test_identical_request_returns_cached_set(
        self, client: AsyncClient, auth_headers, monkeypatch
    ):
        calls = []

        async def fake_generate(**_kwargs):
            calls.append(1)
            return _fake_result()

        monkeypatch.setattr(study_aid_service, "generate", fake_generate)

        cache_source = SOURCE_TEXT + " Cache marker: identical requests share one set."
        payload = {
            "source_text": cache_source,
            "num_flashcards": 1,
            "num_quizzes": 1,
        }

        first = await client.post(
            "/api/study-aids/generate", json=payload, headers=auth_headers
        )
        second = await client.post(
            "/api/study-aids/generate", json=payload, headers=auth_headers
        )

        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert len(calls) == 1
        assert first.json()["data"]["cached"] is False
        assert second.json()["data"]["cached"] is True
        assert (
            first.json()["data"]["study_set_id"]
            == second.json()["data"]["study_set_id"]
        )

    @pytest.mark.asyncio
    async def test_different_parameters_bypass_cache(
        self, client: AsyncClient, auth_headers, monkeypatch
    ):
        calls = []

        async def fake_generate(**_kwargs):
            calls.append(1)
            return _fake_result()

        monkeypatch.setattr(study_aid_service, "generate", fake_generate)

        cache_source = SOURCE_TEXT + " Cache marker: different counts regenerate."
        first = await client.post(
            "/api/study-aids/generate",
            json={"source_text": cache_source, "num_flashcards": 1, "num_quizzes": 1},
            headers=auth_headers,
        )
        second = await client.post(
            "/api/study-aids/generate",
            json={"source_text": cache_source, "num_flashcards": 1, "num_quizzes": 2},
            headers=auth_headers,
        )

        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert len(calls) == 2
        assert second.json()["data"]["cached"] is False

    @pytest.mark.asyncio
    async def test_generate_from_pdf_and_cache(
        self, client: AsyncClient, auth_headers, monkeypatch
    ):
        calls = []

        async def fake_extract(file_bytes, filename):
            return SOURCE_TEXT + " PDF extraction marker for the study aid test."

        async def fake_generate(**_kwargs):
            calls.append(1)
            return _fake_result()

        monkeypatch.setattr(pdf_processor, "extract_text_only", fake_extract)
        monkeypatch.setattr(study_aid_service, "generate", fake_generate)

        files = {"file": ("notes.pdf", b"%PDF-1.4 fake pdf bytes", "application/pdf")}
        data = {"num_flashcards": "1", "num_quizzes": "1", "difficulty": "medium"}

        first = await client.post(
            "/api/study-aids/generate/pdf",
            files=files,
            data=data,
            headers=auth_headers,
        )
        second = await client.post(
            "/api/study-aids/generate/pdf",
            files=files,
            data=data,
            headers=auth_headers,
        )

        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert len(calls) == 1
        assert first.json()["data"]["source_filename"] == "notes.pdf"
        assert first.json()["data"]["cached"] is False
        assert second.json()["data"]["cached"] is True
        assert (
            first.json()["data"]["study_set_id"]
            == second.json()["data"]["study_set_id"]
        )

    @pytest.mark.asyncio
    async def test_tier_limit_is_enforced(self, client: AsyncClient, auth_headers):
        response = await client.post(
            "/api/study-aids/generate",
            json={
                "source_text": SOURCE_TEXT,
                "num_flashcards": 6,
                "num_quizzes": 6,
            },
            headers=auth_headers,
        )

        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "TIER_LIMIT_EXCEEDED"

    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/study-aids/generate",
            json={"source_text": SOURCE_TEXT, "num_flashcards": 1, "num_quizzes": 1},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_short_source_text_is_rejected(self, client: AsyncClient, auth_headers):
        response = await client.post(
            "/api/study-aids/generate",
            json={"source_text": "too short", "num_flashcards": 1, "num_quizzes": 1},
            headers=auth_headers,
        )

        assert response.status_code == 422
