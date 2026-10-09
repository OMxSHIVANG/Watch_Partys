import React from 'react';
import { useSocket } from '../context/SocketContext';
import { ChangeRequestData } from '../../../shared/types';
import { Check, X, ShieldAlert, Sparkles } from 'lucide-react';

export const RequestApprovalModal: React.FC = () => {
  const { roomState, userRole, respondRequest } = useSocket();

  const canApprove = userRole === 'host' || userRole === 'moderator';
  const pendingRequests = roomState?.requests || [];

  if (!canApprove || pendingRequests.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full space-y-3">
      {pendingRequests.map((req: ChangeRequestData) => (
        <div
          key={req.id}
          className="glass-panel bg-slate-900/95 border-2 border-rose-500/40 rounded-2xl p-4 shadow-2xl animate-bounce-short"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                Participant Change Request
              </div>
              <p className="text-xs text-slate-200 mt-1 font-medium">
                <span className="text-white font-bold">{req.requestedBy.username}</span> requested to{' '}
                <span className="text-rose-400 font-semibold">{req.type.replace('_', ' ')}</span>
                {req.payload.videoTitle && (
                  <span className="block text-slate-400 text-[11px] truncate mt-0.5">
                    "{req.payload.videoTitle}"
                  </span>
                )}
                {req.payload.videoId && !req.payload.videoTitle && (
                  <span className="block font-mono text-slate-400 text-[11px] truncate mt-0.5">
                    ID: {req.payload.videoId}
                  </span>
                )}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => respondRequest(req.id, true)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md shadow-emerald-600/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => respondRequest(req.id, false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
