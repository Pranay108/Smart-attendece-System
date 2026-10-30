from datetime import datetime, date, time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "teacher"

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    created_at: datetime
    model_config = {"from_attributes": True}

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Class Schemas
class ClassRoomBase(BaseModel):
    name: str
    section: str
    description: Optional[str] = None

class ClassRoomCreate(ClassRoomBase):
    pass

class ClassRoomResponse(ClassRoomBase):
    id: str
    created_at: datetime
    student_count: Optional[int] = 0
    session_count: Optional[int] = 0
    model_config = {"from_attributes": True}

# Student Schemas
class StudentBase(BaseModel):
    full_name: str
    enrollment_number: str
    class_id: str
    email: Optional[EmailStr] = None

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    class_id: Optional[str] = None
    is_active: Optional[bool] = None

class BiometricEnrollRequest(BaseModel):
    consent: bool = Field(..., description="Explicit teacher/student consent to store biometric feature descriptor")
    image_base64: Optional[str] = None # Or uploaded via form data

class StudentResponse(StudentBase):
    id: str
    is_active: bool
    biometric_consent: bool
    biometric_enrolled: bool
    created_at: datetime
    updated_at: datetime
    class_name: Optional[str] = None
    section: Optional[str] = None
    model_config = {"from_attributes": True}

# Session Schemas
class SessionBase(BaseModel):
    title: str
    class_id: str
    session_date: date
    start_time: time
    end_time: Optional[time] = None

class SessionCreate(SessionBase):
    pass

class SessionUpdate(BaseModel):
    title: Optional[str] = None
    session_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    processing_status: Optional[str] = None

class SessionResponse(SessionBase):
    id: str
    processing_status: str
    created_by: Optional[str] = None
    created_at: datetime
    class_name: Optional[str] = None
    section: Optional[str] = None
    total_students: Optional[int] = 0
    present_count: Optional[int] = 0
    absent_count: Optional[int] = 0
    needs_review_count: Optional[int] = 0
    attendance_percentage: Optional[float] = 0.0
    model_config = {"from_attributes": True}

# Attendance Schemas
class AttendanceRecordBase(BaseModel):
    status: str # present, absent, needs_review
    attendance_method: str = "manual" # manual, image_detection, video_detection, manual_correction
    verification_status: str = "unverified" # unverified, verified, flagged_review

class AttendanceRecordUpdate(BaseModel):
    status: str
    correction_reason: Optional[str] = None

class BulkAttendanceCorrection(BaseModel):
    records: List[Dict[str, Any]] # list of {student_id, status, reason}

class AttendanceRecordResponse(AttendanceRecordBase):
    id: str
    session_id: str
    student_id: str
    detection_timestamp: Optional[datetime] = None
    confidence: Optional[float] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    student_name: Optional[str] = None
    enrollment_number: Optional[str] = None
    model_config = {"from_attributes": True}

# Processing Job Schemas
class ProcessingJobResponse(BaseModel):
    id: str
    session_id: str
    media_type: str
    processing_status: str
    progress: int
    error_summary: Optional[str] = None
    total_faces_detected: int
    matched_count: int
    review_needed_count: int
    results_json: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# Engagement Schemas
class EngagementSummaryResponse(BaseModel):
    id: str
    session_id: str
    analysis_method: str
    aggregate_metrics: Dict[str, Any]
    limitations_and_quality_flags: Dict[str, Any]
    created_at: datetime
    model_config = {"from_attributes": True}

# Analytics Schemas
class DashboardStatsResponse(BaseModel):
    total_students: int
    total_sessions: int
    latest_session: Optional[Dict[str, Any]] = None
    latest_present_count: int
    latest_absent_count: int
    latest_attendance_percentage: float
    overall_attendance_percentage: float
    recent_sessions: List[Dict[str, Any]]
    engagement_indicator_summary: Dict[str, Any]

class AttendanceTrendsResponse(BaseModel):
    trend: List[Dict[str, Any]] # date, session_title, present, absent, rate

class StudentAttendanceStatsResponse(BaseModel):
    student_id: str
    full_name: str
    enrollment_number: str
    class_name: str
    total_sessions: int
    attended_sessions: int
    attendance_percentage: float
    status: str # Good, Warning, Low

# Agent Schemas
class AgentQueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None

class AgentQueryResponse(BaseModel):
    query: str
    answer: str
    tool_used: str
    backend_data: Dict[str, Any]
    disclaimer: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AgentSessionSummaryRequest(BaseModel):
    session_id: str

class AgentSessionSummaryResponse(BaseModel):
    session_id: str
    session_title: str
    summary_markdown: str
    metrics: Dict[str, Any]
    visual_indicators: Optional[Dict[str, Any]] = None
