import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { extractYouTubeId, DEFAULT_VIDEOS } from '../../../shared/youtube';
import { Play, Pause, RotateCcw, Link as LinkIcon, Send, Sparkles, Lock } from 'lucide-react';

export const Controls: React.FC = () => {
  const { roomState, userRole, playVideo, pauseVideo, seekVideo, changeVideo, requestChange } = useSocket();

  const [inputUrl, setInputUrl] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestUrl, setRequestUrl] = useState('');

  const canControl = userRole === 'host' || userRole === 'moderator';
  const isPlaying = roomState?.playState === 'playing';
  const currentTime = Math.floor(roomState?.currentTime || 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    if (canControl) {
      seekVideo(targetTime);
    } else {
      requestChange('seek', { time: targetTime });
    }
  };

  const handleChangeVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const videoId = extractYouTubeId(inputUrl);
    if (!videoId) return;

    if (canControl) {
      changeVideo(videoId);
      setInputUrl('');
    } else {
      requestChange('change_video', { videoId });
      setInputUrl('');
    }
  };

  const handleSelectDefaultVideo = (videoId: string, title: string) => {
    if (canControl) {
      changeVideo(videoId, title);
    } else {
      requestChange('change_video', { videoId, videoTitle: title });
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-4">
      {/* 1. Playback Status & Direct / Request Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Play/Pause Button */}
        <div className="flex items-center gap-3">
          {canControl ? (
            <button
              onClick={isPlaying ? pauseVideo : playVideo}
              className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
          ) : (
            <button
              onClick={() => requestChange(isPlaying ? 'pause' : 'play', {})}
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              title="Request Host/Mod approval to play/pause"
            >
              <Lock className="w-4 h-4" />
              <span>Request {isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          )}

          <div>
            <div className="text-xs text-slate-400 font-medium">Status</div>
            <div className="text-sm font-semibold capitalize text-slate-200 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPlaying ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                }`}
              />
              {isPlaying ? 'Playing' : 'Paused'}
            </div>
          </div>
        </div>

        {/* Time display & Seek Bar */}
        <div className="flex-1 min-w-[200px] flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-12 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={7200} // 2 hour max scale
            value={currentTime}
            onChange={handleSeekChange}
            className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400"
          />
        </div>
      </div>

      {/* 2. Change Video Input Form */}
      <form onSubmit={handleChangeVideoSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste YouTube Video URL or ID (e.g., https://youtu.be/...)"
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
          />
        </div>

        <button
          type="submit"
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
            canControl
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
              : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30'
          }`}
        >
          {canControl ? (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Change Video</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Request Video Change</span>
            </>
          )}
        </button>
      </form>

      {/* 3. Preset Quick Videos */}
      <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
        </span>
        {DEFAULT_VIDEOS.map((vid) => (
          <button
            key={vid.id}
            onClick={() => handleSelectDefaultVideo(vid.id, vid.title)}
            className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors"
          >
            {vid.title.split('-')[0]}
          </button>
        ))}
      </div>
    </div>
  );
};
