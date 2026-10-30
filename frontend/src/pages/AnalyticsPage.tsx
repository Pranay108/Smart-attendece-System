import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ClassRoom, StudentAttendanceStat } from '../types';
import { Badge } from '../components/Badge';
import {
  BarChart3,
  TrendingUp,
  Download,
  Filter,
  Users,
  AlertTriangle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [trends, setTrends] = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<StudentAttendanceStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classesData, trendsData, statsData] = await Promise.all([
        api.getClasses(),
        api.getAttendanceTrends(selectedClass || undefined),
        api.getStudentAttendanceStats(selectedClass || undefined),
      ]);
      setClasses(classesData);
      setTrends(trendsData.trend || []);
      setStudentStats(statsData || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass]);

  const handleExportCSV = () => {
    if (studentStats.length === 0) return;

    const headers = ['Full Name', 'Enrollment Number', 'Class', 'Total Sessions', 'Attended', 'Attendance Rate (%)', 'Status'];
    const rows = studentStats.map((s) => [
      `"${s.full_name}"`,
      `"${s.enrollment_number}"`,
      `"${s.class_name}"`,
      s.total_sessions,
      s.attended_sessions,
      `${s.attendance_percentage}%`,
      s.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const lowAttendanceCount = studentStats.filter((s) => s.attendance_percentage < 75 && s.total_sessions > 0).length;

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Attendance Analytics & Trends</h2>
          <p className="text-xs text-slate-500">
            Longitudinal trend visualization, student attendance records, and verifiable exportable reports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent focus:outline-none font-medium text-slate-700"
            >
              <option value="">All Academic Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.section})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={studentStats.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Warning Strip */}
      {lowAttendanceCount > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>{lowAttendanceCount} students</strong> currently have attendance below the 75% institutional threshold.
            </span>
          </div>
          <span className="text-[11px] text-amber-800 font-semibold">Faculty follow-up recommended</span>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Longitudinal Attendance Percentage Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Attendance Percentage Across Sessions</h3>
            <p className="text-xs text-slate-500">Historical percentage over time</p>
          </div>

          {trends.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="title"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    formatter={(val: any) => [`${val}%`, 'Attendance Rate']}
                  />
                  <Line
                    type="monotone"
                    dataKey="attendance_rate"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ fill: '#2563eb', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No trend data available for current selection.
            </div>
          )}
        </div>

        {/* Present vs Absent Count Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Session Headcount Breakdown</h3>
            <p className="text-xs text-slate-500">Present vs Absent headcount comparisons</p>
          </div>

          {trends.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="title"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="present" fill="#3b82f6" name="Present" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="#f43f5e" name="Absent" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="needs_review" fill="#f59e0b" name="Needs Review" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No headcount data available for current selection.
            </div>
          )}
        </div>
      </div>

      {/* Per-Student Attendance Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Student Attendance Standings</h3>
            <p className="text-xs text-slate-500">Individual attendance rates calculated from database records</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Enrolled: {studentStats.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Student Name</th>
                <th className="px-6 py-3.5">Enrollment Number</th>
                <th className="px-6 py-3.5">Class</th>
                <th className="px-6 py-3.5">Attended / Total</th>
                <th className="px-6 py-3.5">Attendance Rate</th>
                <th className="px-6 py-3.5 text-right">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Calculating attendance statistics...</span>
                  </td>
                </tr>
              ) : studentStats.length > 0 ? (
                studentStats.map((st) => (
                  <tr key={st.student_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{st.full_name}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">{st.enrollment_number}</td>
                    <td className="px-6 py-3.5 text-slate-600">{st.class_name}</td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-slate-900">{st.attended_sessions}</span>
                      <span className="text-slate-400"> / {st.total_sessions}</span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold">
                      <span
                        className={
                          st.attendance_percentage >= 75
                            ? 'text-emerald-700'
                            : st.attendance_percentage >= 60
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }
                      >
                        {st.attendance_percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          st.status === 'Good'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : st.status === 'Warning'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : st.status === 'Low'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {st.status === 'Good'
                          ? 'Satisfactory'
                          : st.status === 'Warning'
                          ? 'Warning (<75%)'
                          : st.status === 'Low'
                          ? 'Critical (<60%)'
                          : 'No Records'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No student attendance data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
