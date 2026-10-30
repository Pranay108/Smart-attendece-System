import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AttendanceRecord, Student, AuditEvent, User
from app.schemas import (
    AttendanceRecordResponse, AttendanceRecordUpdate, BulkAttendanceCorrection
)
from app.auth import require_teacher

router = APIRouter(prefix="/attendance", tags=["Attendance Management"])

@router.get("", response_model=List[AttendanceRecordResponse])
def get_attendance_records(
    session_id: Optional[str] = None,
    student_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    query = db.query(AttendanceRecord)
    if session_id:
        query = query.filter(AttendanceRecord.session_id == session_id)
    if student_id:
        query = query.filter(AttendanceRecord.student_id == student_id)
    if status_filter:
        query = query.filter(AttendanceRecord.status == status_filter)
        
    records = query.order_by(AttendanceRecord.created_at.desc()).all()
    results = []
    for r in records:
        st = db.query(Student).filter(Student.id == r.student_id).first()
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
            student_name=st.full_name if st else "Unknown",
            enrollment_number=st.enrollment_number if st else "N/A"
        ))
    return results

@router.patch("/{attendance_id}", response_model=AttendanceRecordResponse)
def correct_attendance_record(
    attendance_id: str,
    update_in: AttendanceRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Teacher corrects automated or existing attendance record.
    Preserves audit trail and updates verification status to verified.
    """
    rec = db.query(AttendanceRecord).filter(AttendanceRecord.id == attendance_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    valid_statuses = {"present", "absent", "needs_review"}
    if update_in.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        
    old_status = rec.status
    rec.status = update_in.status
    rec.attendance_method = "manual_correction"
    rec.verification_status = "verified"
    rec.reviewed_by = current_user.id
    rec.reviewed_at = datetime.utcnow()
    rec.updated_at = datetime.utcnow()
    
    # Audit log entry
    audit = AuditEvent(
        action="attendance_corrected",
        entity_type="attendance_record",
        entity_id=rec.id,
        actor_id=current_user.id,
        details_json=json.dumps({
            "session_id": rec.session_id,
            "student_id": rec.student_id,
            "old_status": old_status,
            "new_status": rec.status,
            "reason": update_in.correction_reason or "Manual faculty review"
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(rec)
    
    st = db.query(Student).filter(Student.id == rec.student_id).first()
    return AttendanceRecordResponse(
        id=rec.id,
        session_id=rec.session_id,
        student_id=rec.student_id,
        status=rec.status,
        attendance_method=rec.attendance_method,
        verification_status=rec.verification_status,
        detection_timestamp=rec.detection_timestamp,
        confidence=rec.confidence,
        reviewed_by=rec.reviewed_by,
        reviewed_at=rec.reviewed_at,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        student_name=st.full_name if st else "Unknown",
        enrollment_number=st.enrollment_number if st else "N/A"
    )

@router.post("/sessions/{session_id}/attendance/bulk-correction")
def bulk_attendance_correction(
    session_id: str,
    bulk_in: BulkAttendanceCorrection,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Applies bulk attendance verification and corrections for an entire session.
    """
    updated_count = 0
    for item in bulk_in.records:
        std_id = item.get("student_id")
        new_status = item.get("status")
        if not std_id or new_status not in {"present", "absent", "needs_review"}:
            continue
            
        rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.student_id == std_id
        ).first()
        if rec:
            rec.status = new_status
            rec.attendance_method = "manual_correction"
            rec.verification_status = "verified"
            rec.reviewed_by = current_user.id
            rec.reviewed_at = datetime.utcnow()
            rec.updated_at = datetime.utcnow()
            updated_count += 1
            
    audit = AuditEvent(
        action="bulk_attendance_correction",
        entity_type="session",
        entity_id=session_id,
        actor_id=current_user.id,
        details_json=json.dumps({"updated_records_count": updated_count})
    )
    db.add(audit)
    db.commit()
    return {"message": f"Successfully updated {updated_count} attendance records."}
