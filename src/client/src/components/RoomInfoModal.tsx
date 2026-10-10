import React from 'react';
import { useSocket } from '../context/SocketContext';
import { X, Info, Shield, Users, Globe, Lock } from 'lucide-react';

export const RoomInfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { roomState } = useSocket();

  if (!isOpen || !roomState) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-scale-in">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white">Room Information</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Room Name</h4>
            <div className="text-lg font-semibold text-slate-100">{roomState.name}</div>
          </div>
          
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</h4>
            <div className="text-sm text-slate-300 italic bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              {roomState.description || 'No description provided.'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Visibility</span>
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                {roomState.isPublic ? <Globe className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-rose-400" />}
                {roomState.isPublic ? 'Public Room' : 'Private Room'}
              </div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Capacity Limit</span>
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                <Users className="w-4 h-4 text-purple-400" />
                {roomState.participants.length} / {roomState.participantLimit}
              </div>
            </div>
          </div>
          
          {roomState.hasPassword && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs text-amber-400/90 font-medium">This room is secured with a password.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
