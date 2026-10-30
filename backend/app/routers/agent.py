from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import (
    AgentQueryRequest, AgentQueryResponse, 
    AgentSessionSummaryRequest, AgentSessionSummaryResponse
)
from app.auth import require_teacher
from app.agent_service import process_agent_query, generate_session_summary_report

router = APIRouter(prefix="/agent", tags=["AI Attendance Agent"])

@router.post("/query", response_model=AgentQueryResponse)
def query_attendance_agent(
    req: AgentQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Answers natural language questions about actual attendance records and analytics 
    using validated backend database tools.
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    result = process_agent_query(db, req.query, session_id=req.session_id)
    return AgentQueryResponse(
        query=result["query"],
        answer=result["answer"],
        tool_used=result["tool_used"],
        backend_data=result["backend_data"],
        disclaimer=result.get("disclaimer"),
        timestamp=result["timestamp"]
    )

@router.post("/session-summary", response_model=AgentSessionSummaryResponse)
def get_session_summary_report(
    req: AgentSessionSummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Generates a structured attendance and visual indicators summary report for a specific session.
    """
    try:
        res = generate_session_summary_report(db, req.session_id)
        return AgentSessionSummaryResponse(
            session_id=res["session_id"],
            session_title=res["session_title"],
            summary_markdown=res["summary_markdown"],
            metrics=res["metrics"],
            visual_indicators=res.get("visual_indicators")
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
