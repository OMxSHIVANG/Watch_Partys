import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { RoleBadge } from './RoleBadge';
import { Tv, Copy, Check, Users, LogOut, Share2 } from 'lucide-react';

import { ParticipantData } from '../../../shared/types';

export const Navbar: React.FC = () => {
  const { roomState, roomId, userRole, leaveRoom, username } = useSocket();
  const [copied, setCopied] = useState(false);

  const copyRoomLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participantCount = roomState?.participants.filter((p: ParticipantData) => p.isOnline).length || 0;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              WatchParty
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">Sync YouTube Video Player</p>
          </div>
        </div>

        {/* Room Info & Controls */}
        {roomId && roomState ? (
          <div className="flex items-center gap-3">
            {/* Room Code Badge & Share */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400 font-medium">ROOM:</span>
              <span className="text-sm font-mono font-bold text-rose-400 tracking-wider">{roomId}</span>
              <button
                onClick={copyRoomLink}
                className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-300 hover:text-white"
                title="Copy Room Link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Active Users */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <span>{participantCount} online</span>
            </div>

            {/* Current User & Role */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-300 font-medium max-w-[100px] truncate">{username}</span>
              <RoleBadge role={userRole} />
            </div>

            {/* Leave Room Button */}
            <button
              onClick={leaveRoom}
              className="flex items-center gap-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400">Real-time YouTube Synchronization</div>
        )}
      </div>
    </header>
  );
};
