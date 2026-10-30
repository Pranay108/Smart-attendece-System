import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ClassSession, EngagementSummary } from '../types';
import { EthicalNotice } from '../components/EthicalNotice';
import {
  Compass,
  Eye,
  CheckCircle,
  AlertCircle,
  Info,
  RefreshCw,
  Calendar,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const EngagementPage: React.FC = () => {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [engagement, setEngagement] = useState<EngagementSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await api.getSessions();
        setSessions(data);
        if (data.length > 0) {
          setSelectedSessionId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching sessions:', err);
      }
    };
    loadSessions();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;

    const loadEngagement = async () => {
      setLoading(true);
      try {
        const data = await api.getSessionEngagement(selectedSessionId);
        setEngagement(data);
      } catch (err) {
        console.error('Error fetching engagement summary:', err);
      } finally {
        setLoading(false);
      }
    };
    loadEngagement();
  }, [selectedSessionId]);

  const orientationCounts = engagement?.aggregate_metrics?.orientation_counts;
  const pieData = orientationCounts
    ? [
        { name: 'Front-Facing (Presentation Oriented)', value: orientationCounts.front_facing, color: '#3b82f6' },
        { name: 'Downward (Notes / Desk Focus)', value: orientationCounts.downward_facing, color: '#6366f1' },
        { name: 'Side-Facing (Left)', value: orientationCounts.side_facing_left, color: '#0ea5e9' },
        { name: 'Side-Facing (Right)', value: orientationCounts.side_facing_right, color: '#94a3b8' },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Visual Engagement Indicators</h2>
          <p className="text-xs text-slate-500">
            Observable geometric head orientation and participant visibility across analyzed frames
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Select Session:
          </span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.session_date})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Prominent Ethical Standard Banner */}
      <EthicalNotice />

      {/* Main Content */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          <span>Retrieving session engagement analysis...</span>
        </div>
      ) : engagement?.available && engagement.aggregate_metrics ? (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Frame Visibility Ratio
              </span>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {engagement.aggregate_metrics.visibility_percentage}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Visible in {engagement.aggregate_metrics.frames_with_visible_participants} of{' '}
                {engagement.aggregate_metrics.total_frames_analyzed} sampled frames
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Presentation Oriented
              </span>
              <p className="text-2xl font-bold text-indigo-600 mt-2">
                {engagement.aggregate_metrics.presentation_oriented_percentage}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Observable forward head tilt orientation
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Face Observations
              </span>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {engagement.aggregate_metrics.total_face_instances_observed}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Aggregated across sampled video/image frames
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Coverage Rating
              </span>
              <p className="text-2xl font-bold text-emerald-700 mt-2">
                {engagement.aggregate_metrics.coverage_rating}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Based on continuous participant visibility
              </p>
            </div>
          </div>

          {/* Orientation Breakdown & Technical Quality Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Orientation Distribution Pie Chart */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Observable Head Orientation Distribution
                </h3>
                <p className="text-xs text-slate-500">
                  Approximate geometric classification across all analyzed face instances
                </p>
              </div>

              {pieData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  No orientation data available.
                </div>
              )}
            </div>

            {/* Technical Parameters & Quality Flags */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Technical Parameters</h3>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700 block">Analysis Sampling Frequency:</span>
                  <span className="text-slate-500">
                    {engagement.limitations_and_quality_flags?.sampling_rate || '1 sampled frame per second'}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block">Camera Perspective:</span>
                  <span className="text-slate-500">
                    {engagement.limitations_and_quality_flags?.camera_angle_factor || 'Standard front-of-room perspective'}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block">Lighting Reliability:</span>
                  <span className="text-slate-500">
                    {engagement.limitations_and_quality_flags?.lighting_reliability || 'Adequate indoor contrast'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                    <p className="font-semibold text-slate-800 text-[11px]">Normative Behavior Note</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Downward-facing orientation frequently correlates with taking notes, reading reference materials, or tablet interaction. It is not an indicator of distraction.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 space-y-3">
          <Compass className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-sm text-slate-800">
            Engagement analysis not available for this session
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {engagement?.message || 'Visual engagement indicators could not be calculated because video or image media processing has not been performed for this session.'}
          </p>
        </div>
      )}
    </div>
  );
};
