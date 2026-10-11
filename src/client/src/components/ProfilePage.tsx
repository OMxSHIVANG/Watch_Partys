import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Users, Calendar, PlayCircle, History, Edit, Check, X, Camera, MoreVertical, Trash2 } from 'lucide-react';

interface UserProfile {
  id: string;
  username?: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
  followers: number;
  following: number;
  totalHosted: number;
  currentlyLive: number;
}

interface RoomHistory {
  id: string;
  name: string;
  status: 'live' | 'ended';
  startedAt: number;
  endedAt?: number;
  participantCount: number;
  videoId: string;
  isPublic: boolean;
  videoTitle?: string;
  purpose?: string;
  description?: string;
  thumbnail?: string;
  durationWatched?: number;
}

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<RoomHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'past'>('all');

  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', displayName: '', bio: '', avatar: '' });
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [streamEditForm, setStreamEditForm] = useState({ name: '', purpose: '', description: '' });
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/users/${userId}/profile`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setHistory(data.history);
          setEditForm({ 
            username: data.profile.username || '', 
            displayName: data.profile.displayName || '', 
            bio: data.profile.bio || '', 
            avatar: data.profile.avatar || '' 
          });
          
          if (user && user.id !== userId) {
            // Check if following
            const folRes = await fetch(`/api/users/${user.id}/following`);
            if (folRes.ok) {
              const followingList = await folRes.json();
              setIsFollowing(followingList.some((u: any) => u.id === userId));
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    if (userId) fetchProfile();
  }, [userId, user]);

  const toggleFollow = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('watchparty_token');
      if (isFollowing) {
        await fetch(`/api/users/${userId}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setProfile(prev => prev ? { ...prev, followers: prev.followers - 1 } : null);
      } else {
        await fetch(`/api/users/${userId}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        setProfile(prev => prev ? { ...prev, followers: prev.followers + 1 } : null);
      }
      setIsFollowing(!isFollowing);
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Profile not found</div>;

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      setEditError('');
      const token = localStorage.getItem('watchparty_token');
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update profile');
      } else {
        setProfile(prev => prev ? { ...prev, ...data.user } : null);
        setIsEditing(false);
      }
    } catch(e: any) {
      setEditError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isOwnProfile = user?.id === userId;

  const handleDeleteStream = async (roomId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete this stream? It will be removed from your profile.')) return;
    try {
      const token = localStorage.getItem('watchparty_token');
      const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setHistory(prev => {
          const removed = prev.find(r => r.id === roomId);
          const next = prev.filter(r => r.id !== roomId);
          if (removed && profile) {
            setProfile(p => p ? ({
              ...p,
              totalHosted: Math.max(0, p.totalHosted - 1),
              currentlyLive: removed.status === 'live' ? Math.max(0, p.currentlyLive - 1) : p.currentlyLive
            }) : null);
          }
          return next;
        });
      }
    } catch (err) {}
  };

  const handleEditStream = async (roomId: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('watchparty_token');
      await fetch(`/api/rooms/${roomId}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(streamEditForm)
      });
      setHistory(prev => prev.map(r => r.id === roomId ? { ...r, ...streamEditForm } : r));
      setEditingStreamId(null);
    } catch (err) {}
  };



  
  const filteredHistory = history.filter(h => {
    if (activeTab === 'live') return h.status === 'live';
    if (activeTab === 'past') return h.status === 'ended';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> Back to WatchParty
        </Link>
      </div>

      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl relative mb-8">
        
        <div className="relative z-10 px-6 sm:px-10 pb-10 pt-20 sm:pt-32 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-slate-900 border-4 border-slate-900 shadow-xl overflow-hidden shrink-0 flex items-center justify-center relative group">
            {isEditing ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 p-2 text-center relative group">
                {editForm.avatar ? <img src={editForm.avatar} className="absolute inset-0 w-full h-full object-cover opacity-30" /> : null}
                <div className="z-10 flex flex-col items-center">
                  <Camera className="w-6 h-6 text-slate-400 mb-2 group-hover:text-rose-400 transition-colors cursor-pointer" />
                  <span className="text-[10px] font-bold text-slate-300">Upload Image</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      const formData = new FormData();
                      formData.append('image', file);
                      formData.append('type', 'profile');
                      try {
                        const token = localStorage.getItem('watchparty_token');
                        const res = await fetch('/api/upload', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                          body: formData
                        });
                        const data = await res.json();
                        if (res.ok && data.url) {
                          setEditForm({...editForm, avatar: data.url});
                        }
                      } catch (err) {
                        console.error('Failed to upload image', err);
                      }
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>
            ) : profile.avatar ? (
              <img src={profile.avatar} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-rose-600 flex items-center justify-center text-4xl font-bold text-white">
                {profile.displayName.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center sm:text-left pt-2">
            {isEditing ? (
              <div className="space-y-3 max-w-md mx-auto sm:mx-0">
                {editError && <div className="text-rose-400 text-xs font-bold bg-rose-950/50 p-2 rounded">{editError}</div>}
                <div>
                  <label className="text-xs text-slate-400 font-bold mb-1 block">Display Name</label>
                  <input type="text" value={editForm.displayName} onChange={e => setEditForm({...editForm, displayName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold mb-1 block">Unique Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1.5 text-slate-500 text-sm">@</span>
                    <input type="text" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value.toLowerCase()})} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-sm text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold mb-1 block">Bio</label>
                  <textarea value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white resize-none" />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">{profile.displayName}</h1>
                {profile.username && <div className="text-sm font-bold text-rose-400 mb-2">@{profile.username}</div>}
                <p className="text-sm text-slate-300 max-w-lg mx-auto sm:mx-0 mt-2">{profile.bio || 'This user loves watching videos on YouTube Watch Party.'}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 pt-2">
            {isOwnProfile ? (
              isEditing ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsEditing(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg border border-slate-700 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button onClick={handleSaveProfile} disabled={isSaving} className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditing(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg border border-slate-700 flex items-center gap-2">
                  <Edit className="w-4 h-4" /> Edit Profile
                </button>
              )
            ) : (
              user && (
                <button 
                  onClick={toggleFollow}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${isFollowing ? 'bg-slate-800 text-white hover:bg-rose-500 hover:text-white border border-slate-700 hover:border-rose-500' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              )
            )}
          </div>
        </div>

        <div className="px-6 sm:px-10 pb-6 flex items-center justify-center sm:justify-start gap-8 border-t border-slate-800/50 pt-6 mt-2">
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-white">{profile.followers}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Followers</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-white">{profile.following}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Following</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-emerald-400">{profile.currentlyLive}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Currently Live</div>
          </div>
          <div className="hidden sm:block text-center sm:text-left">
            <div className="text-2xl font-bold text-slate-200">{profile.totalHosted}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Hosted</div>
          </div>
        </div>
      </div>

            <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-px">
          <button onClick={() => setActiveTab('all')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            All Parties
          </button>
          <button onClick={() => setActiveTab('live')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'live' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <span className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`} /> Live
          </button>
          <button onClick={() => setActiveTab('past')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'past' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            Past Events
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistory.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No watch parties found for this filter.</p>
            </div>
          ) : (
            filteredHistory.map(room => (
              <div key={room.id} className="relative">
              {isOwnProfile && (
                <div className="absolute top-2 right-2 z-20">
                  <button onClick={(e) => { e.preventDefault(); setMenuOpenId(menuOpenId === room.id ? null : room.id); }} className="p-1.5 bg-black/60 backdrop-blur-md rounded-full hover:bg-black/80 text-white shadow-lg border border-white/10 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpenId === room.id && (
                    <div className="absolute top-full right-0 mt-1 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                      
                      <button onClick={(e) => { setMenuOpenId(null); handleDeleteStream(room.id, e); }} className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 flex items-center gap-2 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
              <Link to={room.status === 'ended' ? `/replay/${room.id}` : '/'} onClick={(e) => {
                 if (room.status === 'live') {
                    // Copy ID to clipboard as a fallback
                    navigator.clipboard.writeText(room.id);
                    alert(`Room Code ${room.id} copied to clipboard! Paste it on the Home screen to join.`);
                 }
              }} className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col transition-colors group block h-full ${room.status === 'ended' ? 'cursor-pointer hover:border-rose-500/50' : 'hover:border-rose-500/50 cursor-pointer'}`}>
                <div className="relative aspect-video bg-slate-800">
                  <img src={room.thumbnail || `https://img.youtube.com/vi/${room.videoId}/mqdefault.jpg`} alt="Video" className={`w-full h-full object-cover ${room.status === 'ended' ? 'grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all' : ''}`} />
                  {room.status === 'live' && (
                     <div className="absolute top-2 left-2 bg-rose-600 text-[10px] font-bold px-2 py-0.5 rounded shadow text-white flex items-center gap-1.5 uppercase tracking-wider">
                       <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
                     </div>
                  )}
                  {room.status === 'ended' && (
                     <div className="absolute top-2 left-2 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-[10px] font-bold px-2 py-0.5 rounded shadow text-slate-300 uppercase tracking-wider flex items-center gap-1">
                       <span>Replay</span>
                       {room.durationWatched !== undefined && room.durationWatched > 0 && (
                         <span className="text-rose-400 font-mono font-normal">
                           • {Math.floor(room.durationWatched / 60)}:{Math.floor(room.durationWatched % 60).toString().padStart(2, '0')}
                         </span>
                       )}
                     </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 shadow-lg border border-white/10">
                    <Users className="w-3 h-3" /> {room.participantCount || 0}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors line-clamp-2 leading-snug mb-1">{room.name}</h3>
                  {room.videoTitle && <p className="text-[10px] text-slate-500 line-clamp-1 mb-2">{room.videoTitle}</p>}
                  
                  <div className="mt-auto flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(room.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
