import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Student, ClassRoom } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import {
  Users,
  Search,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
} from 'lucide-react';

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState<boolean>(true);

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBiometricOpen, setIsBiometricOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [classId, setClassId] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Biometric Enrollment State
  const [consentChecked, setConsentChecked] = useState(false);
  const [bioFile, setBioFile] = useState<File | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [bioSubmitting, setBioSubmitting] = useState(false);
  const [bioSuccess, setBioSuccess] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const [studentsData, classesData] = await Promise.all([
        api.getStudents({
          class_id: selectedClass || undefined,
          search: search || undefined,
          active_only: activeOnly,
        }),
        api.getClasses(),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
      if (classesData.length > 0 && !classId) {
        setClassId(classesData[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass, activeOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      await api.createStudent({
        full_name: fullName,
        enrollment_number: enrollmentNumber,
        class_id: classId,
        email: email || undefined,
      });
      setIsRegisterOpen(false);
      setFullName('');
      setEnrollmentNumber('');
      setEmail('');
      fetchStudents();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register student');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setFormError(null);
    setFormSubmitting(true);

    try {
      await api.updateStudent(selectedStudent.id, {
        full_name: fullName,
        email: email || undefined,
        class_id: classId,
      });
      setIsEditOpen(false);
      setSelectedStudent(null);
      fetchStudents();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update student');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivateStudent = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to deactivate ${student.full_name}? Historical attendance records will be preserved.`)) {
      return;
    }
    try {
      await api.deactivateStudent(student.id);
      fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate student');
    }
  };

  const handleBiometricEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !bioFile) {
      setBioError('Please select a reference face photo.');
      return;
    }
    if (!consentChecked) {
      setBioError('Explicit consent must be confirmed before enrolling biometric data.');
      return;
    }

    setBioError(null);
    setBioSubmitting(true);

    try {
      const res = await api.enrollBiometric(selectedStudent.id, bioFile, consentChecked);
      setBioSuccess(res.message);
      setTimeout(() => {
        setIsBiometricOpen(false);
        setSelectedStudent(null);
        setBioFile(null);
        setConsentChecked(false);
        setBioSuccess(null);
        fetchStudents();
      }, 1500);
    } catch (err: any) {
      setBioError(err.message || 'Biometric enrollment failed');
    } finally {
      setBioSubmitting(false);
    }
  };

  const handleRevokeBiometrics = async (student: Student) => {
    if (!window.confirm(`Revoke biometric enrollment for ${student.full_name}? The feature descriptor vector will be permanently deleted.`)) {
      return;
    }
    try {
      await api.revokeBiometric(student.id);
      fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke biometrics');
    }
  };

  const openEditModal = (s: Student) => {
    setSelectedStudent(s);
    setFullName(s.full_name);
    setEnrollmentNumber(s.enrollment_number);
    setEmail(s.email || '');
    setClassId(s.class_id);
    setIsEditOpen(true);
  };

  const openBiometricModal = (s: Student) => {
    setSelectedStudent(s);
    setConsentChecked(false);
    setBioFile(null);
    setBioError(null);
    setBioSuccess(null);
    setIsBiometricOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Student Directory & Biometric Profiles</h2>
          <p className="text-xs text-slate-500">
            Manage student registrations, class assignments, and consent-based facial profiles
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setFullName('');
            setEnrollmentNumber('');
            setEmail('');
            setIsRegisterOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Register Student</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or enrollment number..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.section})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Active only</span>
          </label>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Student Name</th>
                <th className="px-6 py-3.5">Enrollment Number</th>
                <th className="px-6 py-3.5">Class / Section</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Biometric Status</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading student records...</span>
                  </td>
                </tr>
              ) : students.length > 0 ? (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{s.full_name}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">{s.enrollment_number}</td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {s.class_name ? `${s.class_name} (${s.section})` : 'Unassigned'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{s.email || '—'}</td>
                    <td className="px-6 py-3.5">
                      {s.biometric_enrolled ? (
                        <Badge variant="enrolled" text="Enrolled (Consented)" />
                      ) : (
                        <Badge variant="not_enrolled" text="Not Enrolled" />
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={s.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      {s.biometric_enrolled ? (
                        <button
                          onClick={() => handleRevokeBiometrics(s)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                          title="Revoke biometric profile"
                        >
                          Revoke Bio
                        </button>
                      ) : (
                        <button
                          onClick={() => openBiometricModal(s)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Enroll Bio
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(s)}
                        className="text-xs text-slate-600 hover:text-slate-900"
                        title="Edit record"
                      >
                        <Edit2 className="w-3.5 h-3.5 inline" />
                      </button>
                      {s.is_active && (
                        <button
                          onClick={() => handleDeactivateStudent(s)}
                          className="text-xs text-rose-500 hover:text-rose-700"
                          title="Deactivate"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No student records matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Registration Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Student"
      >
        <form onSubmit={handleRegisterStudent} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Liam O'Connor"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Enrollment Number * (Must be Unique)
            </label>
            <input
              type="text"
              required
              value={enrollmentNumber}
              onChange={(e) => setEnrollmentNumber(e.target.value)}
              placeholder="e.g. STU-2026-042"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Assigned Class *
            </label>
            <select
              required
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
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
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@univ.edu"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-60"
            >
              {formSubmitting ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Student Information"
      >
        <form onSubmit={handleEditStudent} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Enrollment Number
            </label>
            <input
              type="text"
              disabled
              value={enrollmentNumber}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Assigned Class *
            </label>
            <select
              required
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
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
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-60"
            >
              {formSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Biometric Enrollment Modal (Separate, Explicit Consent Process) */}
      <Modal
        isOpen={isBiometricOpen}
        onClose={() => setIsBiometricOpen(false)}
        title="Biometric Feature Enrollment"
      >
        <form onSubmit={handleBiometricEnroll} className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Consent-Based Biometric Privacy Standard</span>
            </div>
            <p className="text-[11px] leading-relaxed text-blue-800">
              Biometric enrollment is never automatic. A normalized 128-dimensional facial descriptor vector is generated from an authorized portrait and stored separately from plain records. Raw photos are not retained in public directories.
            </p>
          </div>

          {bioError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{bioError}</span>
            </div>
          )}

          {bioSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{bioSuccess}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Enrolling Student
            </label>
            <p className="text-sm font-semibold text-slate-900">
              {selectedStudent?.full_name} ({selectedStudent?.enrollment_number})
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Upload Frontal Face Portrait *
            </label>
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setBioFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Single clear frontal portrait photo required. Multi-face or blurry photos will be rejected.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-700 leading-relaxed">
                <strong>Explicit Biometric Consent:</strong> I confirm that the student (or authorized guardian) has explicitly consented to the collection of facial feature descriptors solely for classroom attendance verification. Consent may be revoked at any time.
              </span>
            </label>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsBiometricOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bioSubmitting || !consentChecked || !bioFile}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-50"
            >
              {bioSubmitting ? 'Analyzing & Enrolling...' : 'Confirm & Enroll Biometrics'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
