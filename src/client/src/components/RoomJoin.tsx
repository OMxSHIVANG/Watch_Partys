import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { LiveRoomsList } from './LiveRoomsList';
import { RecentRoomsList } from './RecentRoomsList';

import { PlaySquare, Users, Wand2, Settings2, Loader2 } from 'lucide-react';
import { extractYouTubeId } from '../../../shared/youtube';

export const RoomJoin: React.FC = () => {
  const { user } = useAuth();
  const { joinRoom, errorMessage, clearErrorMessage } = useSocket();

  const [isJoinMode, setIsJoinMode] = useState(true);
  const [roomId, setRoomId] = useState('');
  const [videoId, setVideoId] = useState('');
  const [password, setPassword] = useState('');
  
  // Advanced Settings
  const [showSettings, setShowSettings] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [participantLimit, setParticipantLimit] = useState(50);
  const [thumbnail, setThumbnail] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setRoomId(code.toUpperCase());
      setIsJoinMode(true);
    }
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', 'room');
      try {
        setIsUploading(true);
        const token = localStorage.getItem('watchparty_token');
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setThumbnail(data.url);
        }
      } catch (err) {
        console.error('Failed to upload thumbnail', err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrorMessage();
    setIsLoading(true);

    try {
      if (isJoinMode) {
        if (!roomId.trim()) return;
        joinRoom(roomId.trim(), user?.displayName || 'Guest', { password });
      } else {
        const code = roomId.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();
        joinRoom(
          code, 
          user?.displayName || 'Guest', 
          {
            password,
            videoId: videoId.trim() ? (extractYouTubeId(videoId.trim()) || videoId.trim()) : undefined,
            name: roomName.trim() || `Room ${code}`,
            description: description.trim(),
            isPublic,
            participantLimit,
            thumbnail
          }
        );
      }
    } finally {
      // Small timeout to allow socket connection to attempt
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full pt-8 pb-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-4 bg-rose-600 rounded-2xl mb-6 shadow-md">
          <PlaySquare className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Watch Together
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Sync YouTube videos in real-time with friends. Create a room or join an existing one.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column: Form */}
        <div className="bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
          {/* Tab Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
            <button 
              onClick={() => setIsJoinMode(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${isJoinMode ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Join Room
            </button>
            <button 
              onClick={() => setIsJoinMode(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${!isJoinMode ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Create Room
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Room Code */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Room Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD12"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono text-lg transition-colors uppercase"
                  maxLength={12}
                  required={isJoinMode}
                />
                {!isJoinMode && (
                  <button
                    type="button"
                    onClick={() => setRoomId(Math.random().toString(36).substring(2, 8).toUpperCase())}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-colors flex items-center justify-center gap-2 font-semibold"
                    title="Generate Random Code"
                  >
                    <Wand2 className="w-5 h-5 text-rose-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Video URL (Only for Create Mode) */}
            {!isJoinMode && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Initial YouTube URL (Optional)
                </label>
                <input
                  type="text"
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                />
              </div>
            )}

            {/* Room Settings Dropdown (Create Mode) */}
            {!isJoinMode && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                  {showSettings ? 'Hide Room Settings' : 'Advanced Room Settings'}
                </button>

                {showSettings && (
                  <div className="mt-4 space-y-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Room Name</label>
                      <input type="text" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="My Awesome Room" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                      <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="What are we watching?" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Custom Thumbnail (Optional)</label>
                      <div className="flex items-center gap-2">
                        {thumbnail && <img src={thumbnail} className="w-10 h-10 rounded object-cover border border-slate-700" alt="Room Thumbnail" />}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-700 file:text-slate-300"
                        />
                      </div>
                      {isUploading && <div className="text-[10px] text-blue-400 mt-1">Uploading...</div>}
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Visibility</label>
                        <select value={isPublic ? 'public' : 'private'} onChange={e => {
                          const pub = e.target.value === 'public';
                          setIsPublic(pub);
                          if (pub) setPassword('');
                        }} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300">
                          <option value="public">Public Room</option>
                          <option value="private">Private Room</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Participant Limit</label>
                        <input type="number" min="2" max="100" value={participantLimit} onChange={e => setParticipantLimit(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Password (Join Mode - Optional, Create Mode - Visible if Private) */}
            {(isJoinMode || !isPublic) && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Room Password {!isJoinMode && !isPublic && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isJoinMode ? "Enter password if required..." : "Set a secure password..."}
                  required={!isJoinMode && !isPublic}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || (!isJoinMode && !isPublic && !password)}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50 transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isJoinMode ? 'Join Watch Party' : 'Create Watch Party'}
            </button>

            {errorMessage && (
              <p className="text-rose-400 text-sm text-center font-medium mt-2">{errorMessage}</p>
            )}
          </form>
        </div>

        {/* Right Column: Live Rooms & Recent Rooms */}
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-[300px]">
             <RecentRoomsList />
             <LiveRoomsList onSelectRoom={(id, isPub, hasPwd) => {
               setIsJoinMode(true);
               setRoomId(id);
               if (hasPwd) setPassword('');
             }} />
          </div>
          <div className="shrink-0 h-[45%] mt-6">
             <RecentRoomsList />
          </div>
        </div>
      </div>
    </div>
  );
};
