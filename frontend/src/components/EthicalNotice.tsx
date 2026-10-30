import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

interface EthicalNoticeProps {
  compact?: boolean;
}

export const EthicalNotice: React.FC<EthicalNoticeProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-start gap-2 p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Notice:</strong> Visual orientations represent observable geometric approximations only. They do not infer cognitive attention or learning ability and must not be used for grading.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-200/80 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs text-slate-700">
          <h4 className="text-sm font-semibold text-slate-900">
            Ethical Framework & Technical Boundaries
          </h4>
          <p className="leading-relaxed">
            Observable visual engagement indicators measure geometric head orientation and visibility duration across analyzed frames. 
            <strong> These metrics strictly do not measure:</strong> mental comprehension, psychological interest, focus, intelligence, or academic integrity.
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600 pt-1">
            <li>Looking downward at notebooks, desks, or devices is standard classroom behavior and not a penalty.</li>
            <li>Engagement indicators are optional, aggregate observations and are never used to calculate student grades or disciplinary actions.</li>
            <li>Biometric identity matching is consent-based and reviewable by faculty.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
