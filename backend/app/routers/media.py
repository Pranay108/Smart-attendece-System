import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from app.config import settings, MEDIA_DIR
from app.database import get_db, SessionLocal
from app.models import Session as ClassSession, ProcessingJob, User
from app.schemas import ProcessingJobResponse
from app.auth import require_teacher
from app.cv.processor import process_session_image, process_session_video

router = APIRouter(tags=["Media Processing"])

def _bg_process_video(job_id: str, session_id: str, video_path_str: str, user_id: str):
    """
    Background worker function for asynchronous video processing.
    Uses dedicated database session.
    """
    db = SessionLocal()
    try:
        process_session_video(
            session_id=session_id,
            video_path=Path(video_path_str),
            db=db,
            job_id=job_id,
            user_id=user_id
        )
    except Exception as e:
        pass
    finally:
        db.close()

@router.post("/sessions/{session_id}/media", response_model=ProcessingJobResponse, status_code=status.HTTP_201_CREATED)
async def upload_session_media(
    session_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    ext = Path(file.filename or "").suffix.lower()
    is_image = ext in settings.ALLOWED_IMAGE_EXTENSIONS
    is_video = ext in settings.ALLOWED_VIDEO_EXTENSIONS
    
    if not is_image and not is_video:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format '{ext}'. Allowed images: {list(settings.ALLOWED_IMAGE_EXTENSIONS)}, videos: {list(settings.ALLOWED_VIDEO_EXTENSIONS)}"
        )
        
    # Read and check size
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if is_image and size_mb > settings.MAX_IMAGE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"Image size exceeds limit of {settings.MAX_IMAGE_SIZE_MB}MB")
    if is_video and size_mb > settings.MAX_VIDEO_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"Video size exceeds limit of {settings.MAX_VIDEO_SIZE_MB}MB")
        
    # Save file
    media_filename = f"{uuid.uuid4().hex[:12]}_{file.filename}"
    save_path = MEDIA_DIR / media_filename
    with open(save_path, "wb") as f:
        f.write(contents)
        
    media_type = "image" if is_image else "video"
    
    # Create processing job record
    job = ProcessingJob(
        session_id=session.id,
        media_type=media_type,
        file_path=str(save_path),
        processing_status="pending",
        progress=0
    )
    db.add(job)
    session.processing_status = "processing"
    db.commit()
    db.refresh(job)
    
    # Automatically execute processing
    if is_image:
        # Process image directly
        process_session_image(session.id, save_path, db, job.id, user_id=current_user.id)
        db.refresh(job)
    else:
        # Schedule video processing asynchronously in the background so API does not freeze
        background_tasks.add_task(_bg_process_video, job.id, session.id, str(save_path), current_user.id)
        
    return job

@router.get("/jobs/{job_id}", response_model=ProcessingJobResponse)
def get_job_status(
    job_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Processing job not found")
    return job

@router.get("/sessions/{session_id}/processing-results")
def get_session_processing_results(
    session_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_teacher)
):
    import json
    jobs = db.query(ProcessingJob).filter(ProcessingJob.session_id == session_id).order_by(ProcessingJob.created_at.desc()).all()
    if not jobs:
        return {"session_id": session_id, "jobs": [], "latest_results": None}
        
    latest_job = jobs[0]
    results_data = []
    if latest_job.results_json:
        try:
            results_data = json.loads(latest_job.results_json)
        except Exception:
            results_data = []
            
    return {
        "session_id": session_id,
        "latest_job": {
            "id": latest_job.id,
            "media_type": latest_job.media_type,
            "status": latest_job.processing_status,
            "progress": latest_job.progress,
            "total_faces_detected": latest_job.total_faces_detected,
            "matched_count": latest_job.matched_count,
            "review_needed_count": latest_job.review_needed_count,
            "error_summary": latest_job.error_summary,
            "results": results_data
        }
    }
