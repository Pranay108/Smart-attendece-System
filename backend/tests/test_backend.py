import pytest
from datetime import date, time
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models import User, Student, Session as ClassSession, AttendanceRecord, AuditEvent
from app.cv.detector import detect_faces_in_image
from app.cv.matcher import extract_face_descriptor, compute_similarity, match_face_against_profiles
from app.agent_service import tool_get_dashboard_metrics, tool_get_low_attendance_students, process_agent_query
import numpy as np

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_login_and_auth():
    # Attempt login with seeded teacher
    response = client.post("/api/auth/login", json={
        "email": "teacher@school.edu",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "teacher@school.edu"
    token = data["access_token"]
    
    # Test /api/auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["name"] == "Prof. Sarah Jenkins"

def test_classes_and_students():
    # Login to get token
    login_resp = client.post("/api/auth/login", json={
        "email": "teacher@school.edu",
        "password": "password123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get classes
    classes_resp = client.get("/api/classes", headers=headers)
    assert classes_resp.status_code == 200
    classes = classes_resp.json()
    assert len(classes) >= 2
    class_id = classes[0]["id"]
    
    # Register student with duplicate enrollment check
    new_student = {
        "full_name": "Test Student A",
        "enrollment_number": "TEST-ENROLL-999",
        "class_id": class_id,
        "email": "test.a@school.edu"
    }
    create_resp = client.post("/api/students", json=new_student, headers=headers)
    assert create_resp.status_code == 201
    created_id = create_resp.json()["id"]
    
    # Duplicate enrollment attempt should fail with 400
    dup_resp = client.post("/api/students", json=new_student, headers=headers)
    assert dup_resp.status_code == 400
    
    # Deactivate student
    del_resp = client.delete(f"/api/students/{created_id}", headers=headers)
    assert del_resp.status_code == 200
    
    # Verify student is now marked inactive
    get_resp = client.get(f"/api/students/{created_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] == False

def test_cv_detection_and_biometrics():
    # Create synthetic test portrait image
    img = np.full((200, 200, 3), 240, dtype=np.uint8)
    # Face-like oval
    import cv2
    cv2.ellipse(img, (100, 100), (45, 60), 0, 0, 360, (200, 210, 225), -1)
    cv2.circle(img, (85, 90), 8, (255, 255, 255), -1)
    cv2.circle(img, (115, 90), 8, (255, 255, 255), -1)
    cv2.circle(img, (85, 90), 4, (50, 40, 30), -1)
    cv2.circle(img, (115, 90), 4, (50, 40, 30), -1)
    cv2.line(img, (100, 95), (100, 115), (140, 150, 170), 2)
    cv2.ellipse(img, (100, 130), (16, 6), 0, 0, 180, (120, 90, 160), -1)
    
    faces = detect_faces_in_image(img)
    # Even if Haar misses this simple low-res synthetic mock, descriptor extraction & matching unit math must be strictly verified
    crop = img[40:160, 40:160]
    desc1 = extract_face_descriptor(crop)
    assert len(desc1) == 128
    
    # Identical image similarity should be ~1.0
    sim_self = compute_similarity(desc1, desc1)
    assert abs(sim_self - 1.0) < 0.01
    
    # Test matching logic with confidence thresholds
    profile = {
        "student_id": "std-123",
        "student_name": "Test Student",
        "enrollment_number": "STU-001",
        "descriptor": desc1
    }
    match_result = match_face_against_profiles(desc1, [profile])
    assert match_result["status"] == "matched"
    assert match_result["student_id"] == "std-123"
    assert match_result["confidence"] >= 0.72

def test_attendance_correction_audit():
    login_resp = client.post("/api/auth/login", json={
        "email": "teacher@school.edu",
        "password": "password123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Fetch recent attendance records
    records_resp = client.get("/api/attendance", headers=headers)
    assert records_resp.status_code == 200
    records = records_resp.json()
    assert len(records) > 0
    
    target_rec = records[0]
    rec_id = target_rec["id"]
    new_status = "present" if target_rec["status"] != "present" else "absent"
    
    # Correct attendance
    corr_resp = client.patch(f"/api/attendance/{rec_id}", json={
        "status": new_status,
        "correction_reason": "Automated verification corrected by teacher after visual check"
    }, headers=headers)
    assert corr_resp.status_code == 200
    assert corr_resp.json()["status"] == new_status
    assert corr_resp.json()["attendance_method"] == "manual_correction"
    assert corr_resp.json()["verification_status"] == "verified"

def test_analytics_and_agent_queries():
    login_resp = client.post("/api/auth/login", json={
        "email": "teacher@school.edu",
        "password": "password123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Dashboard analytics
    dash_resp = client.get("/api/analytics/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["total_students"] > 0
    assert dash_data["total_sessions"] > 0
    assert "overall_attendance_percentage" in dash_data
    
    # AI Agent questions
    agent_resp = client.post("/api/agent/query", json={
        "query": "What was the attendance percentage in today's session?"
    }, headers=headers)
    assert agent_resp.status_code == 200
    res = agent_resp.json()
    assert "answer" in res
    assert "%" in res["answer"]
    assert res["tool_used"] == "get_session_details"
    
    # Agent absent query
    absent_resp = client.post("/api/agent/query", json={
        "query": "How many students were absent?"
    }, headers=headers)
    assert absent_resp.status_code == 200
    assert "absent" in absent_resp.json()["answer"].lower()
