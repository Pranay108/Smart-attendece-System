import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { ClassSession, ProcessingJob, DetectedFaceResult } from '../types';
import { Badge } from '../components/Badge';
import { EthicalNotice } from '../components/EthicalNotice';
import {
  Upload,
  Camera,
  Film,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Eye,
  UserCheck,
  HelpCircle,
} from 'lucide-react';

export const MediaProcessingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get('session_id') || '';

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Processing state
  const [uploading, setUploading] = useState(false);
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [resultsData, setResultsData] = useState<{
    total_faces: number;
    matched: number;
    review_needed: number;
    faces: DetectedFaceResult[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await api.getSessions();
        setSessions(data);
        if (data.length > 0 && !selectedSessionId) {
          setSelectedSessionId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };
    loadSessions();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadLatestResults(selectedSessionId);
    }
  }, [selectedSessionId]);

  const loadLatestResults = async (sessionId: string) => {
    try {
      const data = await api.getSessionProcessingResults(sessionId);
      if (data?.latest_job) {
        setCurrentJob({
          id: data.latest_job.id,
          session_id: sessionId,
          media_type: data.latest_job.media_type,
          processing_status: data.latest_job.status,
          progress: data.latest_job.progress,
          total_faces_detected: data.latest_job.total_faces_detected,
          matched_count: data.latest_job.matched_count,
          review_needed_count: data.latest_job.review_needed_count,
          results_json: JSON.stringify(data.latest_job.results),
          created_at: new Date().toISOString(),
        });
        setResultsData({
          total_faces: data.latest_job.total_faces_detected,
          matched: data.latest_job.matched_count,
          review_needed: data.latest_job.review_needed_count,
          faces: data.latest_job.results || [],
        });
      } else {
        setCurrentJob(null);
        setResultsData(null);
      }
    } catch (err) {
      console.error('Error fetching latest results:', err);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const job = await api.getJobStatus(jobId);
        setCurrentJob(job);

        if (job.processing_status === 'completed' || job.processing_status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setUploading(false);
          if (selectedSessionId) {
            loadLatestResults(selectedSessionId);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollIntervalRef.current);
        setUploading(false);
      }
    }, 1500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    setErrorMsg(null);
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();

    if (activeTab === 'image') {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
      if (!allowed.includes(ext)) {
        setErrorMsg(`Unsupported image format (${ext}). Allowed: ${allowed.join(', ')}`);
        return;
      }
      if (f.size > 15 * 1024 * 1024) {
        setErrorMsg('Image size exceeds 15MB limit.');
        return;
      }
    } else {
      const allowed = ['.mp4', '.avi', '.mov', '.webm', '.mkv'];
      if (!allowed.includes(ext)) {
        setErrorMsg(`Unsupported video format (${ext}). Allowed: ${allowed.join(', ')}`);
        return;
      }
      if (f.size > 100 * 1024 * 1024) {
        setErrorMsg('Video size exceeds 100MB limit.');
        return;
      }
    }
    setFile(f);
  };

  const handleUploadAndProcess = async () => {
    if (!file || !selectedSessionId) {
      setErrorMsg('Please select a target session and a media file.');
      return;
    }

    setErrorMsg(null);
    setUploading(true);

    try {
      const job = await api.uploadSessionMedia(selectedSessionId, file);
      setCurrentJob(job);

      if (job.media_type === 'video') {
        // Video processing is asynchronous in the background
        startPolling(job.id);
      } else {
        // Image processing completes synchronously on backend
        setUploading(false);
        loadLatestResults(selectedSessionId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Media processing failed');
      setUploading(false);
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Multimodal Media Processing</h2>
          <p className="text-xs text-slate-500">
            Upload classroom image or video for automated face detection, authorized identity matching, and visual indicators
          </p>
        </div>
        {selectedSessionId && (
          <Link
            to={`/sessions/${selectedSessionId}/attendance`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors"
          >
            <span>Review Attendance Records</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Target Session Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Target Session:
          </span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} — {s.class_name} ({s.section}) | {s.session_date}
              </option>
            ))}
          </select>
        </div>

        {selectedSession && (
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              Status: <strong className="uppercase font-semibold">{selectedSession.processing_status}</strong>
            </span>
            <span>•</span>
            <span>
              Attendance Rate: <strong className="text-blue-600">{selectedSession.attendance_percentage}%</strong>
            </span>
          </div>
        )}
      </div>

      {/* Upload Zone & Mode Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              setFile(null);
              setErrorMsg(null);
            }}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'image'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Classroom Image Upload</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('video');
              setFile(null);
              setErrorMsg(null);
            }}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'video'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Classroom Video Upload (Background Processing)</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Drag and Drop Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              validateAndSetFile(e.dataTransfer.files[0]);
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50/50'
              : file
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            id="media-input"
            className="hidden"
            accept={
              activeTab === 'image'
                ? 'image/jpeg,image/png,image/webp'
                : 'video/mp4,video/quicktime,video/webm,video/x-msvideo'
            }
            onChange={handleFileChange}
          />
          <label htmlFor="media-input" className="cursor-pointer block space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-blue-600 mx-auto flex items-center justify-center shadow-xs">
              {activeTab === 'image' ? <Camera className="w-6 h-6" /> : <Film className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">
                {file ? file.name : `Click or drag & drop ${activeTab === 'image' ? 'a classroom photograph' : 'a classroom lecture video'}`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activeTab === 'image'
                  ? 'Supported: JPEG, PNG, WEBP (Max 15MB)'
                  : 'Supported: MP4, MOV, WEBM, AVI (Max 100MB, sampled at 1 FPS)'}
              </p>
            </div>
          </label>
        </div>

        {/* Upload Action Button */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            * Automated detections do not finalize attendance without faculty review opportunity.
          </p>
          <button
            type="button"
            onClick={handleUploadAndProcess}
            disabled={!file || uploading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Media...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload & Initiate Face Processing</span>
              </>
            )}
          </button>
        </div>

        {/* Asynchronous Video Progress Bar */}
        {currentJob && currentJob.processing_status === 'processing' && (
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <div className="flex justify-between text-xs font-medium text-blue-900">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Processing {currentJob.media_type} in background...</span>
              </span>
              <span>{currentJob.progress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentJob.progress}%` }}
              />
            </div>
            <p className="text-[11px] text-blue-700">
              Sampling frames at 1 FPS, running facial detection & tracking orientation observations. The UI remains responsive.
            </p>
          </div>
        )}
      </div>

      {/* Processing Results Summary & Detection Gallery */}
      {resultsData && (
        <div className="space-y-4">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Faces Detected
                </p>
                <p className="text-xl font-bold text-slate-900 mt-1">{resultsData.total_faces}</p>
              </div>
              <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
                <Eye className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                  Confident Matches
                </p>
                <p className="text-xl font-bold text-emerald-800 mt-1">{resultsData.matched}</p>
              </div>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                  Requires Manual Review
                </p>
                <p className="text-xl font-bold text-amber-800 mt-1">{resultsData.review_needed}</p>
              </div>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <HelpCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Detected Faces Visualizer Gallery */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Detected Faces Visualizer & Match Verification
                </h3>
                <p className="text-xs text-slate-500">
                  Inspect detected face crops, match confidence scores, and observable head orientation
                </p>
              </div>
              <Link
                to={`/sessions/${selectedSessionId}/attendance`}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <span>Confirm Attendance Table</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {resultsData.faces.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {resultsData.faces.map((f, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between"
                  >
                    <div className="aspect-square bg-slate-200 rounded-lg overflow-hidden relative">
                      <img
                        src={f.crop_url}
                        alt={`Face ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {f.confidence !== undefined && f.confidence > 0 && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-slate-900/80 text-white text-[10px] rounded font-mono">
                          {Math.round(f.confidence * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 truncate">
                          {f.matched_student_name || 'Unidentified'}
                        </span>
                      </div>

                      {f.enrollment_number && (
                        <p className="text-[10px] font-mono text-slate-500">{f.enrollment_number}</p>
                      )}

                      <div className="pt-1 flex flex-wrap gap-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                            f.match_status === 'matched'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : f.match_status === 'uncertain'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {f.match_status === 'matched'
                            ? 'Confident Match'
                            : f.match_status === 'uncertain'
                            ? 'Needs Review'
                            : 'Unidentified'}
                        </span>

                        {f.orientation && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {f.orientation.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No faces detected in the analyzed media file. Ensure clear lighting and resolution.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ethical Framework Banner */}
      <EthicalNotice />
    </div>
  );
};
