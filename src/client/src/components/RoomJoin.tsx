import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { DEFAULT_VIDEOS } from '../../../shared/youtube';
import { Tv, Sparkles, Shield, MessageCircle, PlayCircle, Users, ArrowRight } from 'lucide-react';

export const RoomJoin: React.FC = () => {
  const { joinRoom, username: savedUsername } = useSocket();

  const [username, setUsername] = useState(savedUsername || '');
  const [roomCode, setRoomCode] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(DEFAULT_VIDEOS[0].id);

  // Check URL params for ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setRoomCode(code.toUpperCase());
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomCode.trim()) return;
    joinRoom(roomCode.trim(), username.trim());
  };

  const handleCreateNewRoom = () => {
    if (!username.trim()) return;
    // Generate 6 character code or let server auto-assign
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(code, username.trim());
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Side: Hero Info & Feature Highlights */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" /> Real-Time YouTube Sync Platform
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-tight">
            Watch YouTube Videos <span className="text-rose-500">Together.</span>
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed">
            Synchronized playback for everyone in real time. Host controls video, seek position, and roles while participants request changes or interact live!
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="glass-card p-3 rounded-xl flex items-start gap-2.5">
              <PlayCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-200">Frame-Sync</div>
                <div className="text-[11px] text-slate-400">Play/pause & seek sync</div>
              </div>
            </div>

            <div className="glass-card p-3 rounded-xl flex items-start gap-2.5">
              <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-200">Role Permissions</div>
                <div className="text-[11px] text-slate-400">Host & Moderator RBAC</div>
              </div>
            </div>

            <div className="glass-card p-3 rounded-xl flex items-start gap-2.5">
              <MessageCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-200">Live Chat</div>
                <div className="text-[11px] text-slate-400">System logs & emoji reactions</div>
              </div>
            </div>

            <div className="glass-card p-3 rounded-xl flex items-start gap-2.5">
              <Users className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-200">Request Flow</div>
                <div className="text-[11px] text-slate-400">Mod approvals for joiners</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Join / Create Room Form Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-white">Get Started</h2>
            <p className="text-xs text-slate-400">Create a new watch room or join with a room code</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Your Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter display name (e.g. Alex)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
              />
            </div>

            {/* Room Code Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Room Code (optional to create new)</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g., PARTY1"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono tracking-wider uppercase placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {roomCode.trim() ? (
                <button
                  type="submit"
                  disabled={!username.trim()}
                  className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/30"
                >
                  <span>Join Room {roomCode}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateNewRoom}
                  disabled={!username.trim()}
                  className="w-full bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/30"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Watch Party Room</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
