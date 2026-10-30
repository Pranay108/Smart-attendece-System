import React from 'react';

interface BadgeProps {
  variant: 'present' | 'absent' | 'needs_review' | 'verified' | 'unverified' | 'flagged' | 'active' | 'inactive' | 'enrolled' | 'not_enrolled';
  text?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant, text, className = '' }) => {
  const styles = {
    present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    absent: 'bg-rose-50 text-rose-700 border-rose-200',
    needs_review: 'bg-amber-50 text-amber-700 border-amber-200',
    verified: 'bg-blue-50 text-blue-700 border-blue-200',
    unverified: 'bg-slate-50 text-slate-600 border-slate-200',
    flagged: 'bg-orange-50 text-orange-700 border-orange-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-500 border-slate-200',
    enrolled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    not_enrolled: 'bg-slate-50 text-slate-500 border-slate-200',
  };

  const defaultText = {
    present: 'Present',
    absent: 'Absent',
    needs_review: 'Needs Review',
    verified: 'Verified',
    unverified: 'Unverified',
    flagged: 'Flagged',
    active: 'Active',
    inactive: 'Inactive',
    enrolled: 'Biometrics Enrolled',
    not_enrolled: 'No Biometrics',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]} ${className}`}>
      {text || defaultText[variant]}
    </span>
  );
};
