# Multimodal Attendance & Engagement Agent

A production-ready, full-stack multimodal web application for automated attendance management, classroom image/video computer vision processing, observable visual engagement-indicator analysis, teacher session analytics, and an AI attendance reporting assistant grounded strictly in verified database records.

---

## 1. System Architecture

```
                            ┌───────────────────────────────────────────┐
                            │      React 19 + TypeScript + Vite UI      │
                            │  (Restrained Blue/White Administrative)   │
                            └─────────────────────┬─────────────────────┘
                                                  │ REST API
                                                  ▼
                            ┌───────────────────────────────────────────┐
                            │          FastAPI Backend Service          │
                            │  (Pydantic v2 + SQLAlchemy ORM Engine)    │
                            └───────┬──────────────┬─────────────┬──────┘
                                    │              │             │
                 ┌──────────────────▼────┐         │     ┌───────▼─────────────────┐
                 │    Computer Vision    │         │     │   AI Attendance Agent   │
                 │   • OpenCV Detection  │         │     │ • Controlled DB Tools   │
                 │   • Biometric Matcher │         │     │ • Zero Hallucinations   │
                 │   • Visual Indicators │         │     │ • Ethical Disclaimers   │
                 └───────────────────────┘         │     └─────────────────────────┘
                                                   │
                                    ┌──────────────▼────────────┐
                                    │ Relational Database Model │
                                    │ (SQLite / PostgreSQL)     │
                                    │ • Users & Classes         │
                                    │ • Students & Biometrics   │
                                    │ • Sessions & Attendance   │
                                    │ • Jobs, Metrics & Audits  │
                                    └───────────────────────────┘
```

---

## 2. Core Capabilities & Scope Adherence

1. **Automated Attendance Management**:
   - Class creation and student enrollment with unique enrollment numbers.
   - Session scheduling with date and time bounds.
   - Comprehensive status tracking: **Present**, **Absent**, and **Needs Review**.
   - Database constraint preventing conflicting final records for the same student and session (`uq_session_student_attendance`).

2. **Multimodal Media Processing**:
   - **Classroom Image Upload**: Multi-face detection, feature extraction, and identity matching against consented profiles.
   - **Classroom Video Upload**: Asynchronous background worker sampling frames at 1 FPS, aggregating observations across timestamps without freezing the web interface.
   - **Distinction of States**: Detected face vs. Confident match vs. Uncertain match vs. Unidentified face vs. Verified student.

3. **Visual Engagement Indicators**:
   - Analyzes observable indicators only: frame visibility duration and coarse geometric head orientation (Front-Facing / Presentation-Oriented vs. Downward / Desk-Focused vs. Lateral).
   - **Strict Ethical Framework**: Explicitly disclaims and prevents pseudo-scientific emotion inference, grading based on facial expressions, or disciplinary measures.

4. **Faculty Dashboard & Analytics**:
   - Real-time KPI figures (Total Students, Conducted Sessions, Latest Present, Latest Absent, Overall Attendance %).
   - Longitudinal attendance trend charts and headcount distribution charts (Recharts).
   - Per-student attendance rate rankings and standing badges (**Satisfactory**, **Warning <75%**, **Critical <60%**).
   - Exportable CSV reports.

5. **AI Attendance & Reporting Agent**:
   - Controlled natural-language assistant backed by explicit database retrieval tools (`get_dashboard_metrics`, `get_session_details`, `get_low_attendance_students`, `get_recent_sessions_summary`, `compare_recent_sessions`, `get_session_engagement_indicators`).
   - "Inspect Database Tool Call" drawer revealing the exact execution output backing the answer.
   - Guaranteed deterministic operation from verified records without requiring an external paid LLM key.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, React Router v7.
- **Backend**: Python 3.14 / 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn.
- **Computer Vision**: OpenCV (`opencv-python`), multi-region spatial gradient facial descriptors, cosine similarity matching.
- **Database**: SQLite (default zero-configuration out-of-the-box file `attendance.db`) or PostgreSQL.

---

## 4. Quickstart & Local Setup

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js v18+ and npm (Tested on Node v24)

### Step 1: Install Backend Dependencies & Seed Database
```bash
cd backend
python -m pip install -r requirements.txt
python -m app.seed
```

### Step 2: Install Frontend Dependencies
```bash
cd ../frontend
npm install
npm run build
```

### Step 3: Run the Application Locally
In Terminal 1 (Backend):
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Open your browser at: **`http://127.0.0.1:5173`**

### Pre-Seeded Faculty Credentials
- **Email**: `teacher@school.edu`
- **Password**: `password123`
*(A 1-click "Sign in with Demo Teacher Account" button is also provided on the login page).*

---

## 5. Security, Privacy & Biometric Protection

- **Consent-Based Biometrics**: Biometric enrollment is a separate, explicit action requiring confirmed consent. If a student does not have consent, their profile is never matched biometrically.
- **Biometric Isolation**: Biometric feature vectors are stored in an isolated `biometric_profiles` table and are never exposed via standard student directory endpoints.
- **Revocation**: Faculty can permanently revoke biometric consent and purge the feature vector at any time.
- **Non-Biometric Alternative**: Faculty can mark attendance manually or verify attendance without requiring facial biometrics.
- **Audit Trails**: Security-sensitive actions (manual corrections, student deactivations, biometric enrollments/revocations) are logged into the `audit_events` table with actor IDs and timestamp metadata.

---

## 6. Running Automated Tests

Run backend tests using `pytest`:
```bash
cd backend
python -m pytest tests/test_backend.py -v
```

All 6 automated test suites pass:
1. `test_health_check`: API service health check.
2. `test_login_and_auth`: JWT token authentication and `/api/auth/me`.
3. `test_classes_and_students`: Class creation, student registration, duplicate enrollment rejection, deactivation preserving historical records.
4. `test_cv_detection_and_biometrics`: Face detection, descriptor extraction, and cosine similarity matching logic.
5. `test_attendance_correction_audit`: Manual correction workflows and audit event emission.
6. `test_analytics_and_agent_queries`: Real database analytics calculations and AI agent tool query resolution.

---

## 7. Deliverables & Verification Checklist

| Capability | Status | Implementation Details |
|---|---|---|
| Faculty Authentication & RBAC | Complete & Tested | JWT Bearer tokens, bcrypt hashing, demo credentials |
| Student Management | Complete & Tested | Search, class filter, unique enrollment constraint, deactivation |
| Explicit Biometric Enrollment | Complete & Tested | Separate consent modal, feature descriptor generation, revocation |
| Classroom Session Scheduling | Complete & Tested | Title, date, time bounds, class linkage, processing states |
| Image Attendance Processing | Complete & Tested | OpenCV face detection, descriptor matching, bounding boxes |
| Video Attendance Processing | Complete & Tested | Asynchronous background worker, 1 FPS frame sampling, progress bar |
| Duplicate Prevention | Complete & Tested | Unique constraint `(session_id, student_id)`, observation aggregation |
| Attendance Review & Correction | Complete & Tested | Interactive quick toggles (P/A/R), correction reason dialog, bulk verify |
| Observable Visual Indicators | Complete & Tested | Visibility ratio, geometric orientation breakdown, coverage ratings |
| Ethical Guidelines & Disclaimers | Complete & Tested | Prominent notices disclaiming cognitive/psychological inferences |
| Analytics Dashboard | Complete & Tested | Longitudinal line chart, headcount bar chart, per-student standings |
| AI Attendance Agent | Complete & Tested | Validated database tools, prompt pills, database tool call inspector |
| CSV Report Export | Complete & Tested | Direct browser CSV download of verified student attendance |
| Production Build | Complete & Tested | TypeScript compilation (`tsc -b`), optimized bundle build (`vite build`) |
