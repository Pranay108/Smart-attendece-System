import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import ClassRoom, Student, Session as ClassSession, AttendanceRecord, EngagementSummary, User
from app.schemas import (
    DashboardStatsResponse, AttendanceTrendsResponse, StudentAttendanceStatsResponse
)
from app.auth import require_teacher
from app.agent_service import tool_get_dashboard_metrics, tool_get_session_engagement_indicators

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_analytics(
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    """
    Returns verified aggregate dashboard statistics computed from real database records.
    """
    total_students = db.query(Student).filter(Student.is_active == True).count()
    total_sessions = db.query(ClassSession).count()
    
    # Latest session
    latest_sess = db.query(ClassSession).order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc()).first()
    
    latest_present = 0
    latest_absent = 0
    latest_pct = 0.0
    latest_data = None
    
    if latest_sess:
        records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == latest_sess.id).all()
        latest_present = sum(1 for r in records if r.status == "present")
        latest_absent = sum(1 for r in records if r.status == "absent")
        tot = len(records)
        latest_pct = round((latest_present / max(1, tot)) * 100.0, 1) if tot > 0 else 0.0
        
        cls = db.query(ClassRoom).filter(ClassRoom.id == latest_sess.class_id).first()
        latest_data = {
            "id": latest_sess.id,
            "title": latest_sess.title,
            "date": str(latest_sess.session_date),
            "class_name": f"{cls.name} ({cls.section})" if cls else "N/A",
            "present_count": latest_present,
            "absent_count": latest_absent,
            "attendance_percentage": latest_pct
        }
        
    # Overall attendance
    all_recs = db.query(AttendanceRecord).all()
    all_present = sum(1 for r in all_recs if r.status == "present")
    overall_pct = round((all_present / max(1, len(all_recs))) * 100.0, 1) if len(all_recs) > 0 else 0.0
    
    # Recent sessions (up to 5)
    recent_sessions_db = db.query(ClassSession).order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc()).limit(5).all()
    recent_list = []
    for s in recent_sessions_db:
        s_recs = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).all()
        p = sum(1 for r in s_recs if r.status == "present")
        a = sum(1 for r in s_recs if r.status == "absent")
        rev = sum(1 for r in s_recs if r.status == "needs_review")
        t = len(s_recs)
        rate = round((p / max(1, t)) * 100.0, 1) if t > 0 else 0.0
        c = db.query(ClassRoom).filter(ClassRoom.id == s.class_id).first()
        recent_list.append({
            "id": s.id,
            "title": s.title,
            "date": str(s.session_date),
            "class_name": f"{c.name} ({c.section})" if c else "N/A",
            "present": p,
            "absent": a,
            "needs_review": rev,
            "total": t,
            "attendance_rate": rate,
            "status": s.processing_status
        })
        
    # Latest engagement indicators
    eng_summary = tool_get_session_engagement_indicators(db)
    
    return DashboardStatsResponse(
        total_students=total_students,
        total_sessions=total_sessions,
        latest_session=latest_data,
        latest_present_count=latest_present,
        latest_absent_count=latest_absent,
        latest_attendance_percentage=latest_pct,
        overall_attendance_percentage=overall_pct,
        recent_sessions=recent_list,
        engagement_indicator_summary=eng_summary
    )

@router.get("/attendance-trends")
def get_attendance_trends(
    class_id: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Returns historical attendance trends for visualization.
    """
    query = db.query(ClassSession)
    if class_id:
        query = query.filter(ClassSession.class_id == class_id)
        
    sessions = query.order_by(ClassSession.session_date.asc(), ClassSession.start_time.asc()).limit(limit).all()
    
    trend = []
    for s in sessions:
        recs = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).all()
        p = sum(1 for r in recs if r.status == "present")
        a = sum(1 for r in recs if r.status == "absent")
        rev = sum(1 for r in recs if r.status == "needs_review")
        tot = len(recs)
        rate = round((p / max(1, tot)) * 100.0, 1) if tot > 0 else 0.0
        
        trend.append({
            "session_id": s.id,
            "title": s.title,
            "date": str(s.session_date),
            "present": p,
            "absent": a,
            "needs_review": rev,
            "total": tot,
            "attendance_rate": rate
        })
    return {"trend": trend}

@router.get("/student-attendance", response_model=List[StudentAttendanceStatsResponse])
def get_student_attendance_stats(
    class_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Calculates per-student attendance rates and status.
    """
    query = db.query(Student).filter(Student.is_active == True)
    if class_id:
        query = query.filter(Student.class_id == class_id)
    students = query.order_by(Student.full_name.asc()).all()
    
    results = []
    for s in students:
        total_records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id).count()
        attended = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == s.id, 
            AttendanceRecord.status == "present"
        ).count()
        pct = round((attended / max(1, total_records)) * 100.0, 1) if total_records > 0 else 0.0
        
        status_label = "Good" if pct >= 75.0 else ("Warning" if pct >= 60.0 else "Low")
        if total_records == 0:
            status_label = "N/A"
            
        c = db.query(ClassRoom).filter(ClassRoom.id == s.class_id).first()
        results.append(StudentAttendanceStatsResponse(
            student_id=s.id,
            full_name=s.full_name,
            enrollment_number=s.enrollment_number,
            class_name=f"{c.name} ({c.section})" if c else "N/A",
            total_sessions=total_records,
            attended_sessions=attended,
            attendance_percentage=pct,
            status=status_label
        ))
    return results
