export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  section: string;
  description?: string;
  created_at: string;
  student_count?: number;
  session_count?: number;
}

export interface Student {
  id: string;
  full_name: string;
  enrollment_number: string;
  class_id: string;
  email?: string;
  is_active: boolean;
  biometric_consent: boolean;
  biometric_enrolled: boolean;
  created_at: string;
  updated_at: string;
  class_name?: string;
  section?: string;
}

export interface ClassSession {
  id: string;
  title: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time?: string;
  processing_status: 'ready' | 'processing' | 'completed' | 'failed';
  created_by?: string;
  created_at: string;
  class_name?: string;
  section?: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  needs_review_count: number;
  attendance_percentage: number;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'needs_review';
  attendance_method: 'manual' | 'image_detection' | 'video_detection' | 'manual_correction';
  verification_status: 'unverified' | 'verified' | 'flagged_review';
  detection_timestamp?: string;
  confidence?: number;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  student_name?: string;
  enrollment_number?: string;
}

export interface ProcessingJob {
  id: string;
  session_id: string;
  media_type: 'image' | 'video';
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error_summary?: string;
  total_faces_detected: number;
  matched_count: number;
  review_needed_count: number;
  results_json?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface DetectedFaceResult {
  face_index?: number;
  bbox?: [number, number, number, number];
  crop_url: string;
  quality_score?: number;
  orientation?: string;
  is_presentation_oriented?: boolean;
  match_status: 'matched' | 'uncertain' | 'unidentified';
  matched_student_id?: string;
  matched_student_name?: string;
  enrollment_number?: string;
  confidence?: number;
  timestamp_sec?: number;
}

export interface EngagementSummary {
  available: boolean;
  session_id?: string;
  session_title?: string;
  session_date?: string;
  message?: string;
  aggregate_metrics?: {
    total_frames_analyzed: number;
    frames_with_visible_participants: number;
    total_face_instances_observed: number;
    visibility_percentage: number;
    presentation_oriented_percentage: number;
    orientation_counts: {
      front_facing: number;
      downward_facing: number;
      side_facing_left: number;
      side_facing_right: number;
    };
    coverage_rating: string;
  };
  limitations_and_quality_flags?: {
    ethical_disclaimer: string;
    sampling_rate: string;
    metric_type: string;
    camera_angle_factor: string;
    lighting_reliability: string;
  };
  disclaimer?: string;
}

export interface DashboardStats {
  total_students: number;
  total_sessions: number;
  latest_session?: {
    id: string;
    title: string;
    date: string;
    class_name: string;
    present_count: number;
    absent_count: number;
    attendance_percentage: number;
  };
  latest_present_count: number;
  latest_absent_count: number;
  latest_attendance_percentage: number;
  overall_attendance_percentage: number;
  recent_sessions: Array<{
    id: string;
    title: string;
    date: string;
    class_name: string;
    present: number;
    absent: number;
    needs_review: number;
    total: number;
    attendance_rate: number;
    status: string;
  }>;
  engagement_indicator_summary: EngagementSummary;
}

export interface StudentAttendanceStat {
  student_id: string;
  full_name: string;
  enrollment_number: string;
  class_name: string;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
  status: 'Good' | 'Warning' | 'Low' | 'N/A';
}

export interface AgentQueryResult {
  query: string;
  answer: string;
  tool_used: string;
  backend_data: any;
  disclaimer?: string;
  timestamp: string;
}
