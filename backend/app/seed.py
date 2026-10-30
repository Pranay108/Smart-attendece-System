import json
import uuid
from datetime import datetime, date, time, timedelta
import cv2
import numpy as np
from pathlib import Path

from app.database import SessionLocal, engine, Base
from app.models import (
    User, ClassRoom, Student, BiometricProfile, Session as ClassSession, 
    AttendanceRecord, EngagementSummary, AuditEvent
)
from app.auth import hash_password
from app.config import MEDIA_DIR, CROPS_DIR
from app.cv.detector import detect_faces_in_image, save_crop_image
from app.cv.matcher import extract_face_descriptor
from app.cv.engagement import ETHICAL_DISCLAIMER

def generate_sample_face_image(name: str, seed: int = 42) -> np.ndarray:
    """
    Generates a synthetic portrait image with a detectable face structure
    for immediate local testing and biometric enrollment.
    """
    np.random.seed(seed)
    img = np.full((320, 320, 3), (240, 240, 245), dtype=np.uint8)
    
    # Head contour (ellipse)
    center = (160, 160)
    cv2.ellipse(img, center, (70, 95), 0, 0, 360, (190, 210, 230), -1)
    cv2.ellipse(img, center, (70, 95), 0, 0, 360, (140, 160, 180), 2)
    
    # Eyes (dark circles with white sclera)
    cv2.circle(img, (135, 140), 12, (255, 255, 255), -1)
    cv2.circle(img, (185, 140), 12, (255, 255, 255), -1)
    cv2.circle(img, (135, 140), 6, (60, 40, 20), -1)
    cv2.circle(img, (185, 140), 6, (60, 40, 20), -1)
    
    # Eyebrows
    cv2.line(img, (120, 122), (150, 124), (50, 40, 30), 3)
    cv2.line(img, (170, 124), (200, 122), (50, 40, 30), 3)
    
    # Nose
    cv2.line(img, (160, 145), (155, 175), (140, 150, 170), 2)
    cv2.line(img, (155, 175), (165, 175), (140, 150, 170), 2)
    
    # Mouth
    cv2.ellipse(img, (160, 200), (25, 10), 0, 0, 180, (120, 90, 160), -1)
    
    # Hair
    cv2.ellipse(img, (160, 110), (75, 45), 0, 180, 360, (50, 35, 25), -1)
    
    # Label
    cv2.putText(img, name, (20, 300), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 50), 2)
    return img

def generate_sample_classroom_image(faces_count: int = 4) -> np.ndarray:
    """
    Creates a classroom panoramic photo with multiple student desks and detectable faces.
    """
    canvas = np.full((480, 800, 3), (245, 247, 250), dtype=np.uint8)
    
    # Background board and wall
    cv2.rectangle(canvas, (50, 20), (750, 150), (45, 75, 55), -1) # Green chalkboard
    cv2.putText(canvas, "Computer Vision 101: Attendance & Features", (70, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    
    # Desks in foreground
    cv2.rectangle(canvas, (0, 340), (800, 480), (210, 195, 180), -1)
    
    # Insert students
    positions = [(120, 260), (300, 250), (480, 260), (660, 250)]
    for i in range(min(faces_count, len(positions))):
        cx, cy = positions[i]
        # Body
        cv2.ellipse(canvas, (cx, cy + 110), (65, 60), 0, 0, 360, (60 + i*30, 90 + i*20, 160), -1)
        # Head
        cv2.ellipse(canvas, (cx, cy), (42, 55), 0, 0, 360, (190, 210, 230), -1)
        # Eyes
        cv2.circle(canvas, (cx - 15, cy - 10), 5, (50, 40, 30), -1)
        cv2.circle(canvas, (cx + 15, cy - 10), 5, (50, 40, 30), -1)
        # Nose & Mouth
        cv2.line(canvas, (cx, cy - 5), (cx, cy + 12), (140, 150, 170), 2)
        cv2.ellipse(canvas, (cx, cy + 26), (15, 6), 0, 0, 180, (120, 90, 160), 2)
        # Hair
        cv2.ellipse(canvas, (cx, cy - 30), (44, 25), 0, 180, 360, (50, 35, 25), -1)
        
    return canvas

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Check if already seeded
        if db.query(User).filter(User.email == "teacher@school.edu").first():
            print("Database already contains seed teacher. Skipping duplicate seed.")
            return

        print("Seeding database with professional initial records...")
        
        # 1. Primary Teacher User
        teacher = User(
            name="Prof. Sarah Jenkins",
            email="teacher@school.edu",
            password_hash=hash_password("password123"),
            role="teacher"
        )
        db.add(teacher)
        db.commit()
        db.refresh(teacher)
        
        # 2. Classes
        class_a = ClassRoom(
            name="Computer Vision & AI",
            section="Section A",
            description="Foundations of Computer Vision, Detection, and Visual Indicators"
        )
        class_b = ClassRoom(
            name="Data Structures & Algorithms",
            section="Section B",
            description="Algorithmic problem solving and data modeling"
        )
        db.add_all([class_a, class_b])
        db.commit()
        db.refresh(class_a)
        db.refresh(class_b)
        
        # 3. Students
        students_data = [
            ("Alex Mercer", "STU-2026-001", "alex.mercer@univ.edu", True),
            ("Elena Rostova", "STU-2026-002", "elena.r@univ.edu", True),
            ("Marcus Chen", "STU-2026-003", "marcus.c@univ.edu", True),
            ("Priya Sharma", "STU-2026-004", "priya.s@univ.edu", True),
            ("Liam O'Connor", "STU-2026-005", "liam.oc@univ.edu", False), # No biometric consent
            ("Zoe Martinez", "STU-2026-006", "zoe.m@univ.edu", True),
            ("David Kim", "STU-2026-007", "david.kim@univ.edu", True),
            ("Aisha Al-Mansoor", "STU-2026-008", "aisha.m@univ.edu", True),
        ]
        
        created_students = []
        for name, enroll, email, has_consent in students_data:
            st = Student(
                full_name=name,
                enrollment_number=enroll,
                class_id=class_a.id,
                email=email,
                is_active=True,
                biometric_consent=has_consent,
                biometric_enrolled=has_consent
            )
            db.add(st)
            db.commit()
            db.refresh(st)
            created_students.append(st)
            
            # If consented, create a biometric profile
            if has_consent:
                face_img = generate_sample_face_image(name, seed=len(created_students) * 17)
                desc = extract_face_descriptor(face_img)
                prof = BiometricProfile(
                    student_id=st.id,
                    embedding_json=json.dumps(desc),
                    sample_quality=0.92,
                    consent_timestamp=datetime.utcnow() - timedelta(days=20)
                )
                db.add(prof)
                db.commit()
                
        # Class B students
        students_b_data = [
            ("Benjamin Taylor", "STU-2026-009", "ben.t@univ.edu"),
            ("Chloe Bennett", "STU-2026-010", "chloe.b@univ.edu"),
            ("Daniel Vance", "STU-2026-011", "daniel.v@univ.edu"),
            ("Fatima Zahra", "STU-2026-012", "fatima.z@univ.edu"),
        ]
        for name, enroll, email in students_b_data:
            st = Student(
                full_name=name,
                enrollment_number=enroll,
                class_id=class_b.id,
                email=email,
                is_active=True,
                biometric_consent=False,
                biometric_enrolled=False
            )
            db.add(st)
        db.commit()
        
        # 4. Sessions for Class A
        today = date.today()
        sess1 = ClassSession(
            title="Lecture 1: Introduction to CV & Image Processing",
            class_id=class_a.id,
            session_date=today - timedelta(days=10),
            start_time=time(9, 30),
            end_time=time(11, 0),
            processing_status="completed",
            created_by=teacher.id
        )
        sess2 = ClassSession(
            title="Lecture 2: Edge Detection & Spatial Filtering",
            class_id=class_a.id,
            session_date=today - timedelta(days=7),
            start_time=time(9, 30),
            end_time=time(11, 0),
            processing_status="completed",
            created_by=teacher.id
        )
        sess3 = ClassSession(
            title="Lecture 3: Feature Descriptors and Keypoints",
            class_id=class_a.id,
            session_date=today - timedelta(days=3),
            start_time=time(9, 30),
            end_time=time(11, 0),
            processing_status="completed",
            created_by=teacher.id
        )
        sess4 = ClassSession(
            title="Lecture 4: Face Detection & Observable Indicators",
            class_id=class_a.id,
            session_date=today,
            start_time=time(10, 0),
            end_time=time(11, 30),
            processing_status="completed",
            created_by=teacher.id
        )
        db.add_all([sess1, sess2, sess3, sess4])
        db.commit()
        db.refresh(sess1)
        db.refresh(sess2)
        db.refresh(sess3)
        db.refresh(sess4)
        
        # 5. Attendance Records for Class A
        # Session 1: 7 present, 1 absent
        for idx, st in enumerate(created_students):
            status_val = "present" if idx != 4 else "absent"
            rec = AttendanceRecord(
                session_id=sess1.id,
                student_id=st.id,
                status=status_val,
                attendance_method="image_detection" if status_val == "present" else "manual",
                verification_status="verified",
                confidence=0.88 if status_val == "present" else None,
                detection_timestamp=datetime.utcnow() - timedelta(days=10)
            )
            db.add(rec)
            
        # Session 2: 6 present, 2 absent
        for idx, st in enumerate(created_students):
            status_val = "present" if idx not in [1, 6] else "absent"
            rec = AttendanceRecord(
                session_id=sess2.id,
                student_id=st.id,
                status=status_val,
                attendance_method="image_detection" if status_val == "present" else "manual",
                verification_status="verified",
                confidence=0.84 if status_val == "present" else None,
                detection_timestamp=datetime.utcnow() - timedelta(days=7)
            )
            db.add(rec)
            
        # Session 3: 7 present, 1 needs review
        for idx, st in enumerate(created_students):
            status_val = "needs_review" if idx == 3 else "present"
            rec = AttendanceRecord(
                session_id=sess3.id,
                student_id=st.id,
                status=status_val,
                attendance_method="video_detection",
                verification_status="flagged_review" if status_val == "needs_review" else "verified",
                confidence=0.68 if status_val == "needs_review" else 0.89,
                detection_timestamp=datetime.utcnow() - timedelta(days=3)
            )
            db.add(rec)
            
        # Session 4 (Today): 6 present, 1 absent, 1 needs review
        for idx, st in enumerate(created_students):
            if idx == 2:
                status_val = "absent"
                conf = None
                ver = "unverified"
                meth = "manual"
            elif idx == 5:
                status_val = "needs_review"
                conf = 0.64
                ver = "flagged_review"
                meth = "image_detection"
            else:
                status_val = "present"
                conf = 0.91
                ver = "verified"
                meth = "image_detection"
                
            rec = AttendanceRecord(
                session_id=sess4.id,
                student_id=st.id,
                status=status_val,
                attendance_method=meth,
                verification_status=ver,
                confidence=conf,
                detection_timestamp=datetime.utcnow()
            )
            db.add(rec)
            
        # 6. Engagement Summary for Session 4
        eng_summary = EngagementSummary(
            session_id=sess4.id,
            analysis_method="head_pose_and_visibility",
            aggregate_metrics=json.dumps({
                "total_frames_analyzed": 90,
                "frames_with_visible_participants": 82,
                "total_face_instances_observed": 492,
                "visibility_percentage": 91.1,
                "presentation_oriented_percentage": 78.4,
                "orientation_counts": {
                    "front_facing": 386,
                    "downward_facing": 74,
                    "side_facing_left": 18,
                    "side_facing_right": 14
                },
                "coverage_rating": "High"
            }),
            limitations_and_quality_flags=json.dumps({
                "ethical_disclaimer": ETHICAL_DISCLAIMER,
                "sampling_rate": "1 sampled frame per second",
                "metric_type": "Observable visual geometric orientation only",
                "camera_angle_factor": "Front-of-room perspective",
                "lighting_reliability": "Adequate indoor lighting"
            })
        )
        db.add(eng_summary)
        
        # 7. Audit Events
        audit1 = AuditEvent(
            action="session_created",
            entity_type="session",
            entity_id=sess4.id,
            actor_id=teacher.id,
            details_json=json.dumps({"title": sess4.title})
        )
        audit2 = AuditEvent(
            action="attendance_processed",
            entity_type="session",
            entity_id=sess4.id,
            actor_id=teacher.id,
            details_json=json.dumps({"present": 6, "absent": 1, "needs_review": 1})
        )
        db.add_all([audit1, audit2])
        db.commit()
        
        # 8. Generate sample media files on disk for testing
        classroom_img = generate_sample_classroom_image(faces_count=4)
        sample_img_path = MEDIA_DIR / "sample_classroom_lecture.jpg"
        cv2.imwrite(str(sample_img_path), classroom_img)
        print(f"Sample classroom image saved to {sample_img_path}")
        
        print("Database seeded successfully with realistic classes, students, and sessions.")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
