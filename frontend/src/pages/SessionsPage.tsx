import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { ClassSession, ClassRoom } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import {
  CalendarDays,
  Plus,
  Camera,
  CheckSquare,
  Clock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // New Session Modal State
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isNewClassOpen, setIsNewClassOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [sessionClassId, setSessionClassId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('11:00');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionsData, classesData] = await Promise.all([
        api.getSessions(selectedClass || undefined),
        api.getClasses(),
      ]);
      setSessions(sessionsData);
      setClasses(classesData);
      if (classesData.length > 0 && !sessionClassId) {
        setSessionClassId(classesData[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await api.createSession({
        title,
        class_id: sessionClassId,
        session_date: sessionDate,
        start_time: startTime,
        end_time: endTime || undefined,
      });
      setIsNewSessionOpen(false);
      setTitle('');
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const newCls = await api.createClass({
        name: newClassName,
        section: newSection,
        description: newDescription || undefined,
      });
      setIsNewClassOpen(false);
      setNewClassName('');
      setNewSection('');
      setNewDescription('');
      await fetchData();
      setSessionClassId(newCls.id);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create class');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Attendance Sessions & Class Schedules</h2>
          <p className="text-xs text-slate-500">
            Create classroom lecture sessions and select multimodal processing or manual attendance methods
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFormError(null);
              setIsNewClassOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-xl shadow-xs transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-blue-600" />
            <span>New Class</span>
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setTitle('');
              setIsNewSessionOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Session</span>
          </button>
        </div>
      </div>

      {/* Class Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filter by Class:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Registered Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.section}) — {c.student_count || 0} students
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Showing {sessions.length} sessions
        </span>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          <span>Loading attendance sessions...</span>
        </div>
      ) : sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                    {sess.class_name} ({sess.section})
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      sess.processing_status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : sess.processing_status === 'processing'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {sess.processing_status.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug mb-2">
                  {sess.title}
                </h3>

                <div className="space-y-1.5 text-xs text-slate-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span>{sess.session_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {sess.start_time} {sess.end_time ? `– ${sess.end_time}` : ''}
                    </span>
                  </div>
                </div>

                {/* Progress & Stat Strip */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-medium">Attendance Rate</span>
                    <span className="font-bold text-slate-900">{sess.attendance_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, sess.attendance_percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                    <span className="text-emerald-700 font-medium">{sess.present_count} Present</span>
                    <span className="text-rose-700 font-medium">{sess.absent_count} Absent</span>
                    <span className="text-amber-700 font-medium">{sess.needs_review_count} Review</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <Link
                  to={`/media-processing?session_id=${sess.id}`}
                  className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Media Upload</span>
                </Link>
                <Link
                  to={`/sessions/${sess.id}/attendance`}
                  className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold text-center shadow-xs transition-colors flex items-center justify-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Review Records</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 space-y-3">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-sm text-slate-800">No sessions conducted for this class</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "Create Session" above to schedule a lecture and initiate automated or manual attendance processing.
          </p>
        </div>
      )}

      {/* Create Session Modal */}
      <Modal
        isOpen={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        title="Create Attendance Session"
      >
        <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Session Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lecture 5: Convolutional Filters & Features"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Class / Section *
            </label>
            <select
              required
              value={sessionClassId}
              onChange={(e) => setSessionClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.section})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Session Date *
            </label>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Start Time *
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                End Time (Optional)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewSessionOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Class Modal */}
      <Modal
        isOpen={isNewClassOpen}
        onClose={() => setIsNewClassOpen(false)}
        title="Add Academic Class"
      >
        <form onSubmit={handleCreateClass} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Class Name *
            </label>
            <input
              type="text"
              required
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. Neural Networks & Deep Learning"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Section *
            </label>
            <input
              type="text"
              required
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              placeholder="e.g. Section C"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Course overview and syllabus details..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewClassOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
