from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Session as ClassSession, ClassRoom, Student, AttendanceRecord, User
from app.schemas import SessionCreate, SessionUpdate, SessionResponse, AttendanceRecordResponse
from app.auth import require_teacher
from app.cv.processor import ensure_session_student_records

router = APIRouter(prefix="/sessions", tags=["Sessions"])

def _to_session_response(s: ClassSession, db: Session) -> SessionResponse:
    cls = db.query(ClassRoom).filter(ClassRoom.id == s.class_id).first()
    
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).all()
    present_cnt = sum(1 for r in records if r.status == "present")
    absent_cnt = sum(1 for r in records if r.status == "absent")
    review_cnt = sum(1 for r in records if r.status == "needs_review")
    total_cnt = len(records)
    pct = round((present_cnt / max(1, total_cnt)) * 100.0, 1) if total_cnt > 0 else 0.0
    
    return SessionResponse(
        id=s.id,
        title=s.title,
        class_id=s.class_id,
        session_date=s.session_date,
        start_time=s.start_time,
        end_time=s.end_time,
        processing_status=s.processing_status,
        created_by=s.created_by,
        created_at=s.created_at,
        class_name=cls.name if cls else None,
        section=cls.section if cls else None,
        total_students=total_cnt,
        present_count=present_cnt,
        absent_count=absent_cnt,
        needs_review_count=review_cnt,
        attendance_percentage=pct
    )

@router.get("", response_model=List[SessionResponse])
def get_sessions(
    class_id: Optional[str] = None, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    query = db.query(ClassSession)
    if class_id:
        query = query.filter(ClassSession.class_id == class_id)
    sessions = query.order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc()).all()
    return [_to_session_response(s, db) for s in sessions]

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: SessionCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    cls = db.query(ClassRoom).filter(ClassRoom.id == session_in.class_id).first()
    if not cls:
        raise HTTPException(status_code=400, detail="Specified class does not exist")
        
    session = ClassSession(
        title=session_in.title.strip(),
        class_id=session_in.class_id,
        session_date=session_in.session_date,
        start_time=session_in.start_time,
        end_time=session_in.end_time,
        processing_status="ready",
        created_by=current_user.id
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Pre-populate session records for all active students in the class
    ensure_session_student_records(db, session.id, session.class_id)
    
    return _to_session_response(session, db)

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    s = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return _to_session_response(s, db)

@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: str, 
    session_in: SessionUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    s = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session_in.title is not None:
        s.title = session_in.title.strip()
    if session_in.session_date is not None:
        s.session_date = session_in.session_date
    if session_in.start_time is not None:
        s.start_time = session_in.start_time
    if session_in.end_time is not None:
        s.end_time = session_in.end_time
    if session_in.processing_status is not None:
        s.processing_status = session_in.processing_status
        
    db.commit()
    db.refresh(s)
    return _to_session_response(s, db)

@router.get("/{session_id}/attendance", response_model=List[AttendanceRecordResponse])
def get_session_attendance(
    session_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Ensure all enrolled students are represented
    ensure_session_student_records(db, session_id, session.class_id)
    
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    results = []
    for r in records:
        student = db.query(Student).filter(Student.id == r.student_id).first()
        results.append(AttendanceRecordResponse(
            id=r.id,
            session_id=r.session_id,
            student_id=r.student_id,
            status=r.status,
            attendance_method=r.attendance_method,
            verification_status=r.verification_status,
            detection_timestamp=r.detection_timestamp,
            confidence=r.confidence,
            reviewed_by=r.reviewed_by,
            reviewed_at=r.reviewed_at,
            created_at=r.created_at,
            updated_at=r.updated_at,
            student_name=student.full_name if student else "Unknown",
            enrollment_number=student.enrollment_number if student else "N/A"
        ))
        
    # Sort: needs_review first, then present, then absent; secondary sort alphabetically by student name
    order_map = {"needs_review": 0, "present": 1, "absent": 2}
    results.sort(key=lambda x: (order_map.get(x.status, 3), x.student_name))
    return results
