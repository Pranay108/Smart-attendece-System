import json
from datetime import datetime
from typing import List, Optional
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Student, ClassRoom, BiometricProfile, AuditEvent, User
from app.schemas import (
    StudentCreate, StudentUpdate, StudentResponse, BiometricEnrollRequest
)
from app.auth import require_teacher
from app.cv.detector import detect_faces_in_image
from app.cv.matcher import extract_face_descriptor

router = APIRouter(prefix="/students", tags=["Students"])

def _to_student_response(s: Student, db: Session) -> StudentResponse:
    cls = db.query(ClassRoom).filter(ClassRoom.id == s.class_id).first()
    return StudentResponse(
        id=s.id,
        full_name=s.full_name,
        enrollment_number=s.enrollment_number,
        class_id=s.class_id,
        email=s.email,
        is_active=s.is_active,
        biometric_consent=s.biometric_consent,
        biometric_enrolled=s.biometric_enrolled,
        created_at=s.created_at,
        updated_at=s.updated_at,
        class_name=cls.name if cls else None,
        section=cls.section if cls else None
    )

@router.get("", response_model=List[StudentResponse])
def get_students(
    class_id: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    query = db.query(Student)
    if active_only:
        query = query.filter(Student.is_active == True)
    if class_id:
        query = query.filter(Student.class_id == class_id)
    if search:
        s_term = f"%{search.strip().lower()}%"
        query = query.filter(
            (func.lower(Student.full_name).like(s_term)) |
            (func.lower(Student.enrollment_number).like(s_term))
        )
    students = query.order_by(Student.full_name.asc()).all()
    return [_to_student_response(s, db) for s in students]

@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    student_in: StudentCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    # Verify enrollment number is unique
    existing = db.query(Student).filter(Student.enrollment_number == student_in.enrollment_number.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Enrollment number already exists")
        
    cls = db.query(ClassRoom).filter(ClassRoom.id == student_in.class_id).first()
    if not cls:
        raise HTTPException(status_code=400, detail="Specified class does not exist")
        
    student = Student(
        full_name=student_in.full_name.strip(),
        enrollment_number=student_in.enrollment_number.strip().upper(),
        class_id=student_in.class_id,
        email=student_in.email,
        is_active=True,
        biometric_consent=False,
        biometric_enrolled=False
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    
    # Audit event
    audit = AuditEvent(
        action="student_registered",
        entity_type="student",
        entity_id=student.id,
        actor_id=current_user.id,
        details_json=json.dumps({"enrollment_number": student.enrollment_number, "name": student.full_name})
    )
    db.add(audit)
    db.commit()
    
    return _to_student_response(student, db)

@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return _to_student_response(student, db)

@router.patch("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: str, 
    student_in: StudentUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if student_in.full_name is not None:
        student.full_name = student_in.full_name.strip()
    if student_in.email is not None:
        student.email = student_in.email
    if student_in.class_id is not None:
        cls = db.query(ClassRoom).filter(ClassRoom.id == student_in.class_id).first()
        if not cls:
            raise HTTPException(status_code=400, detail="Target class does not exist")
        student.class_id = student_in.class_id
    if student_in.is_active is not None:
        student.is_active = student_in.is_active
        
    student.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(student)
    
    audit = AuditEvent(
        action="student_updated",
        entity_type="student",
        entity_id=student.id,
        actor_id=current_user.id,
        details_json=json.dumps({"is_active": student.is_active, "name": student.full_name})
    )
    db.add(audit)
    db.commit()
    
    return _to_student_response(student, db)

@router.delete("/{student_id}")
def deactivate_student(
    student_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    """
    Deactivates student record preserving historical attendance audit trail.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    student.is_active = False
    student.updated_at = datetime.utcnow()
    
    audit = AuditEvent(
        action="student_deactivated",
        entity_type="student",
        entity_id=student.id,
        actor_id=current_user.id,
        details_json=json.dumps({"enrollment_number": student.enrollment_number})
    )
    db.add(audit)
    db.commit()
    return {"message": f"Student {student.full_name} deactivated successfully."}

@router.post("/{student_id}/biometric-enroll")
async def enroll_student_biometrics(
    student_id: str,
    consent: bool = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Explicit consent-based biometric enrollment.
    Extracts face feature vector and stores in isolated BiometricProfile table.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if not consent:
        raise HTTPException(status_code=400, detail="Explicit consent is mandatory before enrolling biometric features.")
        
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    faces = detect_faces_in_image(img_bgr)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in reference photo. Please provide a clear front-facing portrait.")
    if len(faces) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected. Reference photo must contain only the enrolling student.")
        
    best_face = faces[0]
    descriptor = extract_face_descriptor(best_face["crop_bgr"])
    
    # Store or update isolated profile
    profile = db.query(BiometricProfile).filter(BiometricProfile.student_id == student.id).first()
    if profile:
        profile.embedding_json = json.dumps(descriptor)
        profile.sample_quality = best_face["quality_score"]
        profile.consent_timestamp = datetime.utcnow()
        profile.updated_at = datetime.utcnow()
    else:
        profile = BiometricProfile(
            student_id=student.id,
            embedding_json=json.dumps(descriptor),
            sample_quality=best_face["quality_score"],
            consent_timestamp=datetime.utcnow()
        )
        db.add(profile)
        
    student.biometric_consent = True
    student.biometric_enrolled = True
    student.updated_at = datetime.utcnow()
    
    audit = AuditEvent(
        action="biometric_enrolled",
        entity_type="student",
        entity_id=student.id,
        actor_id=current_user.id,
        details_json=json.dumps({"sample_quality": best_face["quality_score"]})
    )
    db.add(audit)
    db.commit()
    
    return {
        "message": f"Biometric profile enrolled successfully for {student.full_name}",
        "quality_score": best_face["quality_score"],
        "biometric_enrolled": True
    }

@router.delete("/{student_id}/biometric")
def revoke_student_biometrics(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    """
    Revokes biometric consent and purges biometric profile vector.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    profile = db.query(BiometricProfile).filter(BiometricProfile.student_id == student.id).first()
    if profile:
        db.delete(profile)
        
    student.biometric_consent = False
    student.biometric_enrolled = False
    student.updated_at = datetime.utcnow()
    
    audit = AuditEvent(
        action="biometric_revoked",
        entity_type="student",
        entity_id=student.id,
        actor_id=current_user.id,
        details_json=json.dumps({"enrollment_number": student.enrollment_number})
    )
    db.add(audit)
    db.commit()
    
    return {"message": f"Biometric profile for {student.full_name} has been permanently revoked and deleted."}
