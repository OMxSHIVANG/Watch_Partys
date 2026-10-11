import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { PlaySquare } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    ytPlayer: any;
    isDvrMode: boolean;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoPlayer: React.FC = () => {
  const { roomState, stateReceivedAt, userRole, playVideo, pauseVideo, seekVideo, playNext } = useSocket();
  const playerRef = useRef<any>(null);
  const remoteActionUntil = useRef<number>(0);
  const lastLoadedVideoId = useRef<string>('');
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState<string>('00:00');

  const canControl = userRole === 'host' || userRole === 'moderator';

  useEffect(() => {
    if (!roomState?.startedAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - roomState.startedAt!) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      let timeString = '';
      if (hours > 0) {
         timeString += `${hours}:`;
         timeString += `${minutes.toString().padStart(2, '0')}:`;
      } else {
         timeString += `${minutes.toString().padStart(2, '0')}:`;
      }
      timeString += seconds.toString().padStart(2, '0');
      
      setLiveDuration(timeString);
    }, 1000);
    return () => clearInterval(interval);
  }, [roomState?.startedAt]);

  // 1. Initialize YouTube IFrame API only when a video is selected
  useEffect(() => {
    if (!roomState?.videoId) {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
        setIsPlayerReady(false);
        window.ytPlayer = null;
      }
      return;
    }

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (window.YT && window.YT.Player) {
      initPlayer();
    }

    function initPlayer() {
      if (playerRef.current) {
        if (roomState?.videoId && roomState.videoId !== lastLoadedVideoId.current) {
          syncPlayerToState(playerRef.current, roomState);
        }
        return;
      }

      const initialId = roomState?.videoId;
      if (!initialId) return;

      lastLoadedVideoId.current = initialId;

      playerRef.current = new window.YT.Player('youtube-iframe-container', {
        height: '100%',
        width: '100%',
        videoId: initialId,
        playerVars: {
          autoplay: 1,
          controls: 0, // Clean embedded view: hide native YouTube play buttons, length bar, and control overlays
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: (event: any) => {
            setIsPlayerReady(true);
            window.ytPlayer = event.target;
            if (roomState) {
              syncPlayerToState(event.target, roomState);
            }
          },
          onStateChange: handlePlayerStateChange,
          onError: handlePlayerError,
        },
      });
    }
  }, [roomState?.videoId]);

  // Clean up player on component unmount
  useEffect(() => {
    return () => {
      window.ytPlayer = null;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  const [isDvrMode, setIsDvrMode] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // @ts-ignore
      setIsDvrMode(!!window.isDvrMode);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const jumpToLive = () => {
    // @ts-ignore
    window.isDvrMode = false;
    setIsDvrMode(false);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function' && roomState) {
      const serverTime = roomState.playState === 'playing'
        ? (roomState.currentTime || 0) + (Date.now() - (stateReceivedAt || Date.now())) / 1000
        : (roomState.currentTime || 0);
      playerRef.current.seekTo(serverTime, true);
    }
  };

  // 6. Native Boundary Enforcement & Continuous Host/Viewer Play-State Sync Loop
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !roomState) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (typeof player.getCurrentTime !== 'function' || typeof player.getPlayerState !== 'function') return;

      const localTime = player.getCurrentTime();
      const currentState = player.getPlayerState();
      
      const serverTime = roomState.playState === 'playing'
        ? (roomState.currentTime || 0) + Math.max(0, (Date.now() - (stateReceivedAt || Date.now())) / 1000)
        : (roomState.currentTime || 0);

      if (userRole === 'host' || roomState.status === 'ended') {
        // HOST or ENDED STREAM: Do not seek or call seekVideo in a continuous interval loop.
        // The host's player is the master reference, and ended streams allow free viewer local replay.
        return;
      }

      // NON-HOST (Viewer & Moderator):
      // A. Boundary check: CANNOT play or seek past host's live edge!
      if (localTime > serverTime + 2.0) {
        remoteActionUntil.current = Date.now() + 1200;
        player.seekTo(serverTime, true);
        if (roomState.playState === 'paused') {
          player.pauseVideo();
        }
        window.isDvrMode = false;
        setIsDvrMode(false);
        return;
      }

      // B. If viewer is in DVR mode (rewound to seen live video):
      if (window.isDvrMode) {
        // If viewer reached within 1.0s of live edge, smoothly transition back to live mode
        if (localTime >= serverTime - 1.0) {
          window.isDvrMode = false;
          setIsDvrMode(false);
          if (roomState.playState === 'paused' && currentState !== 2) {
            remoteActionUntil.current = Date.now() + 1200;
            player.pauseVideo();
          }
        }
        // In DVR mode, do NOT override viewer's local play/pause/seek controls
        return;
      }

      // C. If viewer is at LIVE edge (not in DVR mode):
      if (roomState.playState === 'paused') {
        // Host paused live stream: viewer at live edge stops
        if (currentState !== 2 && currentState !== -1) {
          remoteActionUntil.current = Date.now() + 1200;
          player.pauseVideo();
        }
        if (Math.abs(localTime - serverTime) > 2.0) {
          remoteActionUntil.current = Date.now() + 1200;
          player.seekTo(serverTime, true);
        }
      } else {
        // Host is playing live stream: viewer at live edge plays
        if (currentState !== 1 && currentState !== 3) {
          remoteActionUntil.current = Date.now() + 1200;
          player.playVideo();
        }
        if (Math.abs(localTime - serverTime) > 3.0) {
          remoteActionUntil.current = Date.now() + 1200;
          player.seekTo(serverTime, true);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlayerReady, canControl, userRole, roomState, stateReceivedAt]);

  // 2. Handle Player Error Events
  const handlePlayerError = (event: any) => {
    const errorCode = event.data;
    console.warn('[YouTube Player Error]:', errorCode);
    if (errorCode === 101 || errorCode === 150) {
      setPlayerError('This video cannot be played in embedded players (restricted by YouTube uploader).');
    } else if (errorCode === 2 || errorCode === 100) {
      setPlayerError('Invalid YouTube video or video not found.');
    } else {
      setPlayerError('Playback error occurred on YouTube player.');
    }
  };

  // 3. Handle YouTube Player State Change Events (Local User Actions)
  const stateRef = useRef({ canControl, userRole, playVideo, pauseVideo, playNext, roomState });
  useEffect(() => {
    stateRef.current = { canControl, userRole, playVideo, pauseVideo, playNext, roomState };
  }, [canControl, userRole, playVideo, pauseVideo, playNext, roomState]);

  const handlePlayerStateChange = (event: any) => {
    if (Date.now() < remoteActionUntil.current) {
      return;
    }

    const { canControl, userRole, playVideo, pauseVideo, playNext, roomState } = stateRef.current;
    const playerState = event.data;

    if (!canControl || roomState?.status === 'ended') {
      // If viewer was at live edge and host is paused, don't let them auto-play past the live edge (only in active live streams)
      if (roomState?.status !== 'ended' && !window.isDvrMode && roomState?.playState === 'paused') {
        if (playerState === 1 || playerState === 3) {
          remoteActionUntil.current = Date.now() + 1200;
          playerRef.current?.pauseVideo();
          if (roomState.currentTime !== undefined) {
            playerRef.current?.seekTo(roomState.currentTime, true);
          }
        }
      }
      return; // Viewer / replay local playback does not affect room broadcast
    }

    // Host / Moderator:
    const localTime = typeof playerRef.current?.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : undefined;

    // YT.PlayerState: PLAYING=1, PAUSED=2, BUFFERING=3, ENDED=0
    if (playerState === 1) {
      if (roomState?.playState !== 'playing') {
        playVideo(localTime);
      }
    } else if (playerState === 2) {
      if (roomState?.playState !== 'paused') {
        pauseVideo(localTime);
      }
    } else if (playerState === 0 && userRole === 'host') {
      playNext();
    }
  };

  // 4. Helper to synchronize player with backend RoomState
  const syncPlayerToState = (player: any, state: any) => {
    if (!player || typeof player.getPlayerState !== 'function') return;

    setPlayerError(null);
    remoteActionUntil.current = Date.now() + 1200;

    // A. Video ID Sync
    if (state.videoId && state.videoId !== lastLoadedVideoId.current) {
      lastLoadedVideoId.current = state.videoId;
      if (typeof player.loadVideoById === 'function') {
        player.loadVideoById({
          videoId: state.videoId,
          startSeconds: state.currentTime || 0,
        });
      }
      if (state.playState === 'playing' && typeof player.playVideo === 'function') {
        setTimeout(() => {
          remoteActionUntil.current = Date.now() + 1200;
          player.playVideo();
        }, 300);
      } else if (state.playState === 'paused' && typeof player.pauseVideo === 'function') {
        setTimeout(() => {
          remoteActionUntil.current = Date.now() + 1200;
          player.pauseVideo();
        }, 300);
      }
      return;
    }

    // HOST & ENDED STREAM: Host is source of truth during broadcast, and ended stream allows free local replay.
    // Never overwrite the seek position or force pause when state.status === 'ended'.
    if (userRole === 'host' || state.status === 'ended') {
      return;
    }

    // B. Seek position sync for Viewers/Moderators
    const localTime = (typeof player.getCurrentTime === 'function' && player.getCurrentTime()) || 0;
    const elapsedSinceState = state.playState === 'playing'
      ? Math.max(0, (Date.now() - (stateReceivedAt || Date.now())) / 1000)
      : 0;
    const targetTime = (state.currentTime || 0) + elapsedSinceState;
    
    if (window.isDvrMode) {
      // Push back if they scrubbed PAST the live edge
      if (localTime > targetTime + 2.0 && typeof player.seekTo === 'function') {
        player.seekTo(targetTime, true);
        window.isDvrMode = false;
        setIsDvrMode(false);
      }
    } else {
      if (Math.abs(localTime - targetTime) > 3.0 && typeof player.seekTo === 'function') {
        player.seekTo(targetTime, true);
      }
    }

    // C. Strict Play / Pause state sync
    const currentState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
    if (state.playState === 'playing') {
      if (currentState !== 1 && typeof player.playVideo === 'function') {
        player.playVideo();
      }
    } else if (state.playState === 'paused') {
      if (currentState !== 2 && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }
    }
  };

  // 5. Synchronize whenever roomState changes from Socket events
  useEffect(() => {
    if (isPlayerReady && playerRef.current && roomState) {
      syncPlayerToState(playerRef.current, roomState);
    }
  }, [roomState?.videoId, roomState?.playState, roomState?.currentTime, isPlayerReady, stateReceivedAt]);

  if (!roomState?.videoId) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 shadow-xl">
          <PlaySquare className="w-8 h-8" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
          {canControl ? 'No Video Selected' : 'Waiting for Host'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
          {canControl
            ? 'Paste a YouTube video link below to start your Live Watch Party.'
            : 'The host has not started a video yet. Playback will begin as soon as a video link is added.'}
        </p>
      </div>
    );
  }

  const handleScreenClick = () => {
    if (!window.ytPlayer) return;
    const state = typeof window.ytPlayer.getPlayerState === 'function' ? window.ytPlayer.getPlayerState() : -1;
    if (canControl && roomState?.status !== 'ended') {
      const curTime = typeof window.ytPlayer.getCurrentTime === 'function' ? window.ytPlayer.getCurrentTime() : roomState?.currentTime || 0;
      if (state === 1) {
        window.ytPlayer.pauseVideo?.();
        pauseVideo(curTime);
      } else {
        window.ytPlayer.playVideo?.();
        playVideo(curTime);
      }
    } else {
      if (state === 1) {
        window.ytPlayer.pauseVideo?.();
        if (roomState?.status !== 'ended') {
          window.isDvrMode = true;
          setIsDvrMode(true);
        }
      } else {
        window.ytPlayer.playVideo?.();
      }
    }
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
      <div id="youtube-iframe-container" className="w-full h-full pointer-events-none" />

      {/* Transparent Click Overlay to Play/Pause on video click without YouTube popup buttons */}
      <div 
        onClick={handleScreenClick} 
        className="absolute inset-0 z-10 cursor-pointer" 
        title="Click to Play / Pause"
      />

      {/* Video Player Error Alert */}
      {playerError && (
        <div className="absolute inset-0 z-20 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3 text-2xl font-bold">
            ⚠️
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Playback Error</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-4">{playerError}</p>
          <span className="text-[11px] text-slate-400">Please try pasting a different YouTube video URL.</span>
        </div>
      )}

      {/* Video Overlay Info */}
      <div 
        onClick={isDvrMode ? jumpToLive : undefined}
        className={`absolute top-4 left-4 z-20 px-3 py-1.5 rounded-lg border flex items-center gap-3 shadow-lg transition-colors ${
          isDvrMode 
            ? "bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 cursor-pointer" 
            : "bg-slate-900 border-slate-700/50 cursor-default"
        }`}
      >
        <div className={`flex items-center gap-2 border-r pr-3 ${isDvrMode ? "border-slate-600" : "border-slate-700"}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${isDvrMode ? "bg-slate-500" : "bg-rose-500 animate-pulse"}`} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDvrMode ? "text-slate-400" : "text-rose-500"}`}>
            {isDvrMode ? 'GO LIVE' : liveDuration}
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-200 truncate max-w-[200px] sm:max-w-xs">
          {roomState?.videoTitle || 'YouTube Watch Party'}
        </span>
      </div>
    </div>
  );
};
