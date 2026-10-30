import json
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from app.config import settings

def extract_face_descriptor(face_crop_bgr: np.ndarray) -> List[float]:
    """
    Extracts a normalized 128-dimensional spatial gradient histogram descriptor 
    from a 128x128 face crop.
    This provides an efficient, reproducible, offline facial feature vector.
    """
    if face_crop_bgr is None or face_crop_bgr.size == 0:
        return [0.0] * 128
        
    # Resize to standard 128x128
    crop = cv2.resize(face_crop_bgr, (128, 128))
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    
    # Apply histogram equalization
    gray = cv2.equalizeHist(gray)
    
    # Compute Sobel gradients in X and Y
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)
    
    # Divide face into 4x4 spatial grid cells (each 32x32 pixels)
    # 8 orientation bins per cell -> 4 * 4 * 8 = 128 features
    num_cells = 4
    cell_size = 128 // num_cells
    num_bins = 8
    bin_width = 360.0 / num_bins
    
    descriptor = []
    for cy in range(num_cells):
        for cx in range(num_cells):
            cell_mag = mag[cy*cell_size:(cy+1)*cell_size, cx*cell_size:(cx+1)*cell_size]
            cell_ang = ang[cy*cell_size:(cy+1)*cell_size, cx*cell_size:(cx+1)*cell_size]
            
            # Histogram for this cell
            hist = np.zeros(num_bins, dtype=np.float32)
            bin_indices = (cell_ang / bin_width).astype(int) % num_bins
            for b in range(num_bins):
                hist[b] = np.sum(cell_mag[bin_indices == b])
                
            descriptor.extend(hist.tolist())
            
    # L2 normalize descriptor
    vec = np.array(descriptor, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 1e-6:
        vec = vec / norm
    return [round(float(v), 5) for v in vec]

def compute_similarity(descriptor_a: List[float], descriptor_b: List[float]) -> float:
    """
    Computes cosine similarity between two 128-d face descriptors.
    Returns float in range [-1.0, 1.0], clamped to [0.0, 1.0].
    """
    if not descriptor_a or not descriptor_b:
        return 0.0
    vec_a = np.array(descriptor_a, dtype=np.float32)
    vec_b = np.array(descriptor_b, dtype=np.float32)
    
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a < 1e-6 or norm_b < 1e-6:
        return 0.0
        
    cos_sim = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
    return max(0.0, min(1.0, cos_sim))

def match_face_against_profiles(
    face_descriptor: List[float],
    enrolled_profiles: List[Dict[str, Any]],
    confidence_threshold: float = settings.MATCH_CONFIDENCE_THRESHOLD,
    review_threshold: float = settings.REVIEW_THRESHOLD
) -> Dict[str, Any]:
    """
    Matches a detected face descriptor against a list of authorized, consented student biometric profiles.
    
    Returns:
    {
        "status": "matched" | "uncertain" | "unidentified",
        "student_id": Optional[str],
        "student_name": Optional[str],
        "enrollment_number": Optional[str],
        "confidence": float,
        "second_best_confidence": float
    }
    """
    if not enrolled_profiles:
        return {
            "status": "unidentified",
            "student_id": None,
            "student_name": None,
            "enrollment_number": None,
            "confidence": 0.0,
            "second_best_confidence": 0.0
        }
        
    scores = []
    for prof in enrolled_profiles:
        sim = compute_similarity(face_descriptor, prof["descriptor"])
        scores.append((sim, prof))
        
    # Sort descending by similarity
    scores.sort(key=lambda x: x[0], reverse=True)
    best_sim, best_profile = scores[0]
    second_sim = scores[1][0] if len(scores) > 1 else 0.0
    
    if best_sim >= confidence_threshold:
        return {
            "status": "matched",
            "student_id": best_profile["student_id"],
            "student_name": best_profile["student_name"],
            "enrollment_number": best_profile["enrollment_number"],
            "confidence": round(best_sim, 3),
            "second_best_confidence": round(second_sim, 3)
        }
    elif best_sim >= review_threshold:
        return {
            "status": "uncertain",
            "student_id": best_profile["student_id"],
            "student_name": best_profile["student_name"],
            "enrollment_number": best_profile["enrollment_number"],
            "confidence": round(best_sim, 3),
            "second_best_confidence": round(second_sim, 3)
        }
    else:
        return {
            "status": "unidentified",
            "student_id": None,
            "student_name": None,
            "enrollment_number": None,
            "confidence": round(best_sim, 3),
            "second_best_confidence": round(second_sim, 3)
        }
