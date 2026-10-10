import React, { useEffect, useState } from 'react';
import { Users, Lock, Globe, History, ChevronRight, MoreVertical, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RecentRoom {
  id: string;
  name: string;
  isPublic: boolean;
  participantCount: number;
  videoId: string;
  thumbnail?: string;
  hostId: string;
  hostUsername: string;
  hostAvatar?: string;
  endedAt: number;
}

export const RecentRoomsList: React.FC = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<RecentRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleDeleteStream = async (roomId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete this stream?')) return;
    try {
      const token = localStorage.getItem('watchparty_token');
      await fetch(`/api/rooms/${roomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setRooms(prev => prev.filter(r => r.id !== roomId));
    } catch (err) {}
  };

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms/recent');
        if (res.ok) {
          const data = await res.json();
          setRooms(data);
        }
      } catch (err) {
        console.error('Failed to fetch recent rooms', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRooms();
  }, []);

  if (isLoading || rooms.length === 0) return null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 h-full flex flex-col shadow-2xl mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <History className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">Recent Watch Parties</h2>
            <p className="text-xs text-slate-400">Past events from top hosts</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {rooms.map(room => {
          const date = new Date(room.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          return (
            <div key={room.id} className="relative">
            <Link 
              to={`/replay/${room.id}`}
              className="group relative bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-3 cursor-pointer transition-all overflow-hidden flex gap-4 items-center shadow-lg block"
            >
              <div className="w-24 h-16 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-slate-700/50 relative transition-colors opacity-70 group-hover:opacity-100 grayscale group-hover:grayscale-0">
                <img src={room.thumbnail || `https://img.youtube.com/vi/${room.videoId}/mqdefault.jpg`} alt="Thumbnail" className="w-full h-full object-cover" />
                <div className="absolute bottom-1 right-1 bg-slate-800 text-[9px] font-bold px-1 rounded uppercase tracking-wider shadow text-white">Ended</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-slate-300 group-hover:text-white truncate">{room.name}</h3>
                </div>
                
                <p className="text-[11px] text-slate-400 truncate mb-1.5 flex items-center gap-1.5">
                   {room.hostAvatar ? (
                     <img src={room.hostAvatar} className="w-3.5 h-3.5 rounded-full object-cover inline" />
                   ) : (
                     <div className="w-3.5 h-3.5 rounded-full bg-slate-700 text-[7px] flex items-center justify-center font-bold text-white inline-flex">
                        {room.hostUsername.substring(0,1).toUpperCase()}
                     </div>
                   )}
                   <span>{room.hostUsername}</span>
                </p>
                
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                  <span>{date}</span>
                  <Link to={`/profile/${room.hostId}`} className="flex items-center gap-0.5 text-slate-400 hover:text-white z-10 relative" onClick={(e) => e.stopPropagation()}>View All <ChevronRight className="w-3 h-3" /></Link>
                </div>
              </div>
            </Link>
            {user && user.id === room.hostId && (
              <div className="absolute top-2 right-2 z-20">
                <button onClick={(e) => { e.preventDefault(); setMenuOpenId(menuOpenId === room.id ? null : room.id); }} className="p-1 bg-slate-900/80 rounded-full hover:bg-slate-700 text-white shadow-lg border border-slate-700/50">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {menuOpenId === room.id && (
                  <div className="absolute top-full right-0 mt-1 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                    <button onClick={(e) => { setMenuOpenId(null); handleDeleteStream(room.id, e); }} className="w-full text-left px-3 py-2 text-xs font-medium text-rose-400 hover:bg-slate-800 flex items-center gap-2">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
