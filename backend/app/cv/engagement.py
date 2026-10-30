import cv2
import numpy as np
from typing import List, Dict, Any, Optional

ETHICAL_DISCLAIMER = (
    "DISCLAIMER: Visual head orientation and visibility metrics represent observable geometric indicators only. "
    "They DO NOT measure mental attention, cognitive comprehension, engagement, intelligence, or academic performance. "
    "Students looking at notebooks, screens, or peers are exhibiting normal classroom behaviors and must never be penalized."
)

def estimate_head_orientation(face_crop_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Estimates coarse visual head orientation (front-facing vs lateral/downward)
    based on facial symmetry, luminance balance, and vertical feature distribution.
    
    This is an observable geometric indicator, NOT a measurement of mental focus.
    """
    if face_crop_bgr is None or face_crop_bgr.size == 0:
        return {
            "orientation": "undetermined",
            "is_presentation_oriented": False,
            "yaw_approx": 0.0,
            "pitch_approx": 0.0
        }
        
    crop = cv2.resize(face_crop_bgr, (96, 96))
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    # Left vs Right half luminance / edge asymmetry gives approximate yaw tilt
    left_half = gray[:, :48]
    right_half = gray[:, 48:]
    
    left_mean = float(np.mean(left_half))
    right_mean = float(np.mean(right_half))
    
    # Compute horizontal asymmetry ratio (-1.0 to +1.0)
    denom = (left_mean + right_mean) if (left_mean + right_mean) > 0 else 1.0
    yaw_asym = (right_mean - left_mean) / denom
    
    # Upper half (forehead/eyes) vs Lower half (nose/mouth/chin) gives pitch tendency
    top_half = gray[:48, :]
    bottom_half = gray[48:, :]
    top_mean = float(np.mean(top_half))
    bottom_mean = float(np.mean(bottom_half))
    pitch_asym = (bottom_mean - top_mean) / ((bottom_mean + top_mean) if (bottom_mean + top_mean) > 0 else 1.0)
    
    # Classify orientation
    # In front-facing orientation, horizontal asymmetry is small (illuminance and structure roughly balanced)
    if abs(yaw_asym) < 0.12 and pitch_asym > -0.15:
        orientation = "front_facing"
        is_presentation_oriented = True
    elif pitch_asym <= -0.15:
        orientation = "downward_facing" # Looking down (e.g., notebook, tablet, desk)
        is_presentation_oriented = False
    elif yaw_asym >= 0.12:
        orientation = "side_facing_right"
        is_presentation_oriented = False
    else:
        orientation = "side_facing_left"
        is_presentation_oriented = False
        
    return {
        "orientation": orientation,
        "is_presentation_oriented": is_presentation_oriented,
        "yaw_approx": round(yaw_asym * 45.0, 1),
        "pitch_approx": round(pitch_asym * 45.0, 1)
    }

def aggregate_session_engagement(
    frame_records: List[Dict[str, Any]], 
    total_frames_analyzed: int
) -> Optional[Dict[str, Any]]:
    """
    Computes session-level aggregate metrics from frame observations.
    Returns None if no frames were analyzed.
    """
    if total_frames_analyzed <= 0 or not frame_records:
        return None
        
    total_detected_instances = len(frame_records)
    presentation_oriented_count = sum(1 for r in frame_records if r.get("is_presentation_oriented", False))
    
    # Count unique frames where at least one face was visible
    frames_with_detections = len(set(r["frame_index"] for r in frame_records if "frame_index" in r))
    
    orientation_breakdown = {
        "front_facing": sum(1 for r in frame_records if r.get("orientation") == "front_facing"),
        "downward_facing": sum(1 for r in frame_records if r.get("orientation") == "downward_facing"),
        "side_facing_left": sum(1 for r in frame_records if r.get("orientation") == "side_facing_left"),
        "side_facing_right": sum(1 for r in frame_records if r.get("orientation") == "side_facing_right"),
    }
    
    visibility_ratio = round((frames_with_detections / total_frames_analyzed) * 100.0, 1)
    presentation_ratio = round((presentation_oriented_count / max(1, total_detected_instances)) * 100.0, 1)
    
    coverage_level = "High" if visibility_ratio >= 75.0 else ("Moderate" if visibility_ratio >= 40.0 else "Low")
    
    return {
        "aggregate_metrics": {
            "total_frames_analyzed": total_frames_analyzed,
            "frames_with_visible_participants": frames_with_detections,
            "total_face_instances_observed": total_detected_instances,
            "visibility_percentage": visibility_ratio,
            "presentation_oriented_percentage": presentation_ratio,
            "orientation_counts": orientation_breakdown,
            "coverage_rating": coverage_level
        },
        "limitations_and_quality_flags": {
            "ethical_disclaimer": ETHICAL_DISCLAIMER,
            "sampling_rate": "1 sampled frame per second",
            "metric_type": "Observable visual geometric orientation only",
            "camera_angle_factor": "Standard classroom front-of-room perspective assumed",
            "lighting_reliability": "Standard contrast analysis applied"
        }
    }
