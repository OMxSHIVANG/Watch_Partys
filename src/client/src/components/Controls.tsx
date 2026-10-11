import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { extractYouTubeId } from '../../../shared/youtube';
import { Play, Pause, RotateCcw, RotateCw, Link as LinkIcon, Send, Lock } from 'lucide-react';

export const Controls: React.FC = () => {
  const { roomState, stateReceivedAt, userRole, userId, playVideo, pauseVideo, seekVideo, changeVideo, requestChange, setCustomErrorMessage } = useSocket();

  const [inputUrl, setInputUrl] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestUrl, setRequestUrl] = useState('');

  const isHost = userRole === 'host' || (roomState?.hostId ? roomState.hostId === userId : false);
  const canControl = isHost || userRole === 'moderator';
  const isPlaying = roomState?.playState === 'playing';
  const [liveEdgeTime, setLiveEdgeTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [localDisplayTime, setLocalDisplayTime] = useState(0);
  const [isDvrMode, setIsDvrMode] = useState(false);
  const [localPlayerState, setLocalPlayerState] = useState<number>(1);

  const isStreamEnded = roomState?.status === 'ended' || Boolean(roomState?.endedAt);
  const maxRecordedDuration = Math.max(
    (roomState?.segments && roomState.segments.length > 0
      ? roomState.segments[roomState.segments.length - 1].end
      : 0),
    roomState?.durationWatched || 0,
    videoDuration || 0
  );
  const totalDisplayDuration = isStreamEnded 
    ? (maxRecordedDuration || videoDuration || 0)
    : (videoDuration > 0 ? videoDuration : (liveEdgeTime || 0));

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (roomState) {
        const edge = roomState.playState === 'playing'
          ? (roomState.currentTime || 0) + (Date.now() - (stateReceivedAt || Date.now())) / 1000
          : (roomState.currentTime || 0);
        setLiveEdgeTime(Math.floor(edge));
      }

      if (window.ytPlayer && typeof window.ytPlayer.getDuration === 'function') {
        const dur = window.ytPlayer.getDuration();
        if (dur > 0) setVideoDuration(dur);

        const state = window.ytPlayer.getPlayerState();
        if (typeof state === 'number') {
          setLocalPlayerState(state);
        }

        const dvr = !!window.isDvrMode;
        setIsDvrMode(dvr);

        if (dvr || isStreamEnded) {
          setLocalDisplayTime(Math.floor(window.ytPlayer.getCurrentTime() || 0));
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [roomState, stateReceivedAt, isStreamEnded]);

  const sliderValue = isStreamEnded 
    ? localDisplayTime 
    : isDvrMode && !canControl 
    ? localDisplayTime 
    : liveEdgeTime;
  const isViewerPlaying = canControl && !isStreamEnded ? isPlaying : (localPlayerState === 1 || localPlayerState === 3);

  const jumpToLive = () => {
    if (isStreamEnded) return;
    window.isDvrMode = false;
    setIsDvrMode(false);
    if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
      window.ytPlayer.seekTo(liveEdgeTime, true);
      if (isPlaying && typeof window.ytPlayer.playVideo === 'function') {
        window.ytPlayer.playVideo();
      }
    }
  };

  const handleTogglePlayPause = () => {
    if (canControl && !isStreamEnded) {
      const curTime = typeof window.ytPlayer?.getCurrentTime === 'function' ? window.ytPlayer.getCurrentTime() : liveEdgeTime;
      if (isPlaying) {
        pauseVideo(curTime);
      } else {
        playVideo(curTime);
      }
      return;
    }

    // Viewer / Participant local control (and Host when watching recorded replay)
    if (window.ytPlayer) {
      const state = typeof window.ytPlayer.getPlayerState === 'function' ? window.ytPlayer.getPlayerState() : -1;
      if (state === 1 || state === 3) {
        window.ytPlayer.pauseVideo?.();
        if (!isStreamEnded) {
          window.isDvrMode = true;
          setIsDvrMode(true);
        }
      } else {
        window.ytPlayer.playVideo?.();
      }
    }
  };

  const handleSkip = (seconds: number) => {
    if (canControl && !isStreamEnded) {
      const newTime = Math.max(0, sliderValue + seconds);
      seekVideo(newTime);
      return;
    }

    // Viewer / Participant skip forward or backward (in DVR mode or recorded replay)
    if (window.ytPlayer) {
      const cur = typeof window.ytPlayer.getCurrentTime === 'function' ? window.ytPlayer.getCurrentTime() : localDisplayTime;
      const boundary = isStreamEnded ? (maxRecordedDuration || videoDuration) : liveEdgeTime;
      const targetTime = Math.max(0, Math.min(boundary, cur + seconds));
      window.ytPlayer.seekTo?.(targetTime, true);
      setLocalDisplayTime(targetTime);
      if (!isStreamEnded) {
        if (targetTime < liveEdgeTime - 1.5) {
          window.isDvrMode = true;
          setIsDvrMode(true);
        } else {
          window.isDvrMode = false;
          setIsDvrMode(false);
        }
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
    if (canControl && !isStreamEnded) {
      seekVideo(targetTime);
      window.isDvrMode = false;
    } else {
      // Viewer DVR scrubbing or Recorded Replay scrubbing
      const boundary = isStreamEnded ? (maxRecordedDuration || videoDuration) : liveEdgeTime;
      const clampedTime = Math.min(targetTime, boundary);
      if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
        window.ytPlayer.seekTo(clampedTime, true);
        setLocalDisplayTime(clampedTime);
        if (!isStreamEnded) {
          if (clampedTime < liveEdgeTime - 1.5) {
            window.isDvrMode = true;
            setIsDvrMode(true);
          } else {
            window.isDvrMode = false;
            setIsDvrMode(false);
          }
        }
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

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-4">
      {/* 1. Playback Controls & Direct / Request Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Playback Button Group: -10s, Play/Pause, +10s */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Skip Back 10s */}
          <button
            onClick={() => handleSkip(-10)}
            title="Rewind 10 seconds"
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center border border-slate-700/60 shadow-md transition-all active:scale-95 text-xs font-bold gap-0.5"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlayPause}
            title={isViewerPlaying ? "Pause" : "Play"}
            className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all transform active:scale-95"
          >
            {isViewerPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>

          {/* Skip Forward 10s */}
          <button
            onClick={() => handleSkip(10)}
            title="Skip forward 10 seconds"
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center border border-slate-700/60 shadow-md transition-all active:scale-95 text-xs font-bold gap-0.5"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Status & Live Pill */}
          <div className="ml-1 sm:ml-2">
            <div className="text-[11px] text-slate-400 font-medium">
              {isStreamEnded ? 'Recorded Replay' : canControl ? 'Broadcast' : isDvrMode ? 'Rewound Live' : 'Live Sync'}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs sm:text-sm font-semibold capitalize text-slate-200 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isViewerPlaying ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                  }`}
                />
                {isViewerPlaying ? 'Playing' : 'Paused'}
              </div>
              
              <button 
                onClick={!isStreamEnded && isDvrMode ? jumpToLive : undefined} 
                title={isStreamEnded ? "Recorded Replay" : isDvrMode ? "Jump to Live Edge" : "Watching Live"}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 transition-colors border ${
                  isStreamEnded
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-default"
                    : isDvrMode 
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-600 cursor-pointer animate-pulse" 
                    : "bg-rose-500/20 text-rose-500 border-rose-500/30 cursor-default"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isStreamEnded ? "bg-blue-400" : isDvrMode ? "bg-slate-500" : "bg-rose-500 animate-pulse"}`} />
                {isStreamEnded ? 'REPLAY' : isDvrMode ? 'GO LIVE' : 'LIVE'}
              </button>
            </div>
          </div>
        </div>

        {/* Time display & Seek Bar */}
        <div className="flex-1 min-w-[200px] flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-12 text-right">{formatTime(sliderValue)}</span>
          <div className="relative flex-1 flex items-center group">
            {/* The Live Edge Indicator Bar */}
            {!canControl && !isStreamEnded && (
              <div 
                className="absolute h-1.5 bg-rose-500/30 rounded-lg pointer-events-none" 
                style={{ width: `${Math.min((liveEdgeTime / (totalDisplayDuration || 1)) * 100, 100)}%`, zIndex: 0 }}
              />
            )}
            <input
              type="range"
              min={0}
              max={isStreamEnded ? (totalDisplayDuration || 1) : canControl ? (totalDisplayDuration || 1) : (liveEdgeTime || 1)}
              value={sliderValue}
              onChange={handleSeekChange}
              className={`relative z-10 flex-1 h-2 rounded-lg appearance-none outline-none bg-slate-800 cursor-pointer accent-rose-500 hover:accent-rose-400`}
            />
          </div>
          <span className="text-xs font-mono text-slate-500 w-12">{formatTime(totalDisplayDuration)}</span>
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
        </>
      )}
    </div>
  );
};
