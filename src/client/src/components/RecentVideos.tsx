import React from 'react';
import { useSocket } from '../context/SocketContext';
import { PlaylistItem } from '../../../shared/types';
import { History, PlayCircle } from 'lucide-react';

export const RecentVideos: React.FC = () => {
  const { roomState, userRole, changeVideo, requestChange } = useSocket();
  const recentVideos = roomState?.recentVideos || [];
  const canControl = userRole === 'host' || userRole === 'moderator';

  const handleReplay = (videoId: string, title: string) => {
    if (canControl) {
      changeVideo(videoId, title);
    } else {
      requestChange('change_video', { videoId, videoTitle: title });
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col h-full bg-slate-900/50">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <History className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-slate-200">Recent Play Video</h3>
        <span className="ml-auto bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
          {recentVideos.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
        {recentVideos.length === 0 ? (
          <div className="text-center text-slate-500 py-8 text-xs">No recent videos played yet.</div>
        ) : (
          recentVideos.map((item: PlaylistItem, idx) => (
            <div key={item.id + idx} className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3 group transition-colors hover:border-slate-700">
              <img 
                src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`} 
                alt="thumbnail" 
                className="w-16 h-10 object-cover rounded-md bg-slate-800 opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-300 truncate group-hover:text-slate-200">{item.title}</div>
                <div className="text-[10px] text-slate-500 truncate">Added by {item.addedBy.username}</div>
              </div>
              <button 
                onClick={() => handleReplay(item.videoId, item.title)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400 rounded transition-colors shrink-0" 
                title="Play Again"
              >
                <PlayCircle className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
