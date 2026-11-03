"""LangGraph node functions for quiz generation."""
import time
from typing import List, Dict, Any, Optional

from app.graphs.state import QuizGenerationState
from app.schemas.quiz import GeneratedQuestion
from app.services.gemini_client import gemini_client
from app.config.settings import get_settings


settings = get_settings()


def normalize_playable_question(question: GeneratedQuestion) -> Optional[GeneratedQuestion]:
    """Normalize a generated question into a form the quiz UI can play."""
    type_value = getattr(question.type, "value", question.type)
    if not question.question_text or len(question.question_text.strip()) < 10:
        return None

    if type_value == "multiple_choice":
        options = [
            str(option).strip()
            for option in (question.options or [])
            if str(option).strip()
        ]
        if len(options) < 2:
            return None

        answer = str(question.correct_answer or "").strip()
        if not answer:
            return None

        match = next(
            (option for option in options if option.casefold() == answer.casefold()),
            None,
        )
        if match is None:
            letter = answer.strip("() .").upper()
            if len(letter) == 1 and "A" <= letter <= "D":
                index = ord(letter) - ord("A")
                if index < len(options):
                    match = options[index]
        if match is None:
            return None

        question.options = options
        question.correct_answer = match
        return question

    if type_value == "true_false":
        answer = str(question.correct_answer or "").strip().casefold()
        if answer not in {"true", "false"}:
            return None
        question.options = ["True", "False"]
        question.correct_answer = "True" if answer == "true" else "False"
        return question

    return None


def validate_request_node(state: QuizGenerationState) -> QuizGenerationState:
    """Validate request parameters and check tier limits."""
    warnings = []
    
    # Check question count against tier limit
    max_questions = settings.PREMIUM_QUESTION_MAX if state["tier"] == "premium" else settings.FREE_QUESTION_MAX
    min_questions = settings.PREMIUM_QUESTION_MIN if state["tier"] == "premium" else settings.FREE_QUESTION_MIN
    
    if state["requested_count"] > max_questions:
        raise ValueError(f"Question count exceeds {state['tier']} tier limit of {max_questions}")
    
    if state["requested_count"] < min_questions:
        warnings.append(f"Minimum {min_questions} questions for {state['tier']} tier")
    
    # Check PDF content quality
    pdf_content = state["pdf_content"]
    if pdf_content.extraction_quality < settings.STRUCTURE_QUALITY_THRESHOLD:
        warnings.append(f"Low PDF extraction quality ({pdf_content.extraction_quality:.1%})")
    
    if not pdf_content.blocks:
        raise ValueError("No questions found in PDF content")
    
    return {
        **state,
        "warnings": warnings,
        "validation_errors": [],
        "retry_count": 0,
    }


def select_questions_node(state: QuizGenerationState) -> QuizGenerationState:
    """Select best question blocks for generation."""
    blocks = state["pdf_content"].blocks
    requested = state["requested_count"]
    
    # Filter by confidence
    min_confidence = 0.4
    valid_blocks = [b for b in blocks if b.confidence >= min_confidence]
    
    if len(valid_blocks) < requested:
        # Use all available, will generate fewer
        selected = valid_blocks
    else:
        # Sort by confidence and select top
        sorted_blocks = sorted(valid_blocks, key=lambda b: b.confidence, reverse=True)
        selected = sorted_blocks[:requested]
    
    # Convert to dict for serialization
    selected_dicts = []
    for block in selected:
        selected_dicts.append({
            "type": block.type.value,
            "question_text": block.question_text,
            "options": block.options,
            "correct_answer": block.correct_answer,
            "explanation": block.explanation,
            "source_location": block.source_location,
            "confidence": block.confidence,
        })
    
    return {
        **state,
        "selected_blocks": selected_dicts,
    }


async def generate_quiz_node(state: QuizGenerationState) -> QuizGenerationState:
    """Generate quiz using Gemini AI."""
    start_time = time.time()
    
    # Prepare structured content for prompt
    blocks = state["selected_blocks"]
    structured_text = ""
    for i, block in enumerate(blocks):
        structured_text += f"\n--- Block {i+1} (confidence: {block['confidence']:.2f}) ---\n"
        structured_text += f"Type: {block['type']}\n"
        structured_text += f"Question: {block['question_text']}\n"
        if block['options']:
            structured_text += f"Options: {', '.join(block['options'])}\n"
        structured_text += f"Answer: {block['correct_answer']}\n"
        if block['explanation']:
            structured_text += f"Explanation: {block['explanation']}\n"
    
    # Generate quiz
    difficulty = getattr(state["difficulty"], "value", state["difficulty"]) or "medium"
    question_types = (
        [getattr(qt, "value", qt) for qt in state["question_types"]]
        if state["question_types"]
        else None
    )
    response = await gemini_client.generate_quiz(
        structured_content=structured_text,
        question_count=state["requested_count"],
        difficulty=difficulty,
        question_types=question_types,
        topics=state["topics"],
    )
    
    generation_time = int((time.time() - start_time) * 1000)
    
    if not response.success:
        return {
            **state,
            "validation_errors": [f"Generation failed: {response.error}"],
            "generation_time_ms": generation_time,
        }
    
    # Parse generated questions
    questions = _parse_generated_questions(response.text, state["requested_count"])
    
    return {
        **state,
        "generated_questions": questions,
        "generation_time_ms": generation_time,
    }


def validate_output_node(state: QuizGenerationState) -> QuizGenerationState:
    """Validate generated questions."""
    questions = state["generated_questions"]
    errors = []
    warnings = state.get("warnings", [])
    
    if not questions:
        errors.append("No questions generated")
        return {**state, "validation_errors": errors}
    
    # Check count
    if len(questions) < state["requested_count"]:
        warnings.append(f"Generated {len(questions)}/{state['requested_count']} questions")
    
    # Validate each question
    valid_questions = []
    for i, q in enumerate(questions):
        normalized = normalize_playable_question(q)
        if normalized is None:
            errors.append(
                f"Q{i+1}: Question is not playable; it needs at least two options "
                "and a correct answer that matches one of them"
            )
            continue
        valid_questions.append(normalized)
    
    if not valid_questions:
        errors.append("No valid questions after validation")
    
    return {
        **state,
        "generated_questions": valid_questions,
        "validation_errors": errors,
        "warnings": warnings,
    }


def reflect_and_retry_node(state: QuizGenerationState) -> QuizGenerationState:
    """Reflect on errors and prepare for retry."""
    retry_count = state.get("retry_count", 0) + 1
    max_retries = 2
    
    if retry_count > max_retries:
        return {
            **state,
            "retry_count": retry_count,
            "validation_errors": state["validation_errors"] + ["Max retries exceeded"],
        }
    
    # Add reflection context for next generation
    errors = state["validation_errors"]
    reflection = f"Previous attempt had errors: {'; '.join(errors)}. "
    reflection += "Please ensure: valid JSON format, correct answer in options, clear questions."
    
    # Add reflection to warnings for next iteration
    warnings = state.get("warnings", [])
    warnings.append(f"Retry {retry_count}/{max_retries}: {reflection}")
    
    return {
        **state,
        "retry_count": retry_count,
        "warnings": warnings,
        "validation_errors": [],  # Clear for next attempt
    }


def finalize_node(state: QuizGenerationState) -> QuizGenerationState:
    """Finalize and prepare output."""
    questions = state["generated_questions"]
    
    # Ensure we have at least some questions
    if not questions and state["selected_blocks"]:
        # Fallback: create basic questions from selected blocks
        questions = _create_fallback_questions(state["selected_blocks"])
    
    # Trim to requested count
    questions = questions[:state["requested_count"]]
    
    # Assign IDs
    for i, q in enumerate(questions):
        if not q.id:
            q.id = f"q{i+1}"
    
    return {
        **state,
        "final_questions": questions,
        "generation_time_ms": state.get("generation_time_ms", 0),
    }


def _parse_generated_questions(response_text: str, expected_count: int) -> List[GeneratedQuestion]:
    """Parse Gemini response into GeneratedQuestion objects."""
    import json
    
    questions = []
    
    try:
        # Extract JSON array
        start = response_text.find('[')
        end = response_text.rfind(']') + 1
        if start >= 0 and end > start:
            json_str = response_text[start:end]
        else:
            json_str = response_text
        
        data = json.loads(json_str)
        
        for item in data:
            try:
                q = GeneratedQuestion(
                    id=item.get("id", ""),
                    type=item.get("type", "multiple_choice"),
                    question_text=item.get("question_text", ""),
                    options=item.get("options"),
                    correct_answer=item.get("correct_answer", ""),
                    explanation=item.get("explanation"),
                    difficulty=item.get("difficulty", "medium"),
                    topic_tags=item.get("topic_tags", []),
                    source_reference=item.get("source_reference"),
                )
                questions.append(q)
            except Exception:
                continue
    
    except Exception:
        pass
    
    return questions


def _create_fallback_questions(blocks: List[Dict[str, Any]]) -> List[GeneratedQuestion]:
    """Create basic questions from selected blocks as fallback."""
    questions = []
    
    for i, block in enumerate(blocks):
        try:
            q = GeneratedQuestion(
                id=f"fallback_{i+1}",
                type=block.get("type", "multiple_choice"),
                question_text=block.get("question_text", ""),
                options=block.get("options"),
                correct_answer=block.get("correct_answer", ""),
                explanation=block.get("explanation"),
                difficulty="medium",
                topic_tags=[],
                source_reference=block.get("source_location", {}).get("page"),
            )
            normalized = normalize_playable_question(q)
            if normalized is not None:
                questions.append(normalized)
        except Exception:
            continue
    
    return questions


def route_after_validation(state: QuizGenerationState) -> str:
    """Route after validation: retry or finalize."""
    if state["validation_errors"] and state.get("retry_count", 0) < 2:
        return "retry"
    return "finalize"