import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Users, Heart, Radio, UserPlus, UserCheck, Square } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LiveHostInfo: React.FC = () => {
  const { roomState, socket, endRoom } = useSocket();
  const { user } = useAuth();
  const [host, setHost] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likes, setLikes] = useState<string[]>([]);

  useEffect(() => {
    if (!roomState) return;
    setLikes(roomState.likes || []);
    
    const fetchHostInfo = async () => {
      try {
        const res = await fetch(`/api/users/${roomState.hostId}/profile`);
        if (res.ok) {
          const data = await res.json();
          setHost(data.profile);
        }
        
        if (user && user.id !== roomState.hostId) {
          const folRes = await fetch(`/api/users/${user.id}/following`);
          if (folRes.ok) {
            const followingList = await folRes.json();
            setIsFollowing(followingList.some((u: any) => u.id === roomState.hostId));
          }
        }
      } catch (e) {}
    };
    fetchHostInfo();
  }, [roomState?.hostId, user]);

  useEffect(() => {
    if (!socket) return;
    socket.on('room_liked', (data: { likes: string[] }) => {
      setLikes(data.likes);
    });
    return () => {
      socket.off('room_liked');
    };
  }, [socket]);

  const toggleFollow = async () => {
    if (!user || !host) return;
    try {
      const token = localStorage.getItem('watchparty_token');
      if (isFollowing) {
        await fetch(`/api/users/${host.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      } else {
        await fetch(`/api/users/${host.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      }
      setIsFollowing(!isFollowing);
    } catch (e) {}
  };

  const toggleLike = async () => {
    if (!user || !roomState) return;
    const isLiked = likes.includes(user.id);
    try {
      const token = localStorage.getItem('watchparty_token');
      if (isLiked) {
        await fetch(`/api/rooms/${roomState.id}/like`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      } else {
        await fetch(`/api/rooms/${roomState.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      }
    } catch (e) {}
  };

  if (!roomState || !host) return null;

  const isLiked = user ? likes.includes(user.id) : false;
  const isOwnProfile = user?.id === host.id;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl mb-6">
      <div className="flex items-center gap-4">
        <Link to={`/profile/${host.id}`} className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0 block">
          {host.avatar ? (
            <img src={host.avatar} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-white bg-slate-700">
              {host.displayName.substring(0,2).toUpperCase()}
            </div>
          )}
        </Link>
        <div>
          <h2 className="text-lg font-bold text-white leading-tight mb-1">{roomState.name}</h2>
          {roomState.purpose && <div className="text-xs font-bold text-rose-400 mb-1">{roomState.purpose}</div>}
          <div className="flex items-center gap-3">
             <Link to={`/profile/${host.id}`} className="text-sm font-semibold text-slate-300 hover:text-rose-400">{host.displayName}</Link>
             <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                <Radio className="w-3 h-3 animate-pulse" /> Live Now
             </span>
             {(roomState.participants ? roomState.participants.length : (roomState.currentParticipantCount || 0)) !== undefined && (
               <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                 <Users className="w-3 h-3" /> {(roomState.participants ? roomState.participants.length : (roomState.currentParticipantCount || 0))} Watching
               </span>
             )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {isOwnProfile && (
          <button 
            onClick={() => {
              if (window.confirm('Are you sure you want to end this live Watch Party for all viewers? It will be saved for replay.')) {
                endRoom();
              }
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-950/40"
            title="End Watch Party"
          >
            <Square className="w-3.5 h-3.5 fill-current" /> End Live
          </button>
        )}
        {!isOwnProfile && user && (
          <button 
            onClick={toggleFollow}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${isFollowing ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-900 hover:bg-white'}`}
          >
            {isFollowing ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
          </button>
        )}
        <button 
          onClick={toggleLike}
          disabled={!user}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${isLiked ? 'bg-rose-500/10 border-rose-500/50 text-rose-500' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} /> {likes.length}
        </button>
      </div>
    </div>
  );
};
