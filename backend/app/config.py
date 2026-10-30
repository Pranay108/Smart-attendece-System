import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR = UPLOAD_DIR / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
CROPS_DIR = UPLOAD_DIR / "crops"
CROPS_DIR.mkdir(parents=True, exist_ok=True)

class Settings:
    PROJECT_NAME: str = "Multimodal Attendance & Engagement Agent"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'attendance.db'}")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-production-key-mino-attendance-agent-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # CV & Biometric Thresholds
    # Cosine similarity threshold for confident identification (0.0 to 1.0)
    MATCH_CONFIDENCE_THRESHOLD: float = float(os.getenv("MATCH_CONFIDENCE_THRESHOLD", "0.72"))
    # Below this threshold, marked as uncertain/needs review
    REVIEW_THRESHOLD: float = float(os.getenv("REVIEW_THRESHOLD", "0.55"))
    
    # Media Limits
    MAX_IMAGE_SIZE_MB: int = int(os.getenv("MAX_IMAGE_SIZE_MB", "15"))
    MAX_VIDEO_SIZE_MB: int = int(os.getenv("MAX_VIDEO_SIZE_MB", "100"))
    ALLOWED_IMAGE_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".webp"}
    ALLOWED_VIDEO_EXTENSIONS: set = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    
    # AI Assistant
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
