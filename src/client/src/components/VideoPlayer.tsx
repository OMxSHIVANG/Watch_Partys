import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { extractYouTubeId } from '../../../shared/youtube';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoPlayer: React.FC = () => {
  const { roomState, userRole, playVideo, pauseVideo, seekVideo, changeVideo } = useSocket();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRemoteAction = useRef<boolean>(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const canControl = userRole === 'host' || userRole === 'moderator';

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

  // 2. Handle YouTube Player State Change Events (Local User Actions)
  const handlePlayerStateChange = (event: any) => {
    if (isRemoteAction.current) {
      isRemoteAction.current = false;
      return;
    }

    if (!canControl) return; // Ignore user events if restricted

    const player = event.target;
    const playerState = event.data;

    // YT.PlayerState: PLAYING=1, PAUSED=2, BUFFERING=3, ENDED=0
    if (playerState === 1) {
      playVideo();
    } else if (playerState === 2) {
      pauseVideo();
    }
  };

  // 3. Helper to synchronize player with backend RoomState
  const syncPlayerToState = (player: any, state: any) => {
    if (!player || typeof player.getPlayerState !== 'function') return;

    isRemoteAction.current = true;

    const currentVideo = player.getVideoData ? player.getVideoData().video_id : '';

    // A. Video ID sync
    if (state.videoId && state.videoId !== currentVideo) {
      player.loadVideoById({
        videoId: state.videoId,
        startSeconds: state.currentTime || 0,
      });
      return;
    }

    // B. Seek position sync (if drift > 2.0 seconds)
    const localTime = player.getCurrentTime() || 0;
    const targetTime = state.currentTime || 0;

    if (Math.abs(localTime - targetTime) > 2.0) {
      player.seekTo(targetTime, true);
    }

    // C. Play / Pause state sync
    const currentState = player.getPlayerState();
    if (state.playState === 'playing' && currentState !== 1) {
      player.playVideo();
    } else if (state.playState === 'paused' && currentState !== 2) {
      player.pauseVideo();
    }
  };

  // 4. Synchronize whenever roomState changes from Socket events
  useEffect(() => {
    if (isPlayerReady && playerRef.current && roomState) {
      syncPlayerToState(playerRef.current, roomState);
    }
  }, [roomState?.videoId, roomState?.playState, roomState?.currentTime, isPlayerReady]);

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
      <div id="youtube-iframe-container" className="w-full h-full" />

      {/* Video Overlay Info */}
      <div className="absolute top-4 left-4 z-10 glass-panel px-3 py-1.5 rounded-lg border border-slate-700/50 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-xs font-semibold text-slate-200 truncate max-w-[280px] sm:max-w-xs">
          {roomState?.videoTitle || 'YouTube Watch Party'}
        </span>
      </div>
    </div>
  );
};
