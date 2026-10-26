"""LangGraph workflow builder for quiz generation."""
from langgraph.graph import StateGraph, START, END
from app.graphs.state import QuizGenerationState
from app.graphs.nodes import (
    validate_request_node,
    select_questions_node,
    generate_quiz_node,
    validate_output_node,
    reflect_and_retry_node,
    finalize_node,
    route_after_validation,
)


def build_quiz_generation_graph() -> StateGraph:
    """Build the quiz generation workflow graph."""
    workflow = StateGraph(QuizGenerationState)
    
    # Add nodes
    workflow.add_node("validate_request", validate_request_node)
    workflow.add_node("select_questions", select_questions_node)
    workflow.add_node("generate_quiz", generate_quiz_node)
    workflow.add_node("validate_output", validate_output_node)
    workflow.add_node("reflect_and_retry", reflect_and_retry_node)
    workflow.add_node("finalize", finalize_node)
    
    # Define edges
    workflow.add_edge(START, "validate_request")

    workflow.add_edge("validate_request", "select_questions")
    workflow.add_edge("select_questions", "generate_quiz")
    workflow.add_edge("generate_quiz", "validate_output")
    
    # Conditional edge after validation
    workflow.add_conditional_edges(
        "validate_output",
        route_after_validation,
        {
            "retry": "reflect_and_retry",
            "finalize": "finalize",
        }
    )
    
    workflow.add_edge("reflect_and_retry", "generate_quiz")
    workflow.add_edge("finalize", END)
    
    return workflow.compile()


# Compile once at module load
quiz_generation_graph = build_quiz_generation_graph()