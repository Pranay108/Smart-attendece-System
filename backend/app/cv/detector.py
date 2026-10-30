import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from app.config import CROPS_DIR

# Load standard OpenCV Haar cascade for face detection
CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

def detect_faces_in_image(image_bgr: np.ndarray) -> List[Dict[str, Any]]:
    """
    Detects faces in a BGR image using OpenCV Haar cascade.
    Returns a list of dicts with bounding boxes, normalized coordinates, crops, and quality metrics.
    """
    if image_bgr is None or image_bgr.size == 0:
        return []
    
    height, width = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    
    # Histogram equalization for robust detection under varied lighting
    gray_eq = cv2.equalizeHist(gray)
    
    # Multi-scale face detection
    faces = face_cascade.detectMultiScale(
        gray_eq,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(36, 36),
        flags=cv2.CASCADE_SCALE_IMAGE
    )
    
    results = []
    for idx, (x, y, w, h) in enumerate(faces):
        # Extract face crop
        # Add slight 5% padding around face if within bounds
        pad_x = int(w * 0.05)
        pad_y = int(h * 0.05)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(width, x + w + pad_x)
        y2 = min(height, y + h + pad_y)
        
        crop = image_bgr[y1:y2, x1:x2]
        if crop.size == 0:
            continue
            
        crop_resized = cv2.resize(crop, (128, 128))
        
        # Calculate sharpness (Laplacian variance)
        crop_gray = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2GRAY)
        laplacian_var = float(cv2.Laplacian(crop_gray, cv2.CV_64F).var())
        
        results.append({
            "face_index": idx,
            "bbox": [int(x), int(y), int(w), int(h)],
            "normalized_bbox": [
                round(x / width, 4),
                round(y / height, 4),
                round(w / width, 4),
                round(h / height, 4)
            ],
            "crop_bgr": crop_resized,
            "quality_score": round(min(1.0, laplacian_var / 500.0), 3),
            "width": width,
            "height": height
        })
        
    return results

def save_crop_image(crop_bgr: np.ndarray, prefix: str = "face") -> str:
    """
    Saves a face crop to disk and returns the relative path from BASE_DIR.
    """
    import uuid
    filename = f"{prefix}_{uuid.uuid4().hex[:10]}.jpg"
    filepath = CROPS_DIR / filename
    cv2.imwrite(str(filepath), crop_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    return f"uploads/crops/{filename}"
