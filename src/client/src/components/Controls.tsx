import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { extractYouTubeId, DEFAULT_VIDEOS } from '../../../shared/youtube';
import { Play, Pause, RotateCcw, Link as LinkIcon, Send, Sparkles, Lock } from 'lucide-react';

export const Controls: React.FC = () => {
  const { roomState, stateReceivedAt, userRole, playVideo, pauseVideo, seekVideo, changeVideo, requestChange, setCustomErrorMessage } = useSocket();

  const [inputUrl, setInputUrl] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestUrl, setRequestUrl] = useState('');

  const canControl = userRole === 'host' || userRole === 'moderator';
  const isPlaying = roomState?.playState === 'playing';
  const [liveEdgeTime, setLiveEdgeTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(7200);
  const [localDisplayTime, setLocalDisplayTime] = useState(0);
  const [isDvrMode, setIsDvrMode] = useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (roomState) {
        const edge = roomState.playState === 'playing'
          ? (roomState.currentTime || 0) + (Date.now() - (stateReceivedAt || Date.now())) / 1000
          : (roomState.currentTime || 0);
        setLiveEdgeTime(Math.floor(edge));
      }

      // @ts-ignore
      if (window.ytPlayer && typeof window.ytPlayer.getDuration === 'function') {
        // @ts-ignore
        const dur = window.ytPlayer.getDuration();
        if (dur > 0) setVideoDuration(dur);

        // @ts-ignore
        const dvr = !!window.isDvrMode;
        setIsDvrMode(dvr);

        if (dvr) {
          // @ts-ignore
          setLocalDisplayTime(Math.floor(window.ytPlayer.getCurrentTime() || 0));
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [roomState, stateReceivedAt]);

  const sliderValue = isDvrMode && !canControl ? localDisplayTime : liveEdgeTime;

  const jumpToLive = () => {
    // @ts-ignore
    window.isDvrMode = false;
    setIsDvrMode(false);
    // @ts-ignore
    if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
      // @ts-ignore
      window.ytPlayer.seekTo(liveEdgeTime, true);
      // Force play if the host is currently playing
      // @ts-ignore
      if (isPlaying && typeof window.ytPlayer.playVideo === 'function') {
        // @ts-ignore
        window.ytPlayer.playVideo();
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    if (canControl) {
      seekVideo(targetTime);
      // @ts-ignore
      window.isDvrMode = false;
    } else {
      // Viewer DVR scrubbing
      const clampedTime = Math.min(targetTime, liveEdgeTime);
      // @ts-ignore
      if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
        // @ts-ignore
        window.isDvrMode = true;
        // @ts-ignore
        window.ytPlayer.seekTo(clampedTime, true);
        setLocalDisplayTime(clampedTime);
        setIsDvrMode(true);
      }
    }
  };

  const handleChangeVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const videoId = extractYouTubeId(inputUrl);
    if (!videoId) {
      setCustomErrorMessage('Invalid YouTube URL or Video ID. Please enter a valid link.');
      return;
    }

    if (canControl) {
      changeVideo(videoId);
      setInputUrl('');
    } else {
      requestChange('change_video', { videoId });
      setInputUrl('');
      setCustomErrorMessage('Video change request sent to Host/Moderator for approval!');
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
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-4">
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
            <div
              className="flex items-center gap-2 bg-slate-800/50 text-slate-400 border border-slate-700/50 px-3 py-2 rounded-xl text-xs font-semibold cursor-not-allowed"
              title="Watch only. Host or Moderator controls playback."
            >
              <Lock className="w-4 h-4" />
              <span>{isPlaying ? 'Playing' : 'Paused'} (Watch Only)</span>
            </div>
          )}

          <div>
            <div className="text-xs text-slate-400 font-medium">Status</div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold capitalize text-slate-200 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPlaying ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                  }`}
                />
                {isPlaying ? 'Playing' : 'Paused'}
              </div>
              
              {!canControl && (
                <button 
                  onClick={isDvrMode ? jumpToLive : undefined} 
                  className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 transition-colors border ${
                    isDvrMode 
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700 cursor-pointer" 
                      : "bg-rose-500/20 text-rose-500 border-rose-500/30 cursor-default"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isDvrMode ? "bg-slate-500" : "bg-rose-500 animate-pulse"}`} />
                  LIVE
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Time display & Seek Bar */}
        <div className="flex-1 min-w-[200px] flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-12 text-right">{formatTime(sliderValue)}</span>
          <div className="relative flex-1 flex items-center group">
            {/* The Live Edge Indicator Bar */}
            {!canControl && (
              <div 
                className="absolute h-1.5 bg-rose-500/30 rounded-lg pointer-events-none" 
                style={{ width: `${Math.min((liveEdgeTime / (videoDuration || 7200)) * 100, 100)}%`, zIndex: 0 }}
              />
            )}
            <input
              type="range"
              min={0}
              max={videoDuration || 7200}
              value={sliderValue}
              onChange={handleSeekChange}
              className={`relative z-10 flex-1 h-2 rounded-lg appearance-none outline-none bg-slate-800 cursor-pointer accent-rose-500 hover:accent-rose-400`}
            />
          </div>
          <span className="text-xs font-mono text-slate-500 w-12">{formatTime(videoDuration)}</span>
        </div>
      </div>

      {/* 2. Change Video Input Form & Presets (Only Host/Mod) */}
      {canControl && (
        <>
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
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Change Video</span>
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
        </>
      )}
    </div>
  );
};
