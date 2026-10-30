import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { ClassSession, AttendanceRecord } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import {
  CheckSquare,
  Check,
  X,
  AlertTriangle,
  ArrowLeft,
  Camera,
  RefreshCw,
  ShieldCheck,
  Edit3,
  Calendar,
  Clock,
} from 'lucide-react';

export const AttendanceReviewPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<ClassSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'needs_review'>('all');

  // Correction Modal State
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<'present' | 'absent' | 'needs_review'>('present');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [sessData, recsData] = await Promise.all([
        api.getSession(sessionId),
        api.getSessionAttendance(sessionId),
      ]);
      setSession(sessData);
      setRecords(recsData);
    } catch (err) {
      console.error('Error fetching attendance review records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  const handleQuickStatusChange = async (rec: AttendanceRecord, targetStatus: 'present' | 'absent' | 'needs_review') => {
    if (rec.status === targetStatus) return;

    try {
      const updated = await api.correctAttendanceRecord(
        rec.id,
        targetStatus,
        'Quick toggle verification by faculty'
      );
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      // Refresh session statistics
      if (sessionId) {
        const refreshedSession = await api.getSession(sessionId);
        setSession(refreshedSession);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update record');
    }
  };

  const handleOpenCorrectModal = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setNewStatus(rec.status);
    setReason('');
    setIsCorrectModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSaving(true);

    try {
      const updated = await api.correctAttendanceRecord(
        selectedRecord.id,
        newStatus,
        reason || 'Manual faculty review & correction'
      );
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setIsCorrectModalOpen(false);
      setSelectedRecord(null);
      if (sessionId) {
        const refreshedSession = await api.getSession(sessionId);
        setSession(refreshedSession);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to apply correction');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkConfirmVerified = async () => {
    if (!sessionId) return;
    const reviewNeeded = records.filter((r) => r.status === 'needs_review');
    if (reviewNeeded.length === 0) {
      alert('No records currently requiring review.');
      return;
    }

    if (!window.confirm(`Confirm attendance as 'Present' for all ${reviewNeeded.length} flagged students?`)) {
      return;
    }

    try {
      const bulkPayload = reviewNeeded.map((r) => ({
        student_id: r.student_id,
        status: 'present',
      }));
      await api.bulkCorrectAttendance(sessionId, bulkPayload);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Bulk correction failed');
    }
  };

  const filteredRecords = records.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const presentCount = records.filter((r) => r.status === 'present').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const reviewCount = records.filter((r) => r.status === 'needs_review').length;
  const attendancePct = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/sessions"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sessions List</span>
          </Link>
          <h2 className="text-xl font-bold text-slate-900">
            Attendance Review: {session?.title || 'Session Records'}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {session?.class_name} ({session?.section})
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{session?.session_date}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{session?.start_time}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/media-processing?session_id=${sessionId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-xl shadow-xs transition-colors"
          >
            <Camera className="w-4 h-4 text-blue-600" />
            <span>Upload New Media</span>
          </Link>
          {reviewCount > 0 && (
            <button
              onClick={handleBulkConfirmVerified}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Confirm All ({reviewCount}) Flagged as Present</span>
            </button>
          )}
        </div>
      </div>

      {/* Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attendance Rate</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{attendancePct}%</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{presentCount} of {records.length} enrolled</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Present</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{presentCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Verified attendance</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Absent</p>
          <p className="text-2xl font-bold text-rose-800 mt-1">{absentCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Not observed / marked absent</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Needs Review</p>
          <p className="text-2xl font-bold text-amber-800 mt-1">{reviewCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Uncertain identity matches</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setStatusFilter('all')}
          className={`pb-3 border-b-2 transition-colors ${
            statusFilter === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Students ({records.length})
        </button>
        <button
          onClick={() => setStatusFilter('needs_review')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            statusFilter === 'needs_review'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Flagged for Review</span>
          {reviewCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
              {reviewCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('present')}
          className={`pb-3 border-b-2 transition-colors ${
            statusFilter === 'present'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Present ({presentCount})
        </button>
        <button
          onClick={() => setStatusFilter('absent')}
          className={`pb-3 border-b-2 transition-colors ${
            statusFilter === 'absent'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Absent ({absentCount})
        </button>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Student Name</th>
                <th className="px-6 py-3.5">Enrollment Number</th>
                <th className="px-6 py-3.5">Current Status</th>
                <th className="px-6 py-3.5">Detection Method</th>
                <th className="px-6 py-3.5">Verification State</th>
                <th className="px-6 py-3.5">Confidence Score</th>
                <th className="px-6 py-3.5 text-right">Faculty Correction Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading session attendance records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      r.status === 'needs_review' ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{r.student_name}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">{r.enrollment_number}</td>
                    <td className="px-6 py-3.5">
                      <Badge variant={r.status} />
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 capitalize">
                      {r.attendance_method.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={r.verification_status === 'verified' ? 'verified' : r.verification_status === 'flagged_review' ? 'flagged' : 'unverified'} />
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">
                      {r.confidence !== null && r.confidence !== undefined ? `${Math.round(r.confidence * 100)}%` : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Action Toggle Buttons */}
                        <button
                          onClick={() => handleQuickStatusChange(r, 'present')}
                          title="Mark Present"
                          className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            r.status === 'present'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleQuickStatusChange(r, 'absent')}
                          title="Mark Absent"
                          className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            r.status === 'absent'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleQuickStatusChange(r, 'needs_review')}
                          title="Mark Needs Review"
                          className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            r.status === 'needs_review'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenCorrectModal(r)}
                          title="Custom Correction with Reason"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors ml-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No attendance records for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Correction Dialog */}
      <Modal
        isOpen={isCorrectModalOpen}
        onClose={() => setIsCorrectModalOpen(false)}
        title="Faculty Attendance Correction"
      >
        <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <p className="text-[11px] text-slate-500">Student Record:</p>
            <p className="font-semibold text-slate-900 text-sm">
              {selectedRecord?.student_name} ({selectedRecord?.enrollment_number})
            </p>
            <p className="text-[11px] text-slate-600">
              Current Method: {selectedRecord?.attendance_method.replace('_', ' ')} | Status: {selectedRecord?.status}
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select Corrected Status *
            </label>
            <select
              value={newStatus}
              onChange={(e: any) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="present">Present (Verified)</option>
              <option value="absent">Absent</option>
              <option value="needs_review">Needs Review</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Correction Reason (Recorded in Institutional Audit Trail)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Visual verification by faculty; student seated at back row"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCorrectModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-60"
            >
              {saving ? 'Updating...' : 'Save Correction'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
