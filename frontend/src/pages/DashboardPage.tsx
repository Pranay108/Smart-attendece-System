import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { DashboardStats } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { EthicalNotice } from '../components/EthicalNotice';
import {
  Users,
  CalendarDays,
  UserCheck,
  UserX,
  Percent,
  Compass,
  ArrowRight,
  PlusCircle,
  Camera,
  Bot,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardAnalytics();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-blue-600" />
        <span>Loading verified database records...</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
        <h3 className="font-semibold text-sm">Failed to retrieve dashboard analytics</h3>
        <p className="text-xs mt-1">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const chartData = stats?.recent_sessions
    ? [...stats.recent_sessions].reverse().map((s) => ({
        name: s.title.length > 20 ? s.title.slice(0, 18) + '...' : s.title,
        present: s.present,
        absent: s.absent,
        rate: s.attendance_rate,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Faculty Attendance Dashboard</h2>
          <p className="text-xs text-slate-500">
            Real-time aggregate records and multimodal verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/sessions"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Session</span>
          </Link>
          <Link
            to="/media-processing"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-xl shadow-xs transition-colors"
          >
            <Camera className="w-4 h-4 text-blue-600" />
            <span>Process Media</span>
          </Link>
          <Link
            to="/agent"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium rounded-xl transition-colors"
          >
            <Bot className="w-4 h-4 text-indigo-600" />
            <span>AI Assistant</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Students"
          value={stats?.total_students ?? 0}
          subtitle="Enrolled across active classes"
          icon={Users}
        />
        <StatCard
          title="Sessions Conducted"
          value={stats?.total_sessions ?? 0}
          subtitle="Classroom sessions recorded"
          icon={CalendarDays}
        />
        <StatCard
          title="Latest Session Present"
          value={stats?.latest_present_count ?? 0}
          subtitle={stats?.latest_session ? `${stats.latest_session.title} (${stats.latest_session.date})` : 'No sessions recorded'}
          icon={UserCheck}
          trend={stats?.latest_session ? `${stats.latest_attendance_percentage}%` : undefined}
          trendColor="positive"
        />
        <StatCard
          title="Latest Session Absent"
          value={stats?.latest_absent_count ?? 0}
          subtitle="Students absent in latest session"
          icon={UserX}
          trend={stats?.latest_absent_count ? `${stats.latest_absent_count} absent` : 'None'}
          trendColor={stats?.latest_absent_count && stats.latest_absent_count > 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* Attendance Trends Chart & Latest Session Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Attendance Distribution Across Sessions</h3>
              <p className="text-xs text-slate-500">Present vs. Absent counts from actual records</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg">
              Overall: {stats?.overall_attendance_percentage ?? 0}%
            </span>
          </div>

          {chartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="present" fill="#3b82f6" name="Present" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="#f43f5e" name="Absent" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No historical session records available yet.
            </div>
          )}
        </div>

        {/* Visual Engagement Indicator Quick Overview */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Compass className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Visual Indicator Summary</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Aggregate</span>
            </div>

            {stats?.engagement_indicator_summary?.available ? (
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Frame Visibility Ratio</span>
                    <span className="font-semibold text-slate-900">
                      {stats.engagement_indicator_summary.aggregate_metrics?.visibility_percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, stats.engagement_indicator_summary.aggregate_metrics?.visibility_percentage || 0)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Presentation-Oriented Orientation</span>
                    <span className="font-semibold text-slate-900">
                      {stats.engagement_indicator_summary.aggregate_metrics?.presentation_oriented_percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, stats.engagement_indicator_summary.aggregate_metrics?.presentation_oriented_percentage || 0)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                  <p className="font-medium text-slate-800">
                    Latest: {stats.engagement_indicator_summary.session_title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Frames analyzed: {stats.engagement_indicator_summary.aggregate_metrics?.total_frames_analyzed} (Coverage: {stats.engagement_indicator_summary.aggregate_metrics?.coverage_rating})
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                <Compass className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No video or image engagement analysis available for latest session.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Link
              to="/engagement"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-between"
            >
              <span>View Full Engagement Indicator Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Attendance Sessions</h3>
            <p className="text-xs text-slate-500">Latest classroom records and verification state</p>
          </div>
          <Link
            to="/sessions"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>All Sessions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Session Title</th>
                <th className="px-6 py-3">Class</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Present / Total</th>
                <th className="px-6 py-3">Attendance Rate</th>
                <th className="px-6 py-3">Processing State</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {stats?.recent_sessions && stats.recent_sessions.length > 0 ? (
                stats.recent_sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900">{sess.title}</td>
                    <td className="px-6 py-3.5 text-slate-600">{sess.class_name}</td>
                    <td className="px-6 py-3.5 text-slate-500">{sess.date}</td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-slate-900">{sess.present}</span>
                      <span className="text-slate-400"> / {sess.total}</span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-blue-600">
                      {sess.attendance_rate}%
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          sess.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {sess.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <Link
                        to={`/sessions/${sess.id}/attendance`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Review
                      </Link>
                      <Link
                        to={`/media-processing?session_id=${sess.id}`}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Media
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-xs">
                    No sessions found. Create a session to start managing attendance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ethical Framework Banner */}
      <EthicalNotice />
    </div>
  );
};
