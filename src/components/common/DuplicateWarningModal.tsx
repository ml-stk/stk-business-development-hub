import React from 'react';
import { AlertCircle, ArrowRight, X } from 'lucide-react';
import { DuplicateMatch } from '../../services/organisationService';
import { OrgCategoryBadge, OrgStatusBadge } from './StatusBadge';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  candidateName: string;
  matches: DuplicateMatch[];
  onProceedAnyway: () => void;
  onSelectExisting: (orgId: string) => void;
  onCancel: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  candidateName,
  matches,
  onProceedAnyway,
  onSelectExisting,
  onCancel,
}) => {
  if (!isOpen || matches.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#141418] rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-amber-500/30 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Potential Duplicate Target Detected
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                We found existing target organisations similar to "{candidateName}"
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-1">
          {matches.map((m, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 hover:bg-amber-500/10 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-white truncate">
                    {m.organisation.name}
                  </h4>
                  <OrgCategoryBadge category={m.organisation.category} />
                  <OrgStatusBadge status={m.organisation.status} />
                </div>
                <p className="text-xs text-amber-300 mt-1">{m.reason}</p>
                {m.organisation.aliases && m.organisation.aliases.length > 0 && (
                  <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                    Known aliases: {m.organisation.aliases.join(', ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => onSelectExisting(m.organisation.id)}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 px-2.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                View Existing
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
          >
            Cancel & Edit Name
          </button>
          <button
            onClick={onProceedAnyway}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl transition-colors cursor-pointer"
          >
            Proceed & Create New Organisation Anyway
          </button>
        </div>
      </div>
    </div>
  );
};
