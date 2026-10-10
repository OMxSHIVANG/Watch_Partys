import React, { useEffect, useState } from 'react';
import { Users, Lock, Globe, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LiveRoom {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  hasPassword: boolean;
  participantCount: number;
  participantLimit: number;
  videoId: string;
  videoTitle?: string;
  thumbnail?: string;
  hostId: string;
  hostUsername: string;
  hostAvatar?: string;
  status: string;
}

export const LiveRoomsList: React.FC<{ onSelectRoom: (roomId: string, isPublic: boolean, hasPassword: boolean) => void }> = ({ onSelectRoom }) => {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          setRooms(data);
        }
      } catch (err) {
        console.error('Failed to fetch rooms', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 h-full flex flex-col shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">Live Watch Parties</h2>
          <p className="text-xs text-slate-400">Join active rooms right now</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-50">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Discovering rooms...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4 bg-slate-900/50 rounded-2xl border border-slate-800/50">
            <span className="text-3xl mb-2 opacity-50">🛋️</span>
            <p className="text-sm font-semibold text-slate-300">No active watch parties</p>
            <p className="text-xs text-slate-500 mt-1">Be the first to create one!</p>
          </div>
        ) : (
          rooms.map(room => (
            <div 
              key={room.id}
              onClick={() => onSelectRoom(room.id, room.isPublic, room.hasPassword)}
              className="group relative bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-rose-500/50 rounded-2xl p-3 cursor-pointer transition-all overflow-hidden flex gap-4 items-center shadow-lg"
            >
              <div className="w-24 h-16 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-slate-700/50 relative group-hover:border-rose-500/30 transition-colors">
                <img src={room.thumbnail || `https://img.youtube.com/vi/${room.videoId}/mqdefault.jpg`} alt="Thumbnail" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                  <PlayCircle className="w-6 h-6 text-white/70 group-hover:text-rose-500 transition-colors group-hover:scale-110 transform" />
                </div>
                <div className="absolute bottom-1 right-1 bg-rose-600 text-[9px] font-bold px-1 rounded uppercase tracking-wider shadow text-white">Live</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white truncate">{room.name}</h3>
                  {room.isPublic && !room.hasPassword ? (
                    <span title="Public Room"><Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" /></span>
                  ) : (
                    <span title="Private / Password Required"><Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" /></span>
                  )}
                </div>
                
                <p className="text-[11px] text-slate-400 truncate mb-1.5 flex items-center gap-1.5">
                   {room.hostAvatar ? (
                     <img src={room.hostAvatar} className="w-3.5 h-3.5 rounded-full object-cover inline" />
                   ) : (
                     <div className="w-3.5 h-3.5 rounded-full bg-slate-700 text-[7px] flex items-center justify-center font-bold text-white inline-flex">
                        {room.hostUsername.substring(0,1).toUpperCase()}
                     </div>
                   )}
                   <Link to={`/profile/${room.hostId}`} onClick={(e)=>e.stopPropagation()} className="hover:text-rose-400 hover:underline">{room.hostUsername}</Link>
                </p>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">
                    <Users className="w-3 h-3" />
                    {room.participantCount} / {room.participantLimit}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
