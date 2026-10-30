import json
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func, desc

from app.config import settings
from app.models import ClassRoom, Student, Session as ClassSession, AttendanceRecord, EngagementSummary
from app.cv.engagement import ETHICAL_DISCLAIMER

logger = logging.getLogger(__name__)

# Validated Backend Tool Functions (Controlled Parameters Only)

def tool_get_dashboard_metrics(db: DBSession) -> Dict[str, Any]:
    total_students = db.query(Student).filter(Student.is_active == True).count()
    total_sessions = db.query(ClassSession).count()
    
    latest_session = db.query(ClassSession).order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc()).first()
    
    latest_data = None
    if latest_session:
        present_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == latest_session.id, 
            AttendanceRecord.status == "present"
        ).count()
        absent_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == latest_session.id, 
            AttendanceRecord.status == "absent"
        ).count()
        review_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == latest_session.id, 
            AttendanceRecord.status == "needs_review"
        ).count()
        total_recs = present_count + absent_count + review_count
        pct = round((present_count / max(1, total_recs)) * 100.0, 1) if total_recs > 0 else 0.0
        
        latest_data = {
            "session_id": latest_session.id,
            "session_title": latest_session.title,
            "session_date": str(latest_session.session_date),
            "present_count": present_count,
            "absent_count": absent_count,
            "needs_review_count": review_count,
            "total_records": total_recs,
            "attendance_percentage": pct
        }
        
    # Overall attendance across all sessions
    all_present = db.query(AttendanceRecord).filter(AttendanceRecord.status == "present").count()
    all_total = db.query(AttendanceRecord).count()
    overall_pct = round((all_present / max(1, all_total)) * 100.0, 1) if all_total > 0 else 0.0
    
    return {
        "total_active_students": total_students,
        "total_sessions_conducted": total_sessions,
        "overall_attendance_percentage": overall_pct,
        "latest_session": latest_data
    }

def tool_get_session_details(db: DBSession, session_id: Optional[str] = None) -> Dict[str, Any]:
    query = db.query(ClassSession)
    if session_id:
        session = query.filter(ClassSession.id == session_id).first()
    else:
        session = query.order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc()).first()
        
    if not session:
        return {"error": "No session found in database records."}
        
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    
    present_students = []
    absent_students = []
    review_students = []
    
    for r in records:
        student = db.query(Student).filter(Student.id == r.student_id).first()
        name = student.full_name if student else "Unknown"
        enrollment = student.enrollment_number if student else "N/A"
        item = {
            "student_id": r.student_id,
            "name": name,
            "enrollment": enrollment,
            "confidence": r.confidence,
            "method": r.attendance_method,
            "status": r.status
        }
        if r.status == "present":
            present_students.append(item)
        elif r.status == "absent":
            absent_students.append(item)
        else:
            review_students.append(item)
            
    total = len(records)
    pct = round((len(present_students) / max(1, total)) * 100.0, 1) if total > 0 else 0.0
    
    return {
        "session_id": session.id,
        "title": session.title,
        "date": str(session.session_date),
        "start_time": str(session.start_time),
        "status": session.processing_status,
        "total_students": total,
        "present_count": len(present_students),
        "absent_count": len(absent_students),
        "needs_review_count": len(review_students),
        "attendance_percentage": pct,
        "present_students": present_students,
        "absent_students": absent_students,
        "review_students": review_students
    }

def tool_get_low_attendance_students(db: DBSession, threshold_pct: float = 75.0, class_id: Optional[str] = None) -> Dict[str, Any]:
    students_query = db.query(Student).filter(Student.is_active == True)
    if class_id:
        students_query = students_query.filter(Student.class_id == class_id)
    students = students_query.all()
    
    low_attendance_list = []
    total_sessions = db.query(ClassSession).count()
    
    for s in students:
        total_session_records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id).count()
        attended_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == s.id, 
            AttendanceRecord.status == "present"
        ).count()
        
        pct = round((attended_count / max(1, total_session_records)) * 100.0, 1) if total_session_records > 0 else 0.0
        
        if total_session_records > 0 and pct < threshold_pct:
            cls = db.query(ClassRoom).filter(ClassRoom.id == s.class_id).first()
            class_name = f"{cls.name} ({cls.section})" if cls else "N/A"
            low_attendance_list.append({
                "student_id": s.id,
                "name": s.full_name,
                "enrollment_number": s.enrollment_number,
                "class_name": class_name,
                "attended": attended_count,
                "total_sessions": total_session_records,
                "attendance_percentage": pct
            })
            
    low_attendance_list.sort(key=lambda x: x["attendance_percentage"])
    return {
        "threshold_percentage": threshold_pct,
        "total_active_students_checked": len(students),
        "students_below_threshold_count": len(low_attendance_list),
        "students": low_attendance_list
    }

def tool_get_recent_sessions_summary(db: DBSession, count: int = 5) -> Dict[str, Any]:
    sessions = (
        db.query(ClassSession)
        .order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc())
        .limit(count)
        .all()
    )
    
    summary_list = []
    for s in sessions:
        p_count = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id, AttendanceRecord.status == "present").count()
        a_count = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id, AttendanceRecord.status == "absent").count()
        r_count = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id, AttendanceRecord.status == "needs_review").count()
        tot = p_count + a_count + r_count
        pct = round((p_count / max(1, tot)) * 100.0, 1) if tot > 0 else 0.0
        
        cls = db.query(ClassRoom).filter(ClassRoom.id == s.class_id).first()
        class_name = f"{cls.name} ({cls.section})" if cls else "N/A"
        
        summary_list.append({
            "session_id": s.id,
            "title": s.title,
            "class_name": class_name,
            "date": str(s.session_date),
            "present": p_count,
            "absent": a_count,
            "needs_review": r_count,
            "total": tot,
            "attendance_percentage": pct
        })
        
    return {
        "requested_count": count,
        "sessions_found": len(summary_list),
        "sessions": summary_list
    }

def tool_compare_recent_sessions(db: DBSession, count: int = 3) -> Dict[str, Any]:
    data = tool_get_recent_sessions_summary(db, count=count)
    sessions = data["sessions"]
    if not sessions:
        return {"error": "No sessions available for comparison."}
        
    avg_pct = round(sum(s["attendance_percentage"] for s in sessions) / len(sessions), 1)
    return {
        "compared_sessions": sessions,
        "average_attendance_percentage": avg_pct,
        "highest_session": max(sessions, key=lambda x: x["attendance_percentage"]),
        "lowest_session": min(sessions, key=lambda x: x["attendance_percentage"])
    }

def tool_get_session_engagement_indicators(db: DBSession, session_id: Optional[str] = None) -> Dict[str, Any]:
    if session_id:
        eng = db.query(EngagementSummary).filter(EngagementSummary.session_id == session_id).first()
        sess = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    else:
        eng = db.query(EngagementSummary).order_by(EngagementSummary.created_at.desc()).first()
        sess = db.query(ClassSession).filter(ClassSession.id == eng.session_id).first() if eng else None
        
    if not eng:
        return {
            "available": False,
            "message": "Visual engagement analysis has not been run or is not available for this session.",
            "disclaimer": ETHICAL_DISCLAIMER
        }
        
    try:
        metrics = json.loads(eng.aggregate_metrics)
        flags = json.loads(eng.limitations_and_quality_flags)
    except Exception:
        metrics = {}
        flags = {}
        
    return {
        "available": True,
        "session_id": sess.id if sess else eng.session_id,
        "session_title": sess.title if sess else "Latest Analyzed Session",
        "session_date": str(sess.session_date) if sess else "N/A",
        "aggregate_metrics": metrics,
        "limitations_and_quality_flags": flags,
        "disclaimer": ETHICAL_DISCLAIMER
    }

def tool_get_student_attendance_history(db: DBSession, query_text: str) -> Dict[str, Any]:
    clean_q = query_text.strip().lower()
    student = (
        db.query(Student)
        .filter(
            (func.lower(Student.full_name).contains(clean_q)) |
            (func.lower(Student.enrollment_number) == clean_q)
        )
        .first()
    )
    if not student:
        return {"error": f"No student found matching query '{query_text}'."}
        
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student.id)
        .order_by(AttendanceRecord.created_at.desc())
        .all()
    )
    
    history = []
    present_count = 0
    for r in records:
        sess = db.query(ClassSession).filter(ClassSession.id == r.session_id).first()
        title = sess.title if sess else "Unknown Session"
        sess_date = str(sess.session_date) if sess else "N/A"
        if r.status == "present":
            present_count += 1
        history.append({
            "session_title": title,
            "session_date": sess_date,
            "status": r.status,
            "method": r.attendance_method,
            "confidence": r.confidence
        })
        
    total_sess = len(records)
    pct = round((present_count / max(1, total_sess)) * 100.0, 1) if total_sess > 0 else 0.0
    
    cls = db.query(ClassRoom).filter(ClassRoom.id == student.class_id).first()
    class_name = f"{cls.name} ({cls.section})" if cls else "N/A"
    
    return {
        "student_id": student.id,
        "name": student.full_name,
        "enrollment_number": student.enrollment_number,
        "class_name": class_name,
        "total_sessions": total_sess,
        "attended_sessions": present_count,
        "attendance_percentage": pct,
        "history": history
    }

# Agent Query Processor
def process_agent_query(db: DBSession, query_text: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    q = query_text.lower().strip()
    
    # 1. Routing to validated tools based on question semantics
    if "percentage" in q and ("today" in q or "latest" in q or "current" in q or not session_id):
        tool_name = "get_session_details"
        backend_data = tool_get_session_details(db, session_id=session_id)
        if "error" in backend_data:
            answer = backend_data["error"]
        else:
            pct = backend_data["attendance_percentage"]
            title = backend_data["title"]
            p = backend_data["present_count"]
            tot = backend_data["total_students"]
            answer = f"In session **{title}**, the attendance rate is **{pct}%** ({p} out of {tot} registered students present)."
            
    elif "absent" in q or "how many absent" in q:
        tool_name = "get_session_details"
        backend_data = tool_get_session_details(db, session_id=session_id)
        if "error" in backend_data:
            answer = backend_data["error"]
        else:
            a = backend_data["absent_count"]
            tot = backend_data["total_students"]
            title = backend_data["title"]
            absent_names = [s["name"] for s in backend_data.get("absent_students", [])[:10]]
            names_str = ", ".join(absent_names) if absent_names else "None"
            answer = f"There are **{a} absent students** out of {tot} in session **{title}**.\n\nAbsent students: {names_str}."
            
    elif "below" in q or "under" in q or "low attendance" in q or "<" in q:
        import re
        threshold = 75.0
        m = re.search(r'(\d+)\s*%', q)
        if m:
            threshold = float(m.group(1))
            
        tool_name = "get_low_attendance_students"
        backend_data = tool_get_low_attendance_students(db, threshold_pct=threshold)
        students = backend_data.get("students", [])
        if not students:
            answer = f"Good news! No active students currently have an attendance rate below **{threshold}%**."
        else:
            rows = "\n".join([f"- **{s['name']}** ({s['enrollment_number']}): {s['attendance_percentage']}% ({s['attended']}/{s['total_sessions']} sessions)" for s in students])
            answer = f"Found **{len(students)} students** with attendance below **{threshold}%**:\n\n{rows}"
            
    elif "compare" in q:
        tool_name = "compare_recent_sessions"
        backend_data = tool_compare_recent_sessions(db, count=3)
        if "error" in backend_data:
            answer = backend_data["error"]
        else:
            sessions = backend_data["compared_sessions"]
            avg = backend_data["average_attendance_percentage"]
            summary_lines = "\n".join([f"- **{s['title']}** ({s['date']}): **{s['attendance_percentage']}%** ({s['present']}/{s['total']} present)" for s in sessions])
            answer = f"Comparison of recent sessions (Average: **{avg}%**):\n\n{summary_lines}\n\nHighest attendance was in **{backend_data['highest_session']['title']}** ({backend_data['highest_session']['attendance_percentage']}%)."
            
    elif "last" in q or "recent" in q or "summarize attendance for the last" in q or "summary" in q and "session" in q and "engagement" not in q:
        import re
        count = 5
        m = re.search(r'last\s+(\d+)', q)
        if m:
            count = int(m.group(1))
            
        tool_name = "get_recent_sessions_summary"
        backend_data = tool_get_recent_sessions_summary(db, count=count)
        sessions = backend_data.get("sessions", [])
        if not sessions:
            answer = "No recorded sessions found in the database."
        else:
            rows = "\n".join([f"- **{s['title']}** ({s['date']}): **{s['attendance_percentage']}%** ({s['present']} present, {s['absent']} absent, {s['needs_review']} review)" for s in sessions])
            answer = f"Here is the attendance summary for the last {len(sessions)} sessions:\n\n{rows}"
            
    elif "engagement" in q or "orientation" in q or "indicator" in q:
        tool_name = "get_session_engagement_indicators"
        backend_data = tool_get_session_engagement_indicators(db, session_id=session_id)
        if not backend_data.get("available", False):
            answer = backend_data.get("message", "Visual engagement indicators are not available for this session.")
        else:
            m = backend_data["aggregate_metrics"]
            vis = m.get("visibility_percentage", 0)
            pres = m.get("presentation_oriented_percentage", 0)
            title = backend_data.get("session_title", "Latest Session")
            answer = (
                f"Visual engagement indicator summary for **{title}**:\n\n"
                f"- **Visibility Frequency**: Participants were visible in **{vis}%** of sampled frames.\n"
                f"- **Observable Orientation**: Approximately **{pres}%** of observed face instances appeared oriented forward toward the presentation.\n"
                f"- **Total Analyzed Frames**: {m.get('total_frames_analyzed', 0)}\n\n"
                f"> **Important Notice**: These values represent observable visual geometric indicators only and do not measure student attention, interest, cognitive focus, or learning ability."
            )
    else:
        # Check if student name inquiry
        tool_name = "get_dashboard_metrics"
        backend_data = tool_get_dashboard_metrics(db)
        latest = backend_data.get("latest_session")
        if latest:
            answer = (
                f"Here are the latest attendance records from the database:\n\n"
                f"- **Latest Session**: {latest['session_title']} ({latest['session_date']})\n"
                f"- **Attendance Rate**: {latest['attendance_percentage']}%\n"
                f"- **Present**: {latest['present_count']} | **Absent**: {latest['absent_count']} | **Needs Review**: {latest['needs_review_count']}\n"
                f"- **Total Registered Active Students**: {backend_data['total_active_students']}\n"
                f"- **Overall System Attendance**: {backend_data['overall_attendance_percentage']}%\n\n"
                f"You can ask me specific questions like: *'How many students were absent?'*, *'Show students below 75%'*, or *'Summarize attendance for the last 5 sessions'*."
            )
        else:
            answer = f"Total registered students: {backend_data['total_active_students']}. No classroom sessions have been recorded yet."
            
    disclaimer = ETHICAL_DISCLAIMER if "engagement" in q or "orientation" in q else None
    
    return {
        "query": query_text,
        "answer": answer,
        "tool_used": tool_name,
        "backend_data": backend_data,
        "disclaimer": disclaimer,
        "timestamp": datetime.utcnow()
    }

def generate_session_summary_report(db: DBSession, session_id: str) -> Dict[str, Any]:
    sess_data = tool_get_session_details(db, session_id=session_id)
    if "error" in sess_data:
        raise ValueError(sess_data["error"])
        
    eng_data = tool_get_session_engagement_indicators(db, session_id=session_id)
    
    title = sess_data["title"]
    s_date = sess_data["date"]
    pct = sess_data["attendance_percentage"]
    pres = sess_data["present_count"]
    absent = sess_data["absent_count"]
    rev = sess_data["needs_review_count"]
    tot = sess_data["total_students"]
    
    eng_section = ""
    if eng_data.get("available", False):
        m = eng_data["aggregate_metrics"]
        eng_section = (
            f"### Visual Indicator Observations\n"
            f"- **Sampled Frames Analyzed**: {m.get('total_frames_analyzed', 'N/A')}\n"
            f"- **Frame Visibility Coverage**: {m.get('visibility_percentage', 'N/A')}%\n"
            f"- **Presentation-Oriented Observation Ratio**: {m.get('presentation_oriented_percentage', 'N/A')}%\n"
            f"\n*Ethical Note: Observable visual orientations represent geometric observations and do not assess mental focus or cognitive engagement.*\n\n"
        )
    else:
        eng_section = "### Visual Indicator Observations\n*Visual engagement analysis was not executed or is not configured for this session.*\n\n"
        
    report_md = (
        f"# Session Attendance & Analytics Report\n\n"
        f"**Session**: {title}\n"
        f"**Date**: {s_date} | **Status**: {sess_data['status'].capitalize()}\n\n"
        f"---\n\n"
        f"### Executive Attendance Summary\n"
        f"- **Attendance Rate**: **{pct}%**\n"
        f"- **Present Students**: {pres} / {tot}\n"
        f"- **Absent Students**: {absent}\n"
        f"- **Requiring Manual Verification**: {rev}\n\n"
        f"{eng_section}"
        f"### Action Items for Faculty\n"
        f"{f'- [ ] Review and verify the {rev} flagged attendance records.' if rev > 0 else '- [x] All automated attendance records verified.'}\n"
        f"{f'- [ ] Follow up on {absent} absent students.' if absent > 0 else '- [x] Full attendance achieved.'}\n"
    )
    
    return {
        "session_id": session_id,
        "session_title": title,
        "summary_markdown": report_md,
        "metrics": sess_data,
        "visual_indicators": eng_data.get("aggregate_metrics") if eng_data.get("available") else None
    }
