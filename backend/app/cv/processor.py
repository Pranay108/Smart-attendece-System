import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import cv2
import numpy as np
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.models import (
    Session as ClassSession, Student, BiometricProfile, 
    AttendanceRecord, ProcessingJob, EngagementSummary, AuditEvent
)
from app.cv.detector import detect_faces_in_image, save_crop_image
from app.cv.matcher import extract_face_descriptor, match_face_against_profiles
from app.cv.engagement import estimate_head_orientation, aggregate_session_engagement

logger = logging.getLogger(__name__)

def get_enrolled_profiles_for_class(db: DBSession, class_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves authorized biometric profiles for active students with explicit consent in the given class.
    Strict privacy rule: NEVER include students without biometric_consent=True.
    """
    students = (
        db.query(Student)
        .filter(
            Student.class_id == class_id,
            Student.is_active == True,
            Student.biometric_consent == True,
            Student.biometric_enrolled == True
        )
        .all()
    )
    
    profiles = []
    for s in students:
        if s.biometric_profile and s.biometric_profile.embedding_json:
            try:
                descriptor = json.loads(s.biometric_profile.embedding_json)
                profiles.append({
                    "student_id": s.id,
                    "student_name": s.full_name,
                    "enrollment_number": s.enrollment_number,
                    "descriptor": descriptor
                })
            except Exception as e:
                logger.error(f"Error deserializing biometric profile for {s.id}: {e}")
    return profiles

def ensure_session_student_records(db: DBSession, session_id: str, class_id: str):
    """
    Ensures every active student in the class has an attendance row in the session.
    Defaults to 'absent' / 'unverified' if not yet recorded.
    """
    students = db.query(Student).filter(Student.class_id == class_id, Student.is_active == True).all()
    existing_records = {
        r.student_id: r for r in db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    }
    
    for s in students:
        if s.id not in existing_records:
            new_rec = AttendanceRecord(
                session_id=session_id,
                student_id=s.id,
                status="absent",
                attendance_method="manual",
                verification_status="unverified"
            )
            db.add(new_rec)
    db.commit()

def process_session_image(
    session_id: str, 
    image_path: Path, 
    db: DBSession, 
    job_id: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Processes an uploaded classroom photo for attendance detection and engagement indicators.
    """
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not job or not session:
        raise ValueError("Job or Session not found")
        
    try:
        job.processing_status = "processing"
        job.started_at = datetime.utcnow()
        job.progress = 20
        db.commit()
        
        # Ensure base attendance records exist for all students
        ensure_session_student_records(db, session_id, session.class_id)
        
        # Read image
        img_bgr = cv2.imread(str(image_path))
        if img_bgr is None:
            raise ValueError("Unable to read image file. Invalid or corrupted image format.")
            
        job.progress = 40
        db.commit()
        
        # Detect faces
        detected_faces = detect_faces_in_image(img_bgr)
        enrolled_profiles = get_enrolled_profiles_for_class(db, session.class_id)
        
        job.progress = 60
        db.commit()
        
        results_list = []
        matched_student_ids = set()
        matched_count = 0
        review_count = 0
        frame_observations = []
        
        for face in detected_faces:
            crop_bgr = face["crop_bgr"]
            crop_path = save_crop_image(crop_bgr, prefix=f"sess_{session_id[:6]}")
            
            # Feature extraction & orientation
            desc = extract_face_descriptor(crop_bgr)
            orientation_info = estimate_head_orientation(crop_bgr)
            
            # Biometric Matching
            match_res = match_face_against_profiles(desc, enrolled_profiles)
            
            face_result = {
                "face_index": face["face_index"],
                "bbox": face["bbox"],
                "normalized_bbox": face["normalized_bbox"],
                "crop_url": f"/{crop_path}",
                "quality_score": face["quality_score"],
                "orientation": orientation_info["orientation"],
                "is_presentation_oriented": orientation_info["is_presentation_oriented"],
                "match_status": match_res["status"],
                "matched_student_id": match_res["student_id"],
                "matched_student_name": match_res["student_name"],
                "enrollment_number": match_res["enrollment_number"],
                "confidence": match_res["confidence"]
            }
            results_list.append(face_result)
            
            frame_observations.append({
                "frame_index": 0,
                "orientation": orientation_info["orientation"],
                "is_presentation_oriented": orientation_info["is_presentation_oriented"]
            })
            
            # Update database attendance records if matched
            if match_res["status"] == "matched" and match_res["student_id"]:
                std_id = match_res["student_id"]
                matched_student_ids.add(std_id)
                matched_count += 1
                
                rec = db.query(AttendanceRecord).filter(
                    AttendanceRecord.session_id == session_id,
                    AttendanceRecord.student_id == std_id
                ).first()
                if rec:
                    rec.status = "present"
                    rec.attendance_method = "image_detection"
                    rec.verification_status = "verified"
                    rec.confidence = match_res["confidence"]
                    rec.detection_timestamp = datetime.utcnow()
                    rec.updated_at = datetime.utcnow()
            elif match_res["status"] == "uncertain" and match_res["student_id"]:
                std_id = match_res["student_id"]
                review_count += 1
                rec = db.query(AttendanceRecord).filter(
                    AttendanceRecord.session_id == session_id,
                    AttendanceRecord.student_id == std_id
                ).first()
                if rec and rec.status != "present": # Don't downgrade if already present
                    rec.status = "needs_review"
                    rec.attendance_method = "image_detection"
                    rec.verification_status = "flagged_review"
                    rec.confidence = match_res["confidence"]
                    rec.detection_timestamp = datetime.utcnow()
                    rec.updated_at = datetime.utcnow()
                    
        job.progress = 85
        db.commit()
        
        # Calculate visual engagement indicators
        eng_data = aggregate_session_engagement(frame_observations, total_frames_analyzed=1)
        if eng_data:
            # Check if summary already exists for this session
            existing_eng = db.query(EngagementSummary).filter(EngagementSummary.session_id == session_id).first()
            if existing_eng:
                existing_eng.aggregate_metrics = json.dumps(eng_data["aggregate_metrics"])
                existing_eng.limitations_and_quality_flags = json.dumps(eng_data["limitations_and_quality_flags"])
            else:
                new_eng = EngagementSummary(
                    session_id=session_id,
                    analysis_method="head_pose_and_visibility",
                    aggregate_metrics=json.dumps(eng_data["aggregate_metrics"]),
                    limitations_and_quality_flags=json.dumps(eng_data["limitations_and_quality_flags"])
                )
                db.add(new_eng)
                
        # Finalize job
        job.total_faces_detected = len(detected_faces)
        job.matched_count = matched_count
        job.review_needed_count = review_count
        job.results_json = json.dumps(results_list)
        job.processing_status = "completed"
        job.progress = 100
        job.completed_at = datetime.utcnow()
        
        session.processing_status = "completed"
        
        # Audit Event
        audit = AuditEvent(
            action="image_attendance_processed",
            entity_type="session",
            entity_id=session_id,
            actor_id=user_id,
            details_json=json.dumps({
                "job_id": job_id,
                "faces_detected": len(detected_faces),
                "matched_count": matched_count,
                "review_count": review_count
            })
        )
        db.add(audit)
        db.commit()
        
        return {
            "status": "success",
            "faces_detected": len(detected_faces),
            "matched_count": matched_count,
            "review_needed": review_count,
            "results": results_list
        }
        
    except Exception as e:
        logger.exception(f"Error processing image for session {session_id}: {e}")
        job.processing_status = "failed"
        job.error_summary = str(e)
        session.processing_status = "failed"
        db.commit()
        raise

def process_session_video(
    session_id: str, 
    video_path: Path, 
    db: DBSession, 
    job_id: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Processes an uploaded classroom video file:
    Extracts sampled frames at 1 FPS, aggregates observations across time, 
    avoids duplicate entries, updates job progress, and calculates session engagement indicators.
    """
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not job or not session:
        raise ValueError("Job or Session not found")
        
    try:
        job.processing_status = "processing"
        job.started_at = datetime.utcnow()
        job.progress = 5
        db.commit()
        
        ensure_session_student_records(db, session_id, session.class_id)
        enrolled_profiles = get_enrolled_profiles_for_class(db, session.class_id)
        
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError("Unable to open video file. Supported formats: .mp4, .avi, .mov, .webm")
            
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_video_frames <= 0:
            total_video_frames = 100 # Fallback estimate
            
        sample_interval = max(1, int(round(fps))) # Sample 1 frame every second
        
        frame_idx = 0
        analyzed_sample_count = 0
        frame_records = []
        all_detections_summary = []
        
        # Student observation tracking across frames: {student_id: {"matches": int, "max_conf": float, "timestamps": list}}
        student_tracker = {}
        total_faces_seen = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_idx % sample_interval == 0:
                analyzed_sample_count += 1
                faces = detect_faces_in_image(frame)
                total_faces_seen += len(faces)
                timestamp_sec = round(frame_idx / fps, 2)
                
                for f in faces:
                    crop_bgr = f["crop_bgr"]
                    desc = extract_face_descriptor(crop_bgr)
                    orientation_info = estimate_head_orientation(crop_bgr)
                    match_res = match_face_against_profiles(desc, enrolled_profiles)
                    
                    frame_records.append({
                        "frame_index": analyzed_sample_count,
                        "timestamp_sec": timestamp_sec,
                        "orientation": orientation_info["orientation"],
                        "is_presentation_oriented": orientation_info["is_presentation_oriented"]
                    })
                    
                    std_id = match_res.get("student_id")
                    if std_id:
                        if std_id not in student_tracker:
                            student_tracker[std_id] = {
                                "status": match_res["status"],
                                "matches": 0,
                                "max_conf": 0.0,
                                "name": match_res["student_name"],
                                "enrollment": match_res["enrollment_number"]
                            }
                        student_tracker[std_id]["matches"] += 1
                        student_tracker[std_id]["max_conf"] = max(
                            student_tracker[std_id]["max_conf"], match_res["confidence"]
                        )
                        if match_res["status"] == "matched":
                            student_tracker[std_id]["status"] = "matched"
                            
                    # Sample thumbnails for UI result inspection (up to 15 gallery faces)
                    if len(all_detections_summary) < 15:
                        crop_path = save_crop_image(crop_bgr, prefix=f"vid_{session_id[:6]}")
                        all_detections_summary.append({
                            "timestamp_sec": timestamp_sec,
                            "crop_url": f"/{crop_path}",
                            "match_status": match_res["status"],
                            "student_name": match_res["student_name"],
                            "confidence": match_res["confidence"],
                            "orientation": orientation_info["orientation"]
                        })
                        
                # Update progress in DB every 5 sampled frames
                if analyzed_sample_count % 5 == 0:
                    pct = min(90, int(10 + (frame_idx / max(1, total_video_frames)) * 80))
                    job.progress = pct
                    db.commit()
                    
            frame_idx += 1
            # Safety limit: Cap analyzed frames to 300 to ensure fast response
            if analyzed_sample_count >= 300:
                break
                
        cap.release()
        
        # Apply aggregated attendance decisions
        matched_count = 0
        review_count = 0
        for std_id, trk in student_tracker.items():
            rec = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == std_id
            ).first()
            if rec:
                if trk["status"] == "matched":
                    rec.status = "present"
                    rec.attendance_method = "video_detection"
                    rec.verification_status = "verified"
                    rec.confidence = round(trk["max_conf"], 3)
                    rec.detection_timestamp = datetime.utcnow()
                    rec.updated_at = datetime.utcnow()
                    matched_count += 1
                elif trk["status"] == "uncertain" and rec.status != "present":
                    rec.status = "needs_review"
                    rec.attendance_method = "video_detection"
                    rec.verification_status = "flagged_review"
                    rec.confidence = round(trk["max_conf"], 3)
                    rec.detection_timestamp = datetime.utcnow()
                    rec.updated_at = datetime.utcnow()
                    review_count += 1
                    
        # Calculate visual engagement indicator summary
        eng_data = aggregate_session_engagement(frame_records, total_frames_analyzed=analyzed_sample_count)
        if eng_data:
            existing_eng = db.query(EngagementSummary).filter(EngagementSummary.session_id == session_id).first()
            if existing_eng:
                existing_eng.aggregate_metrics = json.dumps(eng_data["aggregate_metrics"])
                existing_eng.limitations_and_quality_flags = json.dumps(eng_data["limitations_and_quality_flags"])
            else:
                new_eng = EngagementSummary(
                    session_id=session_id,
                    analysis_method="head_pose_and_visibility",
                    aggregate_metrics=json.dumps(eng_data["aggregate_metrics"]),
                    limitations_and_quality_flags=json.dumps(eng_data["limitations_and_quality_flags"])
                )
                db.add(new_eng)
                
        job.total_faces_detected = total_faces_seen
        job.matched_count = matched_count
        job.review_needed_count = review_count
        job.results_json = json.dumps(all_detections_summary)
        job.processing_status = "completed"
        job.progress = 100
        job.completed_at = datetime.utcnow()
        session.processing_status = "completed"
        
        audit = AuditEvent(
            action="video_attendance_processed",
            entity_type="session",
            entity_id=session_id,
            actor_id=user_id,
            details_json=json.dumps({
                "job_id": job_id,
                "frames_analyzed": analyzed_sample_count,
                "total_faces_seen": total_faces_seen,
                "matched_count": matched_count,
                "review_count": review_count
            })
        )
        db.add(audit)
        db.commit()
        
        return {
            "status": "success",
            "frames_analyzed": analyzed_sample_count,
            "total_faces_seen": total_faces_seen,
            "matched_count": matched_count,
            "review_needed": review_count
        }
        
    except Exception as e:
        logger.exception(f"Error processing video for session {session_id}: {e}")
        job.processing_status = "failed"
        job.error_summary = str(e)
        session.processing_status = "failed"
        db.commit()
        raise
