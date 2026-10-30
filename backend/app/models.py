import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date, Time, 
    ForeignKey, Text, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="teacher", nullable=False) # teacher, admin
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    sessions_created = relationship("Session", back_populates="creator")

class ClassRoom(Base):
    __tablename__ = "classes"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False) # e.g. "Computer Vision 101"
    section = Column(String(50), nullable=False) # e.g. "Section A"
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    students = relationship("Student", back_populates="classroom", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="classroom", cascade="all, delete-orphan")

class Student(Base):
    __tablename__ = "students"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    full_name = Column(String(120), nullable=False, index=True)
    enrollment_number = Column(String(60), unique=True, index=True, nullable=False)
    class_id = Column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    biometric_consent = Column(Boolean, default=False, nullable=False)
    biometric_enrolled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    classroom = relationship("ClassRoom", back_populates="students")
    biometric_profile = relationship("BiometricProfile", back_populates="student", uselist=False, cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")

class BiometricProfile(Base):
    __tablename__ = "biometric_profiles"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    embedding_json = Column(Text, nullable=False) # Serialized facial feature descriptor vector
    sample_quality = Column(Float, default=1.0, nullable=False)
    consent_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    student = relationship("Student", back_populates="biometric_profile")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(150), nullable=False)
    class_id = Column(String(36), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    session_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=True)
    processing_status = Column(String(30), default="ready", nullable=False) # ready, processing, completed, failed
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    classroom = relationship("ClassRoom", back_populates="sessions")
    creator = relationship("User", back_populates="sessions_created")
    attendance_records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="session", cascade="all, delete-orphan")
    engagement_summaries = relationship("EngagementSummary", back_populates="session", cascade="all, delete-orphan")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="absent", nullable=False) # present, absent, needs_review
    attendance_method = Column(String(30), default="manual", nullable=False) # manual, image_detection, video_detection, manual_correction
    verification_status = Column(String(30), default="unverified", nullable=False) # unverified, verified, flagged_review
    detection_timestamp = Column(DateTime, nullable=True)
    confidence = Column(Float, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    session = relationship("Session", back_populates="attendance_records")
    student = relationship("Student", back_populates="attendance_records")
    
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student_attendance"),
        Index("idx_session_status", "session_id", "status"),
    )

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    media_type = Column(String(20), nullable=False) # image, video
    file_path = Column(String(255), nullable=False)
    processing_status = Column(String(20), default="pending", nullable=False) # pending, processing, completed, failed
    progress = Column(Integer, default=0, nullable=False) # 0-100%
    error_summary = Column(Text, nullable=True)
    total_faces_detected = Column(Integer, default=0, nullable=False)
    matched_count = Column(Integer, default=0, nullable=False)
    review_needed_count = Column(Integer, default=0, nullable=False)
    results_json = Column(Text, nullable=True) # Serialized detailed detection bounding boxes and match scores
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    session = relationship("Session", back_populates="processing_jobs")

class EngagementSummary(Base):
    __tablename__ = "engagement_summaries"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    analysis_method = Column(String(50), default="head_pose_and_visibility", nullable=False)
    aggregate_metrics = Column(Text, nullable=False) # JSON: {frames_analyzed, avg_presentation_oriented_ratio, visibility_ratio, etc.}
    limitations_and_quality_flags = Column(Text, nullable=False) # JSON: {lighting_quality, occlusion_detected, ethical_disclaimer, etc.}
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    session = relationship("Session", back_populates="engagement_summaries")

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    action = Column(String(50), nullable=False, index=True) # e.g. attendance_correction, student_deactivated, biometric_enrolled
    entity_type = Column(String(50), nullable=False) # attendance_record, student, session
    entity_id = Column(String(36), nullable=False)
    actor_id = Column(String(36), nullable=True)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
