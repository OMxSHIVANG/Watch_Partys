import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoPlayer: React.FC = () => {
  const { roomState, stateReceivedAt, userRole, playVideo, pauseVideo, seekVideo, playNext } = useSocket();
  const playerRef = useRef<any>(null);
  const isRemoteAction = useRef<boolean>(false);
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

  // 1. Initialize YouTube IFrame API
  useEffect(() => {
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
      if (playerRef.current) return;

      const initialId = roomState?.videoId || 'L_LUpnjgPso';
      lastLoadedVideoId.current = initialId;

      playerRef.current = new window.YT.Player('youtube-iframe-container', {

        height: '100%',
        width: '100%',
        videoId: initialId,
        playerVars: {
          autoplay: 1,
          controls: canControl ? 1 : 0, // Hide native controls for participants to enforce RBAC!
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: any) => {
            
            setIsPlayerReady(true);
            if (roomState) {
              syncPlayerToState(event.target, roomState);
            }
          },
          
          onStateChange: handlePlayerStateChange,
          onError: handlePlayerError,
        },
      });
    }
    
    return () => {
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

  // 6. Native Boundary Enforcement & Host Sync Loop
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !roomState) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (typeof player.getCurrentTime !== 'function') return;

      const localTime = player.getCurrentTime();
      
      const serverTime = roomState.playState === 'playing'
        ? (roomState.currentTime || 0) + (Date.now() - (stateReceivedAt || Date.now())) / 1000
        : (roomState.currentTime || 0);

      if (userRole === 'host') {
        // HOST: Update server if drifted
        if (Math.abs(localTime - serverTime) > 2.0) {
           seekVideo(localTime);
        }
        return;
      }

      // VIEWER & MODERATOR: Boundary Enforcement
      if (localTime > serverTime + 1.0) {
        if (typeof player.seekTo === 'function') {
          player.seekTo(serverTime, true);
          // @ts-ignore
          window.isDvrMode = false; 
        }
      } else if (localTime < serverTime - 2.0) {
        // Viewer scrubbed backward natively
        // @ts-ignore
        window.isDvrMode = true;
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlayerReady, canControl, roomState, stateReceivedAt]);

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
  const stateRef = useRef({ canControl, userRole, playVideo, pauseVideo, playNext });
  useEffect(() => {
    stateRef.current = { canControl, userRole, playVideo, pauseVideo, playNext };
  }, [canControl, userRole, playVideo, pauseVideo, playNext]);

  const handlePlayerStateChange = (event: any) => {
    if (isRemoteAction.current) {
      isRemoteAction.current = false;
      return;
    }

    const { canControl, userRole, playVideo, pauseVideo, playNext } = stateRef.current;

    if (!canControl) return; // Ignore user events if restricted

    const playerState = event.data;

    // YT.PlayerState: PLAYING=1, PAUSED=2, BUFFERING=3, ENDED=0
    if (playerState === 1) {
      playVideo();
    } else if (playerState === 2) {
      pauseVideo();
    } else if (playerState === 0 && userRole === 'host') {
      playNext();
    }
  };

  // 4. Helper to synchronize player with backend RoomState
  const syncPlayerToState = (player: any, state: any) => {
    if (!player || typeof player.getPlayerState !== 'function') return;

    setPlayerError(null);
    isRemoteAction.current = true;

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
        setTimeout(() => player.playVideo(), 300);
      }
      return;
    }

    // B. Seek position sync (if drift > 2.0 seconds)
    const localTime = (typeof player.getCurrentTime === 'function' && player.getCurrentTime()) || 0;
    const targetTime = state.currentTime || 0;
    
    // @ts-ignore
    if (window.isDvrMode) {
      // Push back if they scrubbed PAST the live edge
      if (localTime > targetTime + 2.0 && typeof player.seekTo === 'function') {
        player.seekTo(targetTime, true);
        // @ts-ignore
        window.isDvrMode = false;
      }
    } else {
      if (Math.abs(localTime - targetTime) > 2.0 && typeof player.seekTo === 'function') {
        player.seekTo(targetTime, true);
      }
    }

    // C. Play / Pause state sync
    const currentState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
    if (state.playState === 'playing' && currentState !== 1 && typeof player.playVideo === 'function') {
      player.playVideo();
    } else if (state.playState === 'paused' && currentState !== 2 && typeof player.pauseVideo === 'function') {
      player.pauseVideo();
    }
  };

  // 5. Synchronize whenever roomState changes from Socket events
  useEffect(() => {
    if (isPlayerReady && playerRef.current && roomState) {
      syncPlayerToState(playerRef.current, roomState);
    }
  }, [roomState?.videoId, roomState?.playState, roomState?.currentTime, isPlayerReady]);

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
      <div id="youtube-iframe-container" className="w-full h-full" />

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
        className={`absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg border flex items-center gap-3 shadow-lg transition-colors ${
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
