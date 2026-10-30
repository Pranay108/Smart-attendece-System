import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Session as ClassSession, EngagementSummary, User
from app.schemas import EngagementSummaryResponse
from app.auth import require_teacher
from app.agent_service import tool_get_session_engagement_indicators

router = APIRouter(prefix="/sessions", tags=["Engagement Indicators"])

@router.get("/{session_id}/engagement-summary")
def get_session_engagement_summary(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Returns observable visual engagement indicators with ethical guidelines and quality flags.
    """
    sess = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    data = tool_get_session_engagement_indicators(db, session_id=session_id)
    return data
