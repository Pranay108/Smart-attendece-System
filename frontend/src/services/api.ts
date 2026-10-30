import { 
  User, ClassRoom, Student, ClassSession, AttendanceRecord, 
  ProcessingJob, DashboardStats, StudentAttendanceStat, AgentQueryResult, EngagementSummary 
} from '../types';

const BACKEND_URL = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, '') : '';
const API_BASE = `${BACKEND_URL}/api`;

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string):Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async register(name: string, email: string, password: string): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: 'teacher' }),
    });
    return handleResponse(res);
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Classes
  async getClasses(): Promise<ClassRoom[]> {
    const res = await fetch(`${API_BASE}/classes`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async createClass(data: { name: string; section: string; description?: string }): Promise<ClassRoom> {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Students
  async getStudents(params?: { class_id?: string; search?: string; active_only?: boolean }): Promise<Student[]> {
    const query = new URLSearchParams();
    if (params?.class_id) query.append('class_id', params.class_id);
    if (params?.search) query.append('search', params.search);
    if (params?.active_only !== undefined) query.append('active_only', String(params.active_only));

    const res = await fetch(`${API_BASE}/students?${query.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async createStudent(data: { full_name: string; enrollment_number: string; class_id: string; email?: string }): Promise<Student> {
    const res = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateStudent(id: string, data: Partial<Student>): Promise<Student> {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deactivateStudent(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async enrollBiometric(studentId: string, file: File, consent: boolean): Promise<{ message: string; quality_score: number; biometric_enrolled: boolean }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('consent', String(consent));

    const res = await fetch(`${API_BASE}/students/${studentId}/biometric-enroll`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    return handleResponse(res);
  },

  async revokeBiometric(studentId: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/students/${studentId}/biometric`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Sessions
  async getSessions(class_id?: string): Promise<ClassSession[]> {
    const query = class_id ? `?class_id=${class_id}` : '';
    const res = await fetch(`${API_BASE}/sessions${query}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getSession(sessionId: string): Promise<ClassSession> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async createSession(data: { title: string; class_id: string; session_date: string; start_time: string; end_time?: string }): Promise<ClassSession> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getSessionAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/attendance`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Media Upload & Processing
  async uploadSessionMedia(sessionId: string, file: File): Promise<ProcessingJob> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/sessions/${sessionId}/media`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    return handleResponse(res);
  },

  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getSessionProcessingResults(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/processing-results`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Attendance Corrections
  async correctAttendanceRecord(attendanceId: string, status: string, correction_reason?: string): Promise<AttendanceRecord> {
    const res = await fetch(`${API_BASE}/attendance/${attendanceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ status, correction_reason }),
    });
    return handleResponse(res);
  },

  async bulkCorrectAttendance(sessionId: string, records: Array<{ student_id: string; status: string }>): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/attendance/sessions/${sessionId}/attendance/bulk-correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ records }),
    });
    return handleResponse(res);
  },

  // Analytics
  async getDashboardAnalytics(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/analytics/dashboard`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getAttendanceTrends(class_id?: string): Promise<{ trend: Array<any> }> {
    const q = class_id ? `?class_id=${class_id}` : '';
    const res = await fetch(`${API_BASE}/analytics/attendance-trends${q}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getStudentAttendanceStats(class_id?: string): Promise<StudentAttendanceStat[]> {
    const q = class_id ? `?class_id=${class_id}` : '';
    const res = await fetch(`${API_BASE}/analytics/student-attendance${q}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Engagement
  async getSessionEngagement(sessionId: string): Promise<EngagementSummary> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/engagement-summary`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // AI Agent
  async queryAgent(query: string, sessionId?: string): Promise<AgentQueryResult> {
    const res = await fetch(`${API_BASE}/agent/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ query, session_id: sessionId }),
    });
    return handleResponse(res);
  },

  async generateSessionSummary(sessionId: string): Promise<{ session_id: string; session_title: string; summary_markdown: string; metrics: any; visual_indicators: any }> {
    const res = await fetch(`${API_BASE}/agent/session-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ session_id: sessionId }),
    });
    return handleResponse(res);
  }
};
