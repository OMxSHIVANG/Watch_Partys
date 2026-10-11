import React from 'react';
import { useSocket } from '../context/SocketContext';
import { RoleBadge } from './RoleBadge';
import { UserRole, ParticipantData } from '../../../shared/types';
import { Users, UserX, Crown, ShieldCheck } from 'lucide-react';

export const ParticipantList: React.FC = () => {
  const { roomState, userId, userRole, assignRole, removeParticipant, transferHost } = useSocket();

  const isHost = userRole === 'host';
  const participants = roomState?.participants || [];

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-slate-200">Room Participants</h3>
        </div>
        <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
          {participants.length}
        </span>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
        {participants.map((p: ParticipantData) => {
          const isMe = p.id === userId;

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                isMe
                  ? 'bg-rose-500/10 border-rose-500/20'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* User Avatar & Name */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-rose-400 border border-slate-700">
                    {p.username.substring(0, 2).toUpperCase()}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                      p.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {p.username} {isMe && <span className="text-rose-400 text-[10px]">(You)</span>}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <RoleBadge role={p.role} />
                  </div>
                </div>
              </div>

              {/* Host Actions for this Participant */}
              {isHost && !isMe && (
                <div className="flex items-center gap-1">
                  {/* Role Selector */}
                  <select
                    value={p.role}
                    onChange={(e) => assignRole(p.id, e.target.value as UserRole)}
                    className="bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-rose-500"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="participant">Participant</option>
                    <option value="moderator">Moderator</option>
                    <option value="host">Make Host</option>
                  </select>

                  {/* Kick / Remove Button */}
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    title="Remove from room"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
