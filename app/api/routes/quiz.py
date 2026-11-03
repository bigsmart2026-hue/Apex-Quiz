"""Quiz generation API routes."""
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_question_limit
from app.models.database import Quiz, PDFDocument
from app.models.session import get_db_session
from app.schemas.quiz import (
    TextQuizRequest,
    QuizResponse,
    QuizListItem,
    QuizDetailResponse,
    DifficultyLevel,
    QuestionType as QuizQuestionType,
)
from app.schemas.common import ErrorCode, ErrorDetail, SuccessResponse
from app.services.pdf_processor import pdf_processor
from app.services.cache import pdf_cache
from app.graphs.nodes import normalize_playable_question
from app.graphs.workflow import quiz_generation_graph
from app.graphs.state import QuizGenerationState
from app.config.settings import get_settings


settings = get_settings()
router = APIRouter(prefix="/quiz", tags=["quiz"])


def _playable_questions(questions, warnings):
    """Keep only questions the frontend can actually render and grade."""
    playable = []
    for question in questions:
        normalized = normalize_playable_question(question)
        if normalized is not None:
            playable.append(normalized)
    skipped = len(questions) - len(playable)
    if skipped:
        warnings.append(f"Skipped {skipped} unplayable question(s).")
    return playable


@router.post("/generate", response_model=SuccessResponse[QuizResponse])
async def generate_quiz_from_pdf(
    file: UploadFile = File(...),
    question_count: int = Form(..., ge=1, le=50),
    difficulty: Optional[str] = Form(default=None),
    topics: Optional[str] = Form(default=None),
    question_types: Optional[str] = Form(default=None),
    user=Depends(get_current_user),
    question_limit: int = Depends(get_question_limit),
    session: AsyncSession = Depends(get_db_session),
):
    """Generate quiz from uploaded PDF."""
    start_time = time.time()
    quiz_id = str(uuid.uuid4())
    
    # Validate tier limit
    if question_count > question_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorDetail(
                code=ErrorCode.TIER_LIMIT_EXCEEDED,
                message=f"Your tier allows maximum {question_limit} questions",
                recoverable=True,
                suggestions=["Upgrade to premium for more questions"]
            ).model_dump(),
        )
    
    # Read file
    file_bytes = await file.read()
    
    # Check cache
    cached_content = await pdf_cache.get_structured_content(file_bytes)
    if cached_content:
        structured_content = cached_content
        # Increment access count
        await pdf_cache.increment_access(file_bytes)
    else:
        # Process PDF
        try:
            structured_content = await pdf_processor.process(file_bytes, file.filename)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=ErrorDetail(
                    code=ErrorCode.EXTRACTION_FAILED,
                    message=str(e),
                    recoverable=True,
                    suggestions=["Try a different PDF or use text input"]
                ).model_dump(),
            )
        
        # Cache if quality is good enough
        if structured_content.extraction_quality >= settings.STRUCTURE_QUALITY_THRESHOLD:
            await pdf_cache.set_structured_content(file_bytes, structured_content)
        
        # Save to database
        pdf_doc = PDFDocument(
            user_id=user.id,
            filename=file.filename,
            file_hash=pdf_processor._compute_hash(file_bytes) if hasattr(pdf_processor, '_compute_hash') else str(hash(file_bytes)),
            file_size_bytes=len(file_bytes),
            structured_content=structured_content.model_dump(mode="json"),
            extraction_quality=structured_content.extraction_quality,
            extraction_method=structured_content.metadata.extraction_method.value,
            page_count=structured_content.metadata.page_count,
            warnings=structured_content.warnings,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.CACHE_TTL_SECONDS),
        )
        session.add(pdf_doc)
    
    # If no blocks at all, can't generate questions
    if not structured_content.blocks:
        return SuccessResponse(
            data=QuizResponse(
                quiz_id=quiz_id,
                questions=[],
                total_generated=0,
                requested_count=question_count,
                generation_time_ms=int((time.time() - start_time) * 1000),
                warnings=structured_content.warnings + [
                    "No questions could be extracted from this PDF. "
                    "Consider using a clearer PDF or text input."
                ],
            ),
            message="No questions found in PDF"
        )
    
    # Quality below threshold is a warning, not a hard blocker
    if structured_content.extraction_quality < settings.STRUCTURE_QUALITY_THRESHOLD:
        structured_content.warnings.append(
            f"Low extraction quality ({structured_content.extraction_quality:.1%}). "
            "Some questions may be inaccurate."
        )
    
    # Parse optional parameters
    topic_list = topics.split(",") if topics else None
    type_list = None
    if question_types:
        parsed_types = []
        for raw_type in question_types.split(","):
            try:
                parsed_types.append(QuizQuestionType(raw_type.strip()))
            except ValueError:
                continue
        type_list = parsed_types or None
    diff = None
    if difficulty:
        try:
            diff = DifficultyLevel(difficulty)
        except ValueError:
            pass
    
    # Run LangGraph workflow
    graph_state = QuizGenerationState(
        user_id=str(user.id),
        tier="premium" if user.is_paid else "free",
        pdf_content=structured_content,
        requested_count=question_count,
        difficulty=diff,
        question_types=type_list,
        topics=topic_list,
        selected_blocks=[],
        generated_questions=[],
        validation_errors=[],
        retry_count=0,
        final_questions=[],
        warnings=[],
        generation_time_ms=0,
    )
    
    result = await quiz_generation_graph.ainvoke(graph_state)
    
    warnings = result.get("warnings", [])
    final_questions = _playable_questions(result.get("final_questions", []), warnings)
    generation_time = result.get("generation_time_ms", 0)

    if not final_questions:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorDetail(
                code=ErrorCode.GENERATION_FAILED,
                message="AI generation did not return any playable questions. Please try again.",
                recoverable=True,
                suggestions=["Try again in a moment", "Try pasting the text instead"],
            ).model_dump(),
        )
    
    # Update user usage
    user.questions_generated_this_month += len(final_questions)
    session.add(user)
    
    # Save quiz to database
    quiz = Quiz(
        id=uuid.UUID(quiz_id),
        user_id=user.id,
        source_filename=file.filename,
        question_count=question_count,
        difficulty=difficulty,
        topics=topic_list or [],
        question_types=[qt.value for qt in type_list] if type_list else [],
        questions=[q.model_dump(mode="json") for q in final_questions],
        total_generated=len(final_questions),
        generation_time_ms=generation_time,
    )
    session.add(quiz)
    await session.commit()
    
    total_time = int((time.time() - start_time) * 1000)
    
    return SuccessResponse(
        data=QuizResponse(
            quiz_id=quiz_id,
            questions=final_questions,
            total_generated=len(final_questions),
            requested_count=question_count,
            generation_time_ms=total_time,
            source_document_id=str(pdf_doc.id) if 'pdf_doc' in locals() else None,
            warnings=warnings,
        ),
        message=f"Generated {len(final_questions)} questions"
    )


@router.post("/generate/text", response_model=SuccessResponse[QuizResponse])
async def generate_quiz_from_text(
    request: TextQuizRequest,
    user=Depends(get_current_user),
    question_limit: int = Depends(get_question_limit),
    session: AsyncSession = Depends(get_db_session),
):
    """Generate quiz from direct text input (bypasses PDF processing)."""
    start_time = time.time()
    quiz_id = str(uuid.uuid4())
    
    # Validate tier limit
    if request.question_count > question_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorDetail(
                code=ErrorCode.TIER_LIMIT_EXCEEDED,
                message=f"Your tier allows maximum {question_limit} questions",
                recoverable=True,
            ).model_dump(),
        )
    
    # Create structured content from text
    from app.schemas.pdf_structure import StructuredContent, QuestionBlock, DocumentMetadata, ExtractionMethod, QuestionType
    
    # Simple text-to-blocks conversion (could be enhanced with AI)
    text_blocks = request.text.split("\n\n")
    blocks = []
    for i, text in enumerate(text_blocks[:request.question_count]):
        if len(text.strip()) > 20:
            blocks.append(QuestionBlock(
                type=QuestionType.SHORT_ANSWER,
                question_text=text.strip()[:500],
                options=None,
                correct_answer="See source text",
                explanation="Generated from provided text",
                source_location={"paragraph": i+1},
                confidence=0.7,
            ))
    
    structured_content = StructuredContent(
        blocks=blocks,
        metadata=DocumentMetadata(
            filename="text_input.txt",
            file_size_bytes=len(request.text.encode()),
            page_count=1,
            extraction_method=ExtractionMethod.PDFMINER,
            processing_time_ms=0,
        ),
        extraction_quality=0.8,
        warnings=[],
    )
    
    # Parse parameters
    diff = None
    if request.difficulty:
        diff = request.difficulty
    
    # Run workflow
    graph_state = QuizGenerationState(
        user_id=str(user.id),
        tier="premium" if user.is_paid else "free",
        pdf_content=structured_content,
        requested_count=request.question_count,
        difficulty=diff,
        question_types=request.question_types,
        topics=request.topics,
        selected_blocks=[],
        generated_questions=[],
        validation_errors=[],
        retry_count=0,
        final_questions=[],
        warnings=[],
        generation_time_ms=0,
    )
    
    result = await quiz_generation_graph.ainvoke(graph_state)
    
    warnings = result.get("warnings", [])
    final_questions = _playable_questions(result.get("final_questions", []), warnings)
    generation_time = result.get("generation_time_ms", 0)

    if not final_questions:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorDetail(
                code=ErrorCode.GENERATION_FAILED,
                message="AI generation did not return any playable questions. Please try again.",
                recoverable=True,
                suggestions=["Try again in a moment", "Try a shorter piece of text"],
            ).model_dump(),
        )
    
    # Update user usage
    user.questions_generated_this_month += len(final_questions)
    session.add(user)
    
    # Save quiz
    quiz = Quiz(
        id=uuid.UUID(quiz_id),
        user_id=user.id,
        source_filename="text_input",
        question_count=request.question_count,
        difficulty=request.difficulty.value if request.difficulty else None,
        topics=request.topics or [],
        question_types=[qt.value for qt in request.question_types] if request.question_types else [],
        questions=[q.model_dump(mode="json") for q in final_questions],
        total_generated=len(final_questions),
        generation_time_ms=generation_time,
    )
    session.add(quiz)
    await session.commit()
    
    total_time = int((time.time() - start_time) * 1000)
    
    return SuccessResponse(
        data=QuizResponse(
            quiz_id=quiz_id,
            questions=final_questions,
            total_generated=len(final_questions),
            requested_count=request.question_count,
            generation_time_ms=total_time,
            warnings=warnings,
        ),
        message=f"Generated {len(final_questions)} questions from text"
    )


@router.get("/history", response_model=SuccessResponse[list[QuizListItem]])
async def get_quiz_history(
    limit: int = 20,
    offset: int = 0,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Get user's quiz generation history."""
    result = await session.execute(
        select(Quiz)
        .where(Quiz.user_id == user.id)
        .order_by(Quiz.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    quizzes = result.scalars().all()
    
    items = [
        QuizListItem(
            quiz_id=str(q.id),
            question_count=q.total_generated,
            created_at=q.created_at,
            source_filename=q.source_filename,
        )
        for q in quizzes
    ]
    
    return SuccessResponse(data=items)


@router.get("/{quiz_id}", response_model=SuccessResponse[QuizDetailResponse])
async def get_quiz(
    quiz_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Get specific quiz by ID."""
    from uuid import UUID

    try:
        qid = UUID(quiz_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Quiz not found",
                recoverable=False,
            ).model_dump(),
        )

    result = await session.execute(
        select(Quiz).where(Quiz.id == qid, Quiz.user_id == user.id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Quiz not found",
                recoverable=False,
            ).model_dump(),
        )
    
    return SuccessResponse(
        data=QuizDetailResponse(
            quiz_id=str(quiz.id),
            questions=quiz.questions,
            created_at=quiz.created_at,
            source_filename=quiz.source_filename,
            generation_params={
                "question_count": quiz.question_count,
                "difficulty": quiz.difficulty,
                "topics": quiz.topics,
                "question_types": quiz.question_types,
            },
        )
    )


@router.delete("/{quiz_id}", response_model=SuccessResponse)
async def delete_quiz(
    quiz_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete a quiz."""
    from uuid import UUID

    try:
        qid = UUID(quiz_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Quiz not found",
                recoverable=False,
            ).model_dump(),
        )

    result = await session.execute(
        select(Quiz).where(Quiz.id == qid, Quiz.user_id == user.id)
    )
    quiz = result.scalars().first()
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Quiz not found",
                recoverable=False,
            ).model_dump(),
        )
    
    await session.delete(quiz)
    await session.commit()
    
    return SuccessResponse(message="Quiz deleted")