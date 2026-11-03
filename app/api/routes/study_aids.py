"""Study aid (flashcards + quizzes) API routes.

Generation is grounded, validated, and persisted per user. The heavy lifting
lives in ``app.services.study_aid_service``; these endpoints handle auth, tier
limits, PDF ingestion, and storage.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.auth.dependencies import get_current_user, get_question_limit
from app.models.database import StudySet, User
from app.models.session import get_db_session
from app.schemas.common import ErrorCode, ErrorDetail, SuccessResponse
from app.schemas.study_aids import (
    StudyAidGenerationRequest,
    StudySetListItem,
    StudySetResponse,
)
from app.services.pdf_processor import pdf_processor
from app.services.study_aid_service import (
    StudyAidResult,
    compute_request_hash,
    study_aid_service,
)


router = APIRouter(prefix="/study-aids", tags=["study-aids"])


def _parse_topics(topics: Optional[str]) -> Optional[list[str]]:
    if not topics:
        return None
    parsed = [topic.strip() for topic in topics.split(",") if topic.strip()]
    return parsed or None


def _to_response(study_set: StudySet, cached: bool = False) -> StudySetResponse:
    return StudySetResponse(
        study_set_id=str(study_set.id),
        flashcards=study_set.flashcards,
        quiz_questions=study_set.quiz_questions,
        flashcard_count=study_set.flashcard_count,
        quiz_count=study_set.quiz_count,
        generation_time_ms=study_set.generation_time_ms,
        grounding_score=study_set.grounding_score,
        chunks_processed=study_set.chunks_processed,
        warnings=study_set.warnings or [],
        source_filename=study_set.source_filename,
        cached=cached,
        created_at=study_set.created_at,
    )


async def _find_cached_study_set(
    session: AsyncSession,
    user_id: uuid.UUID,
    request_hash: str,
) -> Optional[StudySet]:
    """Return a previously generated set for an identical request, if any."""
    result = await session.execute(
        select(StudySet)
        .where(
            StudySet.user_id == user_id,
            StudySet.source_file_hash == request_hash,
        )
        .order_by(StudySet.created_at.desc())
    )
    return result.scalars().first()


async def _persist_study_set(
    session: AsyncSession,
    user: User,
    result: StudyAidResult,
    source_hash: str,
    source_filename: Optional[str] = None,
) -> StudySet:
    """Store a generated study set and return the persisted row."""
    study_set = StudySet(
        id=uuid.uuid4(),
        user_id=user.id,
        source_filename=source_filename,
        source_file_hash=source_hash,
        flashcards=[item.model_dump() for item in result.payload.flashcards],
        quiz_questions=[item.model_dump() for item in result.payload.quiz_questions],
        flashcard_count=len(result.payload.flashcards),
        quiz_count=len(result.payload.quiz_questions),
        grounding_score=result.grounding_score,
        chunks_processed=result.chunks_processed,
        generation_time_ms=result.generation_time_ms,
        warnings=result.warnings,
    )
    session.add(study_set)

    # Keep monthly usage in sync with the quiz generation endpoints.
    user.questions_generated_this_month += len(result.payload.quiz_questions)
    session.add(user)

    await session.commit()
    await session.refresh(study_set)
    return study_set


def _empty_result_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=ErrorDetail(
            code=ErrorCode.GENERATION_FAILED,
            message=(
                "No grounded study aids could be generated from this source. "
                "Try richer source text, a clearer PDF, or text input."
            ),
            recoverable=True,
            suggestions=[
                "Use a clearer PDF or paste the text directly",
                "Include more explanatory prose in the source",
            ],
        ).model_dump(),
    )


def _generation_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=ErrorDetail(
            code=ErrorCode.GENERATION_FAILED,
            message=message,
            recoverable=True,
            suggestions=["Check the Gemini API key and quota", "Try again with a shorter source"],
        ).model_dump(),
    )


def _enforce_tier_limit(requested_total: int, question_limit: int) -> None:
    if requested_total > question_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorDetail(
                code=ErrorCode.TIER_LIMIT_EXCEEDED,
                message=(
                    f"Your tier allows up to {question_limit} study aid items per request "
                    f"({requested_total} requested)."
                ),
                recoverable=True,
                suggestions=["Upgrade to premium for more items", "Reduce the requested counts"],
            ).model_dump(),
        )


@router.post("/generate", response_model=SuccessResponse[StudySetResponse])
async def generate_study_aids_from_text(
    request: StudyAidGenerationRequest,
    user=Depends(get_current_user),
    question_limit: int = Depends(get_question_limit),
    session: AsyncSession = Depends(get_db_session),
):
    """Generate grounded flashcards and quiz questions from pasted text."""
    _enforce_tier_limit(request.num_flashcards + request.num_quizzes, question_limit)

    request_hash = compute_request_hash(
        request.source_text,
        request.num_flashcards,
        request.num_quizzes,
        request.difficulty.value,
        request.topics,
    )
    cached_set = await _find_cached_study_set(session, user.id, request_hash)
    if cached_set:
        return SuccessResponse(
            data=_to_response(cached_set, cached=True),
            message=(
                f"Returned cached set: {cached_set.flashcard_count} flashcards and "
                f"{cached_set.quiz_count} quiz questions"
            ),
        )

    try:
        result = await study_aid_service.generate(
            source_text=request.source_text,
            num_flashcards=request.num_flashcards,
            num_quizzes=request.num_quizzes,
            difficulty=request.difficulty.value,
            topics=request.topics,
        )
    except ValueError as exc:
        raise _generation_error(str(exc)) from exc

    if not result.payload.total_items:
        raise _empty_result_error()

    study_set = await _persist_study_set(
        session=session,
        user=user,
        result=result,
        source_hash=request_hash,
        source_filename=None,
    )

    return SuccessResponse(
        data=_to_response(study_set),
        message=(
            f"Generated {study_set.flashcard_count} flashcards and "
            f"{study_set.quiz_count} quiz questions"
        ),
    )


@router.post("/generate/pdf", response_model=SuccessResponse[StudySetResponse])
async def generate_study_aids_from_pdf(
    file: UploadFile = File(...),
    num_flashcards: int = Form(default=5, ge=0, le=50),
    num_quizzes: int = Form(default=5, ge=0, le=50),
    difficulty: Optional[str] = Form(default=None),
    topics: Optional[str] = Form(default=None),
    user=Depends(get_current_user),
    question_limit: int = Depends(get_question_limit),
    session: AsyncSession = Depends(get_db_session),
):
    """Generate grounded flashcards and quiz questions from an uploaded PDF."""
    _enforce_tier_limit(num_flashcards + num_quizzes, question_limit)

    file_bytes = await file.read()

    resolved_difficulty = (difficulty or "medium").lower()
    if resolved_difficulty not in {"easy", "medium", "hard"}:
        resolved_difficulty = "medium"

    parsed_topics = _parse_topics(topics)
    request_hash = compute_request_hash(
        file_bytes,
        num_flashcards,
        num_quizzes,
        resolved_difficulty,
        parsed_topics,
    )
    cached_set = await _find_cached_study_set(session, user.id, request_hash)
    if cached_set:
        return SuccessResponse(
            data=_to_response(cached_set, cached=True),
            message=(
                f"Returned cached set: {cached_set.flashcard_count} flashcards and "
                f"{cached_set.quiz_count} quiz questions"
            ),
        )

    try:
        source_text = await pdf_processor.extract_text_only(file_bytes, file.filename or "document.pdf")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ErrorDetail(
                code=ErrorCode.EXTRACTION_FAILED,
                message=str(exc),
                recoverable=True,
                suggestions=["Try a different PDF or use text input"],
            ).model_dump(),
        ) from exc

    try:
        result = await study_aid_service.generate(
            source_text=source_text,
            num_flashcards=num_flashcards,
            num_quizzes=num_quizzes,
            difficulty=resolved_difficulty,
            topics=parsed_topics,
        )
    except ValueError as exc:
        raise _generation_error(str(exc)) from exc

    if not result.payload.total_items:
        raise _empty_result_error()

    study_set = await _persist_study_set(
        session=session,
        user=user,
        result=result,
        source_hash=request_hash,
        source_filename=file.filename,
    )

    return SuccessResponse(
        data=_to_response(study_set),
        message=(
            f"Generated {study_set.flashcard_count} flashcards and "
            f"{study_set.quiz_count} quiz questions"
        ),
    )


@router.get("/history", response_model=SuccessResponse[list[StudySetListItem]])
async def get_study_set_history(
    limit: int = 20,
    offset: int = 0,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """List the current user's generated study sets."""
    result = await session.execute(
        select(StudySet)
        .where(StudySet.user_id == user.id)
        .order_by(StudySet.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    study_sets = result.scalars().all()

    return SuccessResponse(
        data=[
            StudySetListItem(
                study_set_id=str(study_set.id),
                flashcard_count=study_set.flashcard_count,
                quiz_count=study_set.quiz_count,
                grounding_score=study_set.grounding_score,
                created_at=study_set.created_at,
                source_filename=study_set.source_filename,
            )
            for study_set in study_sets
        ]
    )


@router.get("/{study_set_id}", response_model=SuccessResponse[StudySetResponse])
async def get_study_set(
    study_set_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Fetch one generated study set by id."""
    try:
        study_set_uuid = uuid.UUID(study_set_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Study set not found",
                recoverable=False,
            ).model_dump(),
        )

    result = await session.execute(
        select(StudySet).where(
            StudySet.id == study_set_uuid,
            StudySet.user_id == user.id,
        )
    )
    study_set = result.scalars().first()

    if not study_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Study set not found",
                recoverable=False,
            ).model_dump(),
        )

    return SuccessResponse(data=_to_response(study_set))


@router.delete("/{study_set_id}", response_model=SuccessResponse)
async def delete_study_set(
    study_set_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete a generated study set."""
    try:
        study_set_uuid = uuid.UUID(study_set_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Study set not found",
                recoverable=False,
            ).model_dump(),
        )

    result = await session.execute(
        select(StudySet).where(
            StudySet.id == study_set_uuid,
            StudySet.user_id == user.id,
        )
    )
    study_set = result.scalars().first()

    if not study_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Study set not found",
                recoverable=False,
            ).model_dump(),
        )

    await session.delete(study_set)
    await session.commit()

    return SuccessResponse(message="Study set deleted")
