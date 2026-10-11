import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { PlaylistItem } from '../../../shared/types';
import { extractYouTubeId } from '../../../shared/youtube';
import { ListVideo, ThumbsUp, Trash2, PlayCircle, Plus } from 'lucide-react';

export const Playlist: React.FC = () => {
  const { roomState, addToPlaylist, votePlaylist, removeFromPlaylist, playPlaylistItem, userRole, userId } = useSocket();
  const [inputUrl, setInputUrl] = useState('');

  const playlist = roomState?.playlist || [];
  const isPrivileged = userRole === 'host' || userRole === 'moderator';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    const vId = extractYouTubeId(inputUrl);
    if (vId) {
      addToPlaylist(vId, 'Added Video');
      setInputUrl('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent p-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <ListVideo className="w-4 h-4 text-rose-400" />
        <h3 className="text-sm font-bold text-slate-200">Up Next</h3>
        <span className="ml-auto bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
          {playlist.length}
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
        {playlist.length === 0 ? (
          <div className="text-center text-slate-500 py-8 text-xs">Queue is empty. Add a video!</div>
        ) : (
          playlist.map((item: PlaylistItem) => {
            const hasVoted = item.votes.includes(userId || '');
            return (
              <div key={item.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3 group transition-colors hover:border-slate-700">
                <img 
                  src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`} 
                  alt="thumbnail" 
                  className="w-16 h-10 object-cover rounded-md bg-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{item.title}</div>
                  <div className="text-[10px] text-slate-500 truncate">Added by {item.addedBy.username}</div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => votePlaylist(item.id)}
                    className={`flex flex-col items-center justify-center w-8 h-8 rounded-lg transition-colors ${hasVoted ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
                    <span className="text-[9px] font-bold mt-0.5">{item.votes.length}</span>
                  </button>
                  
                  {isPrivileged && (
                    <div className="flex flex-col gap-1 hidden group-hover:flex">
                      <button onClick={() => playPlaylistItem(item.id)} className="p-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded" title="Play Now">
                        <PlayCircle className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeFromPlaylist(item.id)} className="p-1 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleAdd} className="pt-3 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="Paste YouTube URL to queue..."
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
        />
        <button
          type="submit"
          className="bg-rose-600 hover:bg-rose-500 text-white p-2 rounded-xl transition-all shadow-md shadow-rose-600/20"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
